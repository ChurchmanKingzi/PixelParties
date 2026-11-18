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
//  Gezielte BALANCING-Änderungen (Eintrag der Karte in cards.json hat sich geändert, z. B. der Effekttext) sind kein Bugfix: Diese Karten werden
//  übergeben (`balanced`) und hier ausgelassen — sie gehören in die Patchnotes.
//  Die genaue Fehlerbeschreibung stammt aus Commit-Zeilen der Form `Bugfix-Note: <Kartenname oder _baustein> | <Beschreibung>` (siehe readNotes).
//  Reine Anpassungen an eine NEUE Karte (kein Fehler) melden Commit-Zeilen `Bugfix-Skip: <Kartenname oder _baustein>` ab (siehe readCommitChanges/applySkips).
//  Ein Skip gilt NUR für die Änderung des Commits, in dessen Nachricht er steht: Ändert ein anderer Commit desselben Zeitraums das Skript (bzw. den Baustein) inhaltlich
//  ohne eigenen Skip, wird das Ziel trotzdem gemeldet; eine `Bugfix-Note` eines anderen Commits wird ebenfalls nicht von einem fremden Skip unterdrückt.
//  Innerhalb EINES Commits mit Note und Skip für dasselbe Ziel gewinnt der Skip (die Note dieses Commits entfällt).
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

const normName = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '');
const NOTE_RE = /^\s*(?:[*-]\s+)?Bugfix-Note:[ \t]*([^|\n]+?)[ \t]*\|[ \t]*(.+?)[ \t]*$/gim;
const NOTE_MAX = 220;
const SKIP_RE = /^\s*(?:[*-]\s+)?Bugfix-Skip:[ \t]*([^|\n]+?)[ \t]*(?:\|.*)?$/gim;

/** Ziele der `Bugfix-Skip`-Zeilen EINER Commit-Nachricht (normalisiert). */
function parseSkips(body) {
  const out = new Set();
  for (const m of String(body).matchAll(SKIP_RE)) { const key = normName(m[1]); if (key) out.add(key); }
  return out;
}

/**
 * Fehlerbeschreibungen aus den Commit-Nachrichten zwischen zwei Ständen: Zeilen `Bugfix-Note: <Kartenname oder _baustein> | <Beschreibung>`
 * (eine Zeile je Karte/Baustein; auch mit „* “/„- “ davor, wie sie bei Squash-Merges entstehen). Mehrere Zeilen für dasselbe Ziel werden verbunden —
 * über alle Commits hinweg. Eine Note, deren Commit für dasselbe Ziel einen `Bugfix-Skip` trägt, wird verworfen (der Skip des eigenen Commits gewinnt);
 * Skips anderer Commits ändern an einer Note nichts.
 * @returns {Promise<Map<string,string>>}  normalisiertes Ziel → Beschreibung
 */
async function readNotes({ git, last, head }) {
  const out = new Map();
  let log = '';
  try { log = await git('log', '--format=%B%x1e', `${last}..${head}`); } catch { return out; }
  for (const body of log.split('\x1e')) {
    const skips = parseSkips(body);
    for (const m of body.matchAll(NOTE_RE)) {
      const key = normName(m[1]);
      const text = m[2].replace(/\s+/g, ' ').slice(0, NOTE_MAX);
      if (!key || !text || skips.has(key)) continue;
      out.set(key, out.has(key) ? `${out.get(key)}; ${text}`.slice(0, NOTE_MAX * 2) : text);
    }
  }
  return out;
}

const RAW_RE = /^:\d+ \d+ ([0-9a-f]{40,64}) ([0-9a-f]{40,64}) ([A-Z])\d*\t(.+)$/;

/** Dateien (Namen ohne .js), deren Änderung ein `findBugfixes`-Ergebnis zugrunde liegt: die Karten-Skripte und die Bausteine. */
function changedFiles(found) {
  return [...new Set([...found.direct.map(d => d.file), ...found.shared.map(sh => sh.module)])];
}

/**
 * Wer hat die Dateien inhaltlich geändert? Je Datei (Name ohne .js) die Commits zwischen den Ständen, deren Änderung an dieser Datei inhaltlich ist (Fingerabdruck vor/nach
 * DIESEM Commit verschieden; reine Kommentar-/Leerraum-Änderungen, neue und gelöschte Dateien zählen nicht), samt den `Bugfix-Skip`-Zielen aus der Nachricht dieses Commits.
 * Merge-Commits tragen keine eigene Änderung (ihre Commits stehen einzeln im Verlauf), ihre Skip-Zeilen unterdrücken also nichts.
 * Begrenzung: höchstens `maxPairs` (Commit, Datei)-Paare und `budgetMs` Rechenzeit; was darüber hinausgeht oder nicht lesbar ist, gilt als inhaltliche Änderung
 * (im Zweifel melden — der Skip des Commits greift trotzdem). Kann der Verlauf nicht gelesen werden, ist das Ergebnis leer (dann unterdrückt applySkips nichts).
 * @param {string[]} o.files   Dateinamen ohne .js (siehe changedFiles)
 * @returns {Promise<Map<string, {hash:string, skips:Set<string>}[]>>}
 */
async function readCommitChanges({ git, last, head, files, maxPairs = 6000, budgetMs = 120000 }) {
  const out = new Map();
  const want = new Set(files || []);
  if (!want.size) return out;
  let log = '';
  try { log = await git('log', '--no-merges', '--full-history', '--no-renames', '--raw', '--no-abbrev', '--format=%x1e%H%x1f%B%x1f', `${last}..${head}`, '--', EFFECTS_DIR); } catch { return out; }
  const commits = [];
  let pairs = 0;
  for (const chunk of log.split('\x1e')) {
    const [hash, body = '', rest = ''] = chunk.split('\x1f');
    if (!hash.trim()) continue;
    const entries = [];
    for (const line of rest.split('\n')) {
      const m = RAW_RE.exec(line.trim());
      if (!m || m[3] !== 'M' || !/^cards\/effects\/[^/]+\.js$/.test(m[4]) || !want.has(baseOf(m[4]))) continue;
      entries.push({ file: baseOf(m[4]), before: m[1], after: m[2], checked: pairs++ < maxPairs });
    }
    if (entries.length) commits.push({ hash: hash.trim(), skips: parseSkips(body), entries });
  }
  // Fingerabdrücke je Blob (ein Blob ist oft „nachher“ des einen und „vorher“ des nächsten Commits → je Fassung nur ein Git-Aufruf)
  const deadline = Date.now() + budgetMs;
  const prints = new Map();                                            // Blob → Fingerabdruck; fehlt er: unbekannt
  const blobs = [...new Set(commits.flatMap(c => c.entries.filter(e => e.checked).flatMap(e => [e.before, e.after])))];
  const fetchPrint = async blob => {
    if (Date.now() > deadline) return;
    try { prints.set(blob, fingerprint(await git('cat-file', 'blob', blob))); } catch { /* unbekannt → gilt als Änderung */ }
  };
  for (let i = 0; i < blobs.length; i += 16) await Promise.all(blobs.slice(i, i + 16).map(fetchPrint));
  for (const c of commits) for (const e of c.entries) {
    const a = prints.get(e.before), b = prints.get(e.after);
    if (a !== undefined && b !== undefined && a === b) continue;       // nur Kommentare/Leerraum
    if (!out.has(e.file)) out.set(e.file, []);
    out.get(e.file).push({ hash: c.hash, skips: c.skips });
  }
  return out;
}

/**
 * Lässt aus einem `findBugfixes`-Ergebnis die Ziele weg, deren sämtliche inhaltlichen Änderungen in Commits stehen, die dafür einen `Bugfix-Skip` tragen
 * (siehe readCommitChanges). Eine Karte zählt über ihr eigenes Skript, wenn ein Commit es ohne `Bugfix-Skip: <Karte>` ändert, und über einen Baustein, wenn ein Commit
 * ihn ohne `Bugfix-Skip: <Karte>` UND ohne `Bugfix-Skip: <baustein>` ändert; ein Baustein selbst fällt weg, wenn jede seiner Änderungen einen `Bugfix-Skip: <baustein>` trägt.
 * Gibt es zu einer Datei keine Commit-Angaben (z. B. nur Merge-Auflösung), wird sie im Zweifel gemeldet.
 * @param {Map<string, {hash:string, skips:Set<string>}[]>} changes   Ergebnis von readCommitChanges
 */
function applySkips(found, changes) {
  if (!changes || !changes.size) return found;
  const counts = (file, ...targets) => {
    const list = changes.get(file);
    return !list || !list.length || list.some(c => !targets.some(t => c.skips.has(t)));
  };
  const direct = found.direct.filter(d => counts(d.file, normName(d.card.name)));
  const shared = [];
  for (const sh of found.shared) {
    const mod = normName(sh.module);
    const cards = sh.cards.filter(c => counts(sh.module, normName(c.name), mod));
    if (!counts(sh.module, mod) || (sh.cards.length && !cards.length)) continue;
    shared.push({ ...sh, cards, count: cards.length });
  }
  return { direct, shared };
}

/** findBugfixes-Ergebnis → ohne die Änderungen, die ihr eigener Commit per `Bugfix-Skip` abmeldet (Git-Verlauf lesen + applySkips). */
async function applyCommitSkips({ git, last, head, found }) {
  return applySkips(found, await readCommitChanges({ git, last, head, files: changedFiles(found) }));
}

/**
 * @param {object} o
 * @param {(...args:string[]) => Promise<string>} o.git   führt git im Repo aus
 * @param {string} o.last   zuletzt gemeldeter Stand
 * @param {string} o.head   aktueller Stand
 * @param {{name:string}[]} o.cards   alle Karten (cards.json im aktuellen Stand)
 * @param {number} [o.maxShared=12]   ab so vielen betroffenen Karten gilt ein Baustein als „breit“
 * @param {Set<string>} [o.balanced]   Namen der Karten mit Balancing-Änderung (cards.json) — sie zählen nicht als Bugfix
 * @returns {Promise<{direct:{card:object, file:string}[], shared:{module:string, cards:object[], count:number, broad:boolean}[]}>}
 */
async function findBugfixes({ git, last, head, cards, maxShared = 12, balanced = new Set() }) {
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
  for (const f of real.filter(f => !isShared(f))) for (const c of (bySlug.get(baseOf(f)) || []).filter(c => !balanced.has(c.name))) direct.push({ card: c, file: baseOf(f) });

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
        if (closure(deps, slug).has(mod)) cs.push(...bySlug.get(slug).filter(c => !balanced.has(c.name)));
      }
      shared.push({ module: mod, cards: cs, count: cs.length, broad: cs.length > maxShared });
    }
  }
  return { direct, shared };
}

module.exports = { findBugfixes, readNotes, parseSkips, readCommitChanges, changedFiles, applySkips, applyCommitSkips, normName, fingerprint, parseNameStatus, parseRequires, closure, nameToFile };
