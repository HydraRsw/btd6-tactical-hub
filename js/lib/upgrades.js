// Turns crosspath notation ("2-0-5") into the 3 × 5 grid of upgrade pips.
//
// Each path becomes five pip states:
//   'bought'  tier already purchased
//   'tier5'   the tier-5 upgrade (drawn gold)
//   'empty'   not purchased
//   'unknown' route still settling (written as "x" or "?", or "—")

const PATHS = 3;
const TIERS = 5;

/** "2-0-5" → [2, 0, 5]; "5-x-x" → [5, null, null]; anything else → [null, null, null] */
export function parseRoute(route) {
  const match = /^([0-5x?])-([0-5x?])-([0-5x?])$/i.exec(String(route ?? '').trim());
  if (!match) return [null, null, null];
  return match.slice(1).map((part) => (/\d/.test(part) ? Number(part) : null));
}

/** "2-0-5" → [['bought','bought','empty','empty','empty'], [...], [...]] */
export function pipRows(route) {
  return parseRoute(route).slice(0, PATHS).map((bought) =>
    Array.from({ length: TIERS }, (_, index) => {
      const tier = index + 1;
      if (bought === null) return 'unknown';
      if (tier > bought) return 'empty';
      return tier === TIERS ? 'tier5' : 'bought';
    }),
  );
}
