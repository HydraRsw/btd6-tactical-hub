// Maps tab (#maps), map pages (#map/<id>) and game-mode pages (#mode/<id>).
//
// A map page has a mode switcher: picking a mode adds that mode's rules and
// general advice, plus the map's own note for that mode when there is one.

import { matchesQuery } from '../lib/text.js';
import { t } from '../lib/i18n.js';

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

// Trait filters: each matches words in a map's traits list.
export const TRAIT_FILTERS = [
  { id: 'water', label: 'Water', test: /water|pond|river|pool|lake|sea/i },
  { id: 'single', label: 'Single lane', test: /single lane|one active|one entrance/i },
  { id: 'multi', label: 'Several lanes', test: /two|three|four|five|six|eight|lanes|paths|entrances|simultaneous|alternating/i },
  { id: 'los', label: 'Line-of-sight blockers', test: /line-of-sight|blocks|walls?\b|trees/i },
  { id: 'changing', label: 'Moving or changing map', test: /moving|rotat|collapse|freeze|darkness|spawns change|change every|toggle/i },
  { id: 'removable', label: 'Removable obstacles', test: /removable|drainable|\$[\d,]+/i },
  { id: 'long', label: 'Long track', test: /long/i },
  { id: 'short', label: 'Short track', test: /short/i },
];

// Mode difficulty groups, in the order the game's mode picker shows them.
const MODE_GROUPS = ['Easy', 'Medium', 'Hard', 'Any'];

// Modes that only allow one tower class (heroes are always allowed).
const CLASS_ONLY = {
  'primary-only': 'Primary',
  'military-only': 'Military',
  'magic-only': 'Magic',
};

/** Why a recommended tower can't be used in a mode, or '' if it can. */
export function restriction(unit, modeId) {
  const allowed = CLASS_ONLY[modeId];
  if (!unit || !allowed || unit.category === 'Heroes' || unit.category === allowed) return '';
  return `Not allowed in ${allowed} Only`;
}

/** A recommendation entry with the tower or hero it points at. */
function withUnit(hub, entry) {
  return { ...entry, partner: hub.units.find((unit) => unit.id === entry.unit) };
}

export function mapGuide() {
  return {
    DIFFICULTIES,
    MODE_GROUPS,
    TRAIT_FILTERS,
    difficulty: 'All',
    query: '',
    traits: [],
    sort: 'game', // 'game' = the order of the game's map menu, 'az' = alphabetical (in the page's language)

    toggleTrait(id) {
      this.traits = this.traits.includes(id) ? this.traits.filter((t) => t !== id) : [...this.traits, id];
    },

    hasTrait(map, id) {
      const filter = TRAIT_FILTERS.find((f) => f.id === id);
      return map.traits.some((trait) => filter.test.test(trait));
    },

    get visibleMaps() {
      return this.$store.hub.maps.maps.filter((map) =>
        (this.difficulty === 'All' || map.difficulty === this.difficulty) &&
        this.traits.every((id) => this.hasTrait(map, id)) &&
        matchesQuery(this.query, [map.name, t(map.name), ...map.traits, ...map.traits.map(t)]));
    },

    get groups() {
      return DIFFICULTIES
        .map((difficulty) => ({ difficulty, maps: this.sorted(this.visibleMaps.filter((map) => map.difficulty === difficulty)) }))
        .filter((group) => group.maps.length > 0);
    },

    sorted(maps) {
      if (this.sort !== 'az') return maps; // maps.json is kept in the game's menu order
      return [...maps].sort((a, b) => t(a.name).localeCompare(t(b.name)));
    },

    modesIn(group) {
      return this.$store.hub.modes.modes.filter((mode) => mode.difficulty === group);
    },

    /** The map's own note for the mode picked on this tab, if it has one. */
    noteFor(map) {
      return map.modeNotes?.[this.$store.hub.mapMode] ?? '';
    },
  };
}

export function mapPage() {
  return {
    restriction,

    keep: null,

    init() {
      this.keep = this.$store.hub.pageKeeper('map');
    },

    get map() {
      return this.keep ? this.keep() : this.$store.hub.currentPage;
    },

    get mode() {
      return this.$store.hub.findMode(this.$store.hub.mapMode);
    },

    get recommended() {
      return this.map.recommended.map((entry) => withUnit(this.$store.hub, entry));
    },

    get modeTowers() {
      return (this.mode?.towers ?? []).map((entry) => withUnit(this.$store.hub, entry));
    },

    get mapNote() {
      return this.map.modeNotes?.[this.$store.hub.mapMode] ?? '';
    },

    /** Modes this map has its own notes for (they're marked in the switcher). */
    hasNote(modeId) {
      return Boolean(this.map.modeNotes?.[modeId]);
    },

    get sources() {
      return [...this.map.sources, ...(this.mode?.sources ?? [])];
    },

    /** Previous / next map in the game's order. */
    neighbour(step) {
      const maps = this.$store.hub.maps.maps;
      const index = maps.findIndex((map) => map.id === this.map.id);
      return maps[(index + step + maps.length) % maps.length];
    },

    openUnit(unit) {
      this.$store.hub.openUnit(unit);
    },
  };
}

export function modePage() {
  return {
    restriction,

    keep: null,

    init() {
      this.keep = this.$store.hub.pageKeeper('mode');
    },

    get mode() {
      return this.keep ? this.keep() : this.$store.hub.currentPage;
    },

    get towers() {
      return this.mode.towers.map((entry) => withUnit(this.$store.hub, entry));
    },

    /** Maps that have their own note for this mode. */
    get mapNotes() {
      return this.$store.hub.maps.maps
        .filter((map) => map.modeNotes?.[this.mode.id])
        .map((map) => ({ map, note: map.modeNotes[this.mode.id] }));
    },

    /** Look at the map list with this mode picked. */
    browseMaps() {
      this.$store.hub.setMapMode(this.mode.id);
      this.$store.hub.openTab('maps');
    },

    openUnit(unit) {
      this.$store.hub.openUnit(unit);
    },
  };
}
