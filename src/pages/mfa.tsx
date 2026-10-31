// Second step of the login: the 6-digit code of the authenticator app. The first time (no 2FA yet) the account is
// enrolled here: scan the QR code, enter the first code. The site never opens without it, because it can move money.
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { AuthShell } from "./auth-shell";

type Setup = { factorId: string; qr: string; secret: string };

// supabase-js hands over the QR code as `data:image/svg+xml;utf-8,<svg ...>` with the markup unescaped. A "#" in a color
// would cut such a URL short, so the markup is escaped properly before it goes into <img src>.
const PLAIN_SVG = "data:image/svg+xml;utf-8,";
const qrSrc = (qr: string) => (qr.startsWith(PLAIN_SVG) ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.slice(PLAIN_SVG.length))}` : qr);

export function MfaPage({ mode, email, onVerified, onSignOut }: { mode: "enroll" | "challenge"; email: string; onVerified: () => void; onSignOut: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: list } = await supabase.auth.mfa.listFactors();
        if (mode === "challenge") {
          const id = list?.totp?.[0]?.id ?? null; // listFactors().totp only holds verified factors
          if (!cancelled) id ? setFactorId(id) : setLoadError("No authenticator is set up for this account.");
          return;
        }
        // A setup left half-way earlier leaves an unverified factor behind: remove it before starting again.
        for (const f of list?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
        const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Kasho Pay Admin ${Date.now()}` });
        if (cancelled) return;
        if (err || !data) throw err ?? new Error("Could not start the 2FA setup.");
        setSetup({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
        setFactorId(data.id);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e, "Could not start the 2FA setup. Try again."));
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  const verify = async () => {
    if (!factorId) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (err) {
      setCode("");
      setError("That code is not right. Check the code in your authenticator app.");
      return;
    }
    onVerified();
  };

  const enrolling = mode === "enroll";
  return (
    <AuthShell
      title={enrolling ? "Set up two-factor authentication" : "Enter your 2FA code"}
      subtitle={enrolling ? "This site can move customer money, so it only opens with an authenticator app." : `Signed in as ${email}. Open your authenticator app and enter the 6-digit code.`}
    >
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">{loadError}</p>
      ) : !factorId ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (code.length === 6 && !busy) void verify(); }}>
          {setup && (
            <div className="space-y-3 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password...).</li>
                <li>Scan this QR code, or type the key below.</li>
                <li>Enter the 6-digit code it shows.</li>
              </ol>
              <div className="flex justify-center"><img src={qrSrc(setup.qr)} alt="QR code to scan with your authenticator app" className="h-44 w-44 rounded-xl bg-white p-2" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Key to type by hand</p>
                <p data-no-i18n className="mt-1 break-all rounded-lg bg-secondary px-3 py-2 font-mono text-xs tracking-wider">{setup.secret}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="mfa-code">6-digit code</Label>
            <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="123456" className="h-11 rounded-xl text-center text-lg tracking-[0.4em]"
              value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy || code.length !== 6}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {enrolling ? "Turn on 2FA and continue" : "Verify"}
          </Button>
        </form>
      )}
      <button type="button" className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={onSignOut}>Use another account</button>
    </AuthShell>
  );
}
