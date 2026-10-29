// "What should I use here?" (#wizard): pick a map, a mode and optionally a hero
// and get a plan built from the site's own data — the opener, a hero, win
// conditions with the route for that mode, how Camo and Lead get covered, the
// danger rounds, and the map and mode notes. Boss events use the boss pages.

import { firstRoundWith, meetsRule, toPath } from '../lib/game.js';
import { recall, remember } from '../lib/storage.js';

// Game modes the wizard knows: which tier list they use, which rounds they cover,
// and which tower classes are allowed.
export const WIZARD_MODES = [
  { id: 'chimps', tiers: 'chimps', start: 6, end: 100 },
  { id: 'impoppable', tiers: 'normal', start: 6, end: 100 },
  { id: 'hard', tiers: 'normal', start: 3, end: 80 },
  { id: 'half-cash', tiers: 'normal', start: 3, end: 80 },
  { id: 'double-hp-moabs', tiers: 'normal', start: 3, end: 80 },
  { id: 'abr', tiers: 'normal', start: 3, end: 80 },
  { id: 'magic-only', tiers: 'normal', start: 3, end: 80, only: 'Magic' },
  { id: 'medium', tiers: 'normal', start: 1, end: 60 },
  { id: 'military-only', tiers: 'normal', start: 1, end: 60, only: 'Military' },
  { id: 'reverse', tiers: 'normal', start: 1, end: 60 },
  { id: 'apopalypse', tiers: 'normal', start: 1, end: 60 },
  { id: 'deflation', tiers: 'normal', start: 31, end: 60 },
  { id: 'easy', tiers: 'normal', start: 1, end: 40 },
  { id: 'primary-only', tiers: 'normal', start: 1, end: 40, only: 'Primary' },
  { id: 'freeplay', tiers: 'normal', start: 1, end: 140 },
  { id: 'boss', tiers: 'boss', start: 1, end: 140 },
];

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];
const DETECTION_TAGS = [
  { id: 'camo', rule: 'camo', heroLevel: 'camoLevel', label: 'Camo' },
  { id: 'lead', rule: 'lead', heroLevel: 'leadLevel', label: 'Lead' },
];

export function wizardTool() {
  const saved = recall('wizard', {});
  return {
    WIZARD_MODES,
    mapId: saved.mapId ?? 'monkey-meadow',
    modeId: saved.modeId ?? 'chimps',
    heroId: saved.heroId ?? '',
    bossId: saved.bossId ?? 'bloonarius',

    init() {
      this.$watch('[mapId, modeId, heroId, bossId]', () => remember('wizard', { mapId: this.mapId, modeId: this.modeId, heroId: this.heroId, bossId: this.bossId }));
    },

    get hub() {
      return this.$store.hub;
    },

    get map() {
      return this.hub.maps.maps.find((m) => m.id === this.mapId) ?? this.hub.maps.maps[0];
    },

    get mode() {
      return WIZARD_MODES.find((m) => m.id === this.modeId) ?? WIZARD_MODES[0];
    },

    modeName(id) {
      if (id === 'boss') return 'Boss event';
      return this.hub.modes.modes.find((m) => m.id === id)?.name ?? id;
    },

    get modeData() {
      return this.hub.modes.modes.find((m) => m.id === this.modeId) ?? null;
    },

    get boss() {
      return this.hub.bosses.bosses.find((b) => b.id === this.bossId) ?? this.hub.bosses.bosses[0];
    },

    get mapsByDifficulty() {
      return ['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((d) => ({ difficulty: d, maps: this.hub.maps.maps.filter((m) => m.difficulty === d) }));
    },

    hasTrait(pattern) {
      return this.map.traits.some((trait) => pattern.test(trait));
    },

    get isWater() {
      return this.hasTrait(/water/i);
    },

    /** Towers allowed in this mode on this map (class-only modes, water towers on dry maps). */
    allowed(tower) {
      if (this.mode.only && tower.category !== this.mode.only) return false;
      if (['sub', 'bucc'].includes(tower.id) && !this.isWater) return false;
      return true;
    },

    routeOf(tower) {
      return tower.modeRoutes?.[this.mode.tiers] ?? { path: tower.bestRoute, name: '', note: '' };
    },

    // --- Opener -------------------------------------------------------------
    get template() {
      if (!['chimps', 'impoppable', 'hard', 'half-cash'].includes(this.modeId)) return null;
      const templates = this.hub.templates.templates;
      const byId = (id) => templates.find((t) => t.id === id);
      if (this.mode.only) return null;
      if (this.isWater) return byId('dart-sub');
      if (this.map.traits.some((tr) => /line-of-sight|obstacle|wall/i.test(tr) && !/\b(no|light|without|removable)\b/i.test(tr))) return byId('dart-sniper');
      if (['Beginner', 'Intermediate'].includes(this.map.difficulty)) return byId('sauda-start');
      return byId('three-darts');
    },

    /** Opening advice from the tower tips for this mode (towers whose tips talk about openers). */
    get openerTips() {
      const key = this.mode.tiers;
      return this.hub.towers
        .filter((t) => this.allowed(t))
        .flatMap((t) => (t.tips?.[key] ?? []).filter((tip) => /opener|start|early/i.test(tip)).map((tip) => ({ tower: t, tip })))
        .slice(0, 4);
    },

    // --- Hero ---------------------------------------------------------------
    get heroOptions() {
      return this.hub.heroes;
    },

    get suggestedHeroes() {
      const key = this.mode.tiers;
      return [...this.hub.heroes]
        .filter((h) => h.id !== 'brickell' || this.isWater)
        .sort((a, b) => TIER_ORDER.indexOf(a.tiers[key]) - TIER_ORDER.indexOf(b.tiers[key]))
        .slice(0, 3);
    },

    get hero() {
      return this.hub.heroes.find((h) => h.id === this.heroId) ?? null;
    },

    get heroes() {
      return this.hero ? [this.hero] : this.suggestedHeroes;
    },

    // --- Win conditions -----------------------------------------------------
    get winConditions() {
      const key = this.mode.tiers;
      const fromMap = (this.map.recommended ?? [])
        .map((r) => ({ tower: this.hub.towers.find((t) => t.id === r.unit), mapNote: r.note, upgrade: r.upgrade }))
        .filter((r) => r.tower && this.allowed(r.tower) && TIER_ORDER.indexOf(r.tower.tiers[key]) <= 2);
      const used = new Set(fromMap.map((r) => r.tower.id));
      const fromTiers = this.hub.towers
        .filter((t) => this.allowed(t) && !used.has(t.id) && ['S', 'A'].includes(t.tiers[key]) && this.routeOf(t).path)
        .sort((a, b) => TIER_ORDER.indexOf(a.tiers[key]) - TIER_ORDER.indexOf(b.tiers[key]))
        .map((tower) => ({ tower, mapNote: '', upgrade: '' }));
      const isSupport = (t) => t.roles.includes('Buff') && !t.roles.includes('DPS');
      const carries = [...fromMap, ...fromTiers].filter((r) => !isSupport(r.tower)).slice(0, 5);
      const support = [...fromMap, ...fromTiers].filter((r) => isSupport(r.tower)).slice(0, 2);
      return [...carries, ...support].map((r) => ({ ...r, support: isSupport(r.tower), route: this.routeOf(r.tower), tier: r.tower.tiers[key] }));
    },

    // --- Camo and Lead --------------------------------------------------------
    /** For Camo and Lead: which planned picks handle it, and cheap fixes if none do. */
    get coverage() {
      const rounds = this.hub.rounds.sets?.find((s) => s.id === (this.modeId === 'abr' ? 'abr' : 'regular'))?.rounds ?? [];
      return DETECTION_TAGS.map((tag) => {
        const covered = this.winConditions
          .filter((w) => w.route.path && w.tower.detection && meetsRule(w.tower.detection[tag.rule], toPath(w.route.path.replace(/x/g, '0'))))
          .map((w) => ({ name: w.tower.name, how: w.route.path }));
        for (const h of this.heroes) {
          const level = h[tag.heroLevel];
          if (level) covered.push({ name: h.name, how: `level ${level}` });
        }
        const fixes = this.hub.towers
          .filter((t) => this.allowed(t) && t.detection && Array.isArray(t.detection[tag.rule]))
          .map((t) => ({ tower: t, cost: Math.min(...t.detection[tag.rule].map((r) => r.reduce((a, b) => a + b, 0))), text: t.detection[`${tag.rule}Text`] }))
          .filter((f) => f.cost <= 2)
          .sort((a, b) => a.cost - b.cost)
          .slice(0, 4);
        return { ...tag, firstRound: firstRoundWith(rounds, tag.id, this.mode.start), covered, fixes };
      });
    },

    // --- Danger rounds ------------------------------------------------------
    get dangerRounds() {
      if (this.modeId === 'boss') return [];
      return this.hub.playbook.dangerRounds.filter((r) => r.round >= this.mode.start && r.round <= this.mode.end);
    },

    get modeNote() {
      const note = this.map.modeNotes?.[this.modeId];
      return note ?? null;
    },

    openTemplate() {
      if (this.template) this.hub.openTemplate(this.template.id, this.map.id);
    },
  };
}
