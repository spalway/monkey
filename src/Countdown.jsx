/// Time until the next drop round, minutes and seconds.
///
/// Driven by the engine's own `lastRound + minInterval`, not a fixed timer, so
/// it cannot promise a round the program will refuse to run.

/// One digit pair, rendered as a column of every value it can hold and slid to
/// the right one. Sliding is what animates; the window only ever shows a single
/// row.
///
/// The column is real elements rather than a `content` string of `\A`-separated
/// numbers: the CSS escape has to be terminated by a space or the following
/// digits are swallowed into the hex escape, and it survives no tooling that
/// touches backslashes.
const COLUMN = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function Cell({ value, label }) {
  return (
    <div className="countdown-cell">
      <span className="countdown">
        <span
          className="countdown-digits"
          style={{ '--value': Math.min(value, COLUMN.length - 1) }}
          aria-live="polite"
          aria-label={`${value} ${label}`}
        >
          {COLUMN.map((n) => (
            <b key={n}>{n}</b>
          ))}
        </span>
      </span>
      {label}
    </div>
  );
}

export default function Countdown({ engine, now }) {
  if (!engine) return null;

  const remaining = Math.max(0, engine.lastRound + engine.minInterval - now);

  return (
    <div className="countdown-row">
      <Cell value={Math.floor(remaining / 60)} label="min" />
      <Cell value={remaining % 60} label="sec" />
    </div>
  );
}
