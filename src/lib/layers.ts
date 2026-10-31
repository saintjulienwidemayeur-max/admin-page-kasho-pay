// Helpers for the modal windows (Radix dialogs, sheets): a modal that is still closing must be gone before the next one
// opens, and the page must never be left frozen behind a modal that is no longer there.
import { useEffect } from "react";

const MODALS = '[role="dialog"], [role="alertdialog"]';
const CLOSING = '[role="dialog"][data-state="closed"], [role="alertdialog"][data-state="closed"]';

/** Resolves once no modal is in its closing animation any more (at most `max` ms). */
export function whenDialogsSettled(max = 700): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if (!document.querySelector(CLOSING) || Date.now() - started > max) resolve();
      else setTimeout(check, 40);
    };
    setTimeout(check, 0);
  });
}

/**
 * While a modal is open Radix switches off clicks and scrolling on the page behind it, and switches them back on when the
 * last modal closes. If two modals change at the same moment it can leave them off, and the whole page stops answering.
 * This puts things back once no modal (or menu) is left.
 */
export function useUnstickBody() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const busy = () => document.querySelector(`${MODALS}, [role="listbox"], [role="menu"], [data-radix-popper-content-wrapper]`) !== null;
    const fix = () => {
      if (busy()) return;
      if (document.body.style.pointerEvents === "none") document.body.style.removeProperty("pointer-events");
      if (document.body.hasAttribute("data-scroll-locked")) document.body.removeAttribute("data-scroll-locked");
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(fix, 400); };
    const obs = new MutationObserver(later);
    obs.observe(document.body, { attributes: true, attributeFilter: ["style", "data-scroll-locked"], childList: true });
    const poll = setInterval(fix, 2000);
    return () => { obs.disconnect(); clearInterval(poll); clearTimeout(timer); };
  }, []);
}
