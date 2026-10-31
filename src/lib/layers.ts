// Helpers for the modal windows (Radix dialogs, sheets): a window closes with its animation BEFORE the page forgets about it,
// and the page must never be left frozen (or covered by a dark layer) behind a modal that is no longer there.
import { useEffect, useRef, useState } from "react";

const MODALS = '[role="dialog"], [role="alertdialog"]';
const BUSY = `${MODALS}, [role="listbox"], [role="menu"], [data-radix-popper-content-wrapper]`;
// A window that is closing keeps its data-state="closed" until its animation ends and the library removes it.
const CLOSED_LAYERS = '[data-state="closed"][role="dialog"], [data-state="closed"][role="alertdialog"], [data-state="closed"].fixed.inset-0';
// A dark layer (the library's overlay) that says "open" while no window exists anywhere in the page belongs to nothing.
const ORPHAN_OPEN_LAYERS = '[data-state="open"].fixed.inset-0';

/**
 * For a dialog that a parent shows while it exists: `open` is what the dialog gets, `close()` starts its closing animation,
 * and `onClosed` is called once it is over, so the parent can drop it and React removes every trace of the window.
 * (Dropping an open dialog at once, in the middle of its work, is what used to leave the page stuck behind it.)
 */
export function useClosingDialog(onClosed: () => void, ms = 250) {
  const [open, setOpen] = useState(true);
  const done = useRef(onClosed);
  done.current = onClosed;
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => done.current(), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { open, close: () => setOpen(false) };
}

/**
 * Safety net, always on. While a modal is open Radix switches off clicks and scrolling on the page behind it, and switches
 * them back on when the last modal closes. If two modals change at the same moment it can leave them off, or leave a
 * closed window's dark layer in the page, and the whole screen looks black and stops answering. This puts things back:
 *  - no modal (or menu) left: clicks and scrolling are on again;
 *  - a window that has been "closed" for more than a second (or a dark layer that belongs to no window) is hidden and made click-through.
 * Nothing here removes elements that React owns: it only changes their style, which is always safe.
 */
export function useUnstickBody() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const closedSince = new WeakMap<Element, number>();
    const fix = () => {
      // 1) leftovers of windows that should be gone
      const now = Date.now();
      const noWindow = document.querySelector(MODALS) === null;
      for (const el of document.querySelectorAll<HTMLElement>(noWindow ? `${CLOSED_LAYERS}, ${ORPHAN_OPEN_LAYERS}` : CLOSED_LAYERS)) {
        const since = closedSince.get(el);
        if (since === undefined) closedSince.set(el, now);
        else if (now - since > 1000 && el.style.display !== "none") {
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("pointer-events", "none", "important");
        }
      }
      // 2) the page behind them
      if (document.querySelector(BUSY) !== null) return;
      if (document.body.style.pointerEvents === "none") document.body.style.removeProperty("pointer-events");
      if (document.body.hasAttribute("data-scroll-locked")) document.body.removeAttribute("data-scroll-locked");
      if (document.body.style.overflow === "hidden") document.body.style.removeProperty("overflow");
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(fix, 400); };
    const obs = new MutationObserver(later);
    obs.observe(document.body, { attributes: true, attributeFilter: ["style", "data-scroll-locked", "data-state"], childList: true, subtree: true });
    const poll = setInterval(fix, 1500);
    return () => { obs.disconnect(); clearInterval(poll); clearTimeout(timer); };
  }, []);
}
