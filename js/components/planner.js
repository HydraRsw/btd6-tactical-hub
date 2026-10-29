// Planner (Tools tab): lay out a run round by round — which towers you buy,
// when you upgrade them, and when (or whether) you place a hero — then see
// whether you can afford each step and whether you'll have Camo and Lead
// answers by the rounds that need them.
//
// A build is plain data, so it can be saved in the browser and shared as a link:
//   { mode, setId, halfCash, mapId, towers: [{ key, tower, steps: [{ round, path }] }] }
// An entry whose `tower` is a hero id is the hero (only its first step's round matters).

import {
  DIFFICULTIES, cashAtRoundStart, crosspathProblem, firstRoundWith, heroLevels,
  meetsRule, pathText, toPath, upgradeCost,
} from '../lib/game.js';
import { formatCash } from '../lib/text.js';
import { recall, remember } from '../lib/storage.js';

// Game modes the planner understands: prices, first round and last round.
export const PLAN_MODES = [
  { id: 'chimps', label: 'CHIMPS', difficulty: 2, start: 6, end: 100 },
  { id: 'impoppable', label: 'Impoppable', difficulty: 3, start: 6, end: 100 },
  { id: 'hard', label: 'Hard', difficulty: 2, start: 3, end: 80 },
  { id: 'medium', label: 'Medium', difficulty: 1, start: 1, end: 60 },
  { id: 'easy', label: 'Easy', difficulty: 0, start: 1, end: 40 },
];

const EMPTY_BUILD = { mode: 'chimps', setId: 'regular', halfCash: false, mapId: 'logs', towers: [] };

let nextKey = Date.now();

/** Older saved builds kept the hero in heroId/heroRound; turn that into a hero entry. */
function upgradeBuild(saved) {
  const build = { ...EMPTY_BUILD, ...(saved ?? {}), towers: [...(saved?.towers ?? [])] };
  if (build.heroId) {
    build.towers.unshift({ key: nextKey++, tower: build.heroId, steps: [{ round: build.heroRound ?? 6, path: '0-0-0' }] });
  }
  delete build.heroId;
  delete build.heroRound;
  return build;
}

/** Reads a shared build from ?build=… in the address, if there is one. */
function buildFromUrl() {
  try {
    const encoded = new URLSearchParams(location.search).get('build');
    if (!encoded) return null;
    const json = decodeURIComponent(escape(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function encodeBuild(build) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(build)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildPlanner() {
  return {
    PLAN_MODES,
    DIFFICULTIES,
    formatCash,
    pathText,
    build: upgradeBuild(recall('plannerBuild', null)),
    newUnit: 'dart',
    newRound: 6,
    copied: false,
    templateId: '',

    init() {
      const shared = buildFromUrl();
      if (shared) {
        this.build = upgradeBuild(shared);
        history.replaceState(null, '', location.pathname + location.hash);
      }
      this.newRound = this.mode.start;
      this.$watch('build', (value) => remember('plannerBuild', value), { deep: true });
    },

    // --- Settings ---------------------------------------------------------
    get mode() {
      return PLAN_MODES.find((m) => m.id === this.build.mode) ?? PLAN_MODES[0];
    },

    get rounds() {
      const sets = this.$store.hub.rounds.sets;
      return (sets.find((s) => s.id === this.build.setId) ?? sets[0]).rounds;
    },

    get map() {
      return this.$store.hub.maps.maps.find((m) => m.id === this.build.mapId) ?? null;
    },

    unitData(id) {
      return this.$store.hub.units.find((u) => u.id === id);
    },

    isHero(entry) {
      return this.unitData(entry.tower)?.category === 'Heroes';
    },

    /** The hero entry, if the build has one. */
    get heroEntry() {
      return this.build.towers.find((entry) => this.isHero(entry)) ?? null;
    },

    get hero() {
      return this.heroEntry ? this.unitData(this.heroEntry.tower) : null;
    },

    get heroRound() {
      return this.heroEntry ? this.clampRound(this.heroEntry.steps[0].round) : null;
    },

    clampRound(value) {
      return Math.min(this.mode.end, Math.max(this.mode.start, Math.round(Number(value) || this.mode.start)));
    },

    // --- Editing ----------------------------------------------------------
    /** Add the tower or hero picked in the "Add" row. A second hero replaces the first. */
    addUnit() {
      const round = this.clampRound(this.newRound);
      const unit = this.unitData(this.newUnit);
      if (!unit) return;
      if (unit.category === 'Heroes') {
        this.build.towers = this.build.towers.filter((entry) => !this.isHero(entry));
      }
      this.build.towers.push({ key: nextKey++, tower: unit.id, steps: [{ round, path: '0-0-0' }] });
    },

    removeTower(index) {
      this.build.towers.splice(index, 1);
    },

    /** Add an upgrade step: starts from the tower's latest crosspath, a few rounds later. */
    addStep(entry) {
      const last = entry.steps.at(-1);
      entry.steps.push({ round: this.clampRound(last.round + 5), path: last.path });
    },

    removeStep(entry, index) {
      if (entry.steps.length > 1) entry.steps.splice(index, 1);
    },

    /** Nudge one path of a step up or down (keeps it a legal crosspath). */
    bump(step, pathIndex, delta) {
      const path = toPath(step.path);
      path[pathIndex] = Math.min(5, Math.max(0, path[pathIndex] + delta));
      if (!crosspathProblem(path)) step.path = pathText(path);
    },

    reset() {
      this.build = { ...EMPTY_BUILD, towers: [] };
    },

    // --- Templates --------------------------------------------------------
    get templates() {
      return this.$store.hub.templates.templates;
    },

    get template() {
      return this.templates.find((t) => t.id === this.templateId) ?? null;
    },

    loadTemplate() {
      const t = this.template;
      if (!t) return;
      this.build = {
        ...EMPTY_BUILD,
        mapId: this.build.mapId,
        setId: this.build.setId,
        mode: t.mode,
        towers: t.entries.map((entry) => ({ key: nextKey++, tower: entry.tower, steps: entry.steps.map((s) => ({ ...s })) })),
      };
    },

    async share() {
      const url = `${location.origin}${location.pathname}?build=${encodeBuild(this.build)}#planner`;
      try {
        await navigator.clipboard.writeText(url);
        this.copied = true;
        setTimeout(() => (this.copied = false), 2500);
      } catch {
        window.prompt('Copy this link:', url);
      }
    },

    // --- Derived numbers --------------------------------------------------
    /** Every purchase as { round, label, cost }, sorted by round. Steps are checked against each other. */
    get purchases() {
      const diff = this.mode.difficulty;
      const list = [];
      this.build.towers.forEach((entry) => {
        const unit = this.unitData(entry.tower);
        if (!unit) return;
        if (unit.category === 'Heroes') {
          list.push({ round: this.clampRound(entry.steps[0].round), label: `${unit.name} (hero)`, cost: unit.cost?.[diff] ?? 0, kind: 'hero', key: entry.key });
          return;
        }
        let previous = null;
        [...entry.steps].sort((a, b) => a.round - b.round).forEach((step) => {
          const path = toPath(step.path);
          const lowered = previous && path.some((tier, i) => tier < previous[i]);
          const problem = crosspathProblem(path) || (lowered ? "Upgrades can't be undone: this step goes below the previous one." : '');
          const cost = problem ? 0 : upgradeCost(unit, previous, path, diff);
          const label = previous ? `${unit.name} → ${step.path}` : `${unit.name} ${step.path}`;
          list.push({ round: step.round, label, cost, problem, kind: 'tower', key: entry.key });
          if (!problem) previous = path;
        });
      });
      return list.sort((a, b) => a.round - b.round);
    },

    /** Cash before spending, at the start of each round. */
    get bank() {
      return cashAtRoundStart(this.rounds, { startRound: this.mode.start, startCash: this.$store.hub.rounds.startCash, halfCash: this.build.halfCash });
    },

    /** One row per round that has a purchase or a danger round. */
    get timeline() {
      const danger = Object.fromEntries(this.$store.hub.playbook.dangerRounds.map((r) => [r.round, r]));
      const byRound = {};
      for (const p of this.purchases) (byRound[p.round] ??= []).push(p);
      const rounds = new Set([...Object.keys(byRound).map(Number), ...(this.build.setId === 'regular' ? Object.keys(danger).map(Number) : [])]);
      return [...rounds]
        .filter((r) => r >= this.mode.start && r <= this.mode.end)
        .sort((a, b) => a - b)
        .map((round) => {
          const spentBefore = this.purchases.filter((p) => p.round < round).reduce((sum, p) => sum + p.cost, 0);
          const buys = byRound[round] ?? [];
          const cost = buys.reduce((sum, p) => sum + p.cost, 0);
          const cashBefore = (this.bank[round] ?? 0) - spentBefore;
          return {
            round,
            buys,
            cost,
            cashBefore,
            cashAfter: cashBefore - cost,
            short: cost > cashBefore ? cost - cashBefore : 0,
            danger: danger[round] ?? null,
            snapshot: this.snapshot(round),
            spent: spentBefore + cost,
          };
        });
    },

    get totals() {
      const spent = this.purchases.reduce((sum, p) => sum + p.cost, 0);
      const firstShort = this.timeline.find((row) => row.short > 0) ?? null;
      const earned = this.bank[this.mode.end + 1] ?? 0;
      return { spent, earned, left: earned - spent, firstShort };
    },

    /** The build at the start of a round (after that round's purchases): towers with their crosspath, hero level. */
    snapshot(round) {
      const towers = this.build.towers
        .filter((entry) => !this.isHero(entry))
        .map((entry) => {
          const steps = entry.steps.filter((s) => s.round <= round && !crosspathProblem(toPath(s.path))).sort((a, b) => a.round - b.round);
          return steps.length ? { tower: this.unitData(entry.tower), path: toPath(steps.at(-1).path) } : null;
        })
        .filter((item) => item?.tower);
      return { towers, heroLevel: this.heroLevelAt(round) };
    },

    get heroCurve() {
      if (!this.hero) return [];
      return heroLevels(this.rounds, {
        xpModifier: this.hero.xpModifier ?? 1,
        placeRound: this.heroRound,
        mapDifficulty: this.map?.difficulty ?? 'Beginner',
      });
    },

    heroLevelAt(round) {
      return this.heroCurve[round] ?? null;
    },

    /** Can the build at this round handle a Bloon property? Returns the towers/hero that cover it. */
    coverage(kind, round) {
      const { towers, heroLevel } = this.snapshot(round);
      const who = towers.filter(({ tower, path }) => meetsRule(tower.detection?.[kind], path)).map(({ tower, path }) => `${tower.name} ${pathText(path)}`);
      const heroNeeds = kind === 'camo' ? this.hero?.camoLevel : this.hero?.leadLevel;
      if (this.hero && heroLevel !== null && heroNeeds !== null && heroNeeds !== undefined && heroLevel >= Math.max(1, heroNeeds)) {
        who.push(`${this.hero.name} (level ${heroLevel})`);
      }
      return who;
    },

    /** First Camo and Lead rounds in this mode, and whether the build covers them. */
    get checks() {
      return ['camo', 'lead'].map((kind) => {
        const round = firstRoundWith(this.rounds, kind, this.mode.start);
        if (!round || round > this.mode.end) return { kind, round: null, who: [] };
        return { kind, round, who: this.coverage(kind, round) };
      });
    },

    stepCost(entry, index) {
      const unit = this.unitData(entry.tower);
      if (unit?.category === 'Heroes') return unit.cost?.[this.mode.difficulty] ?? 0;
      const sorted = [...entry.steps].sort((a, b) => a.round - b.round);
      const step = entry.steps[index];
      const prior = sorted.filter((s) => s !== step && s.round <= step.round && sorted.indexOf(s) < sorted.indexOf(step)).at(-1);
      const to = toPath(step.path);
      if (crosspathProblem(to)) return null;
      return upgradeCost(unit, prior ? toPath(prior.path) : null, to, this.mode.difficulty);
    },

    stepProblem(step) {
      return crosspathProblem(toPath(step.path));
    },
  };
}
