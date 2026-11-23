// Admin > Benefits: what customers paid in fees, minus what Freda charged. Exact where Freda's real charge was recorded on the operation;
// estimated from the Freda price list (editable here by a super administrator) for the rest. The two are always shown apart.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adminGetProfit, adminSavePartnerCost, type AdminPartnerRule, type AdminProfit, type AdminRole } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useClosingDialog } from "@/lib/layers";
import { cn } from "@/lib/utils";
import { Empty, ErrorBox, Loading, PasswordConfirm, Pill, Section, Stat, money, passwordError, signTone, toneClass, when } from "./shared";

const PERIODS = [{ days: 7, label: "7 days" }, { days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 365, label: "1 year" }] as const;

const OPERATION_LABELS: Record<string, string> = {
  deposit: "Wallet top-up (MonCash / NatCash)", withdrawal: "Wallet withdrawal", card_creation: "Card creation", card_fund: "Card top-up",
  card_withdraw: "Card withdrawal", card_closure: "Card closing", card_purchase: "Card purchase", master_wallet_funding: "Adding money to the Master Wallet",
};

export function ProfitTab({ role }: { role: AdminRole }) {
  const [days, setDays] = useState<number>(30);
  const query = useQuery({ queryKey: ["admin", "profit", days], queryFn: () => adminGetProfit({ data: { days } }), staleTime: 20_000 });
  const data = query.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Period" className="inline-flex rounded-xl border border-border bg-card p-1">
          {PERIODS.map((p) => (
            <button key={p.days} type="button" onClick={() => setDays(p.days)} aria-pressed={days === p.days}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", days === p.days ? "bg-primary text-primary-foreground shadow-neon" : "text-muted-foreground hover:text-foreground")}>
              {p.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>
      {query.isPending ? <Loading /> : query.isError ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : data && (
        <>
          <Summary data={data} />
          <ByOperation data={data} />
          <PriceList data={data} days={days} role={role} />
        </>
      )}
    </div>
  );
}

function Summary({ data }: { data: AdminProfit }) {
  const t = data.totals;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Fees paid by customers" value={money(t.fees)} sub={`${t.count} operation(s)`} />
        <Stat label="Charged by Freda (exact)" value={money(t.costExact)} sub="From the amounts Freda reported" />
        <Stat label="Charged by Freda (estimate)" value={money(t.costEstimated)} sub={`${t.estimatedCount} operation(s) without a recorded charge`} tone={t.costEstimated > 0 ? "warn" : "plain"} />
        <Stat label="Benefit" value={money(t.profit, { sign: true })} tone={signTone(t.profit)} sub={t.costEstimated > 0 ? `Includes an estimate of ${money(t.costEstimated)}` : "Exact"} />
      </div>
      {data.truncated && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">There are too many operations in this period to count them all: choose a shorter period.</p>}
      <p className="text-xs text-muted-foreground">{`From ${when(data.period.from)} to ${when(data.period.to)}. Only completed operations. The benefit is what customers paid in fees minus what Freda charged. It does not include the 4.5 % Freda keeps when you add money to the Master Wallet, nor your own costs.`}</p>
    </div>
  );
}

function ByOperation({ data }: { data: AdminProfit }) {
  return (
    <Section title="Benefit by operation" description='"Exact" is what Freda reported on the operation. "Estimate" comes from the Freda price list below, for what Freda did not report (card creation, card purchases, older operations).'>
      {data.rows.length === 0 ? <Empty>No operation in this period.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Operation</th><th className="px-3 py-2 text-right font-medium">Count</th><th className="px-3 py-2 text-right font-medium">Volume</th>
              <th className="px-3 py-2 text-right font-medium">Fees paid</th><th className="px-3 py-2 text-right font-medium">Freda (exact)</th><th className="px-3 py-2 text-right font-medium">Freda (estimate)</th><th className="px-3 py-2 text-right font-medium">Benefit</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r) => (
                <tr key={r.kind}>
                  <td className="px-3 py-2.5 font-medium">{r.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{money(r.volume)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(r.fees)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(r.costExact)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.estimatedCount > 0 ? `${money(r.costEstimated)} (${r.estimatedCount})` : "-"}</td>
                  <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", toneClass(signTone(r.profit)))}>{money(r.profit, { sign: true })}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-3 py-2.5">Total</td><td className="px-3 py-2.5 text-right tabular-nums">{data.totals.count}</td><td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{money(data.totals.volume)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(data.totals.fees)}</td><td className="px-3 py-2.5 text-right tabular-nums">{money(data.totals.costExact)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{money(data.totals.costEstimated)}</td>
                <td className={cn("px-3 py-2.5 text-right tabular-nums", toneClass(signTone(data.totals.profit)))}>{money(data.totals.profit, { sign: true })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

const describe = (r: AdminPartnerRule) => {
  const parts: string[] = [];
  if (r.thresholdUsd !== null) parts.push(`${money(r.flatUsd)} up to ${money(r.thresholdUsd)}, then ${r.percent}%`);
  else {
    if (r.percent > 0) parts.push(`${r.percent}%`);
    if (r.flatUsd > 0) parts.push(money(r.flatUsd));
    if (r.flatHtg > 0) parts.push(`${r.flatHtg} HTG`);
  }
  return parts.join(" + ") || "Free";
};

function PriceList({ data, days, role }: { data: AdminProfit; days: number; role: AdminRole }) {
  const [editing, setEditing] = useState<AdminPartnerRule | null>(null);
  return (
    <Section title="What Freda charges us (price list)" description="Used to estimate the cost of what Freda did not report. Keep it equal to your Freda plan, and update it when Freda's prices change (for example the new card program).">
      {data.rules.length === 0 ? <Empty>No price yet.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Operation</th><th className="px-3 py-2 font-medium">Freda charges</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-border">
              {data.rules.map((r) => (
                <tr key={r.operation}>
                  <td className="px-3 py-2.5 font-medium">{OPERATION_LABELS[r.operation] ?? r.operation}{r.note && <span className="block text-xs font-normal text-muted-foreground">{r.note}</span>}</td>
                  <td className="px-3 py-2.5 tabular-nums">{describe(r)}</td>
                  <td className="px-3 py-2.5">{r.active ? <Pill tone="good">Used</Pill> : <Pill>Not used</Pill>}</td>
                  <td className="px-3 py-2.5 text-right">{role === "super" && <Button variant="ghost" size="icon" aria-label="Edit price" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <PriceDialog rule={editing} days={days} onClose={() => setEditing(null)} />}
    </Section>
  );
}

function PriceDialog({ rule, days, onClose }: { rule: AdminPartnerRule; days: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { open, close } = useClosingDialog(onClose);
  const [percent, setPercent] = useState(String(rule.percent));
  const [flatUsd, setFlatUsd] = useState(String(rule.flatUsd));
  const [flatHtg, setFlatHtg] = useState(String(rule.flatHtg));
  const [threshold, setThreshold] = useState(rule.thresholdUsd === null ? "" : String(rule.thresholdUsd));
  const [note, setNote] = useState(rule.note);
  const [active, setActive] = useState(rule.active);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);
  const n = (s: string) => Number(s.replace(",", "."));
  const okNum = (s: string, max: number) => s.trim() !== "" && Number.isFinite(n(s)) && n(s) >= 0 && n(s) <= max;
  const valid = okNum(percent, 100) && okNum(flatUsd, 1000) && okNum(flatHtg, 100000) && (threshold.trim() === "" || okNum(threshold, 100000)) && password.length > 0;

  const save = async () => {
    setBusy(true);
    setPwError("");
    try {
      await adminSavePartnerCost({ data: {
        operation: rule.operation, percent: n(percent), flatUsd: n(flatUsd), flatHtg: n(flatHtg), thresholdUsd: threshold.trim() === "" ? null : n(threshold),
        active, note: note.trim(), confirmPassword: password,
      } });
      toast.success("Price saved");
      void qc.invalidateQueries({ queryKey: ["admin", "profit", days] });
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
            <DialogTitle>{OPERATION_LABELS[rule.operation] ?? rule.operation}</DialogTitle>
            <DialogDescription>What Freda charges us for one operation. With a limit, the fixed amount is charged up to it, and the percentage above it.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="pc-percent">Percentage (%)</Label><Input id="pc-percent" inputMode="decimal" className="h-11 rounded-xl" value={percent} onChange={(e) => setPercent(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="pc-usd">Fixed amount ($)</Label><Input id="pc-usd" inputMode="decimal" className="h-11 rounded-xl" value={flatUsd} onChange={(e) => setFlatUsd(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="pc-htg">Fixed amount (HTG)</Label><Input id="pc-htg" inputMode="decimal" className="h-11 rounded-xl" value={flatHtg} onChange={(e) => setFlatHtg(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="pc-limit">Limit ($, optional)</Label><Input id="pc-limit" inputMode="decimal" className="h-11 rounded-xl" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="pc-note">Note (optional)</Label><Input id="pc-note" maxLength={200} className="h-11 rounded-xl" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">Used in the estimates<Switch checked={active} onCheckedChange={setActive} type="button" /></label>
          <PasswordConfirm value={password} onChange={(p) => { setPassword(p); setPwError(""); }} error={pwError} busy={busy} />
          <DialogFooter><Button type="submit" className="w-full rounded-xl" disabled={!valid || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save price</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
