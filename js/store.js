// The shared "hub" store: game data, which tab is open, and the patch banner.
// Every tab reads from it in HTML as $store.hub.

import { loadGameData } from './lib/data.js';
import { recall, remember } from './lib/storage.js';

// Tabs in header order.
// 'patch' (#patch) is a page reached from the patch label, not a header tab.
export const TABS = ['tier', 'cross', 'maps', 'paragons', 'rounds', 'events', 'tools', 'farm', 'chimps', 'knowledge', 'patch'];

// The Tools tab has three views; each also has its own address (#planner, #degree, #compare).
export const TOOL_VIEWS = ['wizard', 'bossplan', 'planner', 'degree', 'compare', 'backup'];

// Detail pages aren't tabs. Each has an address like #tower/<id> and a list
// in the data it looks its id up in.
export const PAGES = {
  tower: (hub) => hub.towers,
  hero: (hub) => hub.heroes,
  map: (hub) => hub.maps.maps,
  mode: (hub) => hub.modes.modes,
  paragon: (hub) => hub.paragons.paragons,
  boss: (hub) => hub.bosses.bosses,
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
    templates: { intro: '', templates: [] },
    patch: { intro: '', versions: [] },
    bosses: { intro: '', tierRounds: [], coop: [1], bosses: [], sources: [] },
    events: { intro: '', formats: [] },
    knowledge: { intro: '', categories: [], treeRules: [], respec: '', entries: [], sources: [] },
    freeplay: { intro: '', speed: [], moabHealth: [], cashPerPop: [], statusResistance: [], sources: [] },

    // Saved in this browser only
    favourites: recall('favourites', []), // [{ kind: 'tower' | 'hero' | 'map' | 'paragon' | 'mode' | 'build', id }]
    medals: recall('medals', {}),         // { mapId: [modeId, …, 'black-border'] }
    savedBuilds: recall('plannerSaved', []), // [{ id, name, savedAt, build }]
    pendingBuild: null,                   // a saved build the planner should load next
    pendingRestore: null,                 // a backup code from a #restore= link, for the backup tool
    pendingTemplate: null,                // { id, mapId }: a template the planner should load next (from the wizard)
    pendingDegree: null,                  // { paragonId, target, difficulty }: values for the degree calculator (from the boss planner)
    toolView: 'planner',   // which tool the Tools tab shows (see TOOL_VIEWS)

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

    /**
     * For detail-page components: the open item of this kind, or (while the
     * page is being closed) the last one it showed, so its template never
     * reads from null or from another kind of page.
     */
    pageKeeper(kind) {
      let last = null;
      return () => {
        if (this.activeTab === kind && this.currentPage) last = this.currentPage;
        return last;
      };
    },

    findMode(modeId) {
      return this.modes.modes.find((mode) => mode.id === modeId) ?? null;
    },

    /** The recommended route for a tower in a mode (defaults to the shown mode); heroes have none. */
    routeFor(unit, mode = this.mode) {
      if (!unit || unit.category === 'Heroes') return null;
      const route = unit.modeRoutes?.[mode];
      return route ? route.path : unit.bestRoute;
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

    // --- Favourites ------------------------------------------------------
    isFavourite(kind, id) {
      return this.favourites.some((f) => f.kind === kind && f.id === id);
    },

    toggleFavourite(kind, id) {
      this.favourites = this.isFavourite(kind, id)
        ? this.favourites.filter((f) => !(f.kind === kind && f.id === id))
        : [...this.favourites, { kind, id }];
      remember('favourites', this.favourites);
    },

    // --- Saved planner builds ----------------------------------------------
    saveBuild(name, build, id = null) {
      const entry = { id: id ?? `b${Date.now()}`, name: name.trim() || 'Untitled build', savedAt: new Date().toISOString().slice(0, 10), build: JSON.parse(JSON.stringify(build)) };
      this.savedBuilds = id ? this.savedBuilds.map((b) => (b.id === id ? entry : b)) : [...this.savedBuilds, entry];
      remember('plannerSaved', this.savedBuilds);
      return entry.id;
    },

    renameBuild(id, name) {
      this.savedBuilds = this.savedBuilds.map((b) => (b.id === id ? { ...b, name: name.trim() || b.name } : b));
      remember('plannerSaved', this.savedBuilds);
    },

    deleteBuild(id) {
      this.savedBuilds = this.savedBuilds.filter((b) => b.id !== id);
      remember('plannerSaved', this.savedBuilds);
      if (this.isFavourite('build', id)) this.toggleFavourite('build', id);
    },

    /** Open a saved build in the planner. */
    openTemplate(id, mapId) {
      this.pendingTemplate = { id, mapId };
      this.openTool('planner');
    },

    openDegree(paragonId, target, difficulty) {
      this.pendingDegree = { paragonId, target, difficulty };
      this.openTool('degree');
    },

    openBuild(id) {
      const saved = this.savedBuilds.find((b) => b.id === id);
      if (!saved) return;
      this.pendingBuild = saved;
      this.openTool('planner');
    },

    // --- Medal tracker ----------------------------------------------------
    hasMedal(mapId, medalId) {
      return (this.medals[mapId] ?? []).includes(medalId);
    },

    toggleMedal(mapId, medalId) {
      const current = this.medals[mapId] ?? [];
      const next = current.includes(medalId) ? current.filter((m) => m !== medalId) : [...current, medalId];
      this.medals = { ...this.medals, [mapId]: next };
      remember('medals', this.medals);
    },

    /** A tower or hero's own page. */
    openUnit(unit) {
      if (unit) this.openPage(unit.category === 'Heroes' ? 'hero' : 'tower', unit.id);
    },

    /** Open the Tools tab on one tool: openTool('degree') → #degree. */
    openTool(view) {
      if (!TOOL_VIEWS.includes(view)) return;
      this.toolView = view;
      this.activeTab = 'tools';
      this.pageId = null;
      if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
      window.scrollTo({ top: 0 });
    },

    openTabFromUrl() {
      if (location.hash.startsWith('#restore=')) {
        this.pendingRestore = location.hash.slice('#restore='.length);
        this.openTool('backup');
        return;
      }
      const [kind, id] = location.hash.slice(1).split('/');
      if (TOOL_VIEWS.includes(kind)) {
        this.openTool(kind);
        return;
      }
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
