'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Bugfix-Erkennung aus dem Git-Verlauf
//
//  Jede Karte hat ihr Skript `cards/effects/<kartenname-als-slug>.js`; gemeinsam genutzte Bausteine für Wechselwirkungen liegen als
//  `cards/effects/_*.js` daneben. Ein BUGFIX ist eine inhaltliche Änderung an einer bestehenden Datei dort:
//    • geändertes Karten-Skript            → diese Karte
//    • geänderter gemeinsamer Baustein     → die Karten, deren Skripte ihn (auch über andere Bausteine) einbinden
//  Nicht gezählt: neu hinzugekommene Dateien (neue Umsetzung, keine Korrektur), gelöschte, reine Kommentar-/Leerraum-Änderungen.
//  Betrifft ein Baustein sehr viele Karten (Engine-Teile wie `_loader`), werden keine Kartenbilder gezeigt, sondern nur sein Name samt Anzahl.
// ═══════════════════════════════════════════════════════════════════
const path = require('path');

const EFFECTS_DIR = 'cards/effects';
const nameToFile = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');   // wie cards/effects/_loader.js
const baseOf = f => path.posix.basename(f, '.js');
const isShared = f => baseOf(f).startsWith('_');

/** Code ohne Kommentare und Leerraum — zwei Fassungen mit gleichem Ergebnis unterscheiden sich nur kosmetisch. */
function fingerprint(text) {
  return String(text || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
    .replace(/\s+/g, '');
}

/** `git diff --name-status`-Ausgabe → [{status, file}] (ohne Umbenennungs-Erkennung, nur .js in cards/effects). */
function parseNameStatus(out) {
  return String(out).split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [status, ...rest] = l.split('\t');
    return { status: status[0], file: rest.join('\t') };
  }).filter(e => /^cards\/effects\/[^/]+\.js$/.test(e.file));
}

/** `git grep -o`-Ausgabe der require-Zeilen → Map Dateiname (ohne .js) → Menge eingebundener Bausteine (nur `_…`). */
function parseRequires(out) {
  const deps = new Map();
  const re = /^[^:]*:(cards\/effects\/[^:]+\.js):require\(\s*['"]\.\/([^'"]+?)(?:\.js)?['"]\s*\)/;
  for (const line of String(out).split('\n')) {
    const m = re.exec(line.trim());
    if (!m) continue;
    const from = baseOf(m[1]), to = m[2];
    if (!to.startsWith('_')) continue;
    if (!deps.has(from)) deps.set(from, new Set());
    deps.get(from).add(to);
  }
  return deps;
}

/** Alle Bausteine, die eine Datei (direkt oder über andere Bausteine) einbindet. */
function closure(deps, start) {
  const seen = new Set();
  const stack = [...(deps.get(start) || [])];
  while (stack.length) {
    const d = stack.pop();
    if (seen.has(d)) continue;
    seen.add(d);
    for (const n of deps.get(d) || []) stack.push(n);
  }
  return seen;
}

/**
 * @param {object} o
 * @param {(...args:string[]) => Promise<string>} o.git   führt git im Repo aus
 * @param {string} o.last   zuletzt gemeldeter Stand
 * @param {string} o.head   aktueller Stand
 * @param {{name:string}[]} o.cards   alle Karten (cards.json im aktuellen Stand)
 * @param {number} [o.maxShared=12]   ab so vielen betroffenen Karten gilt ein Baustein als „breit“
 * @returns {Promise<{direct:{card:object, file:string}[], shared:{module:string, cards:object[], count:number, broad:boolean}[]}>}
 */
async function findBugfixes({ git, last, head, cards, maxShared = 12 }) {
  const changed = parseNameStatus(await git('diff', '--name-status', '--no-renames', last, head, '--', EFFECTS_DIR))
    .filter(e => e.status === 'M');                                   // nur bestehende Dateien: A (neu) und D (gelöscht) sind keine Korrektur
  const real = [];
  for (const e of changed) {
    let before = '', after = '';
    try { before = await git('show', `${last}:${e.file}`); after = await git('show', `${head}:${e.file}`); } catch { continue; }
    if (fingerprint(before) !== fingerprint(after)) real.push(e.file);
  }
  if (!real.length) return { direct: [], shared: [] };

  const bySlug = new Map();
  for (const c of cards) { const s = nameToFile(c.name); if (!bySlug.has(s)) bySlug.set(s, []); bySlug.get(s).push(c); }

  const direct = [];
  for (const f of real.filter(f => !isShared(f))) for (const c of bySlug.get(baseOf(f)) || []) direct.push({ card: c, file: baseOf(f) });

  const sharedFiles = real.filter(isShared);
  const shared = [];
  if (sharedFiles.length) {
    let deps = new Map();
    try { deps = parseRequires(await git('grep', '-o', '-E', 'require\\([\'"]\\./[A-Za-z0-9_.-]+[\'"]\\)', head, '--', EFFECTS_DIR)); } catch { /* keine Treffer: git grep endet dann mit 1 */ }
    const cardFiles = [...bySlug.keys()];
    for (const f of sharedFiles) {
      const mod = baseOf(f);
      const cs = [];
      for (const slug of cardFiles) {
        if (!deps.has(slug)) continue;
        if (closure(deps, slug).has(mod)) cs.push(...bySlug.get(slug));
      }
      shared.push({ module: mod, cards: cs, count: cs.length, broad: cs.length > maxShared });
    }
  }
  return { direct, shared };
}

module.exports = { findBugfixes, fingerprint, parseNameStatus, parseRequires, closure, nameToFile };
