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
  need(TIERS.includes(unit.tiers?.chimps) && TIERS.includes(unit.tiers?.boss), 'tiers.chimps and tiers.boss must be S, A, B, C or D');
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

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s) in /data:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✓ data OK: patch ${meta.patch}, ${towers.length} towers, ${heroes.length} heroes`);
