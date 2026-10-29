// Game maths shared by the round browser, the CHIMPS planner, tower and hero
// pages and the Paragon degree calculator. Pure functions: data in, numbers out.

// --- Difficulties ----------------------------------------------------------
// Prices in the data are lists in this order: [Easy, Medium, Hard, Impoppable].
export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'impoppable', label: 'Impoppable' },
];

export function difficultyIndex(id) {
  return Math.max(0, DIFFICULTIES.findIndex((d) => d.id === id));
}

// --- Bloons ----------------------------------------------------------------
const BLOON_COLORS = {
  Red: '#ff4d4d', Blue: '#3aa0ff', Green: '#62d02b', Yellow: '#ffe13a', Pink: '#ff7fc8',
  Black: '#2a2a33', White: '#f2f4f7', Purple: '#a14dff', Lead: '#8f98a3', Zebra: '#d9d9d9',
  Rainbow: 'linear-gradient(90deg,#ff4d4d,#ffd23f,#62d02b,#3aa0ff,#a14dff)', Ceramic: '#c27a3c',
  MOAB: '#3d8fe0', BFB: '#e23b3b', ZOMG: '#86d630', DDT: '#3c4a3c', BAD: '#a03ad6',
};
const BLIMPS = ['MOAB', 'BFB', 'ZOMG', 'DDT', 'BAD'];

/** "Fortified Camo Regrow Ceramic" → { base: 'Ceramic', camo: true, regrow: true, fortified: true } */
export function parseBloon(name) {
  const words = name.split(' ');
  const base = words.at(-1);
  const has = (word) => words.includes(word);
  return {
    name,
    base,
    camo: has('Camo') || base === 'DDT',
    regrow: has('Regrow'),
    fortified: has('Fortified'),
    blimp: BLIMPS.includes(base),
    color: BLOON_COLORS[base] ?? '#888',
  };
}

// Round tags used by the filters, in display order.
export const ROUND_TAGS = [
  { id: 'camo', label: 'Camo', test: (b) => b.camo },
  { id: 'lead', label: 'Lead', test: (b) => b.base === 'Lead' || b.base === 'DDT' },
  { id: 'purple', label: 'Purple', test: (b) => b.base === 'Purple' },
  { id: 'black', label: 'Black/Zebra', test: (b) => ['Black', 'Zebra', 'DDT'].includes(b.base) },
  { id: 'regrow', label: 'Regrow', test: (b) => b.regrow },
  { id: 'fortified', label: 'Fortified', test: (b) => b.fortified },
  { id: 'blimp', label: 'MOAB-class', test: (b) => b.blimp },
];

/** Tag ids for one round, e.g. ['camo', 'lead', 'blimp'] */
export function roundTags(round) {
  const bloons = round.groups.map((group) => parseBloon(group.bloon));
  return ROUND_TAGS.filter((tag) => bloons.some(tag.test)).map((tag) => tag.id);
}

/** First round number (in [from, 140]) that has a tag, or null. */
export function firstRoundWith(rounds, tagId, from = 1) {
  const tag = ROUND_TAGS.find((t) => t.id === tagId);
  const round = rounds.find((r) => r.round >= from && r.groups.some((g) => tag.test(parseBloon(g.bloon))));
  return round?.round ?? null;
}

// --- Cash ------------------------------------------------------------------
/** Cash a round pays (pops + end-of-round bonus). */
export function roundCash(round, { halfCash = false } = {}) {
  return (round.popCash + round.bonusCash) * (halfCash ? 0.5 : 1);
}

/**
 * Cash you'd have at the start of every round if you spent nothing:
 * result[r] = start cash + everything earned in rounds startRound … r-1.
 */
export function cashAtRoundStart(rounds, { startRound = 1, startCash = 650, halfCash = false } = {}) {
  const result = [];
  let cash = startCash;
  for (const round of rounds) {
    if (round.round < startRound) continue;
    result[round.round] = cash;
    cash += roundCash(round, { halfCash });
  }
  result[rounds.length + 1] = cash;
  return result;
}

// --- Towers ----------------------------------------------------------------
/** "2-0-5" ⇄ [2, 0, 5] */
export const toPath = (text) => String(text).split('-').map(Number);
export const pathText = (path) => path.join('-');

/** Why a crosspath isn't allowed in the game, or '' if it is. */
export function crosspathProblem([a, b, c]) {
  const tiers = [a, b, c];
  if (tiers.some((t) => !Number.isInteger(t) || t < 0 || t > 5)) return 'Each path goes from 0 to 5.';
  if (tiers.filter((t) => t > 0).length > 2) return 'Only two paths can be upgraded.';
  if (tiers.filter((t) => t > 2).length > 1) return 'Only one path can go past tier 2.';
  return '';
}

/** Price of going from crosspath `from` to `to` (both [a, b, c]) on a difficulty. Includes the base tower when `from` is null. */
export function upgradeCost(tower, from, to, diff = 2) {
  if (!tower?.costs) return 0;
  let total = from ? 0 : tower.costs.base[diff];
  const start = from ?? [0, 0, 0];
  for (let path = 0; path < 3; path += 1) {
    for (let tier = start[path] + 1; tier <= to[path]; tier += 1) {
      total += tower.costs.upgrades[path][tier - 1][diff];
    }
  }
  return total;
}

/** True when a tower at this crosspath meets any of the rules ([[0,0,2]] = bottom path ≥ 2). */
export function meetsRule(rules, path) {
  return Array.isArray(rules) && rules.some((rule) => rule.every((min, i) => path[i] >= min));
}

// --- Heroes ----------------------------------------------------------------
// XP to go from level n-1 to n at ×1.0 (index = level). Heroes with a higher
// XP modifier need proportionally more.
const LEVEL_XP = [0, 0, 180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280];
export const MAP_XP = { Beginner: 1, Intermediate: 1.1, Advanced: 1.2, Expert: 1.3 };

/** Total XP needed for each level (index = level). */
export function heroXpTable(xpModifier = 1) {
  let total = 0;
  return LEVEL_XP.map((xp, level) => (level < 1 ? null : (total += Math.round(xp * xpModifier))));
}

/**
 * The hero's level at the start of each round when placed on `placeRound`.
 * XP arrives at the end of each round (the rounds data has XP per round).
 * result[r] = level at the start of round r (undefined before placement).
 */
export function heroLevels(rounds, { xpModifier = 1, placeRound = 1, mapDifficulty = 'Beginner', lastRound = 140 } = {}) {
  const needed = heroXpTable(xpModifier);
  const multiplier = MAP_XP[mapDifficulty] ?? 1;
  const levels = [];
  let xp = 0;
  let level = 1;
  for (const round of rounds) {
    if (round.round < placeRound) continue;
    if (round.round > lastRound) break;
    levels[round.round] = level;
    xp += round.xp * multiplier;
    while (level < 20 && xp >= needed[level + 1]) level += 1;
  }
  levels[Math.min(lastRound, rounds.length) + 1] = level;
  return levels;
}

/** Round at which the hero reaches each level (index = level), or null if it doesn't by round 100. */
export function levelRounds(rounds, options) {
  const levels = heroLevels(rounds, { ...options, lastRound: 100 });
  const reached = Array(21).fill(null);
  levels.forEach((level, round) => {
    if (level !== undefined && reached[level] === null) reached[level] = Math.max(round - 1, options.placeRound ?? 1);
  });
  reached[1] = options.placeRound ?? 1;
  return reached;
}

// --- Paragons --------------------------------------------------------------
export const PARAGON_POWER_CAPS = { cash: 80000, tier5: 50000, damage: 125000 };

/** Power needed for a degree (1–100), from the wiki's formula. */
export function powerForDegree(degree) {
  if (degree <= 1) return 0;
  if (degree >= 100) return 200000;
  return Math.floor((50 * degree ** 3 + 5025 * degree ** 2 + 168324 * degree + 843000) / 600);
}

export function degreeForPower(power) {
  let degree = 1;
  while (degree < 100 && power >= powerForDegree(degree + 1)) degree += 1;
  return degree;
}

/** Boss damage multiplier for a degree: +25% every 20 degrees; Elite bosses take double. */
export function bossMultiplier(degree, elite = false) {
  const normal = 1 + Math.floor(degree / 20) * 0.25;
  return elite ? normal * 2 : normal;
}

/**
 * Paragon power from each source, capped. `paragonCost` is the price on the
 * chosen difficulty: cash buys 1 power per (cost ÷ 20,000), the slider 5% less.
 */
export function paragonPower({ paragonCost, towerCash = 0, sliderCash = 0, extraTier5 = 0, damage = 0, income = 0, totems = 0 }) {
  const perPower = paragonCost / 20000;
  const cashRaw = towerCash / perPower + sliderCash / (perPower * 1.05);
  const parts = {
    cash: Math.min(PARAGON_POWER_CAPS.cash, Math.floor(cashRaw)),
    tier5: Math.min(PARAGON_POWER_CAPS.tier5, extraTier5 * 6000),
    damage: Math.min(PARAGON_POWER_CAPS.damage, Math.floor(damage / 180 + income / 45)),
    totems: totems * 2000,
  };
  return { ...parts, total: parts.cash + parts.tier5 + parts.damage + parts.totems, perPower };
}

// --- Freeplay scaling (from the wiki's Rounds page) -------------------------
/** Bloon speed multiplier on a round (1 = normal). */
export function freeplaySpeed(round) {
  if (round <= 80) return 1;
  const base = round <= 100 ? 1 : round <= 150 ? 1.18 : round <= 200 ? 1.58 : round <= 251 ? 2.08 : 2.56;
  return base + (round - 80) * 0.02;
}

/** MOAB-class health multiplier on a round (1 = normal). */
export function freeplayMoabHealth(round) {
  if (round <= 80) return 1;
  if (round <= 100) return 1 + (round - 80) * 0.02;
  if (round <= 124) return 1.4 + (round - 100) * 0.05;
  if (round <= 150) return 2.6 + (round - 124) * 0.15;
  if (round <= 250) return 6.5 + (round - 150) * 0.35;
  if (round <= 300) return 41.5 + (round - 250) * 1;
  if (round <= 400) return 91.5 + (round - 300) * 1.5;
  if (round <= 500) return 241.5 + (round - 400) * 2.5;
  return 491.5 + (round - 500) * 5;
}

/** Share of normal cash per pop on a round. */
export function cashPerPop(round) {
  if (round <= 50) return 1;
  if (round <= 60) return 0.5;
  if (round <= 85) return 0.2;
  if (round <= 100) return 0.1;
  if (round <= 120) return 0.05;
  if (round <= 140) return 0.04;
  return 0.02;
}
