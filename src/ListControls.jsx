// Sorting and paging, shared by the home page's minted list and the holder's own
// desks — the two lists show the same objects, so they sort and page the same.

import { useMemo, useState } from 'react';

const PER_PAGE = 10;

/// Sorts are over the serial parsed from each desk's name.
///
/// Counters are per tier, so within a tier this is exact mint order and across
/// tiers it interleaves. Nothing in a Core asset records a creation time, so a
/// true global ordering would need a DAS index rather than an RPC account scan.
export const SORTS = {
  newest: { label: 'Newest', compare: (a, b) => b.serial - a.serial },
  oldest: { label: 'Oldest', compare: (a, b) => a.serial - b.serial },
  tier: {
    label: 'Tier',
    compare: (a, b) => (b.tier?.weight ?? 0) - (a.tier?.weight ?? 0) || b.serial - a.serial,
  },
};

/// Sorted, paged slice of a desk list, plus the state its controls need.
export function useSortedPage(items) {
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => [...items].sort(SORTS[sort].compare), [items, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const rows = useMemo(
    () => sorted.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE),
    [sorted, current],
  );

  const choose = (key) => { setSort(key); setPage(0); };
  return { rows, sort, choose, page: current, pages, setPage, start: current * PER_PAGE };
}

export function Sorts({ sort, choose, count, noun = 'minted' }) {
  return (
    <div className="sorts">
      {Object.entries(SORTS).map(([key, { label }]) => (
        <button
          key={key}
          type="button"
          className={`sort ${sort === key ? 'on' : ''}`}
          onClick={() => choose(key)}
        >
          {label}
        </button>
      ))}
      <span className="sorts-count">
        {count} {noun}
      </span>
    </div>
  );
}

export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button type="button" className="page-step" onClick={() => setPage(page - 1)} disabled={page === 0}>
        ←
      </button>
      {Array.from({ length: pages }, (_, i) => (
        <button
          key={i}
          type="button"
          className={`page-no ${i === page ? 'on' : ''}`}
          onClick={() => setPage(i)}
        >
          {i + 1}
        </button>
      ))}
      <button
        type="button"
        className="page-step"
        onClick={() => setPage(page + 1)}
        disabled={page === pages - 1}
      >
        →
      </button>
    </div>
  );
}

