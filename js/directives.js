// Custom Alpine attributes that keep the HTML templates short:
//
//   <span x-icon="search"></span>          a Lucide icon by name
//   <span x-icon="strategy.icon"></span>   …or from data (anything that isn't a plain icon name is evaluated)
//   <div x-avatar="tower"></div>           tower / hero badge (add .small, .large or .huge)
//   <div x-pips="route.path"></div>        3 × 5 upgrade grid for "2-0-5"
//   <p x-sources="tower.sources"></p>      "Sources: Bloons wiki: …" links (ids from data/sources.json)
//   <span x-bloon="bloon"></span>          a bloon icon (drawn, or your own picture from img/bloons/, see img/bloons/README.md)
//   <span x-tip="HELP.cash"></span>        an ⓘ icon that shows the text while hovered (or focused on touch screens)

import { initials } from './lib/text.js';
import { pipRows } from './lib/upgrades.js';

const CATEGORY_ICONS = {
  Primary: 'crosshair',
  Military: 'shield',
  Magic: 'sparkles',
  Support: 'hammer',
  Heroes: 'star',
};

const PLAIN_ICON_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** "flask-conical" → <svg> using the Lucide library loaded in index.html */
function iconSvg(name) {
  const lucide = window.lucide;
  if (!lucide || !name) return document.createTextNode('');
  const key = name.replace(/(^|-)([a-z0-9])/g, (_, __, letter) => letter.toUpperCase());
  const iconNode = lucide.icons?.[key];
  return iconNode ? lucide.createElement(iconNode) : document.createTextNode('');
}

/** Where to look for a picture of this tower/hero (optional, see README). */
function imageUrl(unit, imageDir) {
  if (typeof unit.img === 'string' && unit.img) return unit.img;
  if (!imageDir || !unit.id) return '';
  return `${imageDir.replace(/\/+$/, '')}/${unit.id}.png`;
}

function buildAvatar(unit, { size, imageDir }) {
  const badge = document.createElement('div');
  badge.className = ['avatar', size && `avatar--${size}`, unit.tier === 'S' && 'avatar--s-tier']
    .filter(Boolean)
    .join(' ');
  badge.dataset.category = unit.category;
  badge.setAttribute('aria-hidden', 'true');

  // Fallback art: an icon for towers, initials for heroes.
  if (unit.category === 'Heroes') {
    const text = document.createElement('span');
    text.className = 'avatar__initials';
    text.textContent = initials(unit.name);
    badge.append(text);
  } else {
    badge.append(iconSvg(unit.icon || CATEGORY_ICONS[unit.category]));
  }

  // Optional picture on top; it removes itself if the file is missing.
  const src = imageUrl(unit, imageDir);
  if (src) {
    const picture = document.createElement('img');
    picture.className = 'avatar__image';
    picture.src = src;
    picture.alt = '';
    picture.loading = 'lazy';
    picture.addEventListener('error', () => picture.remove());
    badge.append(picture);
  }
  return badge;
}

function buildPips(route) {
  const grid = document.createElement('div');
  grid.className = 'upgrade-pips';
  grid.title = route;
  for (const states of pipRows(route)) {
    const row = document.createElement('div');
    row.className = 'upgrade-pips__row';
    for (const state of states) {
      const pip = document.createElement('span');
      pip.className = state === 'empty' ? 'pip' : `pip pip--${state === 'tier5' ? 'tier5' : state}`;
      row.append(pip);
    }
    grid.append(row);
  }
  return grid;
}

function buildSourceLinks(ids, sources) {
  const line = document.createDocumentFragment();
  const known = (ids ?? []).map((id) => sources[id]).filter(Boolean);
  if (known.length === 0) {
    line.append('Sources: none yet, this entry is editorial.');
    return line;
  }
  line.append('Sources: ');
  known.forEach((source, index) => {
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = source.title.replace(/^Bloons wiki: /, '');
    line.append(index ? ' · ' : '', link);
  });
  return line;
}

// --- Bloon icons --------------------------------------------------------
// Simple original drawings: a balloon for regular bloons, a blimp for MOAB-class.
// Camo adds a dashed pattern, Regrow a green arrow and Fortified a metal band.
const SVG_NS = 'http://www.w3.org/2000/svg';
const RAINBOW = ['#ff4d4d', '#ffd23f', '#62d02b', '#3aa0ff', '#a14dff'];

function svgEl(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function drawBloon(bloon) {
  const svg = svgEl('svg', { viewBox: '0 0 32 32', class: 'bloon-svg', 'aria-hidden': 'true' });
  const fill = bloon.base === 'Rainbow' ? 'url(#bloon-rainbow)' : bloon.base === 'Zebra' ? 'url(#bloon-zebra)' : bloon.color;
  if (bloon.base === 'Rainbow' || bloon.base === 'Zebra') {
    const defs = svgEl('defs', {});
    const grad = svgEl('linearGradient', { id: bloon.base === 'Rainbow' ? 'bloon-rainbow' : 'bloon-zebra', x1: '0', x2: '1', y1: '0', y2: '0' });
    const colors = bloon.base === 'Rainbow' ? RAINBOW : ['#1d1d22', '#f2f4f7', '#1d1d22', '#f2f4f7'];
    colors.forEach((color, i) => {
      grad.append(svgEl('stop', { offset: `${(i / colors.length) * 100}%`, 'stop-color': color }));
      grad.append(svgEl('stop', { offset: `${((i + 1) / colors.length) * 100}%`, 'stop-color': color }));
    });
    defs.append(grad);
    svg.append(defs);
  }
  if (bloon.blimp) {
    svg.append(svgEl('path', { d: 'M3 16c0-4 6-7 13-7s13 3 13 7-6 7-13 7S3 20 3 16z', fill, stroke: '#0a1c38', 'stroke-width': '2' }));
    svg.append(svgEl('path', { d: 'M27 12l4-3v14l-4-3', fill, stroke: '#0a1c38', 'stroke-width': '2', 'stroke-linejoin': 'round' }));
    svg.append(svgEl('path', { d: 'M8 16h14', stroke: 'rgba(255,255,255,.55)', 'stroke-width': '2', 'stroke-linecap': 'round' }));
  } else {
    svg.append(svgEl('path', { d: 'M16 3c6 0 10 5 10 11 0 6-5 11-10 11S6 20 6 14C6 8 10 3 16 3z', fill, stroke: '#0a1c38', 'stroke-width': '2' }));
    svg.append(svgEl('path', { d: 'M14 25l2 3 2-3z', fill: bloon.base === 'Rainbow' ? '#a14dff' : bloon.color, stroke: '#0a1c38', 'stroke-width': '1.5' }));
    svg.append(svgEl('ellipse', { cx: '12.5', cy: '9.5', rx: '2.2', ry: '3.2', fill: 'rgba(255,255,255,.55)' }));
  }
  if (bloon.camo) svg.append(svgEl('path', { d: bloon.blimp ? 'M6 13h20M5 17h22M7 21h18' : 'M9 10h14M8 14h16M9 18h14', stroke: '#2f5d1e', 'stroke-width': '2', 'stroke-dasharray': '3 2', opacity: '.8' }));
  if (bloon.fortified) svg.append(svgEl('rect', { x: bloon.blimp ? '13' : '6', y: bloon.blimp ? '9' : '13', width: bloon.blimp ? '4' : '20', height: bloon.blimp ? '14' : '3', fill: '#9aa5b1', stroke: '#0a1c38', 'stroke-width': '1' }));
  if (bloon.regrow) svg.append(svgEl('path', { d: 'M24 26a5 5 0 1 0-3-8m3 8l-3 1m3-1l-1-3', fill: 'none', stroke: '#7ad420', 'stroke-width': '2.2', 'stroke-linecap': 'round' }));
  return svg;
}

/** Your own picture if it's in img/bloons/: "fortified-camo-regrow-ceramic.png", falling back to "ceramic.png". */
function bloonImageNames(bloon) {
  const base = bloon.base.toLowerCase();
  const prefix = [bloon.fortified && 'fortified', bloon.camo && bloon.base !== 'DDT' && 'camo', bloon.regrow && 'regrow'].filter(Boolean).join('-');
  return [...new Set([prefix ? `${prefix}-${base}` : base, base])];
}

// Each picture file is checked once per visit, so missing files cost one request, not one per icon.
const pictureChecks = new Map();
function pictureExists(src) {
  if (!pictureChecks.has(src)) {
    pictureChecks.set(src, new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = src;
    }));
  }
  return pictureChecks.get(src);
}

function buildBloon(bloon, imageDir) {
  const wrap = document.createElement('span');
  wrap.className = 'bloon-icon';
  wrap.title = bloon.name;
  wrap.append(drawBloon(bloon));
  if (imageDir) {
    const folder = `${imageDir.replace(/\/+$/, '')}/bloons`;
    (async () => {
      for (const name of bloonImageNames(bloon)) {
        const src = `${folder}/${name}.png`;
        if (await pictureExists(src)) {
          const picture = document.createElement('img');
          picture.className = 'bloon-icon__image';
          picture.alt = '';
          picture.src = src;
          wrap.append(picture);
          wrap.classList.add('bloon-icon--picture');
          return;
        }
      }
    })();
  }
  return wrap;
}

// One shared bubble for every ⓘ tip, positioned next to the icon and kept on screen.
let bubble = null;
function showTip(anchor, text) {
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'tip-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.id = 'tip-bubble';
    document.body.append(bubble);
  }
  bubble.textContent = text;
  bubble.hidden = false;
  const icon = anchor.getBoundingClientRect();
  const box = bubble.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(window.innerWidth - box.width - margin, Math.max(margin, icon.left + icon.width / 2 - box.width / 2));
  const below = icon.bottom + 8;
  const top = below + box.height > window.innerHeight - margin ? icon.top - box.height - 8 : below;
  bubble.style.left = `${left}px`;
  bubble.style.top = `${Math.max(margin, top)}px`;
  anchor.setAttribute('aria-describedby', 'tip-bubble');
}
function hideTip(anchor) {
  if (bubble) bubble.hidden = true;
  anchor?.removeAttribute('aria-describedby');
}
window.addEventListener('scroll', () => hideTip(), { passive: true });

export function registerDirectives(Alpine) {
  Alpine.directive('bloon', (el, { expression }, { evaluateLater, effect }) => {
    const readBloon = evaluateLater(expression);
    effect(() => readBloon((bloon) => {
      if (bloon) el.replaceChildren(buildBloon(bloon, Alpine.store('hub').meta.imageDir));
    }));
  });

  Alpine.directive('tip', (el, { expression }, { evaluateLater, effect, cleanup }) => {
    const readText = evaluateLater(expression);
    let text = '';
    effect(() => readText((value) => {
      text = value ?? '';
      el.setAttribute('aria-label', text);
    }));
    el.classList.add('info-tip');
    el.tabIndex = 0;
    el.replaceChildren(iconSvg('info'));
    const show = () => showTip(el, text);
    const hide = () => hideTip(el);
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', show);
    el.addEventListener('blur', hide);
    cleanup(() => hide());
  });

  Alpine.directive('icon', (el, { expression }, { evaluateLater, effect }) => {
    if (PLAIN_ICON_NAME.test(expression)) {
      el.replaceChildren(iconSvg(expression));
      return;
    }
    const readName = evaluateLater(expression);
    effect(() => readName((name) => el.replaceChildren(iconSvg(name))));
  });

  Alpine.directive('avatar', (el, { expression, modifiers }, { evaluateLater, effect }) => {
    const readUnit = evaluateLater(expression);
    const size = ['small', 'large', 'huge'].find((name) => modifiers.includes(name)) ?? '';
    effect(() =>
      readUnit((unit) => {
        if (!unit) return;
        const imageDir = Alpine.store('hub').meta.imageDir;
        el.replaceChildren(buildAvatar(unit, { size, imageDir }));
      }),
    );
  });

  Alpine.directive('sources', (el, { expression }, { evaluateLater, effect }) => {
    const readIds = evaluateLater(expression);
    el.classList.add('sources');
    effect(() =>
      readIds((ids) => el.replaceChildren(buildSourceLinks(ids, Alpine.store('hub').sources))),
    );
  });

  Alpine.directive('pips', (el, { expression }, { evaluateLater, effect }) => {
    const readRoute = evaluateLater(expression);
    effect(() => readRoute((route) => el.replaceChildren(buildPips(route))));
  });
}
