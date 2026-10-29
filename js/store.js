// The shared "hub" store: game data, which tab is open, and the patch banner.
// Every tab reads from it in HTML as $store.hub.

import { loadGameData } from './lib/data.js';
import { recall, remember } from './lib/storage.js';

// Tabs in header order. A tower's own page isn't a tab: its address is #tower/<id>.
export const TABS = ['tier', 'cross', 'paragons', 'farm', 'chimps'];

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

    mode: ['chimps', 'boss', 'normal'].includes(recall('mode', 'chimps')) ? recall('mode', 'chimps') : 'chimps', // which game mode the tiers are shown for (see MODES)
    activeTab: 'tier',     // one of TABS, or 'tower' while a tower page is open
    towerId: null,         // which tower page is open
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

    /** The tower whose page is open, if any. */
    get currentTower() {
      return this.towers.find((tower) => tower.id === this.towerId) ?? null;
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

    // --- Tabs and tower pages (kept in the URL hash: #farm, #tower/sniper) --
    openTab(tab) {
      if (!TABS.includes(tab)) return;
      this.activeTab = tab;
      this.towerId = null;
      if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
    },

    openTower(towerId) {
      this.towerId = towerId;
      this.activeTab = 'tower';
      // pushState so the browser's Back button returns to the list
      if (location.hash !== `#tower/${towerId}`) history.pushState(null, '', `#tower/${towerId}`);
      window.scrollTo({ top: 0 });
    },

    openTabFromUrl() {
      const hash = location.hash.slice(1);
      if (hash.startsWith('tower/')) {
        this.towerId = hash.slice('tower/'.length);
        this.activeTab = 'tower';
        return;
      }
      this.openTab(hash || 'tier');
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
