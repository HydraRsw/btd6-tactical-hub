// Gives every CSS and JS file a content fingerprint (?v=<hash>) in index.html,
// so after a code change browsers fetch the new files instead of mixing them
// with cached old ones (GitHub Pages lets browsers cache files for 10 minutes).
//
// Run after changing anything in css/ or js/:
//   node scripts/stamp-version.mjs
//
// It rewrites the stylesheet links, the main script tag and an import map that
// sends every module import to its fingerprinted address. Data files don't need
// this: they're always fetched fresh.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function listFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function fingerprint(path) {
  return createHash('sha256').update(readFileSync(join(root, path))).digest('hex').slice(0, 10);
}

const scripts = listFiles('js').filter((path) => path.endsWith('.js')).sort();
const styles = listFiles('css').filter((path) => path.endsWith('.css')).sort();

// One hash for all code: if any module changes, every module address changes,
// so a page can never combine new and old modules.
const codeHash = createHash('sha256');
for (const path of scripts) codeHash.update(path).update(readFileSync(join(root, path)));
const version = codeHash.digest('hex').slice(0, 10);

let html = readFileSync(join(root, 'index.html'), 'utf8');

for (const path of styles) {
  const url = relative(root, join(root, path)).split('\\').join('/');
  const pattern = new RegExp(`href="${url.replace(/[.]/g, '\\.')}(\\?v=[^"]*)?"`);
  if (!pattern.test(html)) throw new Error(`index.html has no <link> for ${url}`);
  html = html.replace(pattern, `href="${url}?v=${fingerprint(path)}"`);
}

const mainPattern = /src="js\/main\.js(\?v=[^"]*)?"/;
if (!mainPattern.test(html)) throw new Error('index.html has no <script src="js/main.js">');
html = html.replace(mainPattern, `src="js/main.js?v=${version}"`);

const imports = Object.fromEntries(scripts.map((path) => {
  const url = path.split('\\').join('/');
  return [`./${url}`, `./${url}?v=${version}`];
}));
const importMap = `<!-- import-map:start (written by scripts/stamp-version.mjs) -->
  <script type="importmap">
${JSON.stringify({ imports }, null, 2).replace(/^/gm, '  ')}
  </script>
  <!-- import-map:end -->`;

const block = /<!-- import-map:start[\s\S]*?<!-- import-map:end -->/;
if (block.test(html)) {
  html = html.replace(block, importMap);
} else {
  // First run: the import map must come before the first module script.
  html = html.replace(/(\s*)<script type="module"/, `$1${importMap}$1<script type="module"`);
}

writeFileSync(join(root, 'index.html'), html);
console.log(`✓ stamped ${styles.length} stylesheets and ${scripts.length} modules (code version ${version})`);
