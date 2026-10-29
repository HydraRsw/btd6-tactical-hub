// Events tab (#events): what's live right now (straight from Ninja Kiwi's Open
// Data API, so it's always current), a boss guide with health per tier, and
// notes on how each event type works.

import { bossMultiplier } from '../lib/game.js';
import { formatCash } from '../lib/text.js';

const API = 'https://data.ninjakiwi.com/btd6';

// One fetch per visit for each list; the tab reuses the results.
let cache = null;

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (!json.success) throw new Error(json.error ?? 'Request failed');
  return json.body;
}

/** "DartMonkey", "Dart Monkey", "Dan D'Monke" → "dartmonkey", "dandmonke" */
const squash = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The event in a list that's on now, else the next one, else the latest. */
function pickEvent(list, now = Date.now()) {
  const live = list.find((e) => e.start <= now && now < e.end);
  if (live) return { event: live, status: 'live' };
  const next = list.filter((e) => e.start > now).sort((a, b) => a.start - b.start)[0];
  if (next) return { event: next, status: 'next' };
  return { event: [...list].sort((a, b) => b.end - a.end)[0], status: 'ended' };
}

export function eventsTab() {
  return {
    loading: false,
    error: '',
    live: null, // { boss, race, odyssey, ct } once loaded
    formatCash,

    // --- Boss guide inputs ---
    bossId: 'bloonarius',
    elite: false,
    players: 1,
    degree: 40,

    init() {
      this.$watch('$store.hub.activeTab', (tab) => tab === 'events' && this.load());
      if (this.$store.hub.activeTab === 'events') this.load();
    },

    async load() {
      if (this.live || this.loading) return;
      if (cache) {
        this.live = cache;
        return;
      }
      this.loading = true;
      this.error = '';
      try {
        const [bosses, races, odysseys, cts] = await Promise.all(['bosses', 'races', 'odyssey', 'ct'].map((path) => getJson(`${API}/${path}`)));
        const boss = pickEvent(bosses);
        const race = pickEvent(races);
        const odyssey = pickEvent(odysseys);
        const ct = pickEvent(cts);
        const [bossRules, raceRules, odysseyInfo, odysseyMaps, ctTiles] = await Promise.all([
          getJson(boss.event.metadataStandard).catch(() => null),
          getJson(race.event.metadata).catch(() => null),
          getJson(odyssey.event.metadata_medium).catch(() => null),
          getJson(`${API}/odyssey/${odyssey.event.id}/medium/maps`).catch(() => []),
          getJson(ct.event.tiles).catch(() => null),
        ]);
        cache = {
          boss: { ...boss, rules: bossRules },
          race: { ...race, rules: raceRules },
          odyssey: { ...odyssey, info: odysseyInfo, maps: odysseyMaps ?? [] },
          ct: { ...ct, tiles: ctTiles?.tiles ?? [] },
          fetchedAt: Date.now(),
        };
        this.live = cache;
      } catch (error) {
        this.error = `Couldn't reach Ninja Kiwi's event data (${error.message}). Try again later.`;
      } finally {
        this.loading = false;
      }
    },

    // --- Formatting helpers for the live cards ---------------------------
    when(event, status) {
      const date = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      if (status === 'live') return `Live now · ends ${date(event.end)} (${this.timeLeft(event.end)} left)`;
      if (status === 'next') return `Starts ${date(event.start)}`;
      return `Ended ${date(event.end)}`;
    },

    timeLeft(ms) {
      const hours = Math.max(0, Math.round((ms - Date.now()) / 3600000));
      return hours >= 48 ? `${Math.round(hours / 24)} days` : `${hours} h`;
    },

    statusLabel(status) {
      return { live: 'Live', next: 'Up next', ended: 'Last one' }[status];
    },

    /** Our map for an API map name ("BloonariusPrime"), if we have it. */
    mapFor(apiName) {
      return this.$store.hub.maps.maps.find((m) => squash(m.name) === squash(apiName)) ?? null;
    },

    mapLabel(apiName) {
      return this.mapFor(apiName)?.name ?? String(apiName ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
    },

    /** Our tower or hero for an API tower name ("BombShooter", "DanDMonke"). */
    unitFor(apiName) {
      return this.$store.hub.units.find((u) => squash(u.name) === squash(apiName)) ?? null;
    },

    unitLabel(apiName) {
      return this.unitFor(apiName)?.name ?? String(apiName).replace(/([a-z])([A-Z])/g, '$1 $2');
    },

    /** Restrictions from an event's tower list, in words. */
    restrictions(rules) {
      if (!rules?._towers) return null;
      // "ChosenPrimaryHero" allowed = the player may bring any hero they like.
      const anyHero = rules._towers.some((t) => t.tower === 'ChosenPrimaryHero' && t.max !== 0);
      const towers = rules._towers.filter((t) => t.tower !== 'ChosenPrimaryHero');
      const heroes = towers.filter((t) => t.isHero && t.max !== 0);
      const banned = towers.filter((t) => !t.isHero && t.max === 0);
      const limited = towers.filter((t) => !t.isHero && t.max > 0);
      const pathLimited = towers.filter((t) => !t.isHero && t.max !== 0 && (t.path1NumBlockedTiers || t.path2NumBlockedTiers || t.path3NumBlockedTiers));
      const heroText = anyHero || heroes.length === towers.filter((t) => t.isHero).length ? 'Any hero' : heroes.length ? heroes.map((h) => this.unitLabel(h.tower)).join(', ') : 'No heroes';
      return {
        heroes: heroText,
        banned: banned.map((t) => this.unitLabel(t.tower)),
        limited: limited.map((t) => `${this.unitLabel(t.tower)} ×${t.max}`),
        paths: pathLimited.map((t) => `${this.unitLabel(t.tower)} (max tier ${[t.path1NumBlockedTiers, t.path2NumBlockedTiers, t.path3NumBlockedTiers].map((b) => 5 - b).join('-')})`),
      };
    },

    /** Bloon modifiers that differ from normal, in words. */
    modifiers(rules) {
      const m = rules?._bloonModifiers;
      if (!m) return [];
      const out = [];
      const pct = (x) => `${Math.round(x * 100)}%`;
      if (m.speedMultiplier !== 1) out.push(`Bloon speed ${pct(m.speedMultiplier)}`);
      if (m.moabSpeedMultiplier !== 1) out.push(`MOAB speed ${pct(m.moabSpeedMultiplier)}`);
      if (m.bossSpeedMultiplier !== 1) out.push(`Boss speed ${pct(m.bossSpeedMultiplier)}`);
      if (m.healthMultipliers?.bloons !== 1) out.push(`Bloon health ${pct(m.healthMultipliers.bloons)}`);
      if (m.healthMultipliers?.moabs !== 1) out.push(`MOAB health ${pct(m.healthMultipliers.moabs)}`);
      if (m.healthMultipliers?.boss !== 1) out.push(`Boss health ${pct(m.healthMultipliers.boss)}`);
      if (m.allCamo) out.push('All Bloons are Camo');
      if (m.allRegen) out.push('All Bloons regrow');
      if (rules.disableSelling) out.push('No selling');
      if (rules.disableMK) out.push('No Monkey Knowledge');
      if (rules.disablePowers) out.push('No powers');
      if (rules.disableInstas) out.push('No Insta Monkeys');
      if (rules.noContinues) out.push('No continues');
      if (rules.abilityCooldownReductionMultiplier && rules.abilityCooldownReductionMultiplier !== 1) out.push(`Ability cooldowns ×${rules.abilityCooldownReductionMultiplier}`);
      return out;
    },

    /** "DoubleMoabHealth" → "Double HP MOABs", "Clicks" → "CHIMPS". */
    modeLabel(apiMode) {
      const aliases = { clicks: 'chimps', doublemoabhealth: 'double-hp-moabs', alternatebloonsrounds: 'abr', magicmonkeysonly: 'magic-only', magiconly: 'magic-only', primaryonly: 'primary-only', militaryonly: 'military-only', halfcash: 'half-cash', standard: null };
      const key = squash(apiMode);
      if (key === 'standard') return 'Standard';
      const id = aliases[key] ?? key;
      return this.$store.hub.modes.modes.find((m) => m.id === id || squash(m.name) === key)?.name ?? String(apiMode).replace(/([a-z])([A-Z])/g, '$1 $2');
    },

    scoring(type) {
      return { GameTime: 'Fastest time', LeastCash: 'Least cash', LeastTiers: 'Least tiers' }[type] ?? type;
    },

    /** Our boss entry for the API's boss type ("bloonarius"). */
    bossFor(type) {
      return this.$store.hub.bosses.bosses.find((b) => b.id === squash(type)) ?? null;
    },

    openBossGuide(type) {
      const boss = this.bossFor(type);
      if (!boss) return;
      this.bossId = boss.id;
      requestAnimationFrame(() => document.getElementById('boss-guide')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    },

    /** Contested Territory tiles grouped by type and by game type. */
    ctSummary(tiles) {
      const count = (key) => Object.entries(tiles.reduce((acc, t) => ({ ...acc, [t[key]]: (acc[t[key]] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
      const relics = tiles.filter((t) => t.type.startsWith('Relic')).map((t) => t.type.replace('Relic - ', '').replace(/([a-z])([A-Z])/g, '$1 $2'));
      return { games: count('gameType').filter(([k]) => k !== 'TeamStart'), banners: tiles.filter((t) => t.type === 'Banner').length, relics: [...new Set(relics)] };
    },

    // --- Boss guide ---------------------------------------------------------
    get boss() {
      return this.$store.hub.bosses.bosses.find((b) => b.id === this.bossId) ?? this.$store.hub.bosses.bosses[0];
    },

    /** One row per tier: health, extra (shield/armor), health per skull section, effective health for a Paragon at the chosen degree. */
    get bossRows() {
      const b = this.boss;
      const coop = this.$store.hub.bosses.coop[this.players - 1] ?? 1;
      const form = this.elite ? 'elite' : 'normal';
      const skulls = b.skulls[form];
      const multiplier = bossMultiplier(Math.min(100, Math.max(1, Number(this.degree) || 1)), this.elite);
      return b[form].map((hp, i) => {
        const health = Math.round(hp * coop);
        const extra = b.extra ? Math.round(b.extra[form][i] * coop) : null;
        return {
          tier: i + 1,
          round: this.$store.hub.bosses.tierRounds[i],
          health,
          extra,
          perSection: Math.round(health / (skulls + 1)),
          effective: Math.round((health + (extra ?? 0)) / multiplier),
        };
      });
    },

    get multiplier() {
      return bossMultiplier(Math.min(100, Math.max(1, Number(this.degree) || 1)), this.elite);
    },

    /** Paragons whose guide names this boss as a good or bad matchup. */
    get matchups() {
      const name = this.boss.name.toLowerCase();
      const mentions = (list) => (list ?? []).some((text) => text.toLowerCase().includes(name));
      const paragons = this.$store.hub.paragons.paragons;
      return {
        good: paragons.filter((p) => mentions(p.bestBosses)),
        bad: paragons.filter((p) => mentions(p.worstBosses)),
      };
    },

    paragonTower(paragon) {
      return this.$store.hub.towers.find((t) => t.id === paragon.tower);
    },
  };
}
