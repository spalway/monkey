// Path routing, no router dependency.
//
// Real paths rather than `#/`, which needs the server to answer any unknown
// path with index.html — server/index.mjs already does, since hash routing
// needed the same fallback for deep links.
//
// This lives in its own module rather than in App.jsx because the pages that
// link also get rendered by App: importing Link from there would make Landing
// and App import each other, and a cycle that happens to work today is a
// footgun tomorrow.

import { useEffect, useState } from 'react';

export function navigate(to) {
  if (window.location.pathname === to) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/// An internal link. Still a real anchor, so middle-click, ctrl-click, "open in
/// new tab" and "copy link address" all behave normally; only an unmodified
/// left click is intercepted.
export function Link({ to, children, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/// The current route, with slashes trimmed: "" | "mint" | "changelog/slug".
///
/// `#/`-style links from before are rewritten once on load, so anything already
/// shared or bookmarked lands where it meant to rather than on the home page.
export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const legacy = window.location.hash;
    if (legacy.startsWith('#/')) {
      window.history.replaceState({}, '', legacy.slice(1) || '/');
      setPath(window.location.pathname);
    }
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}
