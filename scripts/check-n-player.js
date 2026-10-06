#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — N-SPIELER-LINT
//
//  Das Spiel (Skill Test) läuft mit bis zu 8 Spielern. Jede Stelle, die
//  „den Gegner" als `pi === 0 ? 1 : 0` ausrechnet oder „alle Spieler" als
//  `[0, 1]` / `i < 2` schreibt, ist dort falsch. Diese Prüfung sucht genau
//  diese Zwei-Spieler-Idiome, damit KÜNFTIGE Kartenskripte sie nicht
//  wieder einschleppen.
//
//  RICHTIG
//    engine.opponentOf(pi)            der EINE Gegner
//    engine.opponentsOf(pi)           ALLE Gegner (Index-Liste)
//    engine.playerCount()             Spielerzahl (statt `< 2`)
//    opponentOfGs(gs, pi)             wenn nur der Spielzustand da ist
//                                     (const { opponentOfGs } = require('./_opp');)
//    ctx._engine.opponentOf(pi)       im Hook-Kontext
//
//  GEFUNDEN WIRD (AST, nicht Text — Strings/Kommentare zählen nicht)
//    swap   `X === 0 ? 1 : 0`, `X === 1 ? 0 : 1`, `X !== 0 ? 0 : 1`, `pi ? 0 : 1` …
//    minus  `1 - pi` (nur bei Spielerindex-Namen)
//    mod    `(pi + 1) % 2`, `pi ^ 1`
//    loop   `for (…; i < 2; …)` über Spieler (Rumpf indiziert `players[i]`,
//           ruft sendGameState/getHeroTargets(i) …); Slot-Schleifen zählen nicht
//    array  `[0, 1]` als Spielerliste
//
//  AUSNAHMEN
//    • Zeile (oder die Zeile davor) enthält `n-player-ok: <Grund>` — für
//      Stellen, die wirklich Zwei-Spieler-Logik sind (z. B. Zählen eines
//      2-Slot-Layouts), mit Begründung.
//    • scripts/n-player-allow.json: Pfad → Grund (ganze Datei, z. B. die
//      CPU-/Trainings-Inseln) ODER Pfad → { reason, max } (höchstens `max`
//      Treffer erlaubt — neue Treffer in der Datei schlagen trotzdem an).
//    • server.js: nur Spielgeschehen (doPlay…, sendGameState, …) wird geprüft;
//      Lobby/Spielende/Training sind dort bewusst Zwei-Spieler-Inseln und stehen
//      in docs/n-player-todo.md.
//
//  AUFRUF
//    node scripts/check-n-player.js              # alles
//    node scripts/check-n-player.js datei.js …   # einzelne Dateien
//    node scripts/check-n-player.js --list       # auch die erlaubten Treffer zeigen
//  Rückgabewert 1 bei nicht erlaubten Treffern.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const Babel = require('./vendor/babel.min.js');
const cm = require('./codemod-opponent');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
const WURZEL = path.join(__dirname, '..');
const ALLOW_PFAD = path.join(__dirname, 'n-player-allow.json');

/** Namen, die einen Spielerindex bezeichnen (letztes Glied eines Zugriffs wie `ctx.cardOwner`). */
const SPIELER_NAME = /^(?:pi|p|oi|opp\w*|owner|player\w*|ctrl|controller|cpuIdx|seite|side|activator\w*|activePlayer|\w*Idx|\w*Pi|\w*Owner|\w*Player)$/;
const letztesGlied = (t) => t.split('.').pop().replace(/[^\w$]/g, '');

const num = (n, v) => !!n && n.type === 'NumericLiteral' && n.value === v;

/** Zeilen mit „n-player-ok" (selbe oder vorherige Zeile) */
function befreiteZeilen(code) {
  const frei = new Set();
  code.split('\n').forEach((z, i) => { if (/n-player-ok/.test(z)) { frei.add(i + 1); frei.add(i + 2); } });
  return frei;
}

/** Findet alle Zwei-Spieler-Idiome einer Datei. @returns {{zeile:number, art:string, text:string, funktionen:string[]}[]} */
function suche(code, rel) {
  let ast;
  try { ast = parser.parse(code, { sourceType: 'script', allowReturnOutsideFunction: true }); }
  catch (err) { return [{ zeile: 0, art: 'parse', text: err.message, funktionen: [] }]; }
  const treffer = [];
  const frei = befreiteZeilen(code);
  const melde = (p, art) => {
    const n = p.node;
    const zeile = n.loc.start.line;
    if (frei.has(zeile)) return;
    treffer.push({ zeile, art, text: code.slice(n.start, Math.min(n.end, n.start + 70)).replace(/\s+/g, ' '), funktionen: cm.enclosingNames(p) });
  };
  traverse(ast, {
    ConditionalExpression(p) {
      const n = p.node;
      const c = n.consequent, a = n.alternate;
      if (c.type !== 'NumericLiteral' || a.type !== 'NumericLiteral') return;
      const t = n.test;
      if (t.type === 'BinaryExpression' && ['===', '==', '!==', '!='].includes(t.operator)) {
        const lit = t.right.type === 'NumericLiteral' ? t.right.value : t.left.type === 'NumericLiteral' ? t.left.value : null;
        if (lit !== 0 && lit !== 1) return;
        const gleich = t.operator === '===' || t.operator === '==';
        const wennGleich = gleich ? c.value : a.value;
        const sonst = gleich ? a.value : c.value;
        if (wennGleich === 1 - lit && sonst === lit) melde(p, 'swap');
        return;
      }
      // `pi ? 0 : 1` (nur bei Spielerindex-Namen — sonst ist es ein Boolean-zu-Zahl)
      if (c.value === 0 && a.value === 1 && (t.type === 'Identifier' || t.type === 'MemberExpression')
          && SPIELER_NAME.test(letztesGlied(code.slice(t.start, t.end)))) melde(p, 'swap');
    },
    BinaryExpression(p) {
      const n = p.node;
      if (n.operator === '-' && num(n.left, 1) && n.right.type !== 'NumericLiteral'
          && SPIELER_NAME.test(letztesGlied(code.slice(n.right.start, n.right.end)))) melde(p, 'minus');
      if (n.operator === '^' && num(n.right, 1) && SPIELER_NAME.test(letztesGlied(code.slice(n.left.start, n.left.end)))) melde(p, 'mod');
      if (n.operator === '%' && num(n.right, 2) && n.left.type === 'BinaryExpression' && n.left.operator === '+' && num(n.left.right, 1)
          && SPIELER_NAME.test(letztesGlied(code.slice(n.left.left.start, n.left.left.end)))) melde(p, 'mod');
    },
    ForStatement(p) {
      const b = cm.bewerteSchleife(code, p.node);
      if (b && b.spieler) melde(p, 'loop');
    },
    ArrayExpression(p) {
      const n = p.node;
      if (n.elements.length === 2 && num(n.elements[0], 0) && num(n.elements[1], 1)) melde(p, 'array');
    },
  });
  return treffer;
}

function ladeAllow() {
  try { return JSON.parse(fs.readFileSync(ALLOW_PFAD, 'utf8')); }
  catch { return {}; }
}

/** Dateien, die geprüft werden. */
function standardDateien() {
  const dir = path.join(WURZEL, 'cards', 'effects');
  const d = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => 'cards/effects/' + f);
  d.push('server.js');
  return d;
}

/** Spielgeschehen in server.js? Nur dort wird geprüft. */
function serverSpielgeschehen(funktionen) {
  return funktionen.some(f => cm.SERVER_OPP_ERLAUBT.has(f) || cm.SERVER_SCHLEIFE_ERLAUBT.has(f));
}

function main() {
  const args = process.argv.slice(2);
  const zeigeErlaubt = args.includes('--list');
  const explizit = args.filter(a => !a.startsWith('--')).map(a => path.relative(WURZEL, path.resolve(a)).split(path.sep).join('/'));
  const dateien = explizit.length ? explizit : standardDateien();
  const allow = ladeAllow();

  const verboten = [];
  const erlaubt = [];
  let gesamt = 0;
  for (const rel of dateien) {
    const abs = path.join(WURZEL, rel);
    if (!fs.existsSync(abs)) continue;
    let treffer = suche(fs.readFileSync(abs, 'utf8'), rel);
    if (rel === 'server.js') treffer = treffer.filter(t => t.art === 'parse' || serverSpielgeschehen(t.funktionen));
    if (!treffer.length) continue;
    gesamt += treffer.length;
    const a = allow[rel];
    if (a === undefined) { verboten.push(...treffer.map(t => ({ rel, ...t }))); continue; }
    if (typeof a === 'string') { erlaubt.push(...treffer.map(t => ({ rel, grund: a, ...t }))); continue; }
    // { reason, max }: bis `max` Treffer erlaubt, jeder weitere schlägt an
    const grenze = Number.isInteger(a.max) ? a.max : 0;
    treffer.forEach((t, i) => (i < grenze ? erlaubt.push({ rel, grund: a.reason, ...t }) : verboten.push({ rel, ...t, text: `${t.text}   (über dem erlaubten Maximum ${grenze}: ${a.reason})` })));
  }

  console.log(`[check-n-player] ${dateien.length} Dateien geprüft — ${gesamt} Zwei-Spieler-Idiom(e), davon ${erlaubt.length} erlaubt (n-player-allow.json), ${verboten.length} nicht.`);
  if (zeigeErlaubt) {
    const nachDatei = {};
    for (const t of erlaubt) (nachDatei[t.rel] = nachDatei[t.rel] || []).push(t);
    for (const [rel, l] of Object.entries(nachDatei)) console.log(`    erlaubt  ${rel}  ×${l.length}  — ${l[0].grund}`);
  }
  if (!verboten.length) return 0;
  console.log('\nGegner/Spieler NIE hart verdrahten — stattdessen engine.opponentOf(pi) / engine.opponentsOf(pi) / engine.playerCount()');
  console.log('(siehe cards/effects/CARD_API.md, Abschnitt „Gegner-Index"). Echte Zwei-Spieler-Logik: Kommentar `n-player-ok: <Grund>`.\n');
  for (const t of verboten) console.log(`  ${t.rel}:${t.zeile}  [${t.art}]  ${t.text}`);
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { suche, standardDateien };
