// Paragon degree calculator (on the Paragons tab): enter what the Paragon will
// absorb and see its power, degree and boss multiplier — or pick a target
// degree and see how much power (and slider cash) it takes.

import { DIFFICULTIES, PARAGON_POWER_CAPS, bossMultiplier, degreeForPower, paragonPower, powerForDegree } from '../lib/game.js';
import { formatCash } from '../lib/text.js';
import { recall, remember } from '../lib/storage.js';

// Text for the ⓘ tips next to each field and result (shown on hover).
const HELP = {
  paragon: 'The Paragon you plan to build. Each one has its own price, and the price sets how much cash power you get per dollar.',
  difficulty: 'The difficulty of your game. Paragons cost less on Easy and more on Hard and Impoppable, so the same cash gives more power on easier difficulties.',
  towerCash: 'When you buy a Paragon, every other tower of the same type on the map is absorbed into it. Enter the money you spent placing and upgrading those towers, but leave out the tier 5s (they count in the next fields). Not sure? Add up the upgrade prices from the tower\'s page on this site.',
  sliderCash: 'The Paragon upgrade window has a slider that lets you pay extra cash on top of the price. It works like spending on towers but costs 5% more per power. Cash from towers and the slider share one cap of 80,000 power.',
  extraTier5: 'You need three tier 5s of the tower to unlock the Paragon (one of each path). Each extra tier 5 that also gets absorbed adds 6,000 power. Normally you can only own one of each tier 5, so this is usually 0 unless something lets you build a second copy (the wiki names Master Double Cross and level 13+ Silas).',
  damage: 'Every tower shows a damage (pops) counter in its panel. Add up the counters of all the towers that will be absorbed, tier 5s included. Every 180 damage is 1 power. Leaving towers on the map longer before upgrading raises this.',
  income: 'Towers that make money (Merchantmen, Bloon Traps, Bounty Hunters…) show an income counter in their panel. Add up the counters of the towers that will be absorbed. Every $45 is 1 power. Pops and income share one cap of 125,000 power.',
  totems: "Paragon Power Totems are bought from Geraldo's shop once he reaches level 20. Each totem the Paragon absorbs adds 2,000 power, with no cap. Three totems are worth one extra tier 5.",
  degree: 'Degree goes from 1 to 100 and comes from total power. Every 20 degrees (20, 40, 60, 80, 100) the Paragon deals 25% more damage to bosses, and Elite bosses take double on top.',
  breakdown: 'How much power each source gives. When a row turns gold, that source has hit its cap and adding more to it does nothing.',
  target: 'Pick the degree you want. The calculator shows how much power is missing, how much slider cash would cover it, and how many totems you would need for whatever the slider can\'t cover.',
};

const DEFAULTS = { paragonId: 'goliath-doomship', difficulty: 2, towerCash: 0, sliderCash: 0, extraTier5: 0, damage: 0, income: 0, totems: 0, target: 40 };

export function degreeCalculator() {
  return {
    DIFFICULTIES,
    CAPS: PARAGON_POWER_CAPS,
    HELP,
    formatCash,
    showGuide: false,    // the "How to use" steps
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
