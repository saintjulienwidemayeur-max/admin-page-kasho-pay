// Admin > Card holders: every customer with a verified KYC and where their card holder is at Freda (new card program).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminListHolders, adminSendHolder, adminWebhookStatus, type AdminHolderRow, type AdminRole } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { Empty, ErrorBox, Loading, Pill, Section, Stat, when, type Tone } from "./shared";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  none: { label: "Never sent", tone: "bad" },
  needs_profile: { label: "Profile incomplete", tone: "warn" },
  registered: { label: "Registered, ID not sent", tone: "bad" },
  submitted: { label: "ID sent, waiting", tone: "warn" },
  verified: { label: "Verified", tone: "good" },
  failed: { label: "Refused", tone: "bad" },
};

export function HoldersTab({ role }: { role: AdminRole }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "holders"], queryFn: adminListHolders, refetchInterval: 30_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  const { counts, items, mode, total } = query.data;
  const shown = filter === "all" ? items : items.filter((i) => i.status === filter);

  const send = async (row: AdminHolderRow, how: "new" | "restart") => {
    setBusy(`${row.userId}:${how}`);
    try {
      const r = await adminSendHolder({ data: { userId: row.userId, how } });
      if (r.state === "failed" || r.state === "needs_profile") toast.error(r.reason ?? "Freda did not accept it.");
      else toast.success(`Sent to Freda: ${r.holderId ?? ""}`);
      void qc.invalidateQueries({ queryKey: ["admin", "holders"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <WebhookBanner />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {(["none", "registered", "submitted", "verified", "failed", "needs_profile"] as const).map((k) => (
          <button key={k} type="button" className="text-left" onClick={() => setFilter(filter === k ? "all" : k)} aria-pressed={filter === k}>
            <Stat label={STATUS[k]!.label} value={counts[k] ?? 0} tone={k === "verified" ? "good" : k === "failed" || k === "none" || k === "registered" ? ((counts[k] ?? 0) > 0 ? "bad" : "plain") : "plain"} className={filter === k ? "ring-2 ring-primary" : ""} />
          </button>
        ))}
      </div>

      <Section
        title="Card holders (new card program)"
        description={`Customers with a verified identity (${total}) and where their card holder is at Freda (${mode === "live" ? "Live" : "Sandbox"}). "Verified" comes from Freda's holder.verified message: only then can the customer create a card. "Registered, ID not sent" is "à vérifier" at Freda: its ID photo was not submitted yet (it is sent again automatically). "Never sent" was not sent to Freda at all.`}
        action={<Button variant="outline" size="sm" onClick={() => void query.refetch()}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>}
      >
        {shown.length === 0 ? <Empty>Nobody here.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Freda holder</th>
                <th className="px-3 py-2 font-medium">Sent</th><th className="px-3 py-2 font-medium">Last try</th>{role === "super" && <th className="px-3 py-2" />}
              </tr></thead>
              <tbody className="divide-y divide-border">
                {shown.map((r) => {
                  const st = STATUS[r.status] ?? STATUS["none"]!;
                  return (
                    <tr key={r.userId} className="align-top">
                      <td className="px-3 py-2.5"><p className="font-medium">{r.name}</p>{r.email && <p data-no-i18n className="break-all text-xs text-muted-foreground">{r.email}</p>}</td>
                      <td className="px-3 py-2.5"><Pill tone={st.tone}>{st.label}</Pill>{r.reason && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{r.reason}</p>}</td>
                      <td data-no-i18n className="px-3 py-2.5 font-mono text-xs">{r.holderId ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{when(r.sentAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{when(r.lastAttemptAt)}</td>
                      {role === "super" && (
                        <td className="px-3 py-2.5 text-right">
                          {r.status !== "verified" && (
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" disabled={busy !== null} onClick={() => void send(r, r.holderId ? "restart" : "new")}>
                                {busy === `${r.userId}:new` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {r.holderId ? "Send ID again" : "Send now"}
                              </Button>
                              {r.holderId && (
                                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void send(r, "new")}>
                                  {busy === `${r.userId}:new` && <Loader2 className="h-3.5 w-3.5 animate-spin" />} New holder
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {role === "super" && <p className="mt-4 text-xs text-muted-foreground">"Send ID again" submits the ID photos of the holder the customer already has (this is what Freda needs to verify it). "Send now" and "New holder" make a new holder at Freda with a slightly different e-mail, then submit its ID. Freda allows 5 verifications per customer per 24 hours.</p>}
      </Section>
    </div>
  );
}

/** Does Freda's message "holder verified" reach the backend? Checked automatically by the backend (Freda sends it a signed test event). */
function WebhookBanner() {
  const q = useQuery({ queryKey: ["admin", "webhook"], queryFn: () => adminWebhookStatus(), refetchInterval: 5 * 60_000, retry: false });
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  if (q.isPending || q.isError || !q.data) return null;
  const c = q.data;
  const recheck = async () => {
    setBusy(true);
    try { qc.setQueryData(["admin", "webhook"], await adminWebhookStatus({ refresh: true })); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div role="status" className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${c.ok ? "border-border bg-card" : "border-destructive/40 bg-destructive/10"}`}>
      <div className="min-w-0">
        <p className="font-medium">{c.ok ? "Freda's webhook reaches the server" : "Freda's webhook does NOT reach the server"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {c.ok ? "Freda's \"holder verified\" message is received and the customers are updated automatically." : c.problem}
        </p>
        <p data-no-i18n className="mt-1 break-all text-xs text-muted-foreground">{c.url ?? "-"} · {when(c.checkedAt)}</p>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void recheck()}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Test now
      </Button>
    </div>
  );
}
