// The shared "hub" store: game data, which tab is open, and the patch banner.
// Every tab reads from it in HTML as $store.hub.

import { loadGameData } from './lib/data.js';
import { recall, remember } from './lib/storage.js';

export const TABS = ['tier', 'cross', 'farm', 'chimps'];

export function createHubStore() {
  return {
    status: 'loading', // 'loading' | 'ready' | 'error'
    errorMessage: '',

    meta: { patch: '', updated: '', changes: [], imageDir: '' },
    towers: [],
    heroes: [],
    economy: { farmBuilds: [], strategies: [], bossCheckpoints: [] },
    playbook: { modeNotes: {}, dangerRounds: [], heroSynergies: [], bosses: [] },

    activeTab: 'tier',
    openUnitIds: [],       // expanded rows in the tier list
    showPatchBanner: false,

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

    // --- Tabs (kept in the URL hash so links like #farm work) ----------
    openTab(tab) {
      if (!TABS.includes(tab)) return;
      this.activeTab = tab;
      if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
    },

    openTabFromUrl() {
      this.openTab(location.hash.slice(1) || 'tier');
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
