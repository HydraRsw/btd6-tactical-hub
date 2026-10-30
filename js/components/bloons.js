// Bloons tab (#bloons): one card per bloon type and property — health, RBE,
// speed, children, immunities, the first round it shows up (standard and ABR),
// hand-picked towers that handle it, and for Camo, Lead, Purple and DDT the full
// list of towers and heroes that can deal with it (from the detection data).

import { firstRoundWith, parseBloon } from '../lib/game.js';
import { matchesQuery } from '../lib/text.js';
import { t } from '../lib/i18n.js';

const ICONS = { camo: 'Camo Green', regrow: 'Regrow Red', fortified: 'Fortified Ceramic' };
const KINDS = [
  { id: 'all', label: 'Every bloon' },
  { id: 'regular', label: 'Regular' },
  { id: 'blimp', label: 'Blimps' },
  { id: 'property', label: 'Properties' },
];

export function bloonsTab() {
  return {
    KINDS,
    kind: 'all',
    query: '',

    get list() {
      return this.$store.hub.bloons.bloons.filter((b) =>
        (this.kind === 'all' || b.kind === this.kind) &&
        matchesQuery(this.query, [b.name, t(b.name), b.summary, t(b.summary)]));
    },

    icon(b) {
      return parseBloon(ICONS[b.id] ?? b.match);
    },

    setRounds(id) {
      return this.$store.hub.rounds.sets?.find((s) => s.id === id)?.rounds ?? [];
    },

    /** First round with this bloon (or property) in the standard set and in ABR. */
    firstRounds(b) {
      const find = (rounds) => {
        if (b.kind === 'property') return firstRoundWith(rounds, b.match);
        return rounds.find((r) => r.groups.some((g) => parseBloon(g.bloon).base === b.match))?.round ?? null;
      };
      return { regular: find(this.setRounds('regular')), abr: find(this.setRounds('abr')) };
    },

    resolve(pick) {
      const hub = this.$store.hub;
      const unit = hub.units.find((u) => u.id === pick.unit);
      return { ...pick, unit, go: unit ? () => hub.openUnit(unit) : null };
    },

    /** Every tower and hero that can handle Camo / Lead / Purple (or all of a DDT's), cheapest first. */
    coverage(b) {
      const hub = this.$store.hub;
      const needs = { camo: ['camo'], lead: ['lead'], ddt: ['camo', 'lead'], purple: ['purple'] }[b.id];
      if (!needs) return null;
      const cost = (rules) => Math.min(...rules.map((r) => r.reduce((a, c) => a + c, 0)));
      const pathOf = (rules) => rules.map((r) => r.join('-')).join(' / ');
      const towers = hub.towers
        .filter((tw) => tw.detection && needs.every((n) => (n === 'purple' ? /^(Pops Purple|Glue affects Purple|MIB covers Purple)/.test(tw.detection.purple ?? '') : Array.isArray(tw.detection[n]) && tw.detection[n].length)))
        .map((tw) => ({
          tower: tw,
          cost: needs.filter((n) => n !== 'purple').reduce((m, n) => Math.max(m, cost(tw.detection[n])), 0),
          path: needs.filter((n) => n !== 'purple').map((n) => pathOf(tw.detection[n])).join(' + '),
          text: needs.map((n) => (n === 'purple' ? tw.detection.purple : tw.detection[`${n}Text`])).join(' · '),
        }))
        .sort((a, c) => a.cost - c.cost);
      const heroes = needs.includes('purple') ? [] : hub.heroes.filter((h) => needs.every((n) => h[`${n}Level`]));
      return { towers, heroes, needs };
    },

    heroLevels(hero, needs) {
      return needs.map((n) => `${n === 'camo' ? 'Camo' : 'Lead'} from level ${hero[`${n}Level`]}`).join(' · ');
    },
  };
}
