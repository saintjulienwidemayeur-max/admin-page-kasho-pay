import type { ReactNode } from "react";
import { LanguageSwitch } from "@/lib/i18n";

/** Centered card used by the login, 2FA and error screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-10">
      <LanguageSwitch className="absolute right-4 top-4" />
      <div className="page-enter w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
          <div>
            <p className="text-lg font-semibold leading-tight">Kasho Pay Admin</p>
            <p className="text-xs text-muted-foreground">Authorized staff only</p>
          </div>
        </div>
        <section className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </section>
        <p className="mt-4 text-center text-xs text-muted-foreground">Every action on this site is recorded in an audit log.</p>
      </div>
    </main>
  );
}
