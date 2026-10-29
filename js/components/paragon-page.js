// Paragon page (#paragon/<id>): how one Paragon works, how to use it, what it
// pairs with, which bosses it's good and bad against, and how to raise its degree.

import { formatCash } from '../lib/text.js';

export function paragonPage() {
  return {
    formatCash,

    keep: null,

    init() {
      this.keep = this.$store.hub.pageKeeper('paragon');
    },

    get paragon() {
      return this.keep ? this.keep() : this.$store.hub.currentPage;
    },

    get tower() {
      return this.$store.hub.towers.find((tower) => tower.id === this.paragon.tower);
    },

    /**
     * Synergy entries resolved to what they point at: a tower, a hero or
     * another Paragon (shown with its tower's picture).
     */
    get synergies() {
      const hub = this.$store.hub;
      return (this.paragon.synergies ?? []).map((synergy) => {
        const other = hub.paragons.paragons.find((paragon) => paragon.id === synergy.unit);
        if (other) {
          const avatar = hub.towers.find((tower) => tower.id === other.tower);
          return { ...synergy, name: other.name, avatar, go: () => hub.openPage('paragon', other.id) };
        }
        const unit = hub.units.find((u) => u.id === synergy.unit);
        if (!unit) return null;
        const go = () => hub.openUnit(unit);
        return { ...synergy, name: unit.name, avatar: unit, go };
      }).filter(Boolean);
    },

    neighbour(step) {
      const paragons = this.$store.hub.paragons.paragons;
      const index = paragons.findIndex((paragon) => paragon.id === this.paragon.id);
      return paragons[(index + step + paragons.length) % paragons.length];
    },
  };
}
