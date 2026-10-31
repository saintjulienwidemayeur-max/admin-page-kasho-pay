import { useEffect } from "react";

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Calls `onIdle` once the administrator has not clicked, typed or scrolled for `minutes`.
 * It compares real clock times, so a laptop that slept for an hour signs out as soon as it wakes up.
 */
export function useIdleTimeout(minutes: number, onIdle: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    for (const e of EVENTS) window.addEventListener(e, bump, { passive: true });
    const tick = setInterval(() => { if (Date.now() - last >= minutes * 60_000) onIdle(); }, 10_000);
    return () => {
      clearInterval(tick);
      for (const e of EVENTS) window.removeEventListener(e, bump);
    };
  }, [minutes, onIdle, active]);
}
