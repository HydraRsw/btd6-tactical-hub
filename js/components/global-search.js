// Header search: fuzzy-finds towers, heroes, Paragons, maps, modes, danger rounds
// and economy topics,
// then jumps to the matching card. Keyboard: / to focus, ↑ ↓ to move, Enter to open.

import { fuzzyScore } from '../lib/text.js';

const MAX_RESULTS = 10;

const KIND_STYLES = {
  Tower: { color: '#43c6ff' },
  Hero: { color: '#ff6fb5' },
  Round: { color: '#ffd23f', icon: 'skull' },
  Economy: { color: '#7ad420', icon: 'banana' },
  Paragon: { color: '#a77bff' },
  Map: { color: '#7ad420', icon: 'map' },
  Mode: { color: '#ff9f1c', icon: 'gamepad-2' },
  Tool: { color: '#ffd23f', icon: 'wrench' },
};

/** Everything the search box can find, built from the loaded data. */
function buildSearchIndex(hub) {

  const towers = hub.towers.map((tower) => ({
    kind: 'Tower',
    unit: tower,
    title: tower.name,
    subtitle: `${tower.category} · ${tower.bestRoute} · CHIMPS ${tower.tiers.chimps} / Boss ${tower.tiers.boss} / Normal ${tower.tiers.normal}`,
    keywords: [tower.category, tower.bestRoute, ...tower.roles, ...tower.routes.map((r) => `${r.name} ${r.path}`)].join(' '),
    go: () => hub.openTower(tower.id),
  }));

  const heroes = hub.heroes.map((hero) => ({
    kind: 'Hero',
    unit: hero,
    title: hero.name,
    subtitle: `Hero · CHIMPS ${hero.tiers.chimps} / Boss ${hero.tiers.boss} / Normal ${hero.tiers.normal}`,
    keywords: ['hero', ...hero.roles].join(' '),
    go: () => hub.openPage('hero', hero.id),
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

  const paragons = hub.paragons.paragons.map((paragon) => ({
    kind: 'Paragon',
    unit: hub.towers.find((tower) => tower.id === paragon.tower),
    title: paragon.name,
    subtitle: `Paragon · boss tier ${paragon.bossTier}`,
    keywords: `paragon degree ${paragon.role}`,
    go: () => hub.openPage('paragon', paragon.id),
  }));

  const maps = hub.maps.maps.map((map) => ({
    kind: 'Map',
    title: map.name,
    subtitle: `${map.difficulty} map · ${map.traits.slice(0, 2).join(' · ')}`,
    keywords: `map ${map.difficulty} ${map.traits.join(' ')}`,
    go: () => hub.openPage('map', map.id),
  }));

  const modes = hub.modes.modes.map((mode) => ({
    kind: 'Mode',
    title: mode.name,
    subtitle: `${mode.difficulty} game mode`,
    keywords: `mode ${mode.difficulty}`,
    go: () => hub.openPage('mode', mode.id),
  }));

  const tools = [
    { title: 'Build planner', subtitle: 'Plan a CHIMPS run round by round', keywords: 'planner chimps build cash afford', go: () => hub.openTool('planner') },
    { title: 'Round browser', subtitle: 'Every round: bloons, RBE and cash', keywords: 'rounds rbe cash abr alternate', go: () => hub.openTab('rounds') },
    { title: 'Paragon degree calculator', subtitle: 'Power and degree from what you absorb', keywords: 'paragon degree power calculator', go: () => hub.openTool('degree') },
    { title: 'Live events', subtitle: "This week's boss, race, Odyssey and Contested Territory", keywords: 'events boss race odyssey contested territory ct this week live', go: () => hub.openTab('events') },
    { title: 'Boss guide', subtitle: 'Boss health per tier, skulls and Paragon matchups', keywords: 'boss bloonarius lych vortex dreadbloon phayze blastapopoulos diamondback health skull elite', go: () => hub.jumpTo('events', 'boss-guide') },
    { title: 'What changed this patch', subtitle: 'Patch notes in plain words', keywords: 'patch notes changes update version nerf buff', go: () => hub.openTab('patch') },
    { title: 'Freeplay scaling', subtitle: 'How rounds get harder after 80', keywords: 'freeplay scaling speed health super ceramic', go: () => hub.jumpTo('rounds', 'freeplay') },
    { title: 'My medals', subtitle: 'Black Border and medal tracker', keywords: 'medals black border tracker progress', go: () => hub.openTab('maps') },
    { title: 'Compare towers and heroes', subtitle: 'Two units side by side', keywords: 'compare versus vs side by side', go: () => hub.openTool('compare') },
  ].map((tool) => ({ kind: 'Tool', ...tool }));

  return [...tools, ...towers, ...heroes, ...paragons, ...maps, ...modes, ...rounds, ...checkpoints, ...strategies];
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
