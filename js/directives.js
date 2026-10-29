// Custom Alpine attributes that keep the HTML templates short:
//
//   <span x-icon="search"></span>          a Lucide icon by name
//   <span x-icon="strategy.icon"></span>   …or from data (anything that isn't a plain icon name is evaluated)
//   <div x-avatar="tower"></div>           tower / hero badge (add .small or .large)
//   <div x-pips="route.path"></div>        3 × 5 upgrade grid for "2-0-5"

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

export function registerDirectives(Alpine) {
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
    const size = modifiers.includes('small') ? 'small' : modifiers.includes('large') ? 'large' : '';
    effect(() =>
      readUnit((unit) => {
        if (!unit) return;
        const imageDir = Alpine.store('hub').meta.imageDir;
        el.replaceChildren(buildAvatar(unit, { size, imageDir }));
      }),
    );
  });

  Alpine.directive('pips', (el, { expression }, { evaluateLater, effect }) => {
    const readRoute = evaluateLater(expression);
    effect(() => readRoute((route) => el.replaceChildren(buildPips(route))));
  });
}
