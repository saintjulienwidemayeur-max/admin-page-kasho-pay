import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { AuthShell } from "./auth-shell";

export function LoginPage({ notice }: { notice: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    // E-mails are stored in lowercase: "Admin@kashopay.com" and "admin@kashopay.com" are the same account.
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (err) setError(/banned/i.test(err.message) ? "This account is suspended." : "Wrong email or password.");
    // On success the gate (onAuthStateChange) takes over: dashboard.
  };

  return (
    <AuthShell title="Sign in" subtitle="Use your administrator account.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (email && password && !busy) void submit(); }}>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="username" autoFocus className="h-11 rounded-xl" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" className="h-11 rounded-xl" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} />
        </div>
        {notice && !error && <p role="status" className="text-sm text-warning">{notice}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy || !email || !password}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
