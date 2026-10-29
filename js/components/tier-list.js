// Tier List tab: filters on the left, rows grouped by tier on the right.

import { recall, remember } from '../lib/storage.js';
import { matchesQuery } from '../lib/text.js';

export const CATEGORIES = ['Primary', 'Military', 'Magic', 'Support', 'Heroes'];
export const ROLES = ['DPS', 'Stall', 'Buff', 'Cleanup', 'MOAB', 'Income'];
export const CATEGORY_ICONS = { Primary: 'crosshair', Military: 'shield', Magic: 'sparkles', Support: 'hammer', Heroes: 'star' };

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];
export const TIER_COLORS = { S: '#ff4747', A: '#ff8a1f', B: '#ffc700', C: '#5bbf12', D: '#2f9ae6' };

export function tierList() {
  return {
    mode: recall('mode', 'chimps'), // 'chimps' | 'boss'
    sortBy: 'tier',                 // 'tier' | 'name' | 'category'
    query: '',
    categories: [...CATEGORIES],
    roles: [...ROLES],
    filtersOpen: false,            // on phones the filter panel starts collapsed

    CATEGORIES,
    ROLES,
    CATEGORY_ICONS,
    TIER_COLORS,

    setMode(mode) {
      this.mode = mode;
      remember('mode', mode);
    },

    toggle(list, value) {
      const index = this[list].indexOf(value);
      if (index === -1) this[list].push(value);
      else this[list].splice(index, 1);
    },

    /** Short summary for the collapsed filter button, e.g. "CHIMPS · 4/5 classes · all roles". */
    get filterSummary() {
      const mode = this.mode === 'chimps' ? 'CHIMPS' : 'Boss events';
      const classes = this.categories.length === CATEGORIES.length ? 'all classes' : `${this.categories.length}/${CATEGORIES.length} classes`;
      const roles = this.roles.length === ROLES.length ? 'all roles' : `${this.roles.length}/${ROLES.length} roles`;
      return `${mode} · ${classes} · ${roles}`;
    },

    /** Towers open their own page; heroes expand in place. */
    openRow(unit) {
      if (unit.category === 'Heroes') this.$store.hub.toggleOpen(unit.id);
      else this.$store.hub.openTower(unit.id);
    },

    tierOf(unit) {
      return unit.tiers[this.mode];
    },

    get modeNote() {
      return this.$store.hub.playbook.modeNotes[this.mode] ?? '';
    },

    /** Units that pass every filter, in the chosen order. */
    get visibleUnits() {
      const byTier = (a, b) => TIER_ORDER.indexOf(this.tierOf(a)) - TIER_ORDER.indexOf(this.tierOf(b));
      const byCategory = (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
      const byName = (a, b) => a.name.localeCompare(b.name);
      const orderings = {
        tier: (a, b) => byTier(a, b) || byCategory(a, b) || byName(a, b),
        category: (a, b) => byCategory(a, b) || byTier(a, b) || byName(a, b),
        name: byName,
      };

      return this.$store.hub.units
        .filter((unit) => this.categories.includes(unit.category))
        .filter((unit) => unit.roles.some((role) => this.roles.includes(role)))
        .filter((unit) => matchesQuery(this.query, [unit.name, unit.category, unit.bestRoute, unit.summary, ...unit.roles]))
        .sort(orderings[this.sortBy]);
    },

    /**
     * Sorting by tier shows a heading per tier ("S Tier", "A Tier"…).
     * Other sorts show one untitled group.
     */
    get groups() {
      const units = this.visibleUnits;
      if (this.sortBy !== 'tier') return [{ tier: null, units }];
      return TIER_ORDER
        .map((tier) => ({ tier, units: units.filter((unit) => this.tierOf(unit) === tier) }))
        .filter((group) => group.units.length > 0);
    },
  };
}
