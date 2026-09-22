// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — FRONT-END BUILD
//  Pre-compiles the public/*.jsx sources to plain JS in public/dist/
//  so the browser no longer ships Babel-standalone (~3 MB) nor pays
//  the client-side compile cost on every page load.
//
//  Scope model — one shared global scope (NO IIFE wrapping):
//  --------------------------------------------------------
//  In dev these files were loaded as <script type="text/babel">. Babel-
//  standalone's default presets downcompiled block scoping (let/const ->
//  var), so every top-level declaration became a global `var`/`function`
//  shared across all the scripts in one realm. That's load-bearing: most
//  cross-file sharing goes through `window.*`, but some top-level consts
//  are referenced cross-file as bare globals (e.g. SPARKLE_POSITIONS,
//  defined in app-shared and read in app-board). Redeclaring
//  `const { useState } = React` in every file doesn't collide because, as
//  `var`, redeclaration is legal.
//
//  An earlier version wrapped each file in its own IIFE to "reproduce
//  isolation" — but that ISOLATION never existed (the old path shared one
//  global scope), and the IIFE broke those bare-global cross-file refs
//  with "X is not defined". So we emit the compiled code at top level and
//  rely on `transform-block-scoping` (below) to keep all declarations as
//  hoisted `var`, matching the original runtime exactly.
//
//  Uses the SAME Babel the browser used (vendored in scripts/vendor),
//  so the transform output is identical to the old in-browser path.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Babel = require('./vendor/babel.min.js');

// ★★ v1264 — NEU BAUEN NACH INHALT, NICHT NACH UHRZEIT.
// Anlass (22.9.): im hochgeladenen Build war `dist/app-board.js` VERALTET
// — sechs v1263-Fixes aus `app-board.jsx` fehlten im ausgelieferten
// Bundle (dieselbe Fehlerklasse wie v495, 18.8.). Das Sicherheitsnetz
// dagegen, `buildAll()` beim Serverstart, griff nicht: es entschied nach
// Aenderungszeit, und das Bundle war 9 s JUENGER als seine Quelle
// (Entpacken setzt Zeitstempel in Archivreihenfolge). Ein veraltetes
// Bundle mit frischem Zeitstempel ueberlebte damit jeden Neustart.
//
// Jetzt traegt jedes Bundle in Zeile 1 den Hash seiner Quelle
// (`/* pp-quelle sha1:… */`, fuer den Browser ein Kommentar). Gebaut
// wird, wenn das Bundle fehlt oder der Hash nicht zur Quelle passt —
// egal, welche Datei die juengere ist. Bundles ohne Kopfzeile (alles vor
// v1264) werden beim ersten Start einmal neu gebaut.
// `BUILD_FORMAT` hochzaehlen, wenn sich die Transformation aendert
// (Presets, Plugins, Optionen) — dann baut alles einmal neu.
const BUILD_FORMAT = 1;
function quellHash(src) {
  return crypto.createHash('sha1').update('fmt' + BUILD_FORMAT + '\n').update(src).digest('hex');
}
function kopfzeile(src) { return `/* pp-quelle sha1:${quellHash(src)} */\n`; }

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DIST_DIR = path.join(PUBLIC_DIR, 'dist');

// Load order matters — app-shared defines the window.* API the rest
// consume; app-main mounts the React root last. Mirrors the old
// <script> order in index.html.
const ENTRIES = [
  'app-shared',
  'app-screens',
  'app-puzzle',
  'app-deckbuilder',
  'app-board',
  'app-campaign',
  'app-main',
];

function srcPath(name) { return path.join(PUBLIC_DIR, name + '.jsx'); }
function outPath(name) { return path.join(DIST_DIR, name + '.js'); }

function compileOne(name) {
  const src = fs.readFileSync(srcPath(name), 'utf8');
  // `react` preset: JSX -> React.createElement. Modern syntax (optional
  // chaining, nullish, etc.) is intentionally left as-is for modern browsers.
  //
  // `transform-block-scoping` (let/const -> hoisted var) is REQUIRED: the
  // old in-browser `<script type="text/babel">` path used babel-standalone's
  // default presets, which downcompiled block scoping. Lots of the source
  // relies on that hoisting — e.g. a useCallback whose dependency array
  // references a `const` declared further down. With real block scoping
  // those forward references throw a temporal-dead-zone ReferenceError at
  // render ("Cannot access 'X' before initialization"). The plugin's default
  // (tdz: false) hoists them like the original path, so the behaviour matches.
  // It still handles loop-closure semantics correctly, so it's a safe match.
  const { code } = Babel.transform(src, {
    presets: ['react'],
    plugins: ['transform-block-scoping'],
    compact: false,
    comments: false,
    sourceType: 'script',
  });
  // Emit at top level (no IIFE) so all files share one global scope, the
  // way the old concatenated <script> realm did. block-scoping keeps every
  // declaration a hoisted `var`, so redeclarations across files are legal
  // and bare-global cross-file references resolve.
  const wrapped = kopfzeile(src) + `${code}\n`;
  fs.writeFileSync(outPath(name), wrapped);
  return wrapped.length;
}

// Recompile when the output is missing or was built from other source
// (v1264: content hash in line 1 instead of mtime — see top of file).
function needsBuild(name) {
  const o = outPath(name);
  if (!fs.existsSync(o)) return true;
  let erste = '';
  try {
    const fd = fs.openSync(o, 'r');
    const buf = Buffer.alloc(128);
    const n = fs.readSync(fd, buf, 0, 128, 0);
    fs.closeSync(fd);
    erste = buf.slice(0, n).toString('utf8').split('\n')[0];
  } catch (_) { return true; }
  const src = fs.readFileSync(srcPath(name), 'utf8');
  return erste !== kopfzeile(src).trimEnd();
}

function buildAll({ force = false, quiet = false } = {}) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
  let built = 0;
  for (const name of ENTRIES) {
    if (!force && !needsBuild(name)) continue;
    const t = Date.now();
    const bytes = compileOne(name);
    built++;
    if (!quiet) {
      console.log(`[build] ${name}.js  ${(bytes / 1024).toFixed(0)} KB  (${Date.now() - t} ms)`);
    }
  }
  if (!quiet && built === 0) console.log('[build] up to date');
  return built;
}

// Rebuild a single file on change. Uses fs.watch (built-in) so dev
// keeps the edit-and-refresh loop without a separate watcher process.
function watch() {
  for (const name of ENTRIES) {
    let timer = null;
    fs.watch(srcPath(name), () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const t = Date.now();
          const bytes = compileOne(name);
          console.log(`[build:watch] ${name}.js  ${(bytes / 1024).toFixed(0)} KB  (${Date.now() - t} ms)`);
        } catch (e) {
          console.error(`[build:watch] ${name} FAILED:`, e.message);
        }
      }, 80); // debounce editor double-writes
    });
  }
  console.log('[build] watching public/*.jsx for changes');
}

module.exports = { buildAll, watch, ENTRIES, DIST_DIR };

// CLI: `node scripts/build.js` (one-shot) or `--watch`.
if (require.main === module) {
  const force = process.argv.includes('--force');
  buildAll({ force });
  if (process.argv.includes('--watch')) watch();
}
