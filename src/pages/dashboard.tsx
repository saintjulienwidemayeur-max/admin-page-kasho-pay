// The admin dashboard: tabs for the overview, fees, customers, transactions, support, audit log and the account.
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminStatus } from "@/lib/api";
import { LanguageSwitch } from "@/lib/i18n";
import { AccountTab } from "@/components/admin/account";
import { FeesTab } from "@/components/admin/fees";
import { OverviewTab } from "@/components/admin/overview";
import { Pill } from "@/components/admin/shared";
import { AuditTab, SupportTab } from "@/components/admin/support";
import { TransactionsTab } from "@/components/admin/transactions";
import { UsersTab } from "@/components/admin/users";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "fees", label: "Fees" },
  { id: "users", label: "Customers" },
  { id: "transactions", label: "Transactions" },
  { id: "support", label: "Support" },
  { id: "audit", label: "Audit log" },
  { id: "account", label: "My account" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const fromHash = (): TabId => {
  const id = window.location.hash.replace(/^#/, "");
  return TABS.some((t) => t.id === id) ? (id as TabId) : "overview";
};

export function Dashboard({ status, onSignOut }: { status: AdminStatus; onSignOut: () => void }) {
  const [tab, setTab] = useState<TabId>(fromHash);
  const role = status.role ?? "admin";

  // The tab is kept in the address (#fees) so a refresh or a shared link opens the same page.
  useEffect(() => {
    if (window.location.hash !== `#${tab}`) window.history.replaceState(null, "", `#${tab}`);
  }, [tab]);
  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-xl font-semibold leading-tight">Kasho Pay Admin</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <Pill tone="good">{role === "super" ? "Super administrator" : "Administrator"}</Pill>
              <span data-no-i18n className="text-xs text-muted-foreground">{status.email}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <Button variant="outline" size="sm" className="rounded-full" onClick={onSignOut}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id} className="rounded-lg px-3 py-2">{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="mt-6">
        {tab === "overview" && <OverviewTab onOpenFees={() => setTab("fees")} />}
        {tab === "fees" && <FeesTab role={role} />}
        {tab === "users" && <UsersTab role={role} />}
        {tab === "transactions" && <TransactionsTab role={role} />}
        {tab === "support" && <SupportTab role={role} />}
        {tab === "audit" && <AuditTab />}
        {tab === "account" && <AccountTab status={status} />}
      </div>
    </div>
  );
}
