// Boss page (#boss/<id>): how one boss fights, what to build at each tier,
// Elite differences, a money plan, health per tier and the Paragons that suit it.

import { formatCash } from '../lib/text.js';

export function bossPage() {
  return {
    formatCash,
    elite: false,
    players: 1,

    keep: null,

    init() {
      this.keep = this.$store.hub.pageKeeper('boss');
    },

    get boss() {
      return this.keep ? this.keep() : this.$store.hub.currentPage;
    },

    get rows() {
      const b = this.boss;
      const form = this.elite ? 'elite' : 'normal';
      const coop = this.$store.hub.bosses.coop[this.players - 1] ?? 1;
      return b[form].map((hp, i) => ({
        tier: i + 1,
        round: this.$store.hub.bosses.tierRounds[i],
        health: Math.round(hp * coop),
        extra: b.extra ? Math.round(b.extra[form][i] * coop) : null,
      }));
    },

    /** A pick resolved to what it links to: a tower, hero or Paragon. */
    resolve(pick) {
      const hub = this.$store.hub;
      if (!pick.unit) return { ...pick, avatar: null, go: null };
      if (pick.unit.startsWith('paragon:')) {
        const paragon = hub.paragons.paragons.find((p) => p.id === pick.unit.slice(8));
        if (!paragon) return { ...pick, avatar: null, go: null };
        return { ...pick, avatar: hub.towers.find((t) => t.id === paragon.tower), go: () => hub.openPage('paragon', paragon.id) };
      }
      const unit = hub.units.find((u) => u.id === pick.unit);
      return { ...pick, avatar: unit ?? null, go: unit ? () => hub.openUnit(unit) : null };
    },

    /** Paragons whose guide names this boss as a good or bad matchup. */
    get matchups() {
      const name = this.boss.name.toLowerCase();
      const mentions = (list) => (list ?? []).some((text) => text.toLowerCase().includes(name));
      const paragons = this.$store.hub.paragons.paragons;
      return { good: paragons.filter((p) => mentions(p.bestBosses)), bad: paragons.filter((p) => mentions(p.worstBosses)) };
    },

    paragonTower(paragon) {
      return this.$store.hub.towers.find((t) => t.id === paragon.tower);
    },

    neighbour(step) {
      const list = this.$store.hub.bosses.bosses;
      const index = list.findIndex((b) => b.id === this.boss.id);
      return list[(index + step + list.length) % list.length];
    },
  };
}
