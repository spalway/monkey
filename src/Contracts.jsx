// Program and collection addresses. On the landing page this heads the Live
// section; everywhere else it stays in the footer.

import { explorer, CLUSTER_LABEL } from './cluster.js';
import { PROGRAM_ID } from './primates.js';


export default function Contracts({ config, bare = false }) {
  const rows = (
    <div className="rows contracts-rows">
      <div className="row">
        <span>program</span>
        <a href={explorer(PROGRAM_ID)} target="_blank" rel="noreferrer">
          {PROGRAM_ID.toBase58()}
        </a>
      </div>
      <div className="row">
        <span>collection</span>
        {config ? (
          <a href={explorer(config.collection)} target="_blank" rel="noreferrer">
            {config.collection.toBase58()}
          </a>
        ) : (
          <span>—</span>
        )}
      </div>
    </div>
  );

  // Inside an existing shell it brings its own label but not a second container.
  if (bare) {
    return (
      <>
        <div className="label">
          <span>Contracts</span>
          <span>{CLUSTER_LABEL}</span>
        </div>
        {rows}
      </>
    );
  }

  return (
    <footer>
      <div className="shell">
        <div className="label">
          <span>Contracts</span>
          <span>{CLUSTER_LABEL}</span>
        </div>
        {rows}
      </div>
    </footer>
  );
}


