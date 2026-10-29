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

// Ways to order the list. "jump" is how much harder a round is than the one before it.
const SORTS = [
  { id: 'round', label: 'Round order' },
  { id: 'rbe', label: 'Highest RBE' },
  { id: 'jump', label: 'Biggest jump from the round before' },
  { id: 'blimps', label: 'Most MOAB-class' },
];

let chart = null; // Chart.js instance, kept outside Alpine so it isn't made reactive

// Where your money count starts: a normal game starts on round 1, CHIMPS and Impoppable on round 6.
const STARTS = [
  { id: 1, label: 'From round 1' },
  { id: 6, label: 'From round 6 (CHIMPS, Impoppable)' },
];

export function roundBrowser() {
  return {
    RANGES,
    STARTS,
    SORTS,
    sortBy: 'round',
    showChart: true,
    ROUND_TAGS,
    formatCash,
    setId: recall('roundSet', 'regular'),
    range: 'all',
    tags: [],
    startRound: recall('roundStart', 6),
    halfCash: false,
    expanded: null,

    init() {
      // redraw the chart when what it shows changes
      this.$watch('range', () => this.$nextTick(() => this.drawChart(this.$refs.chart)));
      this.$watch('setId', () => this.$nextTick(() => this.drawChart(this.$refs.chart)));
      this.$watch('halfCash', () => this.$nextTick(() => this.drawChart(this.$refs.chart)));
      this.$watch('showChart', (on) => on && this.$nextTick(() => this.drawChart(this.$refs.chart)));
      this.$watch('$store.hub.activeTab', (tab) => tab === 'rounds' && this.$nextTick(() => this.drawChart(this.$refs.chart)));
    },

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
      const all = this.set.rounds;
      const rows = all
        .map((round, i) => ({
          ...round,
          jump: round.rbe - (all[i - 1]?.rbe ?? 0),
          blimps: round.groups.filter((g) => parseBloon(g.bloon).blimp).reduce((sum, g) => sum + g.count, 0),
        }))
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
      if (this.sortBy === 'round') return rows;
      return [...rows].sort((a, b) => b[this.sortBy] - a[this.sortBy]);
    },

    /** The number shown next to a round when sorting by something other than round order. */
    metric(row) {
      if (this.sortBy === 'jump') return `${row.jump >= 0 ? '+' : ''}${row.jump.toLocaleString('en-US')} RBE vs round ${row.round - 1}`;
      if (this.sortBy === 'blimps') return `${row.blimps} MOAB-class`;
      return '';
    },

    // --- Chart: RBE and cash per round for the chosen range -----------------
    drawChart(canvas) {
      if (!window.Chart || !canvas) return;
      const { from, to } = RANGES.find((r) => r.id === this.range);
      const rounds = this.set.rounds.filter((r) => r.round >= from && r.round <= to);
      chart?.destroy();
      chart = new window.Chart(canvas, {
        type: 'line',
        data: {
          labels: rounds.map((r) => r.round),
          datasets: [
            { label: 'RBE', data: rounds.map((r) => r.rbe), borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,.2)', yAxisID: 'rbe', pointRadius: 0, borderWidth: 2, tension: 0.2 },
            { label: 'Cash', data: rounds.map((r) => roundCash(r, { halfCash: this.halfCash })), borderColor: '#a8f05a', backgroundColor: 'rgba(168,240,90,.2)', yAxisID: 'cash', pointRadius: 0, borderWidth: 2, tension: 0.2 },
          ],
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: '#dce8ff' } }, tooltip: { callbacks: { title: (items) => `Round ${items[0].label}` } } },
          scales: {
            x: { ticks: { color: '#b9cdee', maxTicksLimit: 14 }, grid: { color: 'rgba(255,255,255,.06)' } },
            rbe: { type: 'logarithmic', position: 'left', title: { display: true, text: 'RBE (log scale)', color: '#ff9b9b' }, ticks: { color: '#b9cdee' }, grid: { color: 'rgba(255,255,255,.06)' } },
            cash: { type: 'linear', position: 'right', title: { display: true, text: 'Cash', color: '#c8f59a' }, ticks: { color: '#b9cdee' }, grid: { display: false } },
          },
        },
      });
    },

    tagLabel(id) {
      return ROUND_TAGS.find((t) => t.id === id)?.label ?? id;
    },
  };
}
