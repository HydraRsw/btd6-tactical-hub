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
  lib/
    economy.js           Farm income / payback maths (pure functions).
    upgrades.js          "2-0-5" → upgrade pip grid.
    text.js              Cash formatting, initials, fuzzy search.
    storage.js           Remembering preferences in the browser.
    data.js              Loads the files in /data.
data/
  meta.json              Patch number, update date, changelog, optional image folder.
  towers.json            Every tower: tiers, best route, alternatives, roles, icon.
  heroes.json            Every hero: tiers, roles, summary.
  economy.json           Farm builds for the calculator, strategy cards, boss checkpoints.
  playbook.json          Mode notes, CHIMPS danger rounds, hero synergies, boss notes.
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
  "summary": "Global range. Maim MOAB stuns blimps…",
  "routes": [
    { "path": "4-0-2", "kind": "optimal", "name": "Maim MOAB", "note": "…" }
  ]
}
```

- `category`: Primary, Military, Magic, Support (heroes use Heroes)
- `tiers`: S, A, B, C or D for each mode
- `roles`: any of DPS, Stall, Buff, Cleanup, MOAB, Income
- `confidence`: `verified`, `approximate` or `new`
- `icon`: any [Lucide icon](https://lucide.dev/icons) name
- route `path`: digits 0–5 per path; use `x` for "any / still settling"

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
