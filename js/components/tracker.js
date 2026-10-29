// Things saved in this browser: the medal tracker (Maps & Modes tab and map
// pages), the favourites bar, and the "What changed" patch page.

// Medals per map, in the game's order. Freeplay has no medal; Black Border is
// ticked by hand once you've earned it.
export const MEDALS = [
  { id: 'easy', short: 'E', group: 'Easy' },
  { id: 'primary-only', short: 'PO', group: 'Easy' },
  { id: 'deflation', short: 'D', group: 'Easy' },
  { id: 'medium', short: 'M', group: 'Medium' },
  { id: 'military-only', short: 'MO', group: 'Medium' },
  { id: 'apopalypse', short: 'A', group: 'Medium' },
  { id: 'reverse', short: 'R', group: 'Medium' },
  { id: 'hard', short: 'H', group: 'Hard' },
  { id: 'magic-only', short: 'MgO', group: 'Hard' },
  { id: 'double-hp-moabs', short: 'DHP', group: 'Hard' },
  { id: 'half-cash', short: 'HC', group: 'Hard' },
  { id: 'abr', short: 'ABR', group: 'Hard' },
  { id: 'impoppable', short: 'I', group: 'Hard' },
  { id: 'chimps', short: 'C', group: 'Hard' },
  { id: 'black-border', short: 'BB', group: 'Extra' },
];

const DIFFICULTY_ORDER = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

export function medalTracker() {
  return {
    MEDALS,
    show: 'all', // 'all' | 'missing' (maps still missing medals)
    difficulty: 'All',

    medalName(id) {
      if (id === 'black-border') return 'Black Border';
      return this.$store.hub.findMode(id)?.name ?? id;
    },

    count(map) {
      return MEDALS.filter((m) => this.$store.hub.hasMedal(map.id, m.id)).length;
    },

    get maps() {
      return this.$store.hub.maps.maps
        .filter((map) => this.difficulty === 'All' || map.difficulty === this.difficulty)
        .filter((map) => this.show === 'all' || this.count(map) < MEDALS.length);
    },

    /** Medals earned / possible, overall and per difficulty. */
    get totals() {
      const all = this.$store.hub.maps.maps;
      const per = DIFFICULTY_ORDER.map((d) => {
        const maps = all.filter((m) => m.difficulty === d);
        return { difficulty: d, earned: maps.reduce((s, m) => s + this.count(m), 0), possible: maps.length * MEDALS.length, blackBorders: maps.filter((m) => this.$store.hub.hasMedal(m.id, 'black-border')).length, maps: maps.length };
      });
      return {
        earned: per.reduce((s, p) => s + p.earned, 0),
        possible: per.reduce((s, p) => s + p.possible, 0),
        blackBorders: per.reduce((s, p) => s + p.blackBorders, 0),
        per,
      };
    },

    /** Tick every medal on a map (or clear them all if it's already complete). */
    toggleAll(map) {
      const hub = this.$store.hub;
      const complete = this.count(map) === MEDALS.length;
      for (const medal of MEDALS) {
        if (hub.hasMedal(map.id, medal.id) === complete) hub.toggleMedal(map.id, medal.id);
      }
    },
  };
}

// --- Favourites bar ----------------------------------------------------------
const KINDS = {
  tower: { list: (hub) => hub.towers, open: (hub, id) => hub.openPage('tower', id) },
  hero: { list: (hub) => hub.heroes, open: (hub, id) => hub.openPage('hero', id) },
  map: { list: (hub) => hub.maps.maps, open: (hub, id) => hub.openPage('map', id) },
  mode: { list: (hub) => hub.modes.modes, open: (hub, id) => hub.openPage('mode', id) },
  paragon: { list: (hub) => hub.paragons.paragons, open: (hub, id) => hub.openPage('paragon', id) },
};

export function favouritesBar() {
  return {
    open: true,

    /** Favourites resolved to their data, skipping any that no longer exist. Saved builds are handled by the planner. */
    get items() {
      const hub = this.$store.hub;
      return hub.favourites
        .filter((f) => KINDS[f.kind])
        .map((f) => {
          const item = KINDS[f.kind].list(hub).find((x) => x.id === f.id);
          if (!item) return null;
          const avatar = f.kind === 'paragon' ? hub.towers.find((t) => t.id === item.tower) : ['tower', 'hero'].includes(f.kind) ? item : null;
          return { ...f, name: item.name, avatar, go: () => KINDS[f.kind].open(hub, f.id) };
        })
        .filter(Boolean);
    },

    /** Starred planner builds. */
    get builds() {
      const hub = this.$store.hub;
      return hub.savedBuilds.filter((b) => hub.isFavourite('build', b.id));
    },
  };
}

// --- Patch page ----------------------------------------------------------------
export function patchPage() {
  return {
    /** A change's link target: a tower, hero, Paragon or map page. */
    target(change) {
      const hub = this.$store.hub;
      if (change.map) {
        const map = hub.maps.maps.find((m) => m.id === change.map);
        return map ? { label: map.name, go: () => hub.openPage('map', map.id) } : null;
      }
      if (!change.unit) return null;
      const paragon = hub.paragons.paragons.find((p) => p.id === change.unit);
      if (paragon) return { label: paragon.name, go: () => hub.openPage('paragon', paragon.id) };
      const unit = hub.units.find((u) => u.id === change.unit);
      return unit ? { label: unit.name, go: () => hub.openUnit(unit) } : null;
    },
  };
}
