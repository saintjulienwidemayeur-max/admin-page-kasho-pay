// Supabase client of the admin site (same project as the Kasho Pay app, publishable key only).
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Set when the build has no Supabase settings: the site then shows this instead of a broken login. */
export const configError: string | null =
  !url || !key ? "This site is not configured yet: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example) and build again." : null;

// New-style publishable keys ("sb_publishable_...") are opaque strings, not bearer JWTs: never send them as Authorization.
function supabaseFetch(apiKey: string): typeof fetch {
  const opaque = apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_");
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, k) => headers.set(k, value));
    if (opaque && headers.get("Authorization") === `Bearer ${apiKey}`) headers.delete("Authorization");
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

// The session is kept in sessionStorage: closing the tab or the browser signs the administrator out (login + 2FA again).
function sessionStore(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    const s = window.sessionStorage;
    s.getItem("kp-admin-probe");
    return s;
  } catch {
    const mem = new Map<string, string>(); // storage blocked: the session then lives until the page is reloaded
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
}

export const supabase = createClient(url ?? "https://not-configured.invalid", key ?? "not-configured", {
  global: { fetch: supabaseFetch(key ?? "") },
  auth: { storage: sessionStore(), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "kasho-admin-auth" },
});
