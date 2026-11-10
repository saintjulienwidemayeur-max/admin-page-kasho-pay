// Who may see the site: signed in and an administrator (backend `admins` table). There is no 2FA step.
// The backend is the judge (adminStatus); this hook only follows what it says and shows the right screen.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { adminStatus, setSessionEndedHandler, type AdminStatus } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { configError, supabase } from "@/lib/supabase";

export type Gate =
  | { step: "loading" }
  | { step: "config"; message: string }
  | { step: "signed-out" }
  | { step: "error"; message: string }
  | { step: "ready"; status: AdminStatus };

export function useAdminGate() {
  const [gate, setGate] = useState<Gate>(configError ? { step: "config", message: configError } : { step: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const run = useRef(0); // only the latest check may change the screen
  const readyFor = useRef<string | null>(null); // user id of the dashboard that is already open

  const evaluate = useCallback(async (session: Session | null) => {
    const id = ++run.current;
    if (!session) {
      readyFor.current = null;
      setGate({ step: "signed-out" });
      return;
    }
    try {
      const status = await adminStatus();
      if (id !== run.current) return;
      if (!status.isAdmin || !status.role) {
        // A customer account (or anyone else) is never let in, and its session is not kept.
        readyFor.current = null;
        setNotice("This account is not allowed to use the admin site.");
        setGate({ step: "signed-out" });
        await supabase.auth.signOut();
        return;
      }
      readyFor.current = session.user.id;
      setGate({ step: "ready", status });
    } catch (e) {
      if (id !== run.current) return;
      readyFor.current = null;
      setGate({ step: "error", message: errorMessage(e, "The admin service could not be reached. Try again in a moment.") });
    }
  }, []);

  useEffect(() => {
    if (configError) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      // Supabase may send SIGNED_IN again when the tab regains focus: nothing to do if the dashboard is open for that user.
      if (event === "SIGNED_IN" && session && readyFor.current === session.user.id) return;
      // Never await Supabase calls inside this callback (it can deadlock the client): continue on the next tick.
      setTimeout(() => void evaluate(session), 0);
    });
    // The session really ended (the backend and Supabase both refuse it): say so on the login screen.
    setSessionEndedHandler((message) => setNotice(message));
    return () => {
      data.subscription.unsubscribe();
      setSessionEndedHandler(null);
    };
  }, [evaluate]);

  const recheck = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await evaluate(data.session);
  }, [evaluate]);

  /** Signs out; `why` is shown on the login screen. */
  const signOut = useCallback(async (why?: string) => {
    setNotice(why ?? null);
    await supabase.auth.signOut();
  }, []);

  return { gate, notice, clearNotice: () => setNotice(null), recheck, signOut };
}
