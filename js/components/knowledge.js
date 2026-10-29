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

    towerName(id) {
      return this.$store.hub.towers.find((tower) => tower.id === id)?.name ?? id;
    },
  };
}
