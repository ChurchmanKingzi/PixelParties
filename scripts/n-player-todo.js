#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — N-SPIELER-ABLEITUNG: Liste der Stellen, die der Codemod NICHT lösen kann
//
//  Schreibt docs/n-player-todo.md: pro Datei die Zeilen, an denen die Zwei-Spieler-Annahme
//  bleibt, mit einer Zeile Begründung. Zwei Quellen:
//
//    1. bewusst belassene Idiome (Spielende, Lobby, Side-Deck, Puzzle, CPU-Kampf …),
//       die der Codemod (scripts/codemod-opponent.js) erkennt, aber nicht umstellt;
//    2. Zwei-Spieler-STRUKTUREN, die sich nicht über `opponentOf`/`playerCount` ausdrücken
//       lassen: `[0, 0]`/`[null, null]`/`[[], []]`-Literale, `players[0]`/`players[1]`,
//       Vergleiche eines Spielerindex mit 0/1, `pi === 0 ? a : b` mit Nicht-Zahlen.
//
//  AUFRUF
//    node scripts/n-player-todo.js            # docs/n-player-todo.md neu schreiben
//    node scripts/n-player-todo.js --stdout   # nur ausgeben
//
//  Die Datei ist ERZEUGT — nicht von Hand pflegen; Erledigtes verschwindet beim nächsten Lauf.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const Babel = require('./vendor/babel.min.js');
const cm = require('./codemod-opponent');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
const WURZEL = path.join(__dirname, '..');
const AUSGABE = path.join(WURZEL, 'docs', 'n-player-todo.md');

/** Spielerindex-Namen (letztes Glied) */
const SPIELER_NAME = /^(?:pi|p|oi|opp\w*|owner|ownerIdx|ownerPi|player\w*|ctrl|controller|cpuIdx|seite|side|activator\w*|activePlayer|winnerIdx|loserIdx|\w*Idx|\w*Pi|\w*Owner)$/;
const letztes = (t) => t.split('.').pop().replace(/[^\w$]/g, '');
const num = (n, v) => !!n && n.type === 'NumericLiteral' && n.value === v;
const kurz = (s, n = 90) => s.replace(/\s+/g, ' ').slice(0, n);

/** Gleichartige, „leere" Startwerte: 0, null, false, '', [], {} */
function leerWert(n) {
  if (!n) return null;
  if (num(n, 0)) return '0';
  if (n.type === 'NullLiteral') return 'null';
  if (n.type === 'BooleanLiteral') return String(n.value);
  if (n.type === 'StringLiteral' && n.value === '') return "''";
  if (n.type === 'ArrayExpression' && n.elements.length === 0) return '[]';
  if (n.type === 'ObjectExpression' && n.properties.length === 0) return '{}';
  if (n.type === 'Identifier' && n.name === 'undefined') return 'undefined';
  return null;
}

/** Struktur-Funde einer Datei: [{zeile, art, text}] */
function strukturen(code) {
  let ast;
  try { ast = parser.parse(code, { sourceType: 'script', allowReturnOutsideFunction: true }); } catch { return []; }
  const out = [];
  const add = (n, art, hinweis) => out.push({ zeile: n.loc.start.line, art, text: kurz(code.slice(n.start, n.end)), hinweis });
  traverse(ast, {
    ArrayExpression(p) {
      const n = p.node;
      if (n.elements.length !== 2) return;
      const a = leerWert(n.elements[0]), b = leerWert(n.elements[1]);
      if (a && a === b) add(n, 'literal', `Zwei-Spieler-Literal \`[${a}, ${a}]\` — pro Spieler ein Eintrag, muss mit der Spielerzahl wachsen`);
    },
    MemberExpression(p) {
      const n = p.node;
      if (!n.computed || !(num(n.property, 0) || num(n.property, 1))) return;
      const o = code.slice(n.object.start, n.object.end);
      if (/(?:^|\.)players$/.test(o)) add(n, 'players01', `fester Spielerindex \`players[${n.property.value}]\` — setzt Spieler 0/1 voraus`);
    },
    BinaryExpression(p) {
      const n = p.node;
      if (!['===', '!==', '==', '!='].includes(n.operator)) return;
      const lit = num(n.right, 0) || num(n.right, 1) ? n.right : (num(n.left, 0) || num(n.left, 1) ? n.left : null);
      if (!lit) return;
      const other = lit === n.right ? n.left : n.right;
      const ot = code.slice(other.start, other.end);
      if (!SPIELER_NAME.test(letztes(ot))) return;
      // `pi === 0 ? 1 : 0` ist Sache des Codemods; hier nur die übrigen Vergleiche
      add(n, 'vergleich', `Spielerindex gegen Literal ${lit.value} verglichen — „Spieler 0/1“ ist im Skill Test nicht „erster/zweiter“`);
    },
    ConditionalExpression(p) {
      const n = p.node;
      const t = n.test;
      if (t.type !== 'BinaryExpression' || !['===', '=='].includes(t.operator)) return;
      const lit = num(t.right, 0) || num(t.right, 1) ? t.right : null;
      if (!lit) return;
      const ot = code.slice(t.left.start, t.left.end);
      if (!SPIELER_NAME.test(letztes(ot))) return;
      const zahlen = (n.consequent.type === 'NumericLiteral') && (n.alternate.type === 'NumericLiteral');
      if (!zahlen) add(n, 'zweig', `\`${kurz(code.slice(t.start, t.end), 40)} ? … : …\` wählt zwischen zwei festen Seiten (z. B. Beschriftung/Spielerzustand)`);
    },
  });
  return out;
}

function sammeln() {
  const dateien = cm.standardDateien();
  const notizen = {};          // rel → [{zeile, text}]
  const struktur = {};         // rel → [{zeile, art, text, hinweis}]
  for (const rel of dateien) {
    const code = fs.readFileSync(path.join(WURZEL, rel), 'utf8');
    if (!cm.istInsel(rel)) {
      const r = cm.bearbeiteDatei(rel, code);
      const l = r.notizen.map(x => ({ zeile: x.zeile, text: x.notiz }));
      for (const x of r.pruefen.filter(x => x.art !== 'belassen')) l.push({ zeile: x.zeile, text: `\`${x.was}\` — ${x.warum}` });
      if (l.length) notizen[rel] = l;
      const s = strukturen(code);
      if (s.length) struktur[rel] = s;
    }
  }
  return { notizen, struktur };
}

const ART_TITEL = {
  literal: 'Zwei-Spieler-Literale',
  players01: 'Feste Indizes `players[0]` / `players[1]`',
  vergleich: 'Spielerindex gegen 0/1 verglichen',
  zweig: '`pi === 0 ? a : b` mit Nicht-Zahlen',
};

/** Von Hand geschriebene Hinweise — der Codemod kann sie nicht erkennen. */
const HINWEISE = [
  '**Ein Gegner statt „der Gegner“.** `opponentOf(pi)` liefert genau EINEN Spieler (Skill Test: Fokus `gs.stFocus[pi]`, sonst der nächste lebende). '
    + 'Karten mit Kartentext „each opponent“ / „all opponents“ meinten bisher dasselbe wie „the opponent“ und müssen im Skill Test auf `opponentsOf(pi)` '
    + '(Liste) umgestellt werden — das ist eine Entscheidung je Karte, keine mechanische.',
  '**`cards/effects/_engine.js` `aoeTargetPlayers`**: `side: \'enemy\'` (Default) liefert `[this.opponentOf(pi)]`, `side: \'both\'` alle Spieler. '
    + 'Für Flächenschaden im Skill Test vermutlich `this.opponentsOf(pi)` — Entscheidung.',
  '**`cards/effects/future-tech-control-device.js`**: `besitzer(engine, inst)` leitet den Besitzer als „Gegenseite des Wirts“ ab (`engine.opponentOf(inst.owner)`). '
    + 'Mit mehreren Gegnern ist das nicht eindeutig — dort `originalOwner`/den Kontrolleur der Karte speichern.',
  '**server.js Relais an „den Gegner“** (`targeting_update`, `ping_card`, `pending_placement`, `pending_placement_clear`, `blind_pick_update`, `broadcastHandToBoard`) '
    + 'senden jetzt an `opponentOfGs(gs, pi)`; im Skill Test sollen sie vermutlich an ALLE Gegner (`opponentsOfGs`) gehen.',
  '**`1 - oppX`** (kit-the-shark-researcher, pusher, spreading-rumor, tryse-the-shadow-slayer) leitete „den Wirker“ aus dem Gegner ab; steht jetzt direkt als `pi`.',
  '**Schleifen `i < engine.playerCount()`** laufen über ALLE Spieler am Tisch, auch über ausgeschiedene (alle Helden tot) — wie bisher über beide.',
  '**Listen `[0, 1]`** sind jetzt `<gs>.players.map((_, i) => i)` (alle Spieler inkl. des Wirkers, aufsteigend) — Reihenfolge und Inhalt im Normalspiel unverändert.',
  '**`opponentOfGs(gs, pi)` ist null-sicher** (fehlender `gs` → Normalspiel-Verhalten); der Skill-Test-Zweig greift nur bei gesetztem `gs.skillTest`.',
];

const ART_HINWEIS = {
  literal: 'Pro Spieler ein Eintrag (Zähler, Flags, Entscheidungen, Gebiete). Muss mit der Spielerzahl wachsen — z. B. `gs.areaZones`, `mulliganDecisions`, `setScore`.',
  players01: 'Setzt Spieler 0 und 1 fest voraus. Die Guardian-Beast-Karten zählen beide Ablagen von Hand durch — dort gehört `opponentsOf`/`playerCount` hin.',
  zweig: 'Wählt zwischen zwei festen Seiten (Beschriftung, Selektor, Zustand) — keine Zahl, daher nicht über `opponentOf` lösbar.',
};

function rendern({ notizen, struktur }) {
  const z = [];
  z.push('# N-Spieler-Umbau — Stellen mit verbleibender Zwei-Spieler-Annahme');
  z.push('');
  z.push('> **Erzeugt** von `node scripts/n-player-todo.js` — nicht von Hand pflegen. Stand: Schritt 1 des Skill-Test-Umbaus');
  z.push('> (zentrale Gegner-Helfer `opponentOf` / `opponentsOf` / `playerCount`, Codemod `scripts/codemod-opponent.js`).');
  z.push('> Das Normalspiel ist dabei bit-identisch geblieben (`scripts/regress/compare.sh`).');
  z.push('> Zeilennummern gelten für den Stand beim Erzeugen — nach einem Merge einfach neu laufen lassen.');
  z.push('');
  z.push('## 0. Fachliche Hinweise zu den schon umgestellten Stellen');
  z.push('');
  for (const h of HINWEISE) z.push(`- ${h}`);
  z.push('');
  z.push('## 1. Bewusst belassene Idiome (brauchen eine Entscheidung)');
  z.push('');
  z.push('Der Codemod erkennt diese Stellen, stellt sie aber nicht um — der Mehrspielermodus braucht dort eine fachliche Regel,');
  z.push('keine mechanische Ersetzung (Sieger/Verlierer, Aufgeben, Rematch, Side-Deck, Puzzle, CPU-Kampf, Lobby/Sitze).');
  z.push('');
  const nDateien = Object.keys(notizen).sort();
  for (const rel of nDateien) {
    z.push(`### \`${rel}\``);
    z.push('');
    // Gleiche Begründung → eine Zeile mit allen Zeilennummern (server.js hat viele Schleifen derselben Art).
    const gruppen = new Map();
    for (const x of notizen[rel].sort((a, b) => a.zeile - b.zeile)) {
      const m = /^`(.*?)` — ([\s\S]*)$/.exec(x.text);
      const code = m ? m[1] : x.text;
      const grund = m ? m[2] : '';
      if (!gruppen.has(grund)) gruppen.set(grund, []);
      gruppen.get(grund).push({ zeile: x.zeile, code });
    }
    for (const [grund, l] of gruppen) {
      const codes = [...new Set(l.map(x => x.code))];
      const zeilen = l.map(x => x.zeile).join(', ');
      z.push(`- Zeile${l.length > 1 ? 'n' : ''} ${zeilen} (${codes.slice(0, 3).map(c => `\`${c}\``).join(', ')}${codes.length > 3 ? ', …' : ''}) — ${grund}`);
    }
    z.push('');
  }
  z.push('## 2. Zwei-Spieler-Strukturen, die `opponentOf`/`playerCount` nicht ausdrücken');
  z.push('');
  z.push('Unveränderte Zwei-Spieler-Annahmen im Zustandsaufbau und in Spezialfällen. Pro Datei: Zeile, Fundstelle, Hinweis.');
  z.push('Nicht angefasst: `_cpu.js`, `_deck-profile.js`, `_train-*.js`, `_demo-recorder.js`, `_decision-log.js`, `_sc-tracking.js` (Zwei-Spieler-Inseln, siehe `scripts/n-player-allow.json`).');
  z.push('');
  const zaehler = {};
  for (const l of Object.values(struktur)) for (const x of l) zaehler[x.art] = (zaehler[x.art] || 0) + 1;
  z.push('Übersicht: ' + Object.entries(ART_TITEL).map(([k, t]) => `${t}: ${zaehler[k] || 0}`).join(' · '));
  z.push('');
  // Zuerst die „harten" Arten (Literale / players[0|1] / Zweige) ausführlich, Vergleiche kompakt je Datei.
  for (const art of ['literal', 'players01', 'zweig']) {
    const dat = Object.keys(struktur).filter(r => struktur[r].some(x => x.art === art)).sort();
    if (!dat.length) continue;
    z.push(`### ${ART_TITEL[art]}`);
    z.push('');
    z.push(ART_HINWEIS[art]);
    z.push('');
    for (const rel of dat) {
      z.push(`- \`${rel}\``);
      const gesehen = new Set();
      for (const x of struktur[rel].filter(x => x.art === art)) {
        const k = `${x.zeile}|${x.text}`;
        if (gesehen.has(k)) continue;
        gesehen.add(k);
        z.push(`  - Zeile ${x.zeile}: \`${x.text}\``);
      }
    }
    z.push('');
  }
  z.push(`### ${ART_TITEL.vergleich}`);
  z.push('');
  z.push('Vergleiche wie `activePlayer === 0` / `pi !== 1`. Meist harmlos („ist der Wirker Spieler 0?“ als Identität), kippen aber, sobald');
  z.push('„Spieler 0/1“ als „erster/zweiter Spieler“ gelesen wird. Pro Datei die Zeilen:');
  z.push('');
  for (const rel of Object.keys(struktur).sort()) {
    const l = struktur[rel].filter(x => x.art === 'vergleich');
    if (l.length) z.push(`- \`${rel}\`: ${[...new Set(l.map(x => x.zeile))].join(', ')}`);
  }
  z.push('');
  return z.join('\n');
}

function main() {
  const daten = sammeln();
  const md = rendern(daten);
  if (process.argv.includes('--stdout')) { process.stdout.write(md); return 0; }
  fs.mkdirSync(path.dirname(AUSGABE), { recursive: true });
  fs.writeFileSync(AUSGABE, md, 'utf8');
  const zn = Object.values(daten.notizen).reduce((s, l) => s + l.length, 0);
  const zs = Object.values(daten.struktur).reduce((s, l) => s + l.length, 0);
  console.log(`[n-player-todo] ${path.relative(WURZEL, AUSGABE)}: ${zn} belassene Idiome in ${Object.keys(daten.notizen).length} Dateien, ${zs} Strukturfunde in ${Object.keys(daten.struktur).length} Dateien.`);
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { sammeln, rendern, strukturen };
