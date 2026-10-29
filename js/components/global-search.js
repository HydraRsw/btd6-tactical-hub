// Header search: fuzzy-finds towers, heroes, danger rounds and economy topics,
// then jumps to the matching card. Keyboard: / to focus, ↑ ↓ to move, Enter to open.

import { fuzzyScore } from '../lib/text.js';

const MAX_RESULTS = 10;

const KIND_STYLES = {
  Tower: { color: '#43c6ff' },
  Hero: { color: '#ff6fb5' },
  Round: { color: '#ffd23f', icon: 'skull' },
  Economy: { color: '#7ad420', icon: 'banana' },
};

/** Everything the search box can find, built from the loaded data. */
function buildSearchIndex(hub) {
  const synergyHeroIds = hub.playbook.heroSynergies.map((s) => s.heroId);

  const towers = hub.towers.map((tower) => ({
    kind: 'Tower',
    unit: tower,
    title: tower.name,
    subtitle: `${tower.category} · ${tower.bestRoute} · CHIMPS ${tower.tiers.chimps} / Boss ${tower.tiers.boss}`,
    keywords: [tower.category, tower.bestRoute, ...tower.roles, ...tower.routes.map((r) => `${r.name} ${r.path}`)].join(' '),
    go: () => hub.jumpTo('tier', `tier-${tower.id}`, tower.id),
  }));

  const heroes = hub.heroes.map((hero) => ({
    kind: 'Hero',
    unit: hero,
    title: hero.name,
    subtitle: `Hero · CHIMPS ${hero.tiers.chimps} / Boss ${hero.tiers.boss}`,
    keywords: ['hero', ...hero.roles].join(' '),
    go: synergyHeroIds.includes(hero.id)
      ? () => hub.jumpTo('chimps', `hero-${hero.id}`)
      : () => hub.jumpTo('tier', `tier-${hero.id}`, hero.id),
  }));

  const rounds = hub.playbook.dangerRounds.map((round) => ({
    kind: 'Round',
    title: `Round ${round.round}: ${round.title}`,
    subtitle: 'CHIMPS danger round',
    keywords: `r${round.round} round ${round.round} ${round.threat}`,
    go: () => hub.jumpTo('chimps', `round-${round.round}`),
  }));

  const checkpoints = hub.economy.bossCheckpoints.map((checkpoint) => ({
    kind: 'Economy',
    title: `Boss checkpoint R${checkpoint.round}`,
    subtitle: checkpoint.cashTarget,
    keywords: `boss checkpoint r${checkpoint.round} ${checkpoint.bossTier}`,
    go: () => hub.jumpTo('farm', `checkpoint-${checkpoint.round}`),
  }));

  const strategies = hub.economy.strategies.map((strategy) => ({
    kind: 'Economy',
    title: strategy.title,
    subtitle: strategy.tag,
    keywords: 'farm economy income',
    go: () => hub.jumpTo('farm', 'strategies'),
  }));

  return [...towers, ...heroes, ...rounds, ...checkpoints, ...strategies];
}

export function globalSearch() {
  return {
    query: '',
    isOpen: false,
    selected: 0,
    index: [],
    KIND_STYLES,

    init() {
      this.$watch('$store.hub.status', (status) => {
        if (status === 'ready') this.index = buildSearchIndex(this.$store.hub);
      });
      if (this.$store.hub.status === 'ready') this.index = buildSearchIndex(this.$store.hub);
    },

    get results() {
      if (!this.query.trim()) return [];
      return this.index
        .map((entry) => ({
          entry,
          score: Math.max(fuzzyScore(this.query, entry.title) * 1.5, fuzzyScore(this.query, `${entry.title} ${entry.keywords}`)),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map(({ entry }) => entry);
    },

    onType() {
      this.selected = 0;
      this.isOpen = this.query.trim().length > 0;
    },

    move(step) {
      const count = this.results.length;
      if (count) this.selected = (this.selected + step + count) % count;
    },

    choose(result = this.results[this.selected]) {
      if (!result) return;
      this.isOpen = false;
      this.$refs.input.blur();
      result.go();
    },

    close() {
      this.isOpen = false;
    },
  };
}
