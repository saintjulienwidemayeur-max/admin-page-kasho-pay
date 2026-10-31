// Admin > Customers: search, a customer's wallet / cards / transactions, add or remove money, suspend.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, MinusCircle, PlusCircle, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { adminAdjustBalance, adminGetUser, adminListUsers, adminSetUserBlocked, type AdminRole, type AdminUserDetail } from "@/lib/api";
import { cleanAmount, errorMessage } from "@/lib/format";
import { useClosingDialog } from "@/lib/layers";
import { cn } from "@/lib/utils";
import { CARD_STATUS_LABELS, Empty, ErrorBox, KIND_LABELS, Loading, Pager, PasswordConfirm, Pill, Section, Stat, cardStatusTone, money, passwordError, signTone, statusTone, toneClass, when } from "./shared";

const kycLabel = (s: string) => (s === "verified" ? "Verified" : s === "pending" ? "Pending" : s === "rejected" ? "Rejected" : "Not verified");

export function UsersTab({ role }: { role: AdminRole }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const query = useQuery({ queryKey: ["admin", "users", search, page], queryFn: () => adminListUsers({ data: { q: search || undefined, page, pageSize: 25 } }), placeholderData: (prev) => prev });
  const data = query.data;

  return (
    <Section title="Customers" description="Search by name, e-mail, @username, Kasho ID or phone number. Newest customers first.">
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search customers" placeholder="Search customers" className="h-11 rounded-xl pl-9" value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      {query.isPending ? <Loading /> : query.isError ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : data && (
        data.users.length === 0 ? <Empty>No customer found.</Empty> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">E-mail</th><th className="px-3 py-2 font-medium">Identity</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th><th className="px-3 py-2 text-right font-medium">Cards</th><th className="px-3 py-2 font-medium">Joined</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {data.users.map((u) => (
                    <tr key={u.id} tabIndex={0} role="button" aria-label={`Open ${u.name}`} className="cursor-pointer transition hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none"
                      onClick={() => setOpen(u.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(u.id); } }}>
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{u.name}</span>
                        <span className="ml-2 inline-flex gap-1 align-middle">
                          {u.banned && <Pill tone="bad">Suspended</Pill>}
                          {u.adminRole && <Pill tone="good">{u.adminRole === "super" ? "Super admin" : "Admin"}</Pill>}
                        </span>
                        <span className="block text-xs text-muted-foreground">{u.kashoId ?? ""}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{u.email}</td>
                      <td className="px-3 py-2.5"><Pill tone={statusTone(u.kycStatus)}>{kycLabel(u.kycStatus)}</Pill></td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(u.balance)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{u.cards}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )
      )}
      {open && <UserSheet key={open} userId={open} role={role} onClose={() => setOpen(null)} />}
    </Section>
  );
}

// ------------------------------------------------------------------ one customer
export function UserSheet({ userId, role, onClose }: { userId: string; role: AdminRole; onClose: () => void }) {
  const qc = useQueryClient();
  const { open, close } = useClosingDialog(onClose);
  const [moving, setMoving] = useState<"credit" | "debit" | null>(null);
  const [suspend, setSuspend] = useState<boolean | null>(null);
  const query = useQuery({ queryKey: ["admin", "user", userId], queryFn: () => adminGetUser({ data: { userId } }) });
  const u = query.data;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["admin"] }); };
  const canMove = role === "super" && !!u && !u.adminRole;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>{u?.profile.name ?? "Customer"}</SheetTitle>
            <SheetDescription>{u?.email ?? "Loading the customer..."}</SheetDescription>
          </SheetHeader>
          {query.isPending ? <Loading /> : query.isError ? <div className="mt-4"><ErrorBox error={query.error} onRetry={() => void query.refetch()} /></div> : u && (
            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Pill tone={statusTone(u.profile.kycStatus)}>{kycLabel(u.profile.kycStatus)}</Pill>
                {u.banned && <Pill tone="bad">Suspended</Pill>}
                {u.adminRole && <Pill tone="good">{u.adminRole === "super" ? "Super admin" : "Admin"}</Pill>}
                <Pill>{u.profile.kashoId ?? "-"}</Pill>
              </div>

              <Stat label="Wallet balance" value={money(u.balance)} className="bg-primary/10 ring-1 ring-primary/30" tone="good" />

              {role === "super" && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button disabled={!canMove} onClick={() => setMoving("credit")}><PlusCircle className="h-4 w-4" /> Add money</Button>
                  <Button variant="outline" disabled={!canMove} onClick={() => setMoving("debit")}><MinusCircle className="h-4 w-4" /> Remove money</Button>
                  <Button variant="outline" disabled={!!u.adminRole} className={u.banned ? "" : "text-destructive hover:text-destructive"} onClick={() => setSuspend(!u.banned)}>
                    {u.banned ? <><ShieldCheck className="h-4 w-4" /> Reactivate</> : <><Ban className="h-4 w-4" /> Suspend</>}
                  </Button>
                </div>
              )}
              {u.adminRole && role === "super" && <p className="text-xs text-muted-foreground">Administrator accounts cannot be adjusted or suspended here.</p>}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border p-4 text-sm">
                {[["Name", `${u.profile.firstName} ${u.profile.lastName}`.trim() || "-"], ["Username", `@${u.profile.username}`], ["Phone", u.profile.phone || "-"], ["Country", u.profile.country || "-"], ["Joined", when(u.createdAt)], ["Last sign-in", when(u.lastSignInAt)]].map(([k, v]) => (
                  <div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate font-medium">{v}</dd></div>
                ))}
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Cards</h3>
                {u.cards.length === 0 ? <p className="text-sm text-muted-foreground">No cards.</p> : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {u.cards.map((k) => (
                      <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <span className="min-w-0"><span className="font-medium">{k.label}</span><span className="block text-xs text-muted-foreground">{`${k.brand} •••• ${k.last4}`}</span></span>
                        <span className="flex items-center gap-3"><Pill tone={cardStatusTone(k.status)}>{CARD_STATUS_LABELS[k.status] ?? k.status}</Pill><span className="font-semibold tabular-nums">{money(k.balance)}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Latest transactions</h3>
                {u.transactions.length === 0 ? <p className="text-sm text-muted-foreground">No transactions yet.</p> : <TxList items={u.transactions} />}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* One window at a time on top of the panel; each one is only in the page while it is needed. */}
      {moving && u && <MoveMoneyDialog user={u} direction={moving} onClose={() => setMoving(null)} onDone={refresh} />}
      {suspend !== null && u && <SuspendDialog userId={u.id} suspend={suspend} onClose={() => setSuspend(null)} onDone={refresh} />}
    </>
  );
}

export function TxList({ items }: { items: AdminUserDetail["transactions"] }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {items.map((t) => (
        <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-medium">{t.title}</span>
            <span className="block text-xs text-muted-foreground">{`${KIND_LABELS[t.kind] ?? t.kind} · ${new Date(t.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}</span>
            {t.note && <span className="block text-xs text-muted-foreground">{t.note}</span>}
          </span>
          <span className="shrink-0 text-right">
            <span className={cn("block font-semibold tabular-nums", toneClass(signTone(t.amount)))}>{money(t.amount, { sign: true })}</span>
            {t.fee > 0 && <span className="block text-xs text-muted-foreground">{`Fee ${money(t.fee)}`}</span>}
            <Pill tone={statusTone(t.status)}>{t.status}</Pill>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ add / remove money
function MoveMoneyDialog({ user, direction, onClose, onDone }: { user: AdminUserDetail; direction: "credit" | "debit"; onClose: () => void; onDone: () => void }) {
  const { open, close } = useClosingDialog(onClose);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);
  const credit = direction === "credit";
  const n = Number(amount);
  const valid = n >= 0.01 && note.trim().length >= 3 && password.length > 0 && (credit || n <= user.balance + 0.0001);
  const after = credit ? user.balance + (n || 0) : user.balance - (n || 0);

  const submit = async () => {
    setBusy(true);
    setPwError("");
    try {
      const res = await adminAdjustBalance({ data: { userId: user.id, direction, amountUsd: n, note: note.trim(), confirmPassword: password } });
      toast.success(`${credit ? "Added" : "Removed"} ${money(n)}. New balance ${money(res.balanceAfter)}`);
      onDone();
      close(); // the window closes with its animation, then the screen forgets about it
    } catch (e) {
      const bad = passwordError(e);
      if (bad) { setPassword(""); setPwError(bad); } else toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) close(); }}>
      <DialogContent className="rounded-2xl">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void submit(); }}>
          <DialogHeader>
            <DialogTitle>{credit ? "Add money" : "Remove money"}</DialogTitle>
            <DialogDescription>{`${user.profile.name}, balance ${money(user.balance)}. The customer gets a notification and the change appears in their history.`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mv-amount">Amount (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="mv-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" className="h-11 rounded-xl pl-7" value={amount} onChange={(e) => setAmount(cleanAmount(e.target.value))} />
            </div>
            {!credit && n > user.balance && <p className="text-xs text-destructive">That is more than the customer's balance.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-note">Reason (kept in the audit log)</Label>
            <Textarea id="mv-note" maxLength={200} rows={3} placeholder={credit ? "Example: refund of a failed MonCash payment" : "Example: correction of a duplicate credit"} className="rounded-xl" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <PasswordConfirm value={password} onChange={(p) => { setPassword(p); setPwError(""); }} error={pwError} busy={busy} />
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            New balance: <b className="text-foreground">{money(after)}</b>. This moves money inside Kasho Pay only: it does not change anything at Freda.
          </p>
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl" variant={credit ? "default" : "destructive"} disabled={!valid || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {n >= 0.01 ? `${credit ? "Add" : "Remove"} ${money(n)}` : credit ? "Add money" : "Remove money"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ suspend / reactivate
function SuspendDialog({ userId, suspend, onClose, onDone }: { userId: string; suspend: boolean; onClose: () => void; onDone: () => void }) {
  const { open, close } = useClosingDialog(onClose);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setPwError("");
    try {
      await adminSetUserBlocked({ data: { userId, blocked: suspend, confirmPassword: password } });
      toast.success(suspend ? "Customer suspended" : "Customer reactivated");
      onDone();
      close();
    } catch (e) {
      const bad = passwordError(e);
      if (bad) { setPassword(""); setPwError(bad); } else toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !busy) close(); }}>
      <AlertDialogContent className="rounded-2xl" onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById("confirm-pw")?.focus(); }}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (password && !busy) void submit(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>{suspend ? "Suspend this customer?" : "Reactivate this customer?"}</AlertDialogTitle>
            <AlertDialogDescription>{suspend ? "They are signed out of every request at once and cannot sign in again until you reactivate them. Their money stays where it is." : "They can sign in and use Kasho Pay again."}</AlertDialogDescription>
          </AlertDialogHeader>
          <PasswordConfirm value={password} onChange={(v) => { setPassword(v); setPwError(""); }} error={pwError} busy={busy} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>Cancel</AlertDialogCancel>
            <Button type="submit" variant={suspend ? "destructive" : "default"} disabled={!password || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {suspend ? "Suspend" : "Reactivate"}</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
