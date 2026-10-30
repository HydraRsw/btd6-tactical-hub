// Hero page (#hero/<id>): cost, level milestones, when the hero reaches each
// level on each map difficulty, what to pair them with and where they show up.

import { DIFFICULTIES, MAP_XP, heroXpTable, levelRounds } from '../lib/game.js';
import { formatCash } from '../lib/text.js';
import { MODES } from '../store.js';

export function heroPage() {
  return {
    DIFFICULTIES,
    MAP_DIFFICULTIES: Object.keys(MAP_XP),
    MODES,
    formatCash,
    placeRound: 6,
    mapDifficulty: 'Intermediate',
    openLevel: null,
    shopDifficulty: 1,

    keep: null,

    init() {
      this.keep = this.$store.hub.pageKeeper('hero');
    },

    get hero() {
      return this.keep ? this.keep() : this.$store.hub.currentPage;
    },

    get regularRounds() {
      return this.$store.hub.rounds.sets[0]?.rounds ?? [];
    },

    /** Round each level is reached for the chosen placement round and map difficulty. */
    get levels() {
      const reached = levelRounds(this.regularRounds, {
        xpModifier: this.hero.xpModifier ?? 1,
        placeRound: Math.min(100, Math.max(1, Number(this.placeRound) || 1)),
        mapDifficulty: this.mapDifficulty,
      });
      const milestones = Object.fromEntries((this.hero.milestones ?? []).map((m) => [m.level, m.text]));
      const full = Object.fromEntries((this.hero.levels ?? []).map((l) => [l.level, l.text]));
      return Array.from({ length: 20 }, (_, i) => ({
        level: i + 1,
        round: reached[i + 1],
        text: milestones[i + 1] ?? '',
        full: full[i + 1] ?? milestones[i + 1] ?? '',
        ability: (full[i + 1] ?? '').match(/Ability – ([^:]+):/)?.[1] ?? null,
      }));
    },

    toggleLevel(level) {
      this.openLevel = this.openLevel === level ? null : level;
    },

    /** Details for a clicked level: total XP and the round it's reached on every map difficulty. */
    levelDetail(level) {
      const xp = heroXpTable(this.hero.xpModifier ?? 1)[level] ?? 0;
      const placeRound = Math.min(100, Math.max(1, Number(this.placeRound) || 1));
      const byMap = this.MAP_DIFFICULTIES.map((d) => ({
        label: d,
        round: levelRounds(this.regularRounds, { xpModifier: this.hero.xpModifier ?? 1, placeRound, mapDifficulty: d })[level],
      }));
      const abilities = this.levels.filter((l) => l.ability && l.level <= level).map((l) => l.ability);
      return { xp, byMap, abilities };
    },

    get skins() {
      return this.hero.skins ?? [];
    },

    get shop() {
      return this.hero.shop ?? [];
    },

    get keyLevels() {
      return this.levels.filter((l) => l.text);
    },

    get pairs() {
      const hub = this.$store.hub;
      return (this.hero.pairs ?? []).map((p) => ({ ...p, partner: hub.units.find((u) => u.id === p.unit) })).filter((p) => p.partner);
    },

    /** Everywhere else the site recommends this hero: towers' synergies, maps, modes, CHIMPS notes. */
    get mentions() {
      const hub = this.$store.hub;
      const id = this.hero.id;
      const towers = hub.towers
        .flatMap((tower) => (tower.synergies ?? []).filter((s) => s.unit === id).map((s) => ({ kind: 'Tower', title: tower.name, text: s.note, go: () => hub.openTower(tower.id) })));
      const maps = hub.maps.maps
        .flatMap((map) => map.recommended.filter((p) => p.unit === id).map((p) => ({ kind: 'Map', title: map.name, text: p.note, go: () => hub.openPage('map', map.id) })));
      const modes = hub.modes.modes
        .flatMap((mode) => mode.towers.filter((p) => p.unit === id).map((p) => ({ kind: 'Mode', title: mode.name, text: p.note, go: () => hub.openPage('mode', mode.id) })));
      const chimps = hub.playbook.heroSynergies
        .filter((s) => s.heroId === id)
        .map((s) => ({ kind: 'CHIMPS', title: 'Hero synergies', text: s.synergies.join(' · '), go: () => hub.jumpTo('chimps', `hero-${id}`) }));
      return [...chimps, ...towers, ...maps, ...modes];
    },

    neighbour(step) {
      const heroes = this.$store.hub.heroes;
      const index = heroes.findIndex((h) => h.id === this.hero.id);
      return heroes[(index + step + heroes.length) % heroes.length];
    },

    levelLabel(level) {
      return level === 0 ? 'from level 1' : level ? `from level ${level}` : 'not on its own';
    },
  };
}
