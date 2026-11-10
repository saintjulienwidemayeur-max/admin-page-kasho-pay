// Admin > Support (disputes and messages from customers) and Audit (what administrators did).
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquareReply } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminListAudit, adminListSupport, adminReplySupport, type AdminRole, type FeeOperation } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useClosingDialog } from "@/lib/layers";
import { Empty, ErrorBox, FEE_OPERATION_LABELS, Loading, Pager, Pill, Section, money, when } from "./shared";
import { UserSheet } from "./users";

export function SupportTab({ role }: { role: AdminRole }) {
  const query = useQuery({ queryKey: ["admin", "support"], queryFn: adminListSupport });
  const [user, setUser] = useState<string | null>(null);
  const [replying, setReplying] = useState<Reply | null>(null);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  const { disputes, messages } = query.data;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-2">
      <Section title="Disputes" description="Customers who contested a transaction. Newest first.">
        {disputes.length === 0 ? <Empty>No dispute.</Empty> : (
          <ul className="divide-y divide-border">
            {disputes.map((d) => (
              <li key={d.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="font-medium">{d.title || d.transaction_ref} <span className="font-mono text-xs font-normal text-muted-foreground">{d.reference}</span></p>
                  <p className="text-muted-foreground">{d.reason}{d.note ? `: ${d.note}` : ""}</p>
                  <p className="text-xs text-muted-foreground"><button type="button" className="text-primary hover:underline" onClick={() => setUser(d.user_id)}>{d.customer || "Customer"}</button> · {when(d.created_at)} · {d.transaction_ref}</p>
                </div>
                <p className="font-semibold tabular-nums sm:text-right">{money(d.amount)}</p>
                <ReplyLine reply={d.reply} repliedAt={d.replied_at} onReply={() => setReplying({ kind: "dispute", id: d.id, customer: d.customer, original: `${d.title || d.transaction_ref}: ${d.reason}${d.note ? `: ${d.note}` : ""}`, previous: d.reply ?? "" })} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Messages" description="Messages sent with the Help and support form.">
        {messages.length === 0 ? <Empty>No message.</Empty> : (
          <ul className="divide-y divide-border">
            {messages.map((m) => (
              <li key={m.id} className="py-3 text-sm">
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className="mt-1 text-xs text-muted-foreground"><button type="button" className="text-primary hover:underline" onClick={() => setUser(m.user_id)}>{m.customer || "Customer"}</button>{m.email ? ` · ${m.email}` : ""} · {when(m.created_at)}</p>
                <ReplyLine reply={m.reply} repliedAt={m.replied_at} onReply={() => setReplying({ kind: "message", id: m.id, customer: m.customer, original: m.message, previous: m.reply ?? "" })} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      {user && <UserSheet key={user} userId={user} role={role} onClose={() => setUser(null)} />}
      {replying && <ReplyDialog key={replying.id} target={replying} onClose={() => setReplying(null)} />}
    </div>
  );
}

type Reply = { kind: "message" | "dispute"; id: string; customer: string; original: string; previous: string };

/** Under a message or dispute: the answer already sent (if any) and the button to answer. */
function ReplyLine({ reply, repliedAt, onReply }: { reply: string | null | undefined; repliedAt: string | null | undefined; onReply: () => void }) {
  return (
    <div className="mt-2 sm:col-span-2">
      {reply && (
        <div className="mb-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">{`Your reply · ${when(repliedAt)}`}</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words">{reply}</p>
        </div>
      )}
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onReply}><MessageSquareReply className="h-3.5 w-3.5" /> {reply ? "Reply again" : "Reply"}</Button>
    </div>
  );
}

function ReplyDialog({ target, onClose }: { target: Reply; onClose: () => void }) {
  const qc = useQueryClient();
  const { open, close } = useClosingDialog(onClose);
  const [text, setText] = useState(target.previous);
  const [busy, setBusy] = useState(false);
  const valid = text.trim().length >= 2;

  const send = async () => {
    setBusy(true);
    try {
      await adminReplySupport({ data: { kind: target.kind, id: target.id, reply: text.trim() } });
      toast.success("Reply sent");
      void qc.invalidateQueries({ queryKey: ["admin", "support"] });
      close();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) close(); }}>
      <DialogContent className="rounded-2xl">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void send(); }}>
          <DialogHeader>
            <DialogTitle>{`Reply to ${target.customer || "the customer"}`}</DialogTitle>
            <DialogDescription>The customer gets your answer as a notification in the app (and a push on their phone if they turned it on). Write in the language they used.</DialogDescription>
          </DialogHeader>
          <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">{target.original}</div>
          <div className="space-y-2">
            <Label htmlFor="support-reply">Your reply</Label>
            <Textarea id="support-reply" rows={5} maxLength={2000} className="rounded-xl" value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-right text-xs text-muted-foreground">{`${text.length} / 2000`}</p>
          </div>
          <DialogFooter><Button type="submit" className="w-full rounded-xl" disabled={!valid || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send reply</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ACTIONS: Record<string, string> = {
  balance_credit: "Added money", balance_debit: "Removed money", user_suspended: "Suspended a customer", user_reactivated: "Reactivated a customer",
  fee_rule_saved: "Saved a customer fee", fee_rule_deleted: "Removed a customer fee", partner_cost_saved: "Edited a Freda price", partner_plan_applied: "Applied Freda plans",
};
function describeDetails(action: string, d: Record<string, unknown>): ReactNode {
  const v = (k: string) => d[k];
  const feeOp = (o: unknown) => FEE_OPERATION_LABELS[o as FeeOperation] ?? String(o ?? "");
  if (action === "balance_credit" || action === "balance_debit") {
    const note = String(v("note") ?? "").trim();
    return (
      <>
        {`${money(Number(v("amount")))} (${money(Number(v("balance_before")))} to ${money(Number(v("balance_after")))})`}
        {note && <span className="block">{note}</span>}
      </>
    );
  }
  if (action === "fee_rule_saved") return `${feeOp(v("operation"))}: ${v("feeType") === "percent" ? `${v("feeValue")}%` : money(Number(v("feeValue")))}`;
  if (action === "fee_rule_deleted") return feeOp(v("operation"));
  if (action === "partner_cost_saved") return `${String(v("operation") ?? "")}: ${v("percent")}% + ${money(Number(v("flatUsd")))}`;
  if (action === "partner_plan_applied") return `Gateway ${String(v("gateway"))}, Issuing ${String(v("issuing"))}`;
  return "";
}

export function AuditTab() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin", "audit", page], queryFn: () => adminListAudit({ data: { page, pageSize: 50 } }), placeholderData: (prev) => prev });
  return (
    <Section title="Audit log" description="Everything administrators did with money, customers and prices. Nobody can edit or delete these lines.">
      {query.isPending ? <Loading /> : query.isError ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <Empty>Nothing yet.</Empty> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Administrator</th><th className="px-3 py-2 font-medium">Action</th><th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">Details</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {query.data.items.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{when(r.created_at)}</td>
                    <td className="px-3 py-2.5">{r.admin_email ?? "-"}<span className="block text-xs text-muted-foreground">{r.ip ?? ""}</span></td>
                    <td className="px-3 py-2.5"><Pill tone={r.action.startsWith("balance") || r.action === "user_suspended" ? "warn" : "muted"}>{ACTIONS[r.action] ?? r.action}</Pill></td>
                    <td className="px-3 py-2.5">{r.target ?? "-"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{describeDetails(r.action, r.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
        </>
      )}
    </Section>
  );
}
