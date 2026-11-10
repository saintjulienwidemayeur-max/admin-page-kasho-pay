import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/error-boundary";
import { getLang, I18nRuntime } from "./lib/i18n";
import { installRescue } from "./lib/rescue";
import "./styles.css";

// The page language is right from the start (the browser's own "translate this page" must not kick in: the site has its own EN / FR switch).
document.documentElement.lang = getLang();

// Never a black page: if everything disappears anyway, plain text with a way out replaces it.
installRescue(document.getElementById("root")!);

// No <StrictMode>: a development double mount would run every effect twice.
createRoot(document.getElementById("root")!).render(
  <>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
    <I18nRuntime />
  </>,
);
