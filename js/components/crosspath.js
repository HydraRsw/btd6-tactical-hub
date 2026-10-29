// Crosspath Guide tab: one card per tower with its best and situational routes.

import { matchesQuery } from '../lib/text.js';
import { CATEGORY_ICONS } from './tier-list.js';

const TOWER_CATEGORIES = ['Primary', 'Military', 'Magic', 'Support'];

const CONFIDENCE_LABELS = {
  verified: 'Verified route',
  approximate: 'Approximate / patch-sensitive',
  new: 'New tower, meta still settling',
};

export function crosspathGuide() {
  return {
    query: '',
    categories: [...TOWER_CATEGORIES],

    TOWER_CATEGORIES,
    CATEGORY_ICONS,
    CONFIDENCE_LABELS,

    toggleCategory(category) {
      const index = this.categories.indexOf(category);
      if (index === -1) this.categories.push(category);
      else this.categories.splice(index, 1);
    },

    get visibleTowers() {
      return this.$store.hub.towers
        .filter((tower) => this.categories.includes(tower.category))
        .filter((tower) =>
          matchesQuery(this.query, [
            tower.name,
            tower.category,
            tower.summary,
            ...tower.roles,
            ...tower.routes.flatMap((route) => [route.path, route.name, route.note]),
          ]),
        );
    },
  };
}
