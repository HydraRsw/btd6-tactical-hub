// Paragon degree calculator (on the Paragons tab): enter what the Paragon will
// absorb and see its power, degree and boss multiplier — or pick a target
// degree and see how much power (and slider cash) it takes.

import { DIFFICULTIES, PARAGON_POWER_CAPS, bossMultiplier, degreeForPower, paragonPower, powerForDegree } from '../lib/game.js';
import { formatCash } from '../lib/text.js';
import { recall, remember } from '../lib/storage.js';

const DEFAULTS = { paragonId: 'goliath-doomship', difficulty: 2, towerCash: 0, sliderCash: 0, extraTier5: 0, damage: 0, income: 0, totems: 0, target: 40 };

export function degreeCalculator() {
  return {
    DIFFICULTIES,
    CAPS: PARAGON_POWER_CAPS,
    formatCash,
    form: { ...DEFAULTS, ...(recall('degreeCalc', null) ?? {}) },

    init() {
      this.$watch('form', (value) => remember('degreeCalc', value), { deep: true });
    },

    get paragon() {
      const list = this.$store.hub.paragons.paragons;
      return list.find((p) => p.id === this.form.paragonId) ?? list[0];
    },

    get paragonCost() {
      return this.paragon?.costs?.[this.form.difficulty] ?? this.paragon?.cost ?? 0;
    },

    get power() {
      const n = (v) => Math.max(0, Number(v) || 0);
      return paragonPower({
        paragonCost: this.paragonCost,
        towerCash: n(this.form.towerCash),
        sliderCash: n(this.form.sliderCash),
        extraTier5: n(this.form.extraTier5),
        damage: n(this.form.damage),
        income: n(this.form.income),
        totems: n(this.form.totems),
      });
    },

    get degree() {
      return degreeForPower(this.power.total);
    },

    get next() {
      if (this.degree >= 100) return null;
      const nextTwenty = Math.min(100, Math.ceil((this.degree + 1) / 20) * 20);
      return {
        degree: this.degree + 1,
        power: powerForDegree(this.degree + 1) - this.power.total,
        twenty: nextTwenty,
        twentyPower: powerForDegree(nextTwenty) - this.power.total,
      };
    },

    /** Rows for the power breakdown table. */
    get breakdown() {
      const p = this.power;
      return [
        { label: 'Cash (towers + slider)', value: p.cash, cap: PARAGON_POWER_CAPS.cash },
        { label: 'Extra tier 5s', value: p.tier5, cap: PARAGON_POWER_CAPS.tier5 },
        { label: 'Pops and income', value: p.damage, cap: PARAGON_POWER_CAPS.damage },
        { label: 'Paragon Power Totems', value: p.totems, cap: null },
      ];
    },

    /** Target mode: what a chosen degree needs. */
    get target() {
      const degree = Math.min(100, Math.max(1, Math.round(Number(this.form.target) || 1)));
      const needed = powerForDegree(degree);
      const missing = Math.max(0, needed - this.power.total);
      // how much of the missing power the slider could still cover before the cash cap
      const cashRoom = Math.max(0, PARAGON_POWER_CAPS.cash - this.power.cash);
      const sliderPower = Math.min(missing, cashRoom);
      return {
        degree,
        needed,
        missing,
        sliderCash: Math.ceil(sliderPower * this.power.perPower * 1.05),
        afterSlider: missing - sliderPower,
        totems: Math.ceil((missing - sliderPower) / 2000),
        normal: bossMultiplier(degree),
        elite: bossMultiplier(degree, true),
      };
    },

    bossMultiplier,
  };
}
