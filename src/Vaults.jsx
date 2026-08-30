import DeskList, { Shell } from './DeskList.jsx';

export default function Vaults({ engine, desks, tickers, error, sweep, busy }) {

  return (
    <>
      <section className="hero">
        <h1>Your vaults.</h1>
        <p>
          Each vault is derived from its desk, not held by you. Whatever a round
          delivers lands here, and it transfers with the NFT when the desk sells.
        </p>
      </section>

      {error && (
        <section>
          <div className="note error">{error}</div>
        </section>
      )}

      <Shell title="Your desks">
        <DeskList
          desks={desks}
          engine={engine}
          tickers={tickers}
          onSweep={sweep}
          busy={busy}
          empty="No desks yet. Mint one to open a vault."
        />
      </Shell>
    </>
  );
}
