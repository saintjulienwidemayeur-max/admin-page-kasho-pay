// Last resort against a black page. If everything the page showed disappears (an error that no screen caught, a browser add-on
// that rewrote the page), this puts plain text on the screen with a way out, the error and the version of the site.
// It needs neither React nor the stylesheet, and it never throws.
export function installRescue(root: HTMLElement) {
  const startedAt = Date.now();
  let seen = false; // the page has been drawn at least once
  let lastError = "";
  let box: HTMLElement | null = null;

  const note = (e: unknown) => {
    try { lastError = (e instanceof Error ? `${e.name}: ${e.message}` : String(e ?? "")).slice(0, 300); } catch { /* ignore */ }
  };

  const show = () => {
    try {
      if (box) return;
      const fr = document.documentElement.lang === "fr";
      box = document.createElement("div");
      box.setAttribute("role", "alert");
      box.setAttribute("data-no-i18n", "");
      box.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#000;color:#fafafa;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
      const card = document.createElement("div");
      card.style.cssText = "width:100%;max-width:480px;border:1px solid #3a3a3a;border-radius:16px;padding:24px;background:#0b0f0b";
      const h = document.createElement("h1");
      h.style.cssText = "margin:0 0 8px;font-size:20px;font-weight:600";
      h.textContent = fr ? "La page ne s'affiche plus" : "The page stopped showing";
      const p = document.createElement("p");
      p.style.cssText = "margin:0 0 12px;color:#a1a1aa;font-size:14px";
      p.textContent = fr ? "Rechargez-la. Si cela se reproduit, envoyez ce texte au support :" : "Reload it. If it happens again, send this text to support:";
      const pre = document.createElement("pre");
      pre.style.cssText = "margin:0 0 16px;padding:8px 12px;border-radius:12px;background:#1a1a1a;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word";
      pre.textContent = `${lastError || "(no error text)"}\nv ${typeof __BUILD__ === "string" ? __BUILD__ : "?"}`;
      const b = document.createElement("button");
      b.type = "button";
      b.style.cssText = "width:100%;padding:12px;border:0;border-radius:12px;background:#39e600;color:#050505;font:600 15px system-ui,sans-serif;cursor:pointer";
      b.textContent = fr ? "Recharger la page" : "Reload the page";
      b.addEventListener("click", () => window.location.reload());
      card.append(h, p, pre, b);
      box.append(card);
      document.body.append(box);
    } catch { /* nothing more can be done */ }
  };

  const check = () => {
    try {
      if (box) return;
      if (root.childElementCount > 0) { seen = true; return; }
      if (seen || Date.now() - startedAt > 12_000) show();
    } catch { /* ignore */ }
  };

  window.addEventListener("error", (e) => { note(e.error ?? e.message); setTimeout(check, 500); });
  window.addEventListener("unhandledrejection", (e) => { note(e.reason); setTimeout(check, 500); });
  setInterval(check, 2000);
}
