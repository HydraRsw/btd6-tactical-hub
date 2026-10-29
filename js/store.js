// The shared "hub" store: game data, which tab is open, and the patch banner.
// Every tab reads from it in HTML as $store.hub.

import { loadGameData } from './lib/data.js';
import { recall, remember } from './lib/storage.js';

// Tabs in header order.
export const TABS = ['tier', 'cross', 'maps', 'paragons', 'rounds', 'planner', 'farm', 'chimps'];

// Detail pages aren't tabs. Each has an address like #tower/<id> and a list
// in the data it looks its id up in.
export const PAGES = {
  tower: (hub) => hub.towers,
  hero: (hub) => hub.heroes,
  map: (hub) => hub.maps.maps,
  mode: (hub) => hub.modes.modes,
  paragon: (hub) => hub.paragons.paragons,
};

// Game modes the tiers are ranked for. Each tower/hero has tiers.<mode>.
export const MODES = [
  { id: 'chimps', label: 'CHIMPS', short: 'CHIMPS' },
  { id: 'boss', label: 'Boss events', short: 'Bosses' },
  { id: 'normal', label: 'Normal & Freeplay', short: 'Normal' },
];

export function createHubStore() {
  return {
    status: 'loading', // 'loading' | 'ready' | 'error'
    errorMessage: '',

    meta: { patch: '', updated: '', changes: [], imageDir: '' },
    towers: [],
    heroes: [],
    economy: { farmBuilds: [], strategies: [], bossCheckpoints: [] },
    playbook: { modeNotes: {}, dangerRounds: [], heroSynergies: [], bosses: [] },
    sources: {},           // id → { title, url }, referenced by every entry's "sources" list
    paragons: { intro: '', paragons: [], degreeGuide: { basics: [], powerSources: [], tips: [], sources: [] } },
    maps: { intro: '', maps: [] },
    modes: { modes: [] },
    rounds: { startCash: 650, sets: [] },

    mode: ['chimps', 'boss', 'normal'].includes(recall('mode', 'chimps')) ? recall('mode', 'chimps') : 'chimps', // which game mode the tiers are shown for (see MODES)
    activeTab: 'tier',     // one of TABS, or a PAGES kind ('tower', 'map'…) while a detail page is open
    pageId: null,          // id of the open detail page's tower / map / mode / Paragon
    mapMode: recall('mapMode', 'chimps'), // game mode picked on the Maps tab and map pages
    openUnitIds: [],       // expanded rows in the tier list
    showPatchBanner: false,

    setMode(mode) {
      if (!MODES.some((m) => m.id === mode)) return;
      this.mode = mode;
      remember('mode', mode);
    },

    get modeLabel() {
      return MODES.find((m) => m.id === this.mode)?.label ?? '';
    },

    /** A tower or hero's tier in the selected mode. */
    tierOf(unit) {
      return unit?.tiers?.[this.mode] ?? '?';
    },

    setMapMode(modeId) {
      this.mapMode = modeId;
      remember('mapMode', modeId);
    },

    /** The tower, map, mode or Paragon whose page is open, if any. */
    get currentPage() {
      const list = PAGES[this.activeTab]?.(this) ?? [];
      return list.find((item) => item.id === this.pageId) ?? null;
    },

    get currentTower() {
      return this.activeTab === 'tower' ? this.currentPage : null;
    },

    findMode(modeId) {
      return this.modes.modes.find((mode) => mode.id === modeId) ?? null;
    },

    /** Towers and heroes in one list (the tier list shows both). */
    get units() {
      return [...this.towers, ...this.heroes];
    },

    async load() {
      try {
        Object.assign(this, await loadGameData());
        this.showPatchBanner = this.isNewPatchForVisitor();
        this.status = 'ready';
      } catch (error) {
        this.errorMessage = error.message;
        this.status = 'error';
      }
    },

    /** True when this visitor last saw an older patch than the one now loaded. */
    isNewPatchForVisitor() {
      const lastSeen = recall('lastSeenPatch', null);
      remember('lastSeenPatch', this.meta.patch);
      return Boolean(lastSeen) && lastSeen !== this.meta.patch;
    },

    // --- Tabs and detail pages (kept in the URL hash: #farm, #map/logs) ----
    openTab(tab) {
      if (!TABS.includes(tab)) return;
      this.activeTab = tab;
      this.pageId = null;
      if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
    },

    /** Open a detail page: openPage('map', 'logs') → #map/logs. */
    openPage(kind, id) {
      if (!PAGES[kind]) return;
      this.activeTab = kind;
      this.pageId = id;
      // pushState so the browser's Back button returns to the list
      if (location.hash !== `#${kind}/${id}`) history.pushState(null, '', `#${kind}/${id}`);
      window.scrollTo({ top: 0 });
    },

    openTower(towerId) {
      this.openPage('tower', towerId);
    },

    /** A tower or hero's own page. */
    openUnit(unit) {
      if (unit) this.openPage(unit.category === 'Heroes' ? 'hero' : 'tower', unit.id);
    },

    openTabFromUrl() {
      const [kind, id] = location.hash.slice(1).split('/');
      if (PAGES[kind] && id) {
        this.activeTab = kind;
        this.pageId = decodeURIComponent(id);
        return;
      }
      this.openTab(kind || 'tier');
    },

    // --- Tier list rows -------------------------------------------------
    isOpen(unitId) {
      return this.openUnitIds.includes(unitId);
    },

    toggleOpen(unitId) {
      this.openUnitIds = this.isOpen(unitId)
        ? this.openUnitIds.filter((id) => id !== unitId)
        : [...this.openUnitIds, unitId];
    },

    /** Switch tab, scroll to an element and flash it (used by search). */
    jumpTo(tab, elementId, unitId) {
      if (unitId && !this.isOpen(unitId)) this.toggleOpen(unitId);
      this.openTab(tab);
      // wait for Alpine to show the tab before scrolling
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const target = document.getElementById(elementId);
          if (!target) return;
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.remove('flash');
          void target.offsetWidth; // restart the animation
          target.classList.add('flash');
        }),
      );
    },
  };
}
