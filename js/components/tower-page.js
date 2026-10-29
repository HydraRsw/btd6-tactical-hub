// Tower page (#tower/<id>): everything the site knows about one tower —
// upgrade tree, routes, CHIMPS and boss tips, synergies, its Paragon, and
// every place elsewhere on the site that mentions it.

import { parseRoute } from '../lib/upgrades.js';
import { formatCash } from '../lib/text.js';
import { CATEGORY_ICONS } from './tier-list.js';
import { MODES } from '../store.js';
import { DIFFICULTIES, meetsRule, upgradeCost } from '../lib/game.js';

const PATH_NAMES = ['Top path', 'Middle path', 'Bottom path'];

const CONFIDENCE_LABELS = {
  verified: 'Verified: sources back the route and tier',
  approximate: 'Approximate: partly backed by sources',
  new: 'New tower: the meta is still settling',
};

export function towerPage() {
  return {
    PATH_NAMES,
    CONFIDENCE_LABELS,
    CATEGORY_ICONS,
    MODES,
    DIFFICULTIES,
    formatCash,
    costDifficulty: 2, // Hard: the CHIMPS price

    /** Is this upgrade part of the recommended route? */
    onRoute(path, tier) {
      const bought = parseRoute(this.tower.bestRoute);
      return bought[path] !== null && tier <= bought[path];
    },

    /** Total price of the recommended route on the chosen difficulty, or null if the route isn't fixed. */
    get routeCost() {
      const route = parseRoute(this.tower.bestRoute);
      if (!this.tower.costs || route.some((tier) => tier === null)) return null;
      return upgradeCost(this.tower, null, route, this.costDifficulty);
    },

    /** "At 2-0-5 it sees Camo but can't pop Lead without help." */
    get routeDetection() {
      const route = parseRoute(this.tower.bestRoute);
      const d = this.tower.detection;
      if (!d || route.some((tier) => tier === null) || d.camo === null) return '';
      const camo = meetsRule(d.camo, route);
      const lead = meetsRule(d.lead, route);
      const parts = [camo ? 'sees Camo' : 'needs Camo support', lead ? 'pops Lead' : 'needs Lead support'];
      return `At ${this.tower.bestRoute} its main attack ${parts.join(' and ')}.`;
    },

    keep: null,

    init() {
      this.keep = this.$store.hub.pageKeeper('tower');
    },

    get tower() {
      return this.keep ? this.keep() : this.$store.hub.currentPage;
    },

    /**
     * The upgrade tree as 3 rows of 5 cells. A cell is "bought" when the
     * tower's best route includes that tier ("2-0-5" → top 1–2, bottom 1–5).
     */
    get upgradeRows() {
      const bought = parseRoute(this.tower.bestRoute);
      return (this.tower.upgrades ?? [[], [], []]).map((names, path) => ({
        path: PATH_NAMES[path],
        cells: Array.from({ length: 5 }, (_, i) => ({
          tier: i + 1,
          name: names[i] ?? 'Unknown',
          bought: bought[path] !== null && i + 1 <= bought[path],
        })),
      }));
    },

    /** Synergy entries with the tower/hero they point at. */
    get synergies() {
      const hub = this.$store.hub;
      return (this.tower.synergies ?? [])
        .map((synergy) => ({ ...synergy, partner: hub.units.find((unit) => unit.id === synergy.unit) }))
        .filter((synergy) => synergy.partner);
    },

    get paragon() {
      return this.$store.hub.paragons.paragons.find((paragon) => paragon.id === this.tower.paragon) ?? null;
    },

    /**
     * Other parts of the site that mention this tower or one of its tier 3–5
     * upgrades: CHIMPS danger rounds, boss notes and hero synergies.
     */
    get mentions() {
      const hub = this.$store.hub;
      const names = [this.tower.name, ...(this.tower.upgrades ?? []).flatMap((path) => path.slice(2))]
        .filter(Boolean)
        .map((name) => name.toLowerCase());
      const mentionsTower = (text) => names.some((name) => text.toLowerCase().includes(name));

      const rounds = hub.playbook.dangerRounds
        .filter((round) => round.counters.some(mentionsTower))
        .map((round) => ({
          kind: 'CHIMPS round',
          title: `R${round.round}: ${round.title}`,
          text: round.counters.filter(mentionsTower).join(' · '),
          go: () => hub.jumpTo('chimps', `round-${round.round}`),
        }));

      const bosses = hub.playbook.bosses
        .filter((boss) => mentionsTower(boss.note))
        .map((boss) => ({ kind: 'Boss', title: boss.name, text: boss.note, go: () => hub.jumpTo('chimps', 'boss-reference') }));

      const heroes = hub.playbook.heroSynergies
        .filter((synergy) => synergy.synergies.some(mentionsTower))
        .map((synergy) => ({
          kind: 'Hero',
          title: synergy.name,
          text: synergy.synergies.filter(mentionsTower).join(' · '),
          go: () => hub.jumpTo('chimps', `hero-${synergy.heroId}`),
        }));

      const maps = hub.maps.maps
        .flatMap((map) => map.recommended
          .filter((pick) => pick.unit === this.tower.id)
          .map((pick) => ({ kind: 'Map', title: `${map.name}: ${pick.upgrade}`, text: pick.note, go: () => hub.openPage('map', map.id) })));

      return [...rounds, ...bosses, ...heroes, ...maps];
    },

    /** Previous / next tower in the data's order, for quick browsing. */
    neighbour(step) {
      const towers = this.$store.hub.towers;
      const index = towers.findIndex((tower) => tower.id === this.tower.id);
      return towers[(index + step + towers.length) % towers.length];
    },

    openUnit(unit) {
      this.$store.hub.openUnit(unit);
    },
  };
}
