import { useEffect, useMemo } from 'react';
import { explorer } from './cluster.js';
import { ExternalLink } from 'lucide-react';
import * as sprites from './art/sprites.js';
import { deskLook, AllocationBar } from './DeskList.jsx';
import { WALKS } from './art/frames.js';
import { PixelArt, PixelWalk } from './PixelArt.jsx';
import { useSortedPage, Sorts, Pager } from './ListControls.jsx';


export default function MintedList({ minted, tickers = {}, vaultHoldings = {}, loadHoldings, animate = false }) {
  const { rows, sort, choose, page, pages, setPage, start } = useSortedPage(minted);

  // Each row carries the same colour-coded primate the desks page shows. Derived
  // from the address, so it is stable per desk — memoised because deriving it
  // means a full palette roll per row.
  const looks = useMemo(() => rows.map((desk) => ({ desk, look: deskLook(desk) })), [rows]);

  // Holdings for just the rows on screen — one batched call per page rather
  // than every minted desk in the collection.
  useEffect(() => {
    if (loadHoldings && rows.length) loadHoldings(rows.map((d) => d.vault));
  }, [rows, loadHoldings]);

  if (minted.length === 0) return <div className="note">Nothing minted yet.</div>;

  return (
    <>
      <Sorts sort={sort} choose={choose} count={minted.length} noun="minted" />

      <ol className="minted" start={start + 1}>
        {looks.map(({ desk, look }) => (
          <li key={desk.address.toBase58()} style={{ '--metal': look.metal, '--fur': look.colors.fur }}>
            {/* Name over the framed primate: the row reads as a labelled tile
                rather than a thumbnail with text trailing after it. */}
            <div className="minted-id">
              {/* Name, weight and both links share the top line; the primate sits
                  under them. */}
              <div className="minted-line">
                <span className="minted-name">{desk.name}</span>
                <span className="minted-weight">{desk.tier ? `${desk.tier.weight}×` : '—'}</span>
                <div className="minted-links">
                  <a className="linkbtn" href={explorer(desk.address)} target="_blank" rel="noreferrer">
                    Asset <ExternalLink size={11} strokeWidth={2} aria-hidden />
                  </a>
                  <a className="linkbtn" href={explorer(desk.vault)} target="_blank" rel="noreferrer">
                    Vault <ExternalLink size={11} strokeWidth={2} aria-hidden />
                  </a>
                </div>
              </div>
              <div className="minted-well">
                {animate ? (
                  <PixelWalk
                    walk={WALKS[look.slug]}
                    colors={look.colors}
                    nudges={look.nudges}
                    className="minted-art"
                  />
                ) : (
                  <PixelArt
                    sprite={sprites[look.slug]}
                    colors={look.colors}
                    nudges={look.nudges}
                    className="minted-art"
                  />
                )}
              </div>
            </div>
            <AllocationBar
              holdings={vaultHoldings[desk.vault.toBase58()]}
              tickers={tickers}
            />
          </li>
        ))}
      </ol>

      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}





