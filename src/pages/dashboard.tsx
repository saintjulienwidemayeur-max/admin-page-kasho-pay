// The admin console. Built for a computer first: a fixed menu on the left and a wide work area. On tablets and phones the
// menu becomes a drawer opened from a top bar, and the tables scroll sideways inside their own box.
import { useEffect, useState, type ComponentType } from "react";
import { ArrowLeftRight, CreditCard, LayoutDashboard, LifeBuoy, LogOut, Menu, Percent, ScrollText, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AdminRole, AdminStatus } from "@/lib/api";
import { LanguageSwitch } from "@/lib/i18n";
import { useClosingDialog } from "@/lib/layers";
import { cn } from "@/lib/utils";
import { AccountTab } from "@/components/admin/account";
import { CardsTab } from "@/components/admin/cards";
import { FeesTab } from "@/components/admin/fees";
import { OverviewTab } from "@/components/admin/overview";
import { Pill } from "@/components/admin/shared";
import { TeamTab } from "@/components/admin/team";
import { AuditTab, SupportTab } from "@/components/admin/support";
import { TransactionsTab } from "@/components/admin/transactions";
import { UsersTab } from "@/components/admin/users";

const TABS: { id: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "fees", label: "Fees", icon: Percent },
  { id: "users", label: "Customers", icon: Users },
  { id: "cards", label: "Cards", icon: CreditCard },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "audit", label: "Audit log", icon: ScrollText },
  { id: "team", label: "Team", icon: ShieldCheck },
  { id: "account", label: "My account", icon: UserCog },
];
type TabId = "overview" | "fees" | "users" | "cards" | "transactions" | "support" | "audit" | "team" | "account";
/** The Team page (who can sign in, add an administrator) is for super administrators only. */
const visibleTabs = (role: AdminRole) => TABS.filter((t) => t.id !== "team" || role === "super");

const fromHash = (role: AdminRole): TabId => {
  const id = window.location.hash.replace(/^#/, "");
  return (visibleTabs(role).some((t) => t.id === id) ? id : "overview") as TabId;
};

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold leading-tight">Kasho Pay Admin</p>
        <p className="text-[11px] text-muted-foreground">Authorized staff only</p>
      </div>
    </div>
  );
}

function Nav({ tab, onGo, role }: { tab: TabId; onGo: (id: TabId) => void; role: AdminRole }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {visibleTabs(role).map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={tab === id ? "page" : undefined}
          onClick={() => onGo(id as TabId)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
            tab === id ? "bg-primary text-primary-foreground shadow-neon" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" /> {label}
        </a>
      ))}
    </nav>
  );
}

function Who({ status, onSignOut, withLanguage }: { status: AdminStatus; onSignOut: () => void; withLanguage: boolean }) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="min-w-0 space-y-1.5">
        <Pill tone="good">{status.role === "super" ? "Super administrator" : "Administrator"}</Pill>
        <p data-no-i18n className="truncate text-xs text-muted-foreground" title={status.email}>{status.email}</p>
        <p data-no-i18n className="text-[11px] text-muted-foreground/70">{`v ${__BUILD__}`}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        {withLanguage ? <LanguageSwitch /> : <span />}
        <Button variant="outline" size="sm" className="rounded-full" onClick={onSignOut}><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>
    </div>
  );
}

/** The menu of a tablet or phone: a side panel that is only in the page while it is open. */
function MobileMenu({ tab, onGo, onClose, status, onSignOut }: { tab: TabId; onGo: (id: TabId) => void; onClose: () => void; status: AdminStatus; onSignOut: () => void }) {
  const { open, close } = useClosingDialog(onClose);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="left" className="flex w-72 flex-col gap-6 p-4">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Pages of the admin site</SheetDescription>
        </SheetHeader>
        <Brand />
        <Nav tab={tab} role={status.role ?? "admin"} onGo={(id) => { onGo(id); close(); }} />
        <div className="mt-auto"><Who status={status} onSignOut={onSignOut} withLanguage={false} /></div>
      </SheetContent>
    </Sheet>
  );
}

export function Dashboard({ status, onSignOut }: { status: AdminStatus; onSignOut: () => void }) {
  const role = status.role ?? "admin";
  const [tab, setTab] = useState<TabId>(() => fromHash(role));
  const [menu, setMenu] = useState(false);
  const label = TABS.find((t) => t.id === tab)?.label ?? "";

  // The page is kept in the address (#fees): a refresh, the Back button and a shared link open the same page.
  useEffect(() => {
    if (window.location.hash !== `#${tab}`) window.history.replaceState(null, "", `#${tab}`);
  }, [tab]);
  useEffect(() => {
    const onHash = () => setTab(fromHash(role));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [role]);
  // The browser tab says which page is open (useful with several tabs).
  useEffect(() => {
    document.title = `${label} | Kasho Pay Admin`;
    return () => { document.title = "Kasho Pay Admin"; };
  }, [label]);

  const go = (id: TabId) => setTab(id);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Computer: fixed menu on the left */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-border bg-card/40 px-4 py-6 lg:flex">
        <Brand />
        <Nav tab={tab} role={role} onGo={go} />
        <div className="mt-auto"><Who status={status} onSignOut={onSignOut} withLanguage /></div>
      </aside>

      {/* Tablet and phone: top bar with the menu drawer */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label="Menu" onClick={() => setMenu(true)}><Menu className="h-5 w-5" /></Button>
        <div className="min-w-0 flex-1"><Brand /></div>
        <LanguageSwitch />
      </header>
      {menu && <MobileMenu tab={tab} onGo={go} onClose={() => setMenu(false)} status={status} onSignOut={onSignOut} />}

      <main className="mx-auto w-full min-w-0 max-w-[1680px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight lg:text-3xl">{label}</h1>
        <section aria-label={label}>
          {tab === "overview" && <OverviewTab />}
          {tab === "fees" && <FeesTab role={role} />}
          {tab === "users" && <UsersTab role={role} />}
          {tab === "cards" && <CardsTab role={role} />}
          {tab === "transactions" && <TransactionsTab role={role} />}
          {tab === "support" && <SupportTab role={role} />}
          {tab === "audit" && <AuditTab />}
          {tab === "team" && role === "super" && <TeamTab />}
          {tab === "account" && <AccountTab status={status} />}
        </section>
      </main>
    </div>
  );
}
