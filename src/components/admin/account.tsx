// Admin > Account: who is signed in, change password.
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type AdminStatus } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { PasswordConfirm, Section, Stat, passwordError } from "./shared";

export function AccountTab({ status }: { status: AdminStatus }) {
  const [current, setCurrent] = useState("");
  const [currentError, setCurrentError] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = again.length > 0 && next !== again;
  const valid = current.length > 0 && next.length >= 8 && next === again;

  const submit = async () => {
    setBusy(true);
    setCurrentError("");
    try {
      await changePassword({ data: { currentPassword: current, newPassword: next } });
      toast.success("Password changed. Your other devices are signed out.");
      setCurrent(""); setNext(""); setAgain("");
    } catch (e) {
      const bad = passwordError(e);
      if (bad) { setCurrent(""); setCurrentError(bad); } else toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Your administrator account">
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Signed in as" value={<span className="text-base">{status.email}</span>} />
          <Stat label="Role" value={<span className="text-base">{status.role === "super" ? "Super administrator" : "Administrator"}</span>} sub={status.role === "super" ? "Full access, including customer money" : "Read access and the customer fee schedule"} />
        </div>
      </Section>

      <Section title="Change your password" description="You are asked for your current password. Your other devices are signed out.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void submit(); }}>
          <PasswordConfirm id="ad-current" label="Current password" hint="Asked again to change your password." value={current} onChange={(v) => { setCurrent(v); setCurrentError(""); }} error={currentError} busy={busy} />
          <div className="space-y-2">
            <Label htmlFor="ad-new">New password</Label>
            <Input id="ad-new" type="password" autoComplete="new-password" className="h-11 rounded-xl" value={next} onChange={(e) => setNext(e.target.value)} />
            {tooShort && <p className="text-xs text-destructive">Use at least 8 characters.</p>}
            <p className="text-xs text-muted-foreground">Choose a long password you use nowhere else: this account can move customer money.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ad-again">Repeat the new password</Label>
            <Input id="ad-again" type="password" autoComplete="new-password" className="h-11 rounded-xl" value={again} onChange={(e) => setAgain(e.target.value)} />
            {mismatch && <p className="text-xs text-destructive">The two passwords are different.</p>}
          </div>
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={!valid || busy}><KeyRound className="h-4 w-4" /> Change password</Button>
        </form>
      </Section>
    </div>
  );
}
