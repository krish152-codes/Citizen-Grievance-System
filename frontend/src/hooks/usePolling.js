import { useEffect, useRef } from 'react';

// Calls `fn` every `ms` while the browser tab is visible (and once when the tab
// becomes visible again). Used to keep drain data live without a page refresh.
export default function usePolling(fn, ms, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => { if (!document.hidden) fnRef.current(); };
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [ms, enabled]);
}
