// Tower page (#tower/<id>): everything the site knows about one tower —
// upgrade tree, routes, CHIMPS and boss tips, synergies, its Paragon, and
// every place elsewhere on the site that mentions it.

import { parseRoute } from '../lib/upgrades.js';
import { formatCash } from '../lib/text.js';
import { CATEGORY_ICONS } from './tier-list.js';

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
    formatCash,

    get tower() {
      return this.$store.hub.currentTower;
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

      return [...rounds, ...bosses, ...heroes];
    },

    /** Previous / next tower in the data's order, for quick browsing. */
    neighbour(step) {
      const towers = this.$store.hub.towers;
      const index = towers.findIndex((tower) => tower.id === this.tower.id);
      return towers[(index + step + towers.length) % towers.length];
    },

    openUnit(unit) {
      const hub = this.$store.hub;
      if (unit.category === 'Heroes') hub.jumpTo('tier', `tier-${unit.id}`, unit.id);
      else hub.openTower(unit.id);
    },
  };
}
