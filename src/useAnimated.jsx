import { useCallback, useEffect, useId, useState } from 'react';

const KEY = 'primates:animate';

/// Whether the primates walk, shared across pages and remembered between visits.
///
/// Defaults to the visitor's own reduced-motion setting rather than to "on": a
/// page of looping sprites is exactly what that setting exists to prevent. The
/// stored choice wins over it once they have used the toggle.
export function useAnimated() {
  const [on, setOn] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) return saved === 'on';
    } catch { /* private mode: fall through to the media query */ }
    try {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return true;
    }
  });

  // Pausing while the tab is hidden costs nothing and stops a background tab
  // re-rendering three sprites a second forever.
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return [on && visible, toggle, on];
}

/// The toggle itself, so both pages show the same control.
///
/// A real checkbox with a styled label: it keeps keyboard focus, space to
/// toggle, and screen-reader state for free, which a div would have to fake.
export function MotionToggle({ on, onToggle }) {
  // Both pages render one, and a duplicate id would make the first label steal
  // the second switch.
  const id = useId();

  return (
    <div className="checkbox-wrapper-35">
      <input
        className="switch"
        type="checkbox"
        id={id}
        checked={on}
        onChange={onToggle}
      />
      <label htmlFor={id}>
        <span className="switch-x-text">Animations</span>
      </label>
    </div>
  );
}
