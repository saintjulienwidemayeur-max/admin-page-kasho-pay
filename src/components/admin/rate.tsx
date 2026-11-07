// Admin > Fees: the exchange rate (how many gourdes for 1 US dollar) used for every top-up and withdrawal.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminGetRate, adminSetRate, type AdminRate, type AdminRole } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useClosingDialog } from "@/lib/layers";
import { ErrorBox, Loading, PasswordConfirm, Section, passwordError, when } from "./shared";

export function RateCard({ role }: { role: AdminRole }) {
  const rate = useQuery({ queryKey: ["admin", "rate"], queryFn: adminGetRate });
  const [editing, setEditing] = useState(false);
  if (rate.isPending) return <Loading />;
  if (rate.isError) return <ErrorBox error={rate.error} onRetry={() => void rate.refetch()} />;
  const r = rate.data;
  return (
    <Section
      title="Exchange rate"
      description="Gourdes for 1 US dollar. It prices every top-up and withdrawal, for all customers, from the next operation on. Operations already started keep their rate."
      action={role === "super" ? <Button size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Change the rate</Button> : undefined}
    >
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{`1 USD = ${r.rate} HTG`}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {r.source === "admin"
          ? `Set by an administrator${r.updatedBy ? ` (${r.updatedBy})` : ""} on ${when(r.updatedAt)}.`
          : `Default rate from the server settings. Nobody has changed it here yet.`}
      </p>
      {role !== "super" && <p className="mt-1 text-xs text-muted-foreground">Only a super administrator can change it.</p>}
      {editing && <RateDialog current={r} onClose={() => setEditing(false)} />}
    </Section>
  );
}

function RateDialog({ current, onClose }: { current: AdminRate; onClose: () => void }) {
  const qc = useQueryClient();
  const { open, close } = useClosingDialog(onClose);
  const [value, setValue] = useState(String(current.rate));
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);
  const v = Number(value.replace(",", "."));
  const inRange = Number.isFinite(v) && v >= current.min && v <= current.max;
  const valid = value.trim() !== "" && inRange && v !== current.rate && password.length > 0;

  const save = async () => {
    setBusy(true);
    setPwError("");
    try {
      await adminSetRate({ data: { rate: Math.round(v * 100) / 100, confirmPassword: password } });
      toast.success("Exchange rate saved");
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
            <DialogTitle>Change the exchange rate</DialogTitle>
            <DialogDescription>{`Now 1 USD = ${current.rate} HTG. Customers pay and receive at the new rate from the next operation. Allowed: ${current.min} to ${current.max}.`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rate-value">Gourdes for 1 US dollar</Label>
            <Input id="rate-value" inputMode="decimal" className="h-11 rounded-xl" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={value.trim() !== "" && !inRange} />
            {value.trim() !== "" && !inRange && <p role="alert" className="text-sm text-destructive">{`Enter a rate between ${current.min} and ${current.max}.`}</p>}
          </div>
          <PasswordConfirm value={password} onChange={(p) => { setPassword(p); setPwError(""); }} error={pwError} busy={busy} />
          <DialogFooter><Button type="submit" className="w-full rounded-xl" disabled={!valid || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save the rate</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
