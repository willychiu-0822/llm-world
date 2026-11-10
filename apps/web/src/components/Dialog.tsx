import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** One dialog pattern: a verb button, an X, Esc, and no tap-outside dismiss. */
export function Dialog({ title, busy, onClose, children }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const app = document.querySelector(".app");
    app?.setAttribute("inert", "");
    const items = () => [...root.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input, select, textarea")];
    const first = root.querySelector<HTMLElement>(".btn.primary:not(:disabled)") ?? items()[0] ?? root;
    first.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const head = list[0];
      const tail = list[list.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      app?.removeAttribute("inert");
      previous?.focus?.();
    };
  }, [busy]);

  return createPortal(
    <div className="veil">
      <div ref={ref} className="celebrate stack" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}>
        <h2 id="dialog-title" className="sr-only">{title}</h2>
        <button type="button" className="icon-btn dialog-x" aria-label="關閉" disabled={busy} onClick={onClose}>×</button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
