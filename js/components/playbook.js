// CHIMPS & Bosses tab: danger-round checklist, hero synergies and boss notes.

import { recall, remember } from '../lib/storage.js';

export function chimpsPlaybook() {
  return {
    coveredRounds: recall('coveredRounds', []),

    isCovered(round) {
      return this.coveredRounds.includes(round);
    },

    toggleRound(round) {
      this.coveredRounds = this.isCovered(round)
        ? this.coveredRounds.filter((r) => r !== round)
        : [...this.coveredRounds, round];
      remember('coveredRounds', this.coveredRounds);
    },

    clearChecklist() {
      this.coveredRounds = [];
      remember('coveredRounds', []);
    },

    get totalRounds() {
      return this.$store.hub.playbook.dangerRounds.length;
    },

    get progressPercent() {
      return this.totalRounds ? (this.coveredRounds.length / this.totalRounds) * 100 : 0;
    },

    /** The hero record (for tiers and avatar) behind a synergy card. */
    heroFor(synergy) {
      return this.$store.hub.heroes.find((hero) => hero.id === synergy.heroId) ?? {
        id: synergy.heroId,
        name: synergy.name,
        category: 'Heroes',
        tiers: { chimps: '?', boss: '?' },
      };
    },
  };
}
