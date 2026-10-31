// Admin > Cards: every card the platform issued, with its owner (read only). No card number or CVV exists in the system.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminGetCard, adminListCards, type AdminRole, type CardStatus } from "@/lib/api";
import { useClosingDialog } from "@/lib/layers";
import { CARD_STATUS_LABELS, Empty, ErrorBox, KIND_LABELS, Loading, Pager, Pill, Section, Stat, cardStatusTone, money, signTone, statusTone, toneClass, when } from "./shared";
import { UserSheet } from "./users";

const STATES: CardStatus[] = ["active", "disabled", "pending", "failed", "terminated"];
const PURCHASE_LABELS: Record<string, string> = { DEBIT: "Purchase", CREDIT: "Credit", REFUND: "Refund", REVERSAL: "Reversal", DECLINE: "Declined", DECLINED: "Declined" };
const brandName = (b: string) => (b === "MASTERCARD" ? "Mastercard" : b === "VISA" ? "Visa" : b);
const date = (iso: string) => new Date(iso).toLocaleDateString([], { dateStyle: "medium" });

export function CardsTab({ role }: { role: AdminRole }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | CardStatus>("all");
  const [brand, setBrand] = useState<"all" | "VISA" | "MASTERCARD">("all");
  const [page, setPage] = useState(1);
  const [card, setCard] = useState<string | null>(null);
  const [customer, setCustomer] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const query = useQuery({
    queryKey: ["admin", "cards", search, status, brand, page],
    queryFn: () => adminListCards({ data: { q: search || undefined, status: status === "all" ? undefined : status, brand: brand === "all" ? undefined : brand, page, pageSize: 25 } }),
    placeholderData: (prev) => prev,
  });
  const data = query.data;
  const sum = data?.summary;

  return (
    <div className="space-y-6">
      {sum && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Cards issued" value={sum.total} sub={`${sum.terminated} terminated · ${sum.failed} failed`} />
          <Stat label="Active cards" value={sum.active} tone="good" />
          <Stat label="Frozen cards" value={sum.frozen} tone={sum.frozen ? "warn" : "plain"} />
          <Stat label="Pending cards" value={sum.pending} tone={sum.pending ? "warn" : "plain"} sub={sum.pending ? "Waiting for Freda" : "None waiting"} />
          <Stat label="Money on cards" value={money(sum.balance)} sub="Active and frozen cards" />
        </div>
      )}
      <Section title="All cards" description="Search by card name, last 4 digits, reference, or the customer's name, @username or Kasho ID. Newest first.">
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search cards" placeholder="Search cards" className="h-11 rounded-xl pl-9" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as "all" | CardStatus); setPage(1); }}>
            <SelectTrigger className="h-11 rounded-xl" aria-label="State"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All states</SelectItem>{STATES.map((s) => <SelectItem key={s} value={s}>{CARD_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={brand} onValueChange={(v) => { setBrand(v as "all" | "VISA" | "MASTERCARD"); setPage(1); }}>
            <SelectTrigger className="h-11 rounded-xl" aria-label="Brand"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All brands</SelectItem><SelectItem value="VISA">Visa</SelectItem><SelectItem value="MASTERCARD">Mastercard</SelectItem></SelectContent>
          </Select>
        </div>
        {query.isPending ? <Loading /> : query.isError ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : data && (
          data.items.length === 0 ? <Empty>No card found.</Empty> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Card</th><th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">State</th>
                    <th className="px-3 py-2 text-right font-medium">Balance</th><th className="px-3 py-2 font-medium">Created</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((c) => (
                      <tr key={c.id} tabIndex={0} role="button" aria-label={`Open card ${c.label}`} className="cursor-pointer transition hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none"
                        onClick={() => setCard(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCard(c.id); } }}>
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{c.label || "Card"}</span>
                          <span className="block text-xs text-muted-foreground">{`${brandName(c.brand)} •••• ${c.last4 || "----"}${c.expiry ? ` · ${c.expiry}` : ""}`}</span>
                        </td>
                        <td className="px-3 py-2.5"><span className="font-medium">{c.customer || "-"}</span><span className="block text-xs text-muted-foreground">{c.kashoId ?? ""}</span></td>
                        <td className="px-3 py-2.5"><span className="inline-flex flex-wrap gap-1"><Pill tone={cardStatusTone(c.status)}>{CARD_STATUS_LABELS[c.status] ?? c.status}</Pill>{c.hidden && <Pill>Hidden by customer</Pill>}</span></td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(c.balance)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{date(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </>
          )
        )}
      </Section>
      {/* One side panel at a time: "Open customer" closes the card panel first, then opens the customer's. */}
      {card && <CardSheet key={card} cardId={card} onClose={() => setCard(null)} onOpenCustomer={setCustomer} />}
      {customer && <UserSheet key={customer} userId={customer} role={role} onClose={() => setCustomer(null)} />}
    </div>
  );
}

function CardSheet({ cardId, onClose, onOpenCustomer }: { cardId: string; onClose: () => void; onOpenCustomer: (userId: string) => void }) {
  const next = useRef<string | null>(null); // the owner to open once this panel is gone
  const { open, close } = useClosingDialog(() => { onClose(); if (next.current) onOpenCustomer(next.current); });
  const query = useQuery({ queryKey: ["admin", "card", cardId], queryFn: () => adminGetCard({ data: { cardId } }) });
  const c = query.data;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{c?.label || "Card"}</SheetTitle>
          <SheetDescription>{c ? `${brandName(c.brand)} •••• ${c.last4 || "----"}` : "Loading the card..."}</SheetDescription>
        </SheetHeader>
        {query.isPending ? <Loading /> : query.isError ? <div className="mt-4"><ErrorBox error={query.error} onRetry={() => void query.refetch()} /></div> : c && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Pill tone={cardStatusTone(c.status)}>{CARD_STATUS_LABELS[c.status] ?? c.status}</Pill>
              {c.hidden && <Pill>Hidden by customer</Pill>}
            </div>
            <Stat label="Balance on the card" value={money(c.balance)} className="bg-primary/10 ring-1 ring-primary/30" tone="good" />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border p-4 text-sm">
              {[["Brand", brandName(c.brand)], ["Last 4 digits", c.last4 || "-"], ["Expires", c.expiry || "-"], ["Created", when(c.createdAt)], ["Reference", c.reference || "-"], ["Freda card id", c.fredaCardId ?? "-"]].map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd data-no-i18n={k === "Reference" || k === "Freda card id" || k === "Last 4 digits" ? true : undefined} className="truncate font-medium">{v}</dd></div>
              ))}
            </dl>

            <div className="rounded-xl border border-border p-4 text-sm">
              <h3 className="mb-2 text-sm font-semibold">Owner</h3>
              <p className="font-medium">{c.owner.name || "-"}</p>
              <p className="text-xs text-muted-foreground">{[c.owner.kashoId, c.owner.username ? `@${c.owner.username}` : "", c.owner.email].filter(Boolean).join(" · ")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2"><Pill tone={statusTone(c.owner.kycStatus)}>{c.owner.kycStatus === "verified" ? "Verified" : c.owner.kycStatus === "pending" ? "Pending" : c.owner.kycStatus === "rejected" ? "Rejected" : "Not verified"}</Pill></div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { next.current = c.owner.id; close(); }}><User className="h-4 w-4" /> Open customer</Button>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Money moved to and from this card</h3>
              {c.transactions.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {c.transactions.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.title}</span>
                        <span className="block text-xs text-muted-foreground">{`${KIND_LABELS[t.kind] ?? t.kind} · ${when(t.createdAt)}`}</span>
                        {t.note && <span className="block text-xs text-muted-foreground">{t.note}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block font-semibold tabular-nums ${toneClass(signTone(t.amount))}`}>{money(t.amount, { sign: true })}</span>
                        {t.fee > 0 && <span className="block text-xs text-muted-foreground">{`Fee ${money(t.fee)}`}</span>}
                        <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Purchases reported by Freda</h3>
              {c.purchases.length === 0 ? <p className="text-sm text-muted-foreground">No purchase yet.</p> : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {c.purchases.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0"><span className="block font-medium">{PURCHASE_LABELS[e.type.toUpperCase()] ?? e.type}</span><span className="block text-xs text-muted-foreground">{when(e.createdAt)}</span></span>
                      <span className="font-semibold tabular-nums">{money(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
