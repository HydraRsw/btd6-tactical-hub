// Paragons tab: boss-event tier list of every Paragon plus the degree guide.

import { formatCash } from '../lib/text.js';
import { TIER_COLORS } from './tier-list.js';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

export function paragonGuide() {
  return {
    TIER_COLORS,
    formatCash,

    get guide() {
      return this.$store.hub.paragons.degreeGuide;
    },

    /** Paragons grouped by boss tier, best first. */
    get groups() {
      const paragons = this.$store.hub.paragons.paragons;
      return TIER_ORDER
        .map((tier) => ({ tier, paragons: paragons.filter((paragon) => paragon.bossTier === tier) }))
        .filter((group) => group.paragons.length > 0);
    },

    towerOf(paragon) {
      return this.$store.hub.towers.find((tower) => tower.id === paragon.tower);
    },

    costLabel(paragon) {
      return paragon.cost ? formatCash(paragon.cost) : 'Cost not documented yet';
    },
  };
}
