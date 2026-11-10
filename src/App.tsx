import { lazy, Suspense, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useAdminGate } from "@/lib/gate";
import { useIdleTimeout } from "@/lib/idle";
import { useUnstickBody } from "@/lib/layers";
import { AuthShell } from "@/pages/auth-shell";
import { LoginPage } from "@/pages/login";

// The dashboard (and the charts library) is only downloaded once an administrator is in: the login screen stays light.
const Dashboard = lazy(() => import("@/pages/dashboard").then((m) => ({ default: m.Dashboard })));

const Spinner = () => (
  <main className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </main>
);

// Signed out after this long without a click, key press or scroll.
const IDLE_MINUTES = 20;

// No automatic retries or refetching: a refused or failing admin request is shown as it is, and the rate limits stay quiet.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } } });

export default function App() {
  const { gate, notice, recheck, signOut } = useAdminGate();
  useUnstickBody();
  const ready = gate.step === "ready";
  const idleOut = useCallback(() => {
    queryClient.clear();
    void signOut("You were signed out after 20 minutes without activity.");
  }, [signOut]);
  useIdleTimeout(IDLE_MINUTES, idleOut, ready);

  const leave = useCallback(() => {
    queryClient.clear();
    void signOut();
  }, [signOut]);

  let screen;
  switch (gate.step) {
    case "loading":
      screen = <Spinner />;
      break;
    case "config":
      screen = <AuthShell title="Not configured"><p role="alert" className="text-sm text-destructive">{gate.message}</p></AuthShell>;
      break;
    case "error":
      screen = (
        <AuthShell title="Something went wrong">
          <p role="alert" className="text-sm text-destructive">{gate.message}</p>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1 rounded-xl" onClick={() => void recheck()}>Try again</Button>
            <Button variant="outline" className="flex-1 rounded-xl" onClick={leave}>Sign out</Button>
          </div>
        </AuthShell>
      );
      break;
    case "signed-out":
      screen = <LoginPage notice={notice} />;
      break;
    case "ready":
      screen = (
        <Suspense fallback={<Spinner />}>
          <Dashboard status={gate.status} onSignOut={leave} />
        </Suspense>
      );
      break;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {screen}
      <Toaster />
    </QueryClientProvider>
  );
}
