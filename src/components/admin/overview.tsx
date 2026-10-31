// Admin > Overview: the Freda Pay Issuing balances (Master Wallet, Gateway) and what customers hold.
// Real numbers only: no profit or margin figure (see the README).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminFredaFunds, adminOverview, type AdminOverview } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading, Pill, Section, Stat, gourdes, money, percent, when } from "./shared";

const PERIODS = [{ days: 7, label: "7 days" }, { days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 365, label: "1 year" }] as const;

export function OverviewTab() {
  const [days, setDays] = useState<number>(30);
  const query = useQuery({ queryKey: ["admin", "overview", days], queryFn: () => adminOverview({ data: { days } }), staleTime: 20_000 });
  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Period" className="inline-flex rounded-xl border border-border bg-card p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days} type="button" onClick={() => setDays(p.days)} aria-pressed={days === p.days}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", days === p.days ? "bg-primary text-primary-foreground shadow-neon" : "text-muted-foreground hover:text-foreground")}
            >
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
          <FredaFunds data={data} days={days} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 [&>section]:min-w-0">
            <FundsCheck data={data} />
            <Customers data={data} />
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Freda funds
function FredaFunds({ data, days }: { data: AdminOverview; days: number }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const f = data.freda;
  const m = f.master;
  const refresh = async () => {
    setBusy(true); setErr(null);
    try {
      const fresh = await adminFredaFunds();
      qc.setQueryData<AdminOverview>(["admin", "overview", days], (old) => (old ? { ...old, freda: fresh } : old));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Section
      title="Freda Pay Issuing: your money at the partner"
      description="Live balances read from Freda with your API key. The Master Wallet pays for card creations and card top-ups; the Gateway holds what customers paid by MonCash and NatCash."
      action={(
        <div className="flex items-center gap-2">
          {f.mode && <Pill tone={f.mode === "live" ? "good" : "warn"}>{f.mode === "live" ? "Live" : "Sandbox (test money)"}</Pill>}
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Update
          </Button>
        </div>
      )}
    >
      {!f.ok ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>{f.message ?? "Freda balances are not available right now."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {m?.low && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p><b>The Master Wallet is low.</b> Add money to it now, or card creations and card top-ups will be refused.</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              className="bg-primary/10 ring-1 ring-primary/30" label="Master Wallet (USD)" value={m ? money(m.balance) : "-"} tone={m?.low ? "bad" : "good"}
              sub={m ? `Spendable ${money(m.spendable)} · ${money(m.guarantee)} locked as guarantee` : "Not available"}
            />
            <Stat label="Money placed on cards" value={m ? money(m.reservedOnCards) : "-"} sub={m ? `${m.activeCards} active card${m.activeCards === 1 ? "" : "s"} at Freda` : "Not available"} />
            <Stat label="Gateway balance (HTG)" value={f.gateway?.htg != null ? gourdes(f.gateway.htg) : "-"} sub={f.gateway?.htg != null ? `About ${money(f.gateway.htg / data.funds.rate)} at ${data.funds.rate} HTG per $1` : "MonCash and NatCash payments"} />
            <Stat label="Gateway balance (USD)" value={f.gateway?.usd != null ? money(f.gateway.usd) : "-"} sub="Card payments received" />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> {`Updated ${when(f.fetchedAt)}`}</p>
          {err !== null && <ErrorBox error={err} />}
        </div>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ what we owe against what we hold
function FundsCheck({ data }: { data: AdminOverview }) {
  const { owedToUsers, heldAtFreda, coverage } = data.funds;
  const ok = coverage !== null && coverage >= 1;
  const width = coverage === null ? 0 : Math.min(100, Math.round(coverage * 100));
  return (
    <Section title="Do we hold enough?" description="Indicative. Customer wallets are money we owe; the Gateway at Freda is where their MonCash / NatCash payments arrive (HTG converted at our fixed rate).">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Owed to customers" value={money(owedToUsers)} sub="Sum of all wallets" />
          <Stat label="Held at Freda (Gateway)" value={heldAtFreda === null ? "-" : money(heldAtFreda)} sub="HTG converted + USD" />
        </div>
        {coverage === null ? (
          <p className="text-sm text-muted-foreground">{heldAtFreda === null ? "Freda balances are not available, so the check cannot run." : "No customer money to cover yet."}</p>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className={ok ? "text-primary" : "text-destructive"}>{ok ? "Covered" : `Short by ${money(owedToUsers - (heldAtFreda ?? 0))}`}</span>
              <span className="text-muted-foreground">{percent(coverage, 0)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full", ok ? "bg-primary" : "bg-destructive")} style={{ width: `${width}%` }} /></div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Card money is covered separately by the Master Wallet. {`Manual balance adjustments in this period: ${money(data.stats.adjustCredits)} added, ${money(data.stats.adjustDebits)} removed.`}</p>
      </div>
    </Section>
  );
}

function Customers({ data }: { data: AdminOverview }) {
  const s = data.stats;
  return (
    <Section title="Customers and activity">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Customers" value={s.usersTotal} sub={`${s.usersNew} new in this period`} />
        <Stat label="Identity verified" value={s.usersVerified} sub={s.usersKycPending ? `${s.usersKycPending} waiting for a decision` : "None waiting"} />
        <Stat label="Wallets with money" value={s.walletsFunded} sub={`${money(s.walletsTotal)} in total`} />
        <Stat label="Active cards" value={s.cardsActive} sub={`${s.cardsTotal} cards · ${money(s.cardsBalance)} on cards`} />
        <Stat label="Pending operations" value={s.txPending} tone={s.txPendingOld > 0 ? "warn" : "plain"} sub={s.txPendingOld > 0 ? `${s.txPendingOld} pending for over an hour` : "None stuck"} />
        <Stat label="Failed in this period" value={s.txFailed} sub={s.cardPurchases ? `${s.cardPurchases} card purchases counted` : "Card purchases are counted from webhooks"} />
      </div>
    </Section>
  );
}
