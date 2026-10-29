// Rounds tab (#rounds): every round of the standard and ABR sets with its
// bloons, RBE and cash, filterable by range and by what the round contains.

import { ROUND_TAGS, cashAtRoundStart, parseBloon, roundCash, roundTags } from '../lib/game.js';
import { formatCash } from '../lib/text.js';
import { recall, remember } from '../lib/storage.js';

const RANGES = [
  { id: 'all', label: 'All', from: 1, to: 140 },
  { id: 'early', label: '1–40', from: 1, to: 40 },
  { id: 'mid', label: '41–80', from: 41, to: 80 },
  { id: 'late', label: '81–100', from: 81, to: 100 },
  { id: 'free', label: '101–140', from: 101, to: 140 },
];

// Where your money count starts: a normal game starts on round 1, CHIMPS and Impoppable on round 6.
const STARTS = [
  { id: 1, label: 'From round 1' },
  { id: 6, label: 'From round 6 (CHIMPS, Impoppable)' },
];

export function roundBrowser() {
  return {
    RANGES,
    STARTS,
    ROUND_TAGS,
    formatCash,
    setId: recall('roundSet', 'regular'),
    range: 'all',
    tags: [],
    startRound: recall('roundStart', 6),
    halfCash: false,
    expanded: null,

    get set() {
      const sets = this.$store.hub.rounds.sets;
      return sets.find((s) => s.id === this.setId) ?? sets[0];
    },

    pickSet(id) {
      this.setId = id;
      remember('roundSet', id);
    },

    pickStart(start) {
      this.startRound = Number(start);
      remember('roundStart', this.startRound);
    },

    toggleTag(id) {
      this.tags = this.tags.includes(id) ? this.tags.filter((t) => t !== id) : [...this.tags, id];
    },

    /** Cash at the start of each round, for the cumulative column. */
    get bank() {
      return cashAtRoundStart(this.set.rounds, {
        startRound: this.startRound,
        startCash: this.$store.hub.rounds.startCash,
        halfCash: this.halfCash,
      });
    },

    /** Danger-round notes from the CHIMPS playbook, by round number. */
    get dangerRounds() {
      return Object.fromEntries(this.$store.hub.playbook.dangerRounds.map((r) => [r.round, r]));
    },

    get rows() {
      const { from, to } = RANGES.find((r) => r.id === this.range);
      return this.set.rounds
        .filter((round) => round.round >= from && round.round <= to)
        .map((round) => ({ ...round, tagIds: roundTags(round) }))
        .filter((round) => this.tags.every((tag) => round.tagIds.includes(tag)))
        .map((round) => ({
          ...round,
          bloons: round.groups.map((group) => ({ ...parseBloon(group.bloon), count: group.count })),
          cash: roundCash(round, { halfCash: this.halfCash }),
          banked: this.bank[round.round + 1] ?? null,
          danger: this.setId === 'regular' ? this.dangerRounds[round.round] ?? null : null,
        }));
    },

    tagLabel(id) {
      return ROUND_TAGS.find((t) => t.id === id)?.label ?? id;
    },
  };
}
