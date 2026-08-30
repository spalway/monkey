import { useEffect, useRef, useState } from 'react';

/// Drive several walk cycles and a colour change from one clock.
///
/// Every sprite could run its own timer — PixelWalk does exactly that on its own
/// — but three independent `setTimeout` chains drift apart within seconds, and
/// this is the case where that shows: the primates stand side by side and change
/// colour together, so a few tens of milliseconds of drift reads as one of them
/// changing late.
///
/// So frame indices and the colour index are all derived from a single elapsed
/// time. State updates only when a derived value actually changes, which is a few
/// times a second rather than once per tick.
///
/// `timings` is an array of per-frame hold arrays, one per sprite. They are
/// expected to sum to the same cycle length; if they do not, `cycle` follows the
/// longest and the shorter sprites simply repeat within it.
export function useCycleSync(timings, playing = true) {
  const cycleMs = Math.max(...timings.map((t) => t.reduce((a, b) => a + b, 0)));

  const frameAt = (timing, ms) => {
    const total = timing.reduce((a, b) => a + b, 0);
    let t = ms % total;
    for (let i = 0; i < timing.length; i++) {
      if (t < timing[i]) return i;
      t -= timing[i];
    }
    return timing.length - 1;
  };

  const derive = (ms) => ({
    frames: timings.map((t) => frameAt(t, ms)),
    cycle: Math.floor(ms / cycleMs),
  });

  const [state, setState] = useState(() => derive(0));
  // Elapsed time survives a pause, so resuming continues the stride rather than
  // snapping back to the start of the cycle.
  const elapsed = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!playing) return undefined;
    const start = performance.now() - elapsed.current;
    const id = setInterval(() => {
      elapsed.current = performance.now() - start;
      const next = derive(elapsed.current);
      const prev = stateRef.current;
      if (next.cycle !== prev.cycle || next.frames.some((f, i) => f !== prev.frames[i])) {
        setState(next);
      }
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, cycleMs, timings.length]);

  return state;
}
