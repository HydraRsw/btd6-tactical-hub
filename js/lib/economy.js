// Farming maths. Pure functions only: give them builds and modifiers, they
// return numbers. Nothing here touches the page, so it is easy to check.
//
// A "build" comes from data/economy.json → farmBuilds, plus two fields the
// calculator adds: `enabled` (checkbox) and the user's edited numbers.
//
// Modifiers (from the Scenario panel):
//   bananaCentral    Banana Central on the map → +25% to every BRF
//   centralMarkets   0–10 Central Markets → +10% Merchantman income each
//   tradeEmpire      Trade Empire on the map → boat bonus (see below)
//   tradeAgreements  Monkey Knowledge → +$20 per Merchantman

const TRADE_EMPIRE_BOAT_LIMIT = 20;
const TRADE_EMPIRE_BONUS = { merchantman: 10, favoredTrades: 20 };

function findEnabled(builds, rule) {
  const build = builds.find((b) => b.incomeRule === rule);
  return build && build.enabled ? build : null;
}

/**
 * Trade Empire buffs up to 20 boats, Favored Trades first. Every buffed boat
 * earns +$10 per buffed Merchantman and +$20 per buffed Favored Trades.
 */
function tradeEmpireBoats(builds) {
  const favored = findEnabled(builds, 'fav')?.quantity ?? 0;
  const merchants = findEnabled(builds, 'merch')?.quantity ?? 0;
  const buffedFavored = Math.min(TRADE_EMPIRE_BOAT_LIMIT, favored);
  const buffedMerchants = Math.min(TRADE_EMPIRE_BOAT_LIMIT - buffedFavored, merchants);
  const bonusPerBoat =
    buffedMerchants * TRADE_EMPIRE_BONUS.merchantman + buffedFavored * TRADE_EMPIRE_BONUS.favoredTrades;
  return { buffedFavored, buffedMerchants, bonusPerBoat };
}

/** Average income per round for ONE tower of this build, after all bonuses. */
export function incomePerRound(build, builds, modifiers) {
  const base = build.incomePerRound;

  switch (build.incomeRule) {
    case 'brf': {
      const centralOwned = modifiers.bananaCentral || (findEnabled(builds, 'bc')?.quantity ?? 0) > 0;
      return centralOwned ? Math.floor(base * 1.25) : base;
    }

    case 'merch': {
      const agreements = modifiers.tradeAgreements ? 20 : 0;
      const markets = Math.min(10, Math.max(0, modifiers.centralMarkets));
      const boosted = (base + agreements) * (1 + 0.1 * markets);
      if (!modifiers.tradeEmpire || build.quantity === 0) return boosted;
      // Only the first boats are buffed, so spread the bonus across the fleet.
      const { buffedMerchants, bonusPerBoat } = tradeEmpireBoats(builds);
      return boosted + (bonusPerBoat * buffedMerchants) / build.quantity;
    }

    case 'fav': {
      if (!modifiers.tradeEmpire || build.quantity === 0) return base;
      const { buffedFavored, bonusPerBoat } = tradeEmpireBoats(builds);
      return base + (bonusPerBoat * buffedFavored) / build.quantity;
    }

    default:
      return base;
  }
}

/** Rounds until one tower has paid back its cost (Infinity if it never earns). */
export function paybackRounds(cost, income) {
  return income > 0 ? Math.ceil(cost / income) : Infinity;
}

/** Profit for the whole stack of this build after owning it for `rounds` rounds. */
export function netProfit(build, income, rounds) {
  return build.quantity * (income * rounds - build.cost);
}

/** Cash you get back by selling the whole stack. */
export function sellbackValue(build) {
  return build.quantity * build.cost * (build.sellbackPercent / 100);
}

/** Net cash for each round from 0..rounds if you sold everything at that point. */
export function sellOutCurve(build, income, rounds) {
  const points = [];
  for (let owned = 0; owned <= rounds; owned += 1) {
    points.push(Math.round(netProfit(build, income, owned) + sellbackValue(build)));
  }
  return points;
}
