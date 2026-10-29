// Checks the files in /data before they are published.
// Run with:  node scripts/validate-data.mjs
// Exits with code 1 and a list of problems if anything is wrong.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const problems = [];

function load(name) {
  try {
    return JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'));
  } catch (error) {
    problems.push(`${name}.json: ${error.message}`);
    return null;
  }
}

const TIERS = ['S', 'A', 'B', 'C', 'D'];
const ROLES = ['DPS', 'Stall', 'Buff', 'Cleanup', 'MOAB', 'Income'];
const TOWER_CATEGORIES = ['Primary', 'Military', 'Magic', 'Support'];
const CONFIDENCE = ['verified', 'approximate', 'new'];
const ROUTE = /^([0-5x]-[0-5x]-[0-5x]|—)$/i;
const ICON = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function checkUnit(unit, where, { isHero }) {
  const at = `${where} "${unit?.id ?? '?'}"`;
  const need = (ok, message) => ok || problems.push(`${at}: ${message}`);

  need(typeof unit.id === 'string' && /^[a-z0-9-]+$/.test(unit.id), 'id must be lowercase letters, digits or dashes');
  need(typeof unit.name === 'string' && unit.name.length > 0, 'missing name');
  need(isHero ? unit.category === 'Heroes' : TOWER_CATEGORIES.includes(unit.category), `bad category "${unit.category}"`);
  need(['chimps', 'boss', 'normal'].every((mode) => TIERS.includes(unit.tiers?.[mode])), 'tiers.chimps, tiers.boss and tiers.normal must each be S, A, B, C or D');
  need(Array.isArray(unit.roles) && unit.roles.length > 0 && unit.roles.every((r) => ROLES.includes(r)), `roles must be from ${ROLES.join(', ')}`);
  need(CONFIDENCE.includes(unit.confidence), `confidence must be ${CONFIDENCE.join(', ')}`);
  need(typeof unit.summary === 'string' && unit.summary.length > 0, 'missing summary');

  if (!isHero) {
    need(ICON.test(unit.icon ?? ''), 'icon must be a Lucide icon name like "flask-conical"');
    need(ROUTE.test(unit.bestRoute ?? ''), `bestRoute "${unit.bestRoute}" must look like 2-0-5 or x-x-x`);
    need(Array.isArray(unit.routes) && unit.routes.length > 0, 'needs at least one route');
    for (const route of unit.routes ?? []) {
      need(ROUTE.test(route.path ?? ''), `route path "${route.path}" must look like 2-0-5`);
      need(['optimal', 'situational'].includes(route.kind), `route kind must be optimal or situational`);
      need(route.name && route.note, 'each route needs a name and a note');
    }
    need((unit.routes ?? []).some((r) => r.kind === 'optimal'), 'needs one optimal route');
  }
}

function checkUniqueIds(list, where) {
  const seen = new Set();
  for (const item of list) {
    if (seen.has(item.id)) problems.push(`${where}: duplicate id "${item.id}"`);
    seen.add(item.id);
  }
}

const meta = load('meta');
const towers = load('towers');
const heroes = load('heroes');
const economy = load('economy');
const playbook = load('playbook');
const sources = load('sources');

// Every "sources" list must point at ids defined in sources.json.
function checkSourceIds(ids, where) {
  if (ids === undefined) return;
  if (!Array.isArray(ids)) return problems.push(`${where}: sources must be a list of ids`);
  for (const id of ids) {
    if (!sources?.[id]) problems.push(`${where}: unknown source "${id}" (add it to sources.json)`);
  }
}

if (sources) {
  for (const [id, source] of Object.entries(sources)) {
    if (!source.title || !/^https:\/\//.test(source.url ?? '')) problems.push(`sources.json "${id}": needs a title and an https url`);
  }
}
for (const unit of [...(Array.isArray(towers) ? towers : []), ...(Array.isArray(heroes) ? heroes : [])]) {
  checkSourceIds(unit.sources, `"${unit.id}"`);
}
for (const [section, items] of Object.entries({ ...(playbook ?? {}), ...(economy ?? {}) })) {
  if (Array.isArray(items)) items.forEach((item, i) => checkSourceIds(item?.sources, `${section}[${i}]`));
}

if (meta) {
  if (!/^\d+(\.\d+)*$/.test(String(meta.patch))) problems.push('meta.json: patch must look like "57.0"');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(meta.updated))) problems.push('meta.json: updated must be YYYY-MM-DD');
  if (!Array.isArray(meta.changes)) problems.push('meta.json: changes must be a list');
}

if (Array.isArray(towers)) {
  towers.forEach((t) => checkUnit(t, 'towers.json', { isHero: false }));
  checkUniqueIds(towers, 'towers.json');
} else if (towers) problems.push('towers.json must be a list');

if (Array.isArray(heroes)) {
  heroes.forEach((h) => checkUnit(h, 'heroes.json', { isHero: true }));
  checkUniqueIds(heroes, 'heroes.json');
} else if (heroes) problems.push('heroes.json must be a list');

if (economy) {
  for (const build of economy.farmBuilds ?? []) {
    for (const field of ['quantity', 'cost', 'incomePerRound', 'sellbackPercent']) {
      if (typeof build[field] !== 'number' || build[field] < 0) problems.push(`economy.json build "${build.id}": ${field} must be a number ≥ 0`);
    }
  }
  if (!Array.isArray(economy.bossCheckpoints)) problems.push('economy.json: bossCheckpoints must be a list');
}

if (playbook) {
  for (const key of ['dangerRounds', 'heroSynergies', 'bosses']) {
    if (!Array.isArray(playbook[key])) problems.push(`playbook.json: ${key} must be a list`);
  }
  const heroIds = new Set((heroes ?? []).map((h) => h.id));
  for (const synergy of playbook.heroSynergies ?? []) {
    if (!heroIds.has(synergy.heroId)) problems.push(`playbook.json: hero synergy "${synergy.heroId}" has no matching hero`);
  }
}

// Tower pages: upgrade names, tips, synergy links and Paragon links.
const paragonsFile = load('paragons');
const paragonIds = new Set((paragonsFile?.paragons ?? []).map((p) => p.id));
const unitIds = new Set([...(Array.isArray(towers) ? towers : []), ...(Array.isArray(heroes) ? heroes : [])].map((u) => u.id));
for (const tower of Array.isArray(towers) ? towers : []) {
  const at = `towers.json "${tower.id}"`;
  if (tower.upgrades !== undefined) {
    const ok = Array.isArray(tower.upgrades) && tower.upgrades.length === 3
      && tower.upgrades.every((path) => Array.isArray(path) && path.length === 5 && path.every((n) => n === null || typeof n === 'string'));
    if (!ok) problems.push(`${at}: upgrades must be 3 lists of 5 names (null for unknown)`);
  }
  if (tower.tips !== undefined && !['chimps', 'boss', 'normal'].every((mode) => Array.isArray(tower.tips[mode]))) {
    problems.push(`${at}: tips needs "chimps", "boss" and "normal" lists`);
  }
  for (const synergy of tower.synergies ?? []) {
    if (!unitIds.has(synergy.unit)) problems.push(`${at}: synergy points at unknown tower/hero "${synergy.unit}"`);
    if (!synergy.note) problems.push(`${at}: synergy with "${synergy.unit}" needs a note`);
  }
  if (tower.paragon !== undefined && !paragonIds.has(tower.paragon)) problems.push(`${at}: unknown paragon "${tower.paragon}"`);
}

if (paragonsFile) {
  const towerIds = new Set((Array.isArray(towers) ? towers : []).map((t) => t.id));
  for (const paragon of paragonsFile.paragons ?? []) {
    const at = `paragons.json "${paragon.id}"`;
    if (!towerIds.has(paragon.tower)) problems.push(`${at}: unknown tower "${paragon.tower}"`);
    if (!TIERS.includes(paragon.bossTier)) problems.push(`${at}: bossTier must be S, A, B, C or D`);
    if (!CONFIDENCE.includes(paragon.confidence)) problems.push(`${at}: bad confidence`);
    if (paragon.cost !== null && typeof paragon.cost !== 'number') problems.push(`${at}: cost must be a number or null`);
    checkSourceIds(paragon.sources, at);
    // Paragon page fields
    for (const field of ['combines', 'strategy', 'synergies', 'bestBosses', 'worstBosses', 'degreeTips']) {
      if (!Array.isArray(paragon[field])) problems.push(`${at}: ${field} must be a list`);
    }
    if (!paragon.howItWorks) problems.push(`${at}: missing howItWorks`);
    for (const synergy of paragon.synergies ?? []) {
      if (!unitIds.has(synergy.unit) && !paragonIds.has(synergy.unit)) problems.push(`${at}: synergy points at unknown tower/hero/Paragon "${synergy.unit}"`);
      if (!synergy.note) problems.push(`${at}: synergy with "${synergy.unit}" needs a note`);
    }
  }
  checkSourceIds(paragonsFile.degreeGuide?.sources, 'paragons.json degreeGuide');
}

// Maps and game modes
const MAP_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const MODE_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Any'];
const modesFile = load('modes');
const mapsFile = load('maps');
const modeIds = new Set((modesFile?.modes ?? []).map((m) => m.id));
const checkPicks = (list, at) => {
  if (!Array.isArray(list)) return problems.push(`${at}: must be a list`);
  for (const pick of list) {
    if (!unitIds.has(pick.unit)) problems.push(`${at}: "${pick.upgrade}" points at unknown tower/hero "${pick.unit}"`);
    if (!pick.upgrade || !pick.note) problems.push(`${at}: each pick needs an upgrade and a note`);
  }
};
if (modesFile) {
  checkUniqueIds(modesFile.modes ?? [], 'modes.json');
  for (const mode of modesFile.modes ?? []) {
    const at = `modes.json "${mode.id}"`;
    if (!mode.name) problems.push(`${at}: missing name`);
    if (!MODE_DIFFICULTIES.includes(mode.difficulty)) problems.push(`${at}: difficulty must be ${MODE_DIFFICULTIES.join(', ')}`);
    if (!ICON.test(mode.icon ?? '')) problems.push(`${at}: icon must be a Lucide icon name`);
    if (!Array.isArray(mode.rules) || !mode.rules.length) problems.push(`${at}: needs rules`);
    if (!Array.isArray(mode.strategy) || !mode.strategy.length) problems.push(`${at}: needs strategy`);
    checkPicks(mode.towers, `${at} towers`);
    checkSourceIds(mode.sources, at);
  }
}
if (mapsFile) {
  checkUniqueIds(mapsFile.maps ?? [], 'maps.json');
  for (const map of mapsFile.maps ?? []) {
    const at = `maps.json "${map.id}"`;
    if (!/^[a-z0-9-]+$/.test(map.id ?? '')) problems.push(`${at}: id must be lowercase letters, digits or dashes`);
    if (!MAP_DIFFICULTIES.includes(map.difficulty)) problems.push(`${at}: difficulty must be ${MAP_DIFFICULTIES.join(', ')}`);
    for (const field of ['name', 'summary', 'placement']) if (!map[field]) problems.push(`${at}: missing ${field}`);
    if (!Array.isArray(map.traits)) problems.push(`${at}: traits must be a list`);
    checkPicks(map.recommended, `${at} recommended`);
    for (const modeId of Object.keys(map.modeNotes ?? {})) {
      if (!modeIds.has(modeId)) problems.push(`${at}: modeNotes has unknown mode "${modeId}"`);
    }
    checkSourceIds(map.sources, at);
  }
}

// Tower costs and detection, hero levels, rounds
const price4 = (list) => Array.isArray(list) && list.length === 4 && list.every((n) => typeof n === 'number' && n >= 0);
const ruleList = (rules) => rules === null || (Array.isArray(rules) && rules.every((r) => Array.isArray(r) && r.length === 3 && r.every((n) => Number.isInteger(n) && n >= 0 && n <= 5)));
for (const tower of Array.isArray(towers) ? towers : []) {
  const at = `towers.json "${tower.id}"`;
  if (tower.costs) {
    if (!price4(tower.costs.base)) problems.push(`${at}: costs.base must be [easy, medium, hard, impoppable]`);
    const ok = Array.isArray(tower.costs.upgrades) && tower.costs.upgrades.length === 3 && tower.costs.upgrades.every((path) => path.length === 5 && path.every(price4));
    if (!ok) problems.push(`${at}: costs.upgrades must be 3 paths × 5 tiers × 4 difficulties`);
  } else problems.push(`${at}: missing costs`);
  if (tower.detection) {
    if (!ruleList(tower.detection.camo) || !ruleList(tower.detection.lead)) problems.push(`${at}: detection.camo / detection.lead must be lists of [top, middle, bottom] minimum tiers (or null)`);
    for (const field of ['camoText', 'leadText', 'purple']) if (!tower.detection[field]) problems.push(`${at}: detection.${field} missing`);
  } else problems.push(`${at}: missing detection`);
}
for (const hero of Array.isArray(heroes) ? heroes : []) {
  const at = `heroes.json "${hero.id}"`;
  if (!price4(hero.cost)) problems.push(`${at}: cost must be [easy, medium, hard, impoppable]`);
  if (typeof hero.xpModifier !== 'number') problems.push(`${at}: xpModifier must be a number`);
  if (!Array.isArray(hero.milestones) || hero.milestones.some((m) => !Number.isInteger(m.level) || m.level < 1 || m.level > 20 || !m.text)) problems.push(`${at}: milestones must be [{ level 1–20, text }]`);
  for (const field of ['camoLevel', 'leadLevel']) if (hero[field] !== null && !Number.isInteger(hero[field])) problems.push(`${at}: ${field} must be a level or null`);
  for (const pair of hero.pairs ?? []) if (!unitIds.has(pair.unit)) problems.push(`${at}: pairs with unknown tower/hero "${pair.unit}"`);
  checkSourceIds(hero.sources, at);
}
const roundsFile = load('rounds');
if (roundsFile) {
  for (const set of roundsFile.sets ?? []) {
    const at = `rounds.json "${set.id}"`;
    if (!Array.isArray(set.rounds) || set.rounds.length !== 140) problems.push(`${at}: needs 140 rounds`);
    (set.rounds ?? []).forEach((round, i) => {
      if (round.round !== i + 1) problems.push(`${at}: round ${i + 1} is out of order`);
      if (!Array.isArray(round.groups) || !round.groups.length || round.groups.some((g) => !g.bloon || !(g.count > 0))) problems.push(`${at} round ${round.round}: bad groups`);
      for (const field of ['rbe', 'popCash', 'bonusCash', 'duration', 'xp']) if (typeof round[field] !== 'number') problems.push(`${at} round ${round.round}: ${field} must be a number`);
    });
    checkSourceIds(set.sources, at);
  }
}

// Monkey Knowledge on towers, planner templates
for (const tower of Array.isArray(towers) ? towers : []) {
  if (!Array.isArray(tower.knowledge)) problems.push(`towers.json "${tower.id}": knowledge must be a list (can be empty)`);
  for (const mk of tower.knowledge ?? []) if (!mk.name || !mk.effect || !mk.cost) problems.push(`towers.json "${tower.id}": each knowledge entry needs name, effect and cost`);
}
const templatesFile = load('templates');
for (const t of templatesFile?.templates ?? []) {
  const at = `templates.json "${t.id}"`;
  if (!t.name || !t.description) problems.push(`${at}: needs a name and description`);
  for (const entry of t.entries ?? []) {
    if (!unitIds.has(entry.tower)) problems.push(`${at}: unknown tower/hero "${entry.tower}"`);
    if (!Array.isArray(entry.steps) || !entry.steps.length) problems.push(`${at}: "${entry.tower}" needs at least one step`);
    for (const step of entry.steps ?? []) {
      if (!Number.isInteger(step.round)) problems.push(`${at}: "${entry.tower}" step round must be a whole number`);
      if (!/^[0-5]-[0-5]-[0-5]$/.test(step.path ?? '')) problems.push(`${at}: "${entry.tower}" step path must look like 0-2-3`);
    }
  }
  checkSourceIds(t.sources, at);
}

// Patch notes, bosses, events, Freeplay scaling
const patchFile = load('patch');
const mapIds = new Set((mapsFile?.maps ?? []).map((m) => m.id));
for (const v of patchFile?.versions ?? []) {
  const at = `patch.json "${v.version}"`;
  if (!/^\d+\.\d+$/.test(v.version ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(v.date ?? '')) problems.push(`${at}: needs a version like 57.4 and a date like 2026-10-22`);
  for (const c of v.changes ?? []) {
    if (!c.area || !c.text) problems.push(`${at}: each change needs an area and text`);
    if (c.unit && !unitIds.has(c.unit) && !paragonIds.has(c.unit)) problems.push(`${at}: unknown tower/hero/Paragon "${c.unit}"`);
    if (c.map && !mapIds.has(c.map)) problems.push(`${at}: unknown map "${c.map}"`);
  }
  checkSourceIds(v.sources, at);
}
const bossesFile = load('bosses');
for (const b of bossesFile?.bosses ?? []) {
  const at = `bosses.json "${b.id}"`;
  for (const form of ['normal', 'elite']) {
    if (!Array.isArray(b[form]) || b[form].length !== 5 || b[form].some((n) => typeof n !== 'number')) problems.push(`${at}: ${form} must be 5 health numbers`);
    if (!Number.isInteger(b.skulls?.[form])) problems.push(`${at}: skulls.${form} must be a number`);
  }
  checkSourceIds(b.sources, at);
}
const eventsFile = load('events');
for (const f of eventsFile?.formats ?? []) checkSourceIds(f.sources, `events.json "${f.id}"`);
const freeplayFile = load('freeplay');
if (freeplayFile) checkSourceIds(freeplayFile.sources, 'freeplay.json');

// Spanish dictionary (js/lib/i18n.js): exact strings and regex patterns must be usable.
const es = load('i18n/es');
if (es) {
  if (typeof es.exact !== 'object' || Array.isArray(es.exact)) problems.push('i18n/es.json: "exact" must be an object');
  for (const [english, spanish] of Object.entries(es.exact ?? {})) if (typeof spanish !== 'string' || !spanish.trim()) problems.push(`i18n/es.json: empty translation for "${english}"`);
  for (const entry of es.patterns ?? []) {
    try {
      new RegExp(entry[0]);
    } catch (error) {
      problems.push(`i18n/es.json: bad pattern ${entry[0]} (${error.message})`);
    }
    if (typeof entry[1] !== 'string') problems.push(`i18n/es.json: pattern ${entry[0]} needs a Spanish string`);
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s) in /data:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✓ data OK: patch ${meta.patch}, ${towers.length} towers, ${heroes.length} heroes, ${paragonIds.size} paragons, ${mapsFile?.maps?.length ?? 0} maps, ${modeIds.size} modes, ${(roundsFile?.sets ?? []).map((x) => x.rounds.length + ' ' + x.id).join(' / ')} rounds`);
