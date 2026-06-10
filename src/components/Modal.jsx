// Shared modal shell: scrim + panel + focus management.
//
// - Moves focus into the panel on mount and restores it to the previously
//   focused element on close (keyboard users were stranded before).
// - Traps Tab / Shift+Tab inside the panel.
// - Closes on Escape and on scrim click; panel clicks don't propagate.
//
// Replaces the five hand-rolled overlay patterns found in the June 2026
// audit (settings, profile, replay viewer, augment picker, item picker).

import React, { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ onClose, label, zIndex = 'var(--z-modal)', scrimStyle, panelStyle, panelClassName, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector(FOCUSABLE);
      (first || panel).focus();
    }
    return () => {
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch (_) { /* element may be gone */ }
      }
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll(FOCUSABLE))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, ...scrimStyle }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={panelClassName}
        style={{ outline: 'none', ...panelStyle }}
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
