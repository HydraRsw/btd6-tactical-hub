// Spanish version. The site is written in English; when Spanish is on, this
// module swaps the text on the page for its translation as it appears.
//
// How it works: data/i18n/es.json has an `exact` table (English text → Spanish)
// and `patterns` for text built from numbers or names ("Round 40", "Short by $X
// at the start of the round."). A MutationObserver watches the page, so text
// Alpine renders later is translated too. Anything without a translation stays
// in English. Tower, upgrade, hero, map and mode names are game names and stay
// in English on purpose.
//
// Adding a translation: put the English text (exactly as shown, whitespace
// collapsed) and its Spanish in `exact`, or add a pattern: ["^Regex (\\d+)$",
// "Spanish {1}"], where {1}, {2}… are the regex groups (translated too, if
// they're known text).

const STORAGE_KEY = 'btd6hub:lang';
export const LANGS = ['en', 'es'];
const ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'svg']);

let exact = new Map();
let patterns = [];
const cache = new Map();
const lastOutput = new WeakMap();
let lang = 'en';

export function currentLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    // storage blocked: fall back to the browser language
  }
  return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore: the switch then only lasts until reload
  }
  location.reload();
}

/** Translate one piece of text (English in, Spanish or English out). */
export function t(text) {
  if (lang === 'en' || text == null) return text;
  const source = String(text);
  const core = source.replace(/\s+/g, ' ').trim();
  if (!core || !/[A-Za-z]{2}/.test(core)) return source;
  let out = cache.get(core);
  if (out === undefined) {
    out = lookup(core) ?? null;
    cache.set(core, out);
  }
  if (out === null) return source;
  // Keep the whitespace around the text (it matters between inline elements).
  const lead = source.match(/^\s*/)[0];
  const trail = source.match(/\s*$/)[0];
  return lead + out + trail;
}

function lookup(core) {
  const direct = exact.get(core);
  if (direct !== undefined) return direct;
  for (const [regex, replacement] of patterns) {
    const match = core.match(regex);
    if (match) return replacement.replace(/\{(\d+)\}/g, (_, n) => part(match[Number(n)] ?? ''));
  }
  return undefined;
}

/** A pattern group: translate it whole, or piece by piece for lists. */
function part(text) {
  const whole = exact.get(text.trim());
  if (whole !== undefined) return text.replace(text.trim(), whole);
  for (const [separator, spanish] of [[' · ', ' · '], [', ', ', '], [' and ', ' y ']]) {
    if (text.includes(separator)) return text.split(separator).map((piece) => exact.get(piece.trim()) ?? lookupQuiet(piece)).join(spanish);
  }
  return lookupQuiet(text);
}

function lookupQuiet(text) {
  const core = text.trim();
  if (!/[A-Za-z]{2}/.test(core)) return text;
  return lookup(core) ?? text;
}

function skip(element) {
  return !element || SKIP_TAGS.has(element.tagName) || element.closest('[translate="no"], [contenteditable="true"]');
}

function translateText(node) {
  if (skip(node.parentElement)) return;
  if (lastOutput.get(node) === node.data) return;
  const out = t(node.data);
  lastOutput.set(node, out);
  if (out !== node.data) node.data = out;
}

function translateAttributes(element) {
  if (skip(element)) return;
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const out = t(value);
    if (out !== value) element.setAttribute(name, out);
  }
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root);
  if (root.nodeType !== Node.ELEMENT_NODE || skip(root)) return;
  translateAttributes(root);
  root.querySelectorAll(ATTRIBUTES.map((a) => `[${a}]`).join(',')).forEach(translateAttributes);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) translateText(node);
}

function observe() {
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateAttributes(m.target);
      else m.addedNodes.forEach(translateTree);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
}

function wireSwitch() {
  document.querySelectorAll('[data-set-lang]').forEach((button) => {
    const active = button.dataset.setLang === lang;
    button.classList.toggle('lang-switch__option--active', active);
    button.setAttribute('aria-pressed', String(active));
    button.addEventListener('click', () => setLang(button.dataset.setLang));
  });
}

function reveal() {
  document.documentElement.classList.remove('i18n-wait');
}

/** Load the dictionary (if Spanish is on) and start translating the page. */
export async function startI18n() {
  lang = currentLang();
  document.documentElement.lang = lang;
  wireSwitch();
  if (lang === 'en') return reveal();
  const fallback = setTimeout(reveal, 2500); // never leave the page hidden
  try {
    const response = await fetch('data/i18n/es.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    exact = new Map(Object.entries(json.exact));
    patterns = json.patterns.map(([regex, replacement]) => [new RegExp(regex), replacement]);
    document.title = t(document.title);
    translateTree(document.body);
    observe();
  } catch (error) {
    console.warn('Spanish translation unavailable:', error);
    lang = 'en';
  } finally {
    clearTimeout(fallback);
    reveal();
  }
}
