// Admin > Fees: what customers pay for each operation. (No profit or margin figures: see the README.)
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { adminDeleteFee, adminListFees, adminSaveFee, type AdminFeeRule, type FeeOperation } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useClosingDialog } from "@/lib/layers";
import { Empty, ErrorBox, FEE_OPERATION_LABELS, Loading, PasswordConfirm, Pill, Section, money, passwordError } from "./shared";

const OPS: FeeOperation[] = ["wallet_deposit", "wallet_withdrawal", "card_creation", "card_fund", "card_withdraw", "transfer"];

export function FeesTab() {
  const fees = useQuery({ queryKey: ["admin", "fees"], queryFn: adminListFees });
  if (fees.isPending) return <Loading />;
  if (fees.isError) return <ErrorBox error={fees.error} onRetry={() => void fees.refetch()} />;
  return <CustomerFees rules={fees.data.rules} tiered={fees.data.tiered} />;
}

const describeFee = (r: AdminFeeRule) => (r.feeType === "percent" ? `${r.feeValue}%` : money(r.feeValue));
const describeBracket = (r: AdminFeeRule) => (r.minAmount === null || r.maxAmount === null ? "Any amount" : `${money(r.minAmount)} to ${money(r.maxAmount)}`);

function CustomerFees({ rules, tiered }: { rules: AdminFeeRule[]; tiered: FeeOperation[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminFeeRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminFeeRule | null>(null);
  const sorted = [...rules].sort((a, b) => OPS.indexOf(a.operation) - OPS.indexOf(b.operation) || (a.minAmount ?? 0) - (b.minAmount ?? 0));

  return (
    <Section
      title="What customers pay (our fee schedule)"
      description="Changes apply to the next operation, right away. Your password is asked again for every change."
      action={<Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add a fee</Button>}
    >
      {sorted.length === 0 ? <Empty>No fee rules yet.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Operation</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 text-right font-medium">Fee</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-border">
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5 font-medium">{FEE_OPERATION_LABELS[r.operation]}{r.label && <span className="ml-2 text-xs font-normal text-muted-foreground">{r.label}</span>}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{describeBracket(r)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{describeFee(r)}</td>
                  <td className="px-3 py-2.5">{r.active ? <Pill tone="good">Enabled</Pill> : <Pill>Disabled</Pill>}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" size="icon" aria-label="Edit fee" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete fee" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <FeeDialog rule={editing === "new" ? null : editing} tiered={tiered} onClose={() => setEditing(null)} />}
      {deleting && <DeleteFeeDialog rule={deleting} onClose={() => setDeleting(null)} />}
    </Section>
  );
}

function DeleteFeeDialog({ rule, onClose }: { rule: AdminFeeRule; onClose: () => void }) {
  const qc = useQueryClient();
  const { open, close } = useClosingDialog(onClose);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    setPwError("");
    try {
      await adminDeleteFee({ data: { id: rule.id, confirmPassword: password } });
      toast.success("Fee removed");
      void qc.invalidateQueries({ queryKey: ["admin"] });
      close();
    } catch (e) {
      const bad = passwordError(e);
      if (bad) { setPassword(""); setPwError(bad); } else toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !busy) close(); }}>
      <AlertDialogContent className="rounded-2xl" onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById("confirm-pw")?.focus(); }}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (password && !busy) void remove(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this fee?</AlertDialogTitle>
            <AlertDialogDescription>
              {`${FEE_OPERATION_LABELS[rule.operation]}, ${describeBracket(rule)}, ${describeFee(rule)}. Without a fee for an amount, customers cannot do that operation.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <PasswordConfirm value={password} onChange={(v) => { setPassword(v); setPwError(""); }} error={pwError} busy={busy} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>Keep it</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!password || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Remove</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FeeDialog({ rule, tiered, onClose }: { rule: AdminFeeRule | null; tiered: FeeOperation[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { open, close } = useClosingDialog(onClose);
  const [operation, setOperation] = useState<FeeOperation>(rule?.operation ?? "wallet_deposit");
  const [label, setLabel] = useState(rule?.label ?? "");
  const [feeType, setFeeType] = useState<"flat" | "percent">(rule?.feeType ?? "flat");
  const [min, setMin] = useState(rule?.minAmount === null || rule?.minAmount === undefined ? "" : String(rule.minAmount));
  const [max, setMax] = useState(rule?.maxAmount === null || rule?.maxAmount === undefined ? "" : String(rule.maxAmount));
  const [value, setValue] = useState(rule ? String(rule.feeValue) : "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);
  const isTiered = tiered.includes(operation);
  const v = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(v) && v >= 0 && (!isTiered || (min.trim() !== "" && max.trim() !== "" && Number(max) >= Number(min))) && password.length > 0;

  const save = async () => {
    setBusy(true);
    setPwError("");
    try {
      await adminSaveFee({ data: {
        id: rule?.id, operation, label: label.trim(), feeType, minAmount: isTiered ? Number(min) : null, maxAmount: isTiered ? Number(max) : null,
        feeValue: v, active, confirmPassword: password,
      } });
      toast.success("Fee saved");
      void qc.invalidateQueries({ queryKey: ["admin"] });
      close();
    } catch (e) {
      const bad = passwordError(e);
      if (bad) { setPassword(""); setPwError(bad); } else toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) close(); }}>
      <DialogContent className="rounded-2xl">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void save(); }}>
          <DialogHeader>
            <DialogTitle>{rule ? "Edit fee" : "Add a fee"}</DialogTitle>
            <DialogDescription>Top-ups and withdrawals have one fee per amount range. The other operations have a single fee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Operation</Label>
            <Select value={operation} onValueChange={(o) => setOperation(o as FeeOperation)} disabled={!!rule}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{OPS.map((o) => <SelectItem key={o} value={o}>{FEE_OPERATION_LABELS[o]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isTiered && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="fee-min">From ($)</Label><Input id="fee-min" inputMode="decimal" className="h-11 rounded-xl" value={min} onChange={(e) => setMin(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="fee-max">To ($)</Label><Input id="fee-max" inputMode="decimal" className="h-11 rounded-xl" value={max} onChange={(e) => setMax(e.target.value)} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={feeType} onValueChange={(t) => setFeeType(t as "flat" | "percent")}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="flat">Fixed amount ($)</SelectItem><SelectItem value="percent">Percentage (%)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="fee-value">{feeType === "flat" ? "Fee ($)" : "Fee (%)"}</Label><Input id="fee-value" inputMode="decimal" className="h-11 rounded-xl" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="fee-label">Note (optional)</Label><Input id="fee-label" maxLength={80} className="h-11 rounded-xl" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">Enabled<Switch checked={active} onCheckedChange={setActive} type="button" /></label>
          <PasswordConfirm value={password} onChange={(p) => { setPassword(p); setPwError(""); }} error={pwError} busy={busy} />
          <DialogFooter><Button type="submit" className="w-full rounded-xl" disabled={!valid || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save fee</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
