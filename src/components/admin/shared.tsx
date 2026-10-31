// Small building blocks shared by the admin tabs.
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/format";
import { ApiError, errorCode, type FeeOperation } from "@/lib/api";

/** "$1,234.56" / "-$5.00" (the French language switch turns it into "1 234,56 $" by itself). */
export function money(n: number, opts: { sign?: boolean } = {}): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v < 0) return `-$${abs}`;
  return opts.sign && v > 0 ? `+$${abs}` : `$${abs}`;
}
export const gourdes = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("en-US")} HTG`;
export const percent = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? "-" : `${(n * 100).toFixed(digits)}%`);
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-");

export type Tone = "good" | "bad" | "warn" | "muted" | "plain";
export const toneClass = (t: Tone) =>
  t === "good" ? "text-primary" : t === "bad" ? "text-destructive" : t === "warn" ? "text-warning" : t === "muted" ? "text-muted-foreground" : "text-foreground";
export const signTone = (n: number): Tone => (n > 0.004 ? "good" : n < -0.004 ? "bad" : "plain");

export const FEE_OPERATION_LABELS: Record<FeeOperation, string> = {
  card_creation: "Card creation", wallet_deposit: "Wallet top-up", wallet_withdrawal: "Wallet withdrawal", card_fund: "Card top-up",
  card_withdraw: "Card withdrawal", transfer: "Kasho transfer",
};
export const KIND_LABELS: Record<string, string> = {
  deposit: "Top-up", withdrawal: "Withdrawal", card_creation: "Card creation", card_fund: "Card top-up", card_withdraw: "Card withdrawal / closing",
  transfer_out: "Transfer sent", transfer_in: "Transfer received", admin_credit: "Added by admin", admin_debit: "Removed by admin",
};

export function Section({ title, description, action, children, className }: { title: string; description?: string | undefined; action?: ReactNode; children: ReactNode; className?: string | undefined }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "plain", className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; className?: string | undefined }) {
  return (
    <div className={cn("rounded-xl border border-border bg-secondary/40 p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-2xl font-semibold tracking-tight", toneClass(tone))}>{value}</p>
      {sub !== undefined && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  const bg = tone === "good" ? "bg-primary/15 text-primary" : tone === "bad" ? "bg-destructive/15 text-destructive" : tone === "warn" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground";
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", bg)}>{children}</span>;
}

export const statusTone = (s: string): Tone => (s === "completed" || s === "verified" || s === "active" ? "good" : s === "failed" || s === "rejected" || s === "terminated" ? "bad" : s === "pending" || s === "disabled" ? "warn" : "muted");

/** The state of a card (the database says "disabled" for a frozen card). */
export const CARD_STATUS_LABELS: Record<string, string> = { active: "Active", disabled: "Frozen", pending: "Pending", failed: "Failed", terminated: "Terminated" };
export const cardStatusTone = (s: string): Tone => (s === "active" ? "good" : s === "disabled" || s === "pending" ? "warn" : s === "failed" || s === "terminated" ? "bad" : "muted");

/**
 * What to show under the password field when the server refused the password (wrong, missing, too many tries),
 * or null for any other problem (those are shown as a message at the top of the screen).
 */
export function passwordError(e: unknown): string | null {
  const code = errorCode(e);
  if (code === "PASSWORD_INVALID") return "Wrong password. Try again.";
  if (code === "PASSWORD_REQUIRED") return "Enter your password.";
  if (e instanceof ApiError && e.status === 429) return e.message;
  return null;
}

/** The password asked again before something that changes money, prices or accounts: a field inside the window itself. */
export function PasswordConfirm({ value, onChange, error, busy = false, id = "confirm-pw", label = "Your password", hint = "Asked again because this changes money, prices or accounts." }: { value: string; onChange: (v: string) => void; error?: string | undefined; busy?: boolean; id?: string; label?: string; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" autoComplete="current-password" className="h-11 rounded-xl" value={value} readOnly={busy} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p id={`${id}-err`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: (() => void) | undefined }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
      <p className="font-medium text-destructive">{errorMessage(error, "This could not be loaded.")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{`${(page - 1) * pageSize + 1}-${Math.min(total, page * pageSize)} of ${total}`}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span>{`Page ${page} of ${pages}`}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
