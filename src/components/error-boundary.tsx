import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * A screen that crashes must not leave a blank page: this shows what happened and a way out.
 * (React removes the whole page when a component throws while drawing, unless something like this catches it.)
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[admin] the page crashed:", error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="grid min-h-dvh place-items-center px-4 py-10">
        <section role="alert" className="w-full max-w-lg rounded-2xl border border-destructive/40 bg-card p-6">
          <h1 className="text-xl font-semibold">Something went wrong on this page</h1>
          <p className="mt-2 text-sm text-muted-foreground">The page hit an unexpected problem. Reload it, and if it happens again send this text to support:</p>
          <pre data-no-i18n className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-secondary px-3 py-2 font-mono text-xs">{`${error.name}: ${error.message}\nv ${__BUILD__}`}</pre>
          <div className="mt-4">
            <Button className="w-full rounded-xl" onClick={() => window.location.reload()}>Reload the page</Button>
          </div>
        </section>
      </main>
    );
  }
}
