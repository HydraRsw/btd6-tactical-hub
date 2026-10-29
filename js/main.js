// Entry point. Registers everything with Alpine.js, then loads the data.
//
// Script order in index.html matters: this module runs first and listens for
// 'alpine:init'; Alpine (loaded after it with `defer`) fires that event when it
// starts, and then renders the page.

import { registerDirectives } from './directives.js';
import { createHubStore, TABS } from './store.js';
import { tierList } from './components/tier-list.js';
import { crosspathGuide } from './components/crosspath.js';
import { farmingEngine } from './components/farming.js';
import { chimpsPlaybook } from './components/playbook.js';
import { globalSearch } from './components/global-search.js';
import { towerPage } from './components/tower-page.js';
import { paragonGuide } from './components/paragons.js';
import { mapGuide, mapPage, modePage } from './components/maps.js';
import { paragonPage } from './components/paragon-page.js';

document.addEventListener('alpine:init', () => {
  const Alpine = window.Alpine;

  registerDirectives(Alpine);
  Alpine.store('hub', createHubStore());

  Alpine.data('tierList', tierList);
  Alpine.data('crosspathGuide', crosspathGuide);
  Alpine.data('farmingEngine', farmingEngine);
  Alpine.data('chimpsPlaybook', chimpsPlaybook);
  Alpine.data('globalSearch', globalSearch);
  Alpine.data('towerPage', towerPage);
  Alpine.data('paragonGuide', paragonGuide);
  Alpine.data('mapGuide', mapGuide);
  Alpine.data('mapPage', mapPage);
  Alpine.data('modePage', modePage);
  Alpine.data('paragonPage', paragonPage);

  const hub = Alpine.store('hub');
  hub.openTabFromUrl();
  hub.load();

  window.addEventListener('hashchange', () => hub.openTabFromUrl());
  document.addEventListener('keydown', (event) => handleShortcut(event, hub));
});

/** "/" focuses search, 1–6 switch tabs (ignored while typing in a field). */
function handleShortcut(event, hub) {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key === '/') {
    event.preventDefault();
    document.getElementById('site-search-input')?.focus();
  } else if (/^[1-6]$/.test(event.key)) {
    hub.openTab(TABS[Number(event.key) - 1]);
  }
}

/** Decorative balloons drifting up the background. */
function launchBalloons(count = 14) {
  const colors = ['#ff4d4d', '#43c6ff', '#7ad420', '#ffd23f', '#ff6fb5', '#ffffff', '#a77bff'];
  const sky = document.getElementById('balloons');
  for (let i = 0; i < count; i += 1) {
    const balloon = document.createElement('span');
    balloon.className = 'balloon';
    balloon.style.left = `${(i * 71) % 100}%`;
    balloon.style.background = colors[i % colors.length];
    balloon.style.animationDuration = `${22 + ((i * 7) % 18)}s`;
    balloon.style.animationDelay = `${-i * 3.3}s`;
    balloon.style.scale = String(0.6 + ((i * 13) % 7) / 10);
    sky.append(balloon);
  }
}

launchBalloons();
