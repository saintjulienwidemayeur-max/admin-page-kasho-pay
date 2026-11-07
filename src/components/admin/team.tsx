// Admin > Team: the people who can sign in to this site. Only a super administrator sees it and can add someone.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dices, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminCreateAdmin, adminListAdmins, type AdminRole } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useClosingDialog } from "@/lib/layers";
import { Empty, ErrorBox, Loading, PasswordConfirm, Pill, Section, passwordError, when } from "./shared";

/** 16 random characters from an alphabet without look-alikes (never Math.random: this is a password). */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?";
  const buf = new Uint32Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

export function TeamTab() {
  const team = useQuery({ queryKey: ["admin", "team"], queryFn: adminListAdmins });
  const [adding, setAdding] = useState(false);
  if (team.isPending) return <Loading />;
  if (team.isError) return <ErrorBox error={team.error} onRetry={() => void team.refetch()} />;
  const items = team.data.items;
  return (
    <Section
      title="Administrators"
      description="The people who can sign in to this site. Everyone must set up 2FA at their first sign-in. A super administrator can also move customer money, change prices and the exchange rate, and add people here."
      action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add an administrator</Button>}
    >
      {items.length === 0 ? <Empty>No administrators yet.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Person</th><th className="px-3 py-2 font-medium">Role</th><th className="px-3 py-2 font-medium">2FA</th><th className="px-3 py-2 font-medium">Last sign-in</th><th className="px-3 py-2 font-medium">Added</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {items.map((m) => (
                <tr key={m.userId}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{m.name || m.email}{m.you && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}</p>
                    {m.name && <p data-no-i18n className="text-xs text-muted-foreground">{m.email}</p>}
                  </td>
                  <td className="px-3 py-2.5">{m.role === "super" ? <Pill tone="good">Super administrator</Pill> : <Pill>Administrator</Pill>}</td>
                  <td className="px-3 py-2.5">{m.has2fa ? <Pill tone="good">On</Pill> : <Pill tone="warn">Not yet</Pill>}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{when(m.lastSignInAt)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{when(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <AddAdminDialog onClose={() => setAdding(false)} />}
    </Section>
  );
}

function AddAdminDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { open, close } = useClosingDialog(onClose);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [pass, setPass] = useState("");
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; pass: string } | null>(null);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && pass.length >= 12 && password.length > 0;

  const save = async () => {
    setBusy(true);
    setPwError("");
    try {
      await adminCreateAdmin({ data: { email: email.trim().toLowerCase(), password: pass, role, firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined, confirmPassword: password } });
      void qc.invalidateQueries({ queryKey: ["admin", "team"] });
      setDone({ email: email.trim().toLowerCase(), pass });
      setPassword("");
    } catch (e) {
      const bad = passwordError(e);
      if (bad) { setPassword(""); setPwError(bad); } else toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) close(); }}>
      <DialogContent className="rounded-2xl">
        {done ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Administrator created</DialogTitle>
              <DialogDescription>Give these details to the person in a safe way. This password is shown only now. They will be asked to set up 2FA at their first sign-in and should change the password in My account.</DialogDescription>
            </DialogHeader>
            <dl className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">E-mail</dt><dd data-no-i18n className="break-all font-medium">{done.email}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Temporary password</dt><dd data-no-i18n className="break-all font-mono font-medium">{done.pass}</dd></div>
            </dl>
            <DialogFooter><Button className="w-full rounded-xl" onClick={close}>Done</Button></DialogFooter>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void save(); }}>
            <DialogHeader>
              <DialogTitle>Add an administrator</DialogTitle>
              <DialogDescription>Creates an account that can sign in to this site. Choose the role carefully: a super administrator can move customer money.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="adm-first">First name</Label><Input id="adm-first" maxLength={60} className="h-11 rounded-xl" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="adm-last">Last name</Label><Input id="adm-last" maxLength={60} className="h-11 rounded-xl" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="adm-email">E-mail</Label><Input id="adm-email" type="email" autoComplete="off" maxLength={120} className="h-11 rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(r) => setRole(r as AdminRole)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator (read everything, edit fees)</SelectItem>
                  <SelectItem value="super">Super administrator (everything)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm-pass">Temporary password (at least 12 characters)</Label>
              <div className="flex gap-2">
                <Input id="adm-pass" data-no-i18n autoComplete="off" maxLength={72} className="h-11 rounded-xl font-mono" value={pass} onChange={(e) => setPass(e.target.value)} />
                <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl" onClick={() => setPass(generatePassword())}><Dices className="h-4 w-4" /> Generate</Button>
              </div>
            </div>
            <PasswordConfirm value={password} onChange={(p) => { setPassword(p); setPwError(""); }} error={pwError} busy={busy} />
            <DialogFooter><Button type="submit" className="w-full rounded-xl" disabled={!valid || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create administrator</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
