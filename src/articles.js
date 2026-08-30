// Changelog articles.
//
// Plain data, newest first — adding one means adding an object here and
// dropping a 1500x600 thumbnail into /public. Bodies are blocks rather than
// JSX so an article can be written without touching a component:
//
//   { h:    'A heading' }
//   { p:    'A paragraph.' }
//   { list: ['a bullet', 'another'] }
//   { note: 'A callout with the warning icon.' }
//   { code: 'a preformatted block' }
//
// `accent` colours the title and the version chip. It defaults to the site
// yellow, so an article only needs one if it wants to look different.
//
// Any block may carry `devnetOnly: true`. Those describe the test network and
// would be false on a live site, so they are dropped when the cluster is
// mainnet rather than left to be spotted and reworded later.

export const ARTICLES = [
  {
    slug: 'introducing-primates-app',
    number: 1,
    title: 'Introducing Primates.app',
    version: '1.10.002',
    accent: '#ffcf2b',
    thumb: '/changelog_introducing_primates_app.png',
    summary:
      'Three tiers of desk pass, a vault per desk that the holder alone can spend from, and an engine that buys tokenised stocks and splits them by weight.',
    body: [
      {
        p: 'Primates is a set of NFTs that own their own money. Each desk pass is a Metaplex Core asset, and each one has a vault that fills with tokenised real-world assets bought out of protocol revenue. Hold the pass and the vault is yours. Sell the pass and the vault goes with it, contents included.',
      },
      {
        p: 'That last part is the whole design, and it is worth being precise about why it works the way it does.',
      },

      { h: 'The vault is derived, not held' },
      {
        p: 'Every Metaplex Core asset has a signer PDA at ["mpl-core-execute", asset]. That address is the desk\'s vault. It is computed from the asset\'s own address, stored nowhere, and only the asset\'s current owner can make it sign.',
      },
      {
        p: 'So there is no custody contract to withdraw from before a sale, no migration step, and no code of ours standing between a holder and their balance. The permission check belongs to Core, and it is a check on who owns the NFT. When the desk transfers, the right to spend transfers in the same instruction.',
      },

      { h: 'Three tiers, one number' },
      {
        p: 'Monkey, Ape and Kong desks carry weights of 1x, 3x and 9x. The weight is read off the asset when it is registered and is the only input to how much of each drop a desk receives — a Kong earns nine times what a Monkey earns from the same purchase, every time, because the split is arithmetic on those weights and nothing else.',
      },

      { h: 'The engine' },
      {
        p: 'Protocol revenue is swept and split — 20% to the protocol, 80% to the pot. On a cadence set on-chain, the pot buys the next tokenised stock in a ten-stock rotation, and the purchase is credited across every registered desk by weight.',
      },
      {
        p: 'Crediting is one number, not a loop. Each rotation slot carries a per-weight accumulator, and a round adds to it:',
      },
      { code: 'acc_per_weight[slot] += amount * ACC_SCALE / total_weight' },
      {
        p: 'Each desk remembers the value it last settled at, and what it is owed is the distance the accumulator has travelled since, times its own weight. A round therefore costs the same whether ten desks exist or ten thousand, and a desk that nobody has touched since minting is still owed everything it accrued.',
      },
      {
        p: 'Delivery is a separate, permissionless instruction. Anyone can settle any desk, because the only thing settling can do is send a desk what it is already owed. No holder is ever waiting on us to run a crank.',
      },

      { h: 'Sweeping' },
      {
        p: 'Holders can move tokens out of a vault and into their own wallet — any share of any holding, or all of it. This needed no new program code: Core\'s Execute instruction lets the current owner make the vault sign a plain token transfer, so the whole feature is a client-side transaction that ownership of the NFT authorises.',
      },
      {
        p: 'Sweeping first and then selling is equivalent to selling and letting the buyer sweep. The choice is about who ends up holding the stocks, not about how much there is.',
      },

      { h: 'The artwork' },
      {
        p: 'Every desk looks like itself. The colourway is rolled from the asset\'s own address, so it is recomputable by anyone holding that address and stored by nobody — the program records no seed and the site keeps no table. Each tier has its own hand-timed walk cycle, and the tab icon is the Kong walk rasterised frame by frame.',
      },

      { h: 'Where this is' },
      {
        devnetOnly: true,
        list: [
          'Running on devnet. The stocks in the rotation are mock mints with no value and the SOL is test SOL.',
          'Fee sweeping still runs through an operator key. pump.fun\'s fee-sharing config can make the split on-chain and permissionless, which removes that key from the recurring loop — designed, not shipped.',
          'Buying happens off-chain. The engine credits what arrives in its holding account; closing that gap means a program-owned pot and a swap CPI.',
          'Token metadata still points at placeholder art rather than the generated sprites the site renders.',
          'Securities and jurisdiction review has not happened. xStocks exclude U.S. persons, and that question needs answering before mainnet rather than after.',
        ],
      },
      {
        note: 'Nothing here is an offer, and none of it is investment advice.',
      },
    ],
  },
];

export const articleBySlug = (slug) => ARTICLES.find((a) => a.slug === slug) ?? null;
