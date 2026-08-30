// Stock artwork: one square tile per ticker, and the marquee on the landing page.

/// The file for one ticker.
///
/// The artwork is named after the underlying rather than the tokenised ticker in
/// one case, so the map holds the exceptions instead of the whole set.
const FILENAME = { MSFTx: 'MSFT' };

/// Each stock's own colour, taken from its mark. Used to tint the tile a stock
/// appears in, so the panel reads as belonging to that company rather than to
/// the site — the accent yellow said "Primates", not "NVIDIA".
const BRAND = {
  NVDAx: '#4CCA47',
  AAPLx: '#A6A6A6',
  TSLAx: '#EF0027',
  COINx: '#0052FF',
  SPYx: '#D6002A',
  GOOGLx: '#4285F4',
  METAx: '#0081FB',
  AMZNx: '#FD9700',
  AVGOx: '#CC092F',
  MSFTx: '#00A3EE',
};

/// Falls back to the site accent so an unknown ticker still renders a tile.
export const brandFor = (ticker) => BRAND[ticker] ?? 'var(--accent)';

export function logoFor(ticker) {
  return ticker ? `/logos/${FILENAME[ticker] ?? ticker}.svg` : null;
}

/// A single tile. Missing artwork removes the element rather than leaving a
/// broken-image glyph, so a new stock in the rotation degrades to text.
export function StockLogo({ ticker, size = 16, className = '' }) {
  const src = logoFor(ticker);
  if (!src) return null;

  return (
    <img
      className={`stock-logo ${className}`}
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

/// The rotation, looping.
///
/// Two copies of the list slide left by exactly half the track, so the seam
/// lands where the second copy starts and the reset is invisible. Duration is
/// derived from the pixel width rather than fixed, which keeps the speed
/// constant however many stocks are in the rotation.
export function LogoLoop({ tickers, size = 76, gap = 16, speed = 50, playing = true }) {
  if (!tickers.length) return null;

  const track = tickers.length * (size + gap);

  return (
    <div className="logoloop" style={{ '--logo-size': `${size}px`, '--logo-gap': `${gap}px` }}>
      <div
        className="logoloop-track"
        style={{
          animationDuration: `${track / speed}s`,
          animationPlayState: playing ? 'running' : 'paused',
        }}
      >
        {[0, 1].map((copy) => (
          <div className="logoloop-set" key={copy} aria-hidden={copy === 1}>
            {tickers.map((ticker) => (
              <img
                key={`${copy}-${ticker}`}
                className="logoloop-item"
                src={logoFor(ticker)}
                alt={copy === 0 ? ticker : ''}
                title={ticker}
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden';
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
