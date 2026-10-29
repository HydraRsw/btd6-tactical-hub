// Loads everything in /data. These JSON files are the only thing that changes
// between patches: the weekly update job rewrites them and the page picks the
// new values up on the next visit.

const FILES = ['meta', 'towers', 'heroes', 'economy', 'playbook', 'sources', 'paragons', 'maps', 'modes', 'rounds', 'templates'];

async function fetchJson(name) {
  // no-store so visitors never see last patch's numbers from a stale cache
  const response = await fetch(`data/${name}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`data/${name}.json → HTTP ${response.status}`);
  return response.json();
}

export async function loadGameData() {
  const [meta, towers, heroes, economy, playbook, sources, paragons, maps, modes, rounds, templates] = await Promise.all(FILES.map(fetchJson));

  if (!Array.isArray(towers) || !Array.isArray(heroes)) {
    throw new Error('towers.json and heroes.json must each contain a list');
  }

  return { meta, towers, heroes, economy, playbook, sources, paragons, maps, modes, rounds, templates };
}
