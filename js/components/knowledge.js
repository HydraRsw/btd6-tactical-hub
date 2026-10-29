// Monkey Knowledge tab (#knowledge): every point by tree, with what it does,
// what it needs, the key picks, and a per-browser "I own this" checklist.

import { recall, remember } from '../lib/storage.js';
import { matchesQuery } from '../lib/text.js';
import { t } from '../lib/i18n.js';

export function knowledgeTab() {
  return {
    tree: 'All',
    query: '',
    show: 'all', // 'all' | 'missing' | 'owned'
    keyOnly: false,
    owned: new Set(recall('mkOwned', [])),

    isOwned(id) {
      return this.owned.has(id);
    },

    toggleOwned(id) {
      const next = new Set(this.owned);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.owned = next;
      remember('mkOwned', [...next]);
    },

    get entries() {
      return this.$store.hub.knowledge.entries.filter((e) =>
        (this.tree === 'All' || e.category === this.tree) &&
        (!this.keyOnly || e.keyPick) &&
        (this.show === 'all' || (this.show === 'owned') === this.isOwned(e.id)) &&
        matchesQuery(this.query, [e.name, t(e.name), e.effect, t(e.effect), ...e.requires]));
    },

    get groups() {
      return this.$store.hub.knowledge.categories
        .map((category) => ({ category, entries: this.entries.filter((e) => e.category === category) }))
        .filter((g) => g.entries.length);
    },

    progress(category) {
      const all = this.$store.hub.knowledge.entries.filter((e) => category === 'All' || e.category === category);
      return { owned: all.filter((e) => this.isOwned(e.id)).length, total: all.length };
    },

    // --- What to get next ------------------------------------------------------
    byName(name) {
      return this.$store.hub.knowledge.entries.find((e) => e.name === name);
    },

    spentIn(category) {
      return this.$store.hub.knowledge.entries.filter((e) => e.category === category && this.isOwned(e.id)).length;
    },

    /** Not owned, every prerequisite owned, and enough points already spent in its tree. */
    canUnlock(entry) {
      return !this.isOwned(entry.id) && entry.requires.every((name) => this.isOwned(this.byName(name)?.id)) && entry.points <= this.spentIn(entry.category);
    },

    /** Points you can buy right now, key picks first, then the cheapest. */
    get nextUp() {
      return this.$store.hub.knowledge.entries
        .filter((e) => this.canUnlock(e))
        .sort((a, b) => Number(Boolean(b.keyPick)) - Number(Boolean(a.keyPick)) || a.mm - b.mm || a.points - b.points)
        .slice(0, 8);
    },

    /** Every point still missing on the way to an entry (prerequisites first), with the Monkey Money it all costs. */
    pathTo(entry) {
      const chain = [];
      const seen = new Set();
      const walk = (e) => {
        if (!e || seen.has(e.id) || this.isOwned(e.id)) return;
        seen.add(e.id);
        e.requires.forEach((name) => walk(this.byName(name)));
        chain.push(e);
      };
      walk(entry);
      const spent = this.spentIn(entry.category);
      return {
        steps: chain,
        mm: chain.reduce((sum, e) => sum + e.mm, 0),
        morePoints: Math.max(0, entry.points - spent - (chain.length - 1)),
      };
    },

    /** Key picks not owned yet that are still out of reach, with what it takes to reach them. */
    get keyGoals() {
      return this.$store.hub.knowledge.entries
        .filter((e) => e.keyPick && !this.isOwned(e.id) && !this.canUnlock(e))
        .map((e) => ({ entry: e, path: this.pathTo(e) }))
        .sort((a, b) => a.path.steps.length - b.path.steps.length || a.path.mm - b.path.mm)
        .slice(0, 6);
    },

    towerName(id) {
      return this.$store.hub.towers.find((tower) => tower.id === id)?.name ?? id;
    },
  };
}
