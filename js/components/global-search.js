// Header search: fuzzy-finds towers, heroes, Paragons, maps, modes, danger rounds
// and economy topics,
// then jumps to the matching card. Keyboard: / to focus, ↑ ↓ to move, Enter to open.

import { fuzzyScore } from '../lib/text.js';
import { t } from '../lib/i18n.js';
import { meetsRule, parseBloon, roundTags, toPath } from '../lib/game.js';

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
  Boss: { color: '#ff5b5b', icon: 'skull' },
  Knowledge: { color: '#43c6ff', icon: 'graduation-cap' },
  Answer: { color: '#7ad420', icon: 'shield-check' },
  Bloon: { color: '#ff4d4d', icon: 'circle-dot' },
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

  const bosses = hub.bosses.bosses.map((boss) => ({
    kind: 'Boss',
    title: boss.name,
    subtitle: `Boss · ${boss.title}`,
    keywords: `boss ${boss.title} ${(boss.mechanics ?? []).map((m) => m.name).join(' ')}`,
    go: () => hub.openPage('boss', boss.id),
  }));

  const bloons = hub.bloons.bloons.map((bloon) => ({
    kind: 'Bloon',
    title: bloon.name,
    subtitle: bloon.summary,
    keywords: `bloon ${bloon.kind} ${bloon.immune.join(' ')}`,
    go: () => hub.jumpTo('bloons', `bloon-${bloon.id}`),
  }));

  const knowledge = hub.knowledge.entries.map((entry) => ({
    kind: 'Knowledge',
    title: entry.name,
    subtitle: `Monkey Knowledge · ${entry.category}`,
    keywords: `mk monkey knowledge ${entry.effect}`,
    go: () => hub.openTab('knowledge'),
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
    { title: 'Monkey Knowledge', subtitle: 'Every Monkey Knowledge point, by tree.', keywords: 'mk monkey knowledge tree points', go: () => hub.openTab('knowledge') },
    { title: 'Compare towers and heroes', subtitle: 'Two units side by side', keywords: 'compare versus vs side by side', go: () => hub.openTool('compare') },
  ].map((tool) => ({ kind: 'Tool', ...tool }));

  return [...tools, ...towers, ...heroes, ...paragons, ...bosses, ...bloons, ...maps, ...modes, ...knowledge, ...rounds, ...checkpoints, ...strategies];
}

// Words for bloon properties in a search ("camo lead round 50", "plomo camuflaje").
const PROPERTY_WORDS = [
  { id: 'camo', label: 'Camo', words: /\b(camo|camos|camuflaje|camuflados?)\b/i },
  { id: 'lead', label: 'Lead', words: /\b(lead|leads|plomo|emplomados?|ddts?)\b/i },
];
const ROUND_WORDS = /\b(?:r|round|ronda)\s*(\d{1,3})\b/i;

/**
 * Answers for "camo lead round 50": the round itself, and the towers and heroes
 * that can handle the bloon properties asked for (or found in that round).
 */
function propertyAnswers(hub, query) {
  const roundMatch = query.match(ROUND_WORDS);
  const roundNumber = roundMatch ? Number(roundMatch[1]) : null;
  const round = roundNumber ? hub.rounds.sets?.find((s) => s.id === 'regular')?.rounds.find((r) => r.round === roundNumber) : null;
  const wanted = new Set(PROPERTY_WORDS.filter((p) => p.words.test(query)).map((p) => p.id));
  const out = [];
  if (round) {
    const tags = roundTags(round);
    tags.filter((tag) => tag === 'camo' || tag === 'lead').forEach((tag) => wanted.add(tag));
    const bloons = round.groups.map((g) => `${parseBloon(g.bloon).name ?? g.bloon} ×${g.count}`).join(', ');
    out.push({ kind: 'Round', title: `Round ${round.round}`, subtitle: bloons, go: () => hub.jumpTo('rounds', `rb-${round.round}`) });
  }
  if (!wanted.size) return out;
  const props = PROPERTY_WORDS.filter((p) => wanted.has(p.id));
  const need = props.map((p) => p.label).join(' + ');
  const towers = hub.towers
    .filter((tower) => tower.detection && props.every((p) => Array.isArray(tower.detection[p.id])))
    .map((tower) => {
      const route = hub.routeFor(tower);
      const atRoute = route && !route.includes('x') && props.every((p) => meetsRule(tower.detection[p.id], toPath(route)));
      const cheapest = Math.max(...props.map((p) => Math.min(...tower.detection[p.id].map((rule) => rule.reduce((a, b) => a + b, 0)))));
      return { tower, atRoute, cheapest };
    })
    .sort((a, b) => Number(b.atRoute) - Number(a.atRoute) || a.cheapest - b.cheapest)
    .slice(0, 6)
    .map(({ tower }) => ({
      kind: 'Answer',
      unit: tower,
      title: tower.name,
      subtitle: `${need}: ${props.map((p) => tower.detection[`${p.id}Text`]).join(' · ')}`,
      go: () => hub.openPage('tower', tower.id),
    }));
  const heroes = hub.heroes
    .filter((hero) => props.every((p) => hero[`${p.id}Level`]))
    .map((hero) => ({
      kind: 'Answer',
      unit: hero,
      title: hero.name,
      subtitle: `${need}: ${props.map((p) => `${p.label} from level ${hero[`${p.id}Level`]}`).join(' · ')}`,
      go: () => hub.openPage('hero', hero.id),
    }));
  return [...out, ...towers, ...heroes];
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
      const answers = propertyAnswers(this.$store.hub, this.query);
      const found = this.index
        .map((entry) => ({
          entry,
          score: Math.max(fuzzyScore(this.query, entry.title) * 1.5, fuzzyScore(this.query, `${entry.title} ${t(entry.title)} ${t(entry.subtitle ?? '')} ${entry.keywords}`)),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ entry }) => entry);
      return [...answers, ...found].slice(0, answers.length ? MAX_RESULTS + 4 : MAX_RESULTS);
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
