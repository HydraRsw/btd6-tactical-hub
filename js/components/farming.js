// Farming Engine tab: editable build table, scenario modifiers and the payback chart.

import { incomePerRound, netProfit, paybackRounds, sellbackValue, sellOutCurve } from '../lib/economy.js';
import { recall, remember } from '../lib/storage.js';
import { formatCash } from '../lib/text.js';

const CHART_COLORS = ['#ffd23f', '#7ad420', '#43c6ff', '#ff5b5b', '#a77bff', '#ff9b3d', '#ff6fb5', '#ffffff'];
const STRATEGY_COLORS = { amber: '#ffd23f', emerald: '#7ad420', sky: '#43c6ff', rose: '#ff6fb5' };
const CHECKPOINT_COLORS = ['#7ad420', '#ffd23f', '#ff9b3d', '#ff5b5b', '#a77bff'];

let chart = null; // Chart.js instance, kept outside Alpine so it isn't made reactive

/** Fresh copy of the builds from data, each switched on if it has a quantity. */
function defaultBuilds(store) {
  return store.economy.farmBuilds.map((build) => ({ ...build, enabled: build.quantity > 0 }));
}

export function farmingEngine() {
  return {
    builds: [],
    startRound: 30,
    endRound: 80,
    modifiers: { bananaCentral: false, centralMarkets: 0, tradeEmpire: false, tradeAgreements: false },

    STRATEGY_COLORS,
    CHECKPOINT_COLORS,
    formatCash,

    init() {
      const hub = this.$store.hub;
      // Saved edits only apply to the patch they were made on.
      const saved = recall('farm', null);
      this.builds = saved?.patch === hub.meta.patch ? saved.builds : defaultBuilds(hub);
      Object.assign(this, recall('farmScenario', {}));

      this.$watch('builds', () => this.save());
      this.$watch('modifiers', () => this.save());
      this.$watch('startRound', () => this.save());
      this.$watch('endRound', () => this.save());
    },

    save() {
      remember('farm', { patch: this.$store.hub.meta.patch, builds: this.builds });
      remember('farmScenario', { startRound: this.startRound, endRound: this.endRound, modifiers: this.modifiers });
    },

    resetBuilds() {
      this.builds = defaultBuilds(this.$store.hub);
    },

    /** Rounds between buying and the evaluation round (at least 1). */
    get roundsOwned() {
      const start = Math.min(Math.max(Number(this.startRound) || 1, 1), 139);
      const end = Math.min(Math.max(Number(this.endRound) || start + 1, start + 1), 140);
      return end - start;
    },

    // --- Per-build numbers used by the table -----------------------------
    income(build) {
      return incomePerRound(build, this.builds, this.modifiers);
    },
    payback(build) {
      return paybackRounds(build.cost, this.income(build));
    },
    paysBackInTime(build) {
      return this.payback(build) <= this.roundsOwned;
    },
    profit(build) {
      return netProfit(build, this.income(build), this.roundsOwned);
    },
    profitIfSold(build) {
      return this.profit(build) + sellbackValue(build);
    },
    paybackLabel(build) {
      const rounds = this.payback(build);
      return Number.isFinite(rounds) ? `${rounds} rd` : '—';
    },

    /** Number inputs come back as strings; store them as non-negative numbers. */
    setNumber(build, field, value) {
      build[field] = Math.max(0, Number(value) || 0);
      if (field === 'quantity' && build.quantity > 0) build.enabled = true;
    },

    // --- Chart -----------------------------------------------------------
    drawChart(canvas) {
      if (!window.Chart) return;
      const firstRound = Math.max(1, Number(this.startRound) || 1);
      const labels = Array.from({ length: this.roundsOwned + 1 }, (_, i) => `R${firstRound + i}`);
      const datasets = this.builds
        .map((build, index) => ({ build, color: CHART_COLORS[index % CHART_COLORS.length] }))
        .filter(({ build }) => build.enabled && build.quantity > 0)
        .map(({ build, color }) => ({
          label: build.name,
          data: sellOutCurve(build, this.income(build), this.roundsOwned),
          borderColor: color,
          backgroundColor: `${color}22`,
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.3,
        }));

      chart?.destroy();
      chart = new window.Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#dce8ff', boxWidth: 10, font: { family: 'Nunito', weight: 700 } } },
            title: { display: true, text: 'Net cash if you sold everything at this round', color: '#b9cdee', font: { family: 'Nunito' } },
            tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${formatCash(item.parsed.y)}` } },
          },
          scales: {
            x: { ticks: { color: '#86a3d1', maxTicksLimit: 10 }, grid: { color: 'rgba(185,205,238,.08)' } },
            y: { ticks: { color: '#86a3d1', callback: (value) => formatCash(value) }, grid: { color: 'rgba(185,205,238,.1)' } },
          },
        },
      });
    },
  };
}
