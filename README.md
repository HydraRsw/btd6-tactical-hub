# BTD6 Tactical Hub

Unofficial, non-commercial Bloons TD 6 fan site: tier list, crosspath guide,
farming calculator and CHIMPS / boss playbooks.

Plain HTML, CSS and JavaScript with [Alpine.js](https://alpinejs.dev) for
interactivity. **No build step, no npm.** Every library loads from a CDN.

## Folder layout

```
index.html               The whole page. Each tab is one commented <section>.
css/
  theme.css              Colours, fonts, background. Retune the look here.
  components.css         Panels, buttons, tier badges, avatars, upgrade pips, pills, fields.
  layout.css             Header, tabs, and the layout of each tab (+ mobile rules).
js/
  main.js                Entry point: registers everything with Alpine, loads data.
  store.js               Shared state ($store.hub): data, active tab, open rows, patch banner.
  directives.js          x-icon, x-avatar and x-pips helpers used in the HTML.
  components/
    tier-list.js         Tier List tab (filters, sorting, grouping).
    crosspath.js         Crosspath Guide tab.
    farming.js           Farming Engine tab (table + chart).
    playbook.js          CHIMPS & Bosses tab (round checklist).
    global-search.js     Header search.
    tower-page.js        A tower's own page (#tower/<id>).
    paragons.js          Paragons tab: tier list and degree guide.
    paragon-page.js      A Paragon's own page (#paragon/<id>).
    maps.js              Maps & Modes tab, map pages (#map/<id>) and mode pages (#mode/<id>).
    hero-page.js         A hero's own page (#hero/<id>).
    rounds.js            Rounds tab: every round's bloons, RBE and cash.
    planner.js           Tools tab → build planner (shareable with ?build=…, #planner).
    degree-calc.js       Tools tab → Paragon degree calculator (#degree).
    compare.js           Tools tab → compare two towers or heroes (#compare).
  lib/
    economy.js           Farm income / payback maths (pure functions).
    upgrades.js          "2-0-5" → upgrade pip grid.
    text.js              Cash formatting, initials, fuzzy search.
    storage.js           Remembering preferences in the browser.
    data.js              Loads the files in /data.
    game.js              Game maths: prices, crosspath rules, cash by round, hero XP, Paragon power.
data/
  meta.json              Patch number, update date, changelog, optional image folder.
  towers.json            Every tower: tiers, best route, alternatives, roles, icon.
  heroes.json            Every hero: tiers, roles, summary.
  economy.json           Farm builds for the calculator, strategy cards, boss checkpoints.
  playbook.json          Mode notes, CHIMPS danger rounds, hero synergies, boss notes.
  sources.json           Every cited page (id → title + url). Entries point at these ids.
  paragons.json          Paragon tier list (boss events), each Paragon's page and the degree guide.
  maps.json              Every map: difficulty, traits, where to build, recommended towers, per-mode notes.
  modes.json             Every game mode: rules, general strategy, towers that shine.
  rounds.json            Standard and ABR rounds 1–140: bloon groups, duration, RBE, cash, hero XP.
  templates.json         Planner templates: CHIMPS openings (towers/heroes with rounds and crosspaths).
```

## Updating for a new patch

Only the files in `data/` change. Edit them, bump `patch`, `updated` and
`changes` in `meta.json`, and deploy. Returning visitors see an
"Updated for vXX" banner listing `changes`.

A tower looks like this:

```json
{
  "id": "sniper",
  "name": "Sniper Monkey",
  "category": "Military",
  "icon": "scan",
  "tiers": { "chimps": "A", "boss": "S" },
  "bestRoute": "4-0-2",
  "roles": ["DPS", "MOAB", "Stall"],
  "confidence": "verified",
  "summary": "Global range. Elite Defender can clear Lych…",
  "routes": [
    { "path": "2-0-5", "kind": "optimal", "name": "Elite Defender", "note": "…" }
  ],
  "sources": ["wiki-sniper", "wiki-lych"]
}
```

- `category`: Primary, Military, Magic, Support (heroes use Heroes)
- `tiers`: S, A, B, C or D for each mode: `chimps`, `boss` and `normal` (normal games and Freeplay)
- `roles`: any of DPS, Stall, Buff, Cleanup, MOAB, Income
- `confidence`: `verified`, `approximate` or `new`
- `icon`: any [Lucide icon](https://lucide.dev/icons) name
- route `path`: digits 0–5 per path; use `x` for "any / still settling"
- `sources`: ids from `data/sources.json`. Every claim should trace back to one of them.
- `upgrades`: three lists (top, middle, bottom path) of five upgrade names; `null` if unknown
- `tips`: `{ "chimps": [...], "boss": [...], "normal": [...] }`, shown on the tower page
- `synergies`: `[{ "unit": "alch", "note": "…" }]`, where `unit` is a tower or hero id
- `paragon`: id of the tower's Paragon in `paragons.json` (optional)

Each tower has its own page at `#tower/<id>` (for example `#tower/sniper`).

### Maps, modes and Paragon pages

- `maps.json` → `maps[]`: `id`, `name`, `difficulty` (Beginner, Intermediate, Advanced,
  Expert), `traits`, `summary`, `placement`, `recommended: [{ upgrade, unit, note }]`,
  `modeNotes: { "<mode id>": "…" }` (only where a source has something specific to say
  about this map in that mode), `sources`. Page: `#map/<id>`.
- `modes.json` → `modes[]`: `id`, `name`, `difficulty` (Easy, Medium, Hard, Any), Lucide
  `icon`, `rules`, `strategy`, `towers: [{ upgrade, unit, note }]`, `sources`. Page: `#mode/<id>`.
  A map page combines the map with whichever mode the visitor picks.
- `paragons.json` → each Paragon also has `combines` (its three tier 5s), `howItWorks`,
  `strategy`, `synergies: [{ unit, note }]` (a tower, hero or Paragon id), `bestBosses`,
  `worstBosses` and `degreeTips`. Page: `#paragon/<id>`.

### Costs, detection, heroes and rounds

- Towers have `costs: { base: [e, m, h, i], upgrades: [path][tier] → [e, m, h, i] }` (Easy,
  Medium, Hard, Impoppable) and `detection: { camo, lead }` as lists of minimum crosspaths
  (`[[0, 0, 2]]` = bottom path tier 2 or more; `[[0, 0, 0]]` = from the start; `[]` = never
  on its own), with `camoText`, `leadText` and `purple` notes for people.
- Heroes have `cost` (same four prices), `xpModifier`, `milestones: [{ level, text }]`
  (our own summaries), `camoLevel` / `leadLevel` (level the main attack gets it, `0` = from
  the start, `null` = never), `bestFor`, `tips` and `pairs: [{ unit, note }]`.
- Towers also have `knowledge: [{ name, effect, cost, keyPick? }]`: their own Monkey
  Knowledge (paraphrased), with `keyPick: true` on ones that change how you build them.
- `templates.json` → `templates[]`: `id`, `name`, `fits`, `description`, `mode`,
  `entries: [{ tower, steps: [{ round, path }] }]` (a hero id works as `tower`), `sources`.
- Bloon pictures on the Rounds tab are optional: see `img/bloons/README.md`.
- `rounds.json` comes from the wiki's round tables. Cash is `popCash + bonusCash`.
- Paragons have `costs` per difficulty; the degree formula and power caps are in `js/lib/game.js`.

Map and mode advice comes from each map's Bloons wiki page and the wiki's mode strategy
pages; Paragon pages from each Paragon's wiki page (its Strategy section).

## Where the rankings come from

Tiers and routes are editorial judgments, not copied from any single list. They were
last re-checked on the date in `meta.json` → `researched`, mostly against the Bloons
wiki ([CHIMPS strategy](https://www.bloonswiki.com/Strategy:CHIMPS), the
[boss event guide](https://www.bloonswiki.com/Strategy:Boss_Bloon_Event), each
boss's strategy page and each tower's page). Its CHIMPS-listed win conditions rank
highest. `confidence` says how well-backed an entry is: `verified` (sources support
the route and tier), `approximate` (partly supported, or the source is silent on
crosspaths), `new` (tower too new for a consensus).

## Checking the data

Before publishing edits to `data/`, run:

```
node scripts/validate-data.mjs
```

It lists any missing fields, bad tiers or broken routes. The weekly update job runs it too and won't commit data that fails.

## Tower and hero pictures (optional)

Badges show an icon by default. To use your own pictures, either:

- put PNGs named by id (`img/sniper.png`, `img/alch.png`…) in a folder and set
  `"imageDir": "img"` in `data/meta.json`, or
- give one entry its own `"img": "path/or/url.png"`.

A missing image falls back to the icon.

## After changing code (css/ or js/)

Run:

```
node scripts/stamp-version.mjs
```

It adds a content fingerprint (`?v=…`) to every stylesheet and module address in
`index.html`. GitHub Pages lets browsers cache files for 10 minutes; without the
fingerprint a visitor can get the new page with old cached scripts, which breaks
it. Data changes in `data/` don't need this.

## Running it locally

The page loads its data with `fetch`, which browsers block for files opened
straight from disk. Start any static server in this folder:

```
python3 -m http.server 8000      # then open http://localhost:8000
```

## Deploying

- **Netlify Drop / Cloudflare Pages:** drag this folder onto the upload page.
- **GitHub Pages:** push the folder to a repo, then Settings → Pages → Deploy from branch → `main` / root.
- **Vercel:** import the repo, framework "Other", no build command.

## Disclaimer

Bloons TD 6 and all related monkey graphics, character designs and trademarks
are the property of Ninja Kiwi Limited. This is an unofficial, non-commercial
fan project, not affiliated with, endorsed or sponsored by Ninja Kiwi.
