// Boss event planner (#bossplan): pick the boss (this week's is picked for
// you from Ninja Kiwi's live data), then plan each tier: the defense the boss
// page suggests, a Paragon and the degree you want, what that costs in power
// and cash, and how much cash the rounds alone pay by then.

import { DIFFICULTIES, PARAGON_POWER_CAPS, bossMultiplier, cashAtRoundStart, powerForDegree } from '../lib/game.js';
import { formatCash } from '../lib/text.js';
import { recall, remember } from '../lib/storage.js';

const DEFAULT_DEGREES = [1, 1, 20, 40, 60];

export function bossPlanner() {
  const saved = recall('bossPlan', {});
  return {
    formatCash,
    DIFFICULTIES,
    bossId: saved.bossId ?? 'bloonarius',
    elite: saved.elite ?? false,
    players: saved.players ?? 1,
    difficulty: saved.difficulty ?? 1, // boss events are usually Medium
    tiers: saved.tiers ?? DEFAULT_DEGREES.map((degree, i) => ({ paragonId: i < 2 ? '' : 'apex-plasma-master', degree })),
    liveNote: '',

    async init() {
      this.$watch('[bossId, elite, players, difficulty, tiers]', () => remember('bossPlan', { bossId: this.bossId, elite: this.elite, players: this.players, difficulty: this.difficulty, tiers: this.tiers }), { deep: true });
      if (!saved.bossId) await this.useLiveBoss();
    },

    /** Pick this week's boss from Ninja Kiwi's open data (silently keeps the current pick if it can't). */
    async useLiveBoss() {
      try {
        const response = await fetch('https://data.ninjakiwi.com/btd6/bosses');
        const json = await response.json();
        const now = Date.now();
        const list = json.body ?? [];
        const event = list.find((e) => e.start <= now && now < e.end) ?? list.sort((a, b) => b.start - a.start)[0];
        const id = String(event?.bossType ?? '').toLowerCase().replace(/[^a-z]/g, '');
        if (this.$store.hub.bosses.bosses.some((b) => b.id === id)) {
          this.bossId = id;
          this.liveNote = event.start <= now && now < event.end ? 'live' : 'latest';
        }
      } catch {
        this.liveNote = '';
      }
    },

    get boss() {
      return this.$store.hub.bosses.bosses.find((b) => b.id === this.bossId) ?? this.$store.hub.bosses.bosses[0];
    },

    get paragons() {
      return this.$store.hub.paragons.paragons;
    },

    /** Paragons the boss page or Paragon guides recommend for this boss, first. */
    get recommended() {
      const name = this.boss.name.toLowerCase();
      const fromPage = (this.boss.stages ?? []).flatMap((s) => s.picks).filter((p) => p.unit?.startsWith('paragon:')).map((p) => p.unit.slice(8));
      const fromGuide = this.paragons.filter((p) => (p.bestBosses ?? []).some((t) => t.toLowerCase().includes(name))).map((p) => p.id);
      return [...new Set([...fromPage, ...fromGuide])];
    },

    /** Boss page advice that matches a tier (stage labels like "Tiers 1–2", "Tier 3"). */
    stageFor(tier) {
      const stages = this.boss.stages ?? [];
      const match = stages.find((s) => {
        const nums = (s.label.match(/\d/g) ?? []).map(Number);
        if (!nums.length) return false;
        return nums.length === 1 ? nums[0] === tier : tier >= nums[0] && tier <= nums[nums.length - 1];
      });
      if (match) return match;
      return /early/i.test(stages[0]?.label ?? '') ? (tier <= 2 ? stages[0] : stages[stages.length - 1]) : null;
    },

    get rounds() {
      return this.$store.hub.rounds.sets?.find((s) => s.id === 'regular')?.rounds ?? [];
    },

    get rows() {
      const hub = this.$store.hub;
      const form = this.elite ? 'elite' : 'normal';
      const coop = hub.bosses.coop[this.players - 1] ?? 1;
      return this.boss[form].map((hp, i) => {
        const tier = i + 1;
        const round = hub.bosses.tierRounds[i];
        const plan = this.tiers[i];
        const paragon = this.paragons.find((p) => p.id === plan.paragonId) ?? null;
        const degree = Math.min(100, Math.max(1, Number(plan.degree) || 1));
        const health = Math.round((hp + (this.boss.extra ? this.boss.extra[form][i] : 0)) * coop);
        const multiplier = bossMultiplier(degree, this.elite);
        const power = powerForDegree(degree);
        let paragonCost = 0;
        let cashPower = 0;
        let cashForPower = 0;
        let popPower = 0;
        if (paragon) {
          paragonCost = paragon.costs?.[this.difficulty] ?? paragon.cost;
          const perPower = paragonCost / 20000;
          cashPower = Math.min(power, PARAGON_POWER_CAPS.cash);
          cashForPower = Math.round(cashPower * perPower);
          popPower = power - cashPower;
        }
        return {
          tier,
          round,
          health,
          paragon,
          degree,
          multiplier,
          effective: Math.round(health / multiplier),
          power,
          paragonCost,
          cashForPower,
          popPower,
          popDamage: popPower * 180,
          cashByRound: Math.round(cashAtRoundStart(this.rounds, { startRound: 1, startCash: 650 })[round] ?? 0),
          stage: this.stageFor(tier),
        };
      });
    },

    openDegree(row) {
      if (row.paragon) this.$store.hub.openDegree(row.paragon.id, row.degree, this.difficulty);
    },
  };
}
