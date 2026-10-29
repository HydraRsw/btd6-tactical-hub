// Compare (Tools tab): two towers or heroes side by side — tiers, best route,
// prices on a chosen difficulty, Camo/Lead/Purple and their Paragon.

import { DIFFICULTIES, meetsRule, upgradeCost } from '../lib/game.js';
import { parseRoute } from '../lib/upgrades.js';
import { formatCash } from '../lib/text.js';
import { MODES } from '../store.js';
import { recall, remember } from '../lib/storage.js';

export function compareUnits() {
  return {
    DIFFICULTIES,
    MODES,
    picks: recall('comparePicks', ['dart', 'sniper']),
    difficulty: 2,

    init() {
      this.$watch('picks', (value) => remember('comparePicks', value));
    },

    get units() {
      return this.picks.map((id) => this.$store.hub.units.find((u) => u.id === id)).filter(Boolean);
    },

    swap() {
      this.picks = [this.picks[1], this.picks[0]];
    },

    pick(index, id) {
      const next = [...this.picks];
      next[index] = id;
      this.picks = next;
    },

    /** One row of the comparison: label plus a value per unit. */
    get rows() {
      const d = this.difficulty;
      const hub = this.$store.hub;
      const value = (unit, fn) => (unit ? fn(unit) : '—');
      const isHero = (u) => u.category === 'Heroes';
      const routeOf = (u) => parseRoute(u.bestRoute);
      const fixedRoute = (u) => !isHero(u) && !routeOf(u).some((t) => t === null);
      const rows = [
        { label: 'Class', get: (u) => (isHero(u) ? 'Hero' : u.category) },
        ...MODES.map((m) => ({ label: `${m.label} tier`, get: (u) => u.tiers[m.id], tier: true })),
        { label: 'Roles', get: (u) => u.roles.join(', ') },
        { label: 'Best route', get: (u) => (isHero(u) ? '—' : u.bestRoute) },
        { label: 'Price to place', get: (u) => formatCash(isHero(u) ? u.cost?.[d] ?? 0 : u.costs?.base[d] ?? 0), cash: true },
        { label: 'Best route, total', get: (u) => (fixedRoute(u) ? formatCash(upgradeCost(u, null, routeOf(u), d)) : '—'), cash: true },
        { label: 'Camo', get: (u) => (isHero(u) ? levelText(u.camoLevel) : u.detection?.camoText ?? '—') },
        { label: 'Lead', get: (u) => (isHero(u) ? levelText(u.leadLevel) : u.detection?.leadText ?? '—') },
        { label: 'At its best route', get: (u) => (fixedRoute(u) && u.detection?.camo ? [meetsRule(u.detection.camo, routeOf(u)) ? 'sees Camo' : 'no Camo', meetsRule(u.detection.lead, routeOf(u)) ? 'pops Lead' : 'no Lead'].join(' · ') : '—') },
        { label: 'Purple', get: (u) => (isHero(u) ? '—' : u.detection?.purple ?? '—') },
        { label: 'Hero XP cost', get: (u) => (isHero(u) ? `×${u.xpModifier}` : '—') },
        { label: 'Paragon', get: (u) => hub.paragons.paragons.find((p) => p.id === u.paragon)?.name ?? '—' },
        { label: 'Summary', get: (u) => u.summary, long: true },
      ];
      return rows.map((row) => ({ ...row, values: this.units.map((u) => value(u, row.get)) }));
    },
  };
}

function levelText(level) {
  if (level === 0) return 'From level 1';
  if (level === null || level === undefined) return 'Not on its own';
  return `From level ${level}`;
}
