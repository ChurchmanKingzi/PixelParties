#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: TOKENS STEHEN AM ENDE DES KARTEN-TOOLTIPS
//
//  ANLASS (20.10., Als Vorgabe): Nennt eine Karte einen Token („Pollution Tokens", „Mummy Token"), steht ganz unten in ihrem Tooltip das Bild
//  des Tokens, gefolgt von seinem Effekt — in JEDEM Menü und Modus. Früher öffnete das Spielbrett dafür einen zweiten, angeschnittenen
//  Tooltip links daneben (feste Liste: Pyroblast, Mummy Maker Machine, dazu jeder Text mit „Pollution Token"), nur im Spiel.
//
//  Geprüft wird:
//
//    1. ERKENNUNG — `ttRelatedTokens` (app-shared.jsx, hier aus dem Quelltext ausgeführt) findet gegen `data/cards.json` Spontaneous
//       Reappearance und Pyroblast → Pollution Token (Plural im Text), Mummy Maker Machine → Mummy Token, Tri Fecta → die drei Puppen,
//       Biomancy → Biomancy Token; Tokens selbst nennen keine Tokens (kein Nest, auch wenn die Puppen aufeinander verweisen). Jede Karte
//       mit dem Namen eines Tokens im Text bekommt mindestens diesen.
//
//    2. EINBAU — `TTTokenSektion` steht in `CardTooltipContent` UND `CardSideTooltip` (zusammen decken sie Brett, Puzzle-Editor, Deckeditor,
//       Galerien, Regeln, Kampagne ab) und im Pile-Hover-Tooltip des Bretts.
//
//    3. KEIN ZWEITER TOOLTIP — `app-board.jsx` hält keine feste Token-Liste (`CARD_TOKEN_MAP`) und kein „Pollution Token"-Muster mehr; der
//       Seiten-Tooltip bleibt nur für die angesagte Karte von Luck.
//
//  Aufruf:  node scripts/check-token-tooltip.js        Rückgabe 0 = sauber, 1 = Verstöße.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const shared = fs.readFileSync(path.join(WURZEL, 'public', 'app-shared.jsx'), 'utf8');
const board = fs.readFileSync(path.join(WURZEL, 'public', 'app-board.jsx'), 'utf8');
const karten = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'cards.json'), 'utf8'));
const fehler = [];

// 1. Erkennung: den Teil mit den Funktionen (ohne JSX) ausführen
const a = shared.indexOf('function ttIstToken(');
const b = shared.indexOf('/** Ein Token: Name, Bild');
if (a < 0 || b < 0) { console.error('[check-token-tooltip] ttRelatedTokens nicht gefunden (app-shared.jsx).'); process.exit(1); }
const byName = {};
for (const k of karten) byName[k.name] = k;
const win = { CARDS_BY_NAME: byName };
const ttRelatedTokens = new Function('window', shared.slice(a, b) + '\nreturn { ttRelatedTokens, ttIstToken };')(win);
const tokensVon = n => ttRelatedTokens.ttRelatedTokens(byName[n]).map(t => t.name);

const ERWARTET = {
  'Spontaneous Reappearance': ['Pollution Token'],
  'Pyroblast': ['Pollution Token'],
  'Mummy Maker Machine': ['Mummy Token'],
  'Biomancy': ['Biomancy Token'],
  'Tri Fecta, the Puppet Master': ['Destructive Puppet Shishi', 'Creative Puppet Brammi', 'Preserving Puppet Vinny'],
  'Pollution Token': [],
  'Clever Puppet Saras': [],
  'Mummy Token': [],
};
for (const [n, soll] of Object.entries(ERWARTET)) {
  if (!byName[n]) { fehler.push(`Karte „${n}" gibt es nicht mehr — Eintrag in ERWARTET prüfen.`); continue; }
  const ist = tokensVon(n);
  if (JSON.stringify([...ist].sort()) !== JSON.stringify([...soll].sort())) fehler.push(`${n}: Tokens [${ist.join(', ')}], erwartet [${soll.join(', ')}].`);
}
const tokenKarten = karten.filter(k => ttRelatedTokens.ttIstToken(k));
let mitToken = 0;
for (const k of karten) {
  if (ttRelatedTokens.ttIstToken(k)) continue;
  const text = String(k.effect || '');
  const genannt = tokenKarten.filter(t => new RegExp('\\b' + t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b').test(text)).map(t => t.name);
  const ist = tokensVon(k.name);
  if (genannt.length) mitToken++;
  for (const t of genannt) if (!ist.includes(t)) fehler.push(`${k.name}: nennt „${t}", aber der Tooltip zeigt ihn nicht.`);
}

// 2. Einbau
const abschnitt = (von, bis) => { const x = shared.indexOf(von); return x < 0 ? '' : shared.slice(x, bis ? shared.indexOf(bis, x) : undefined); };
if (!/<TTTokenSektion card=\{card\} \/>/.test(abschnitt('function CardTooltipContent(', '\n}\n'))) fehler.push('CardTooltipContent zeigt keine TTTokenSektion.');
if (!/<TTTokenSektion card=\{card\} \/>/.test(abschnitt('function CardSideTooltip(', '\n}\n'))) fehler.push('CardSideTooltip zeigt keine TTTokenSektion.');
if (!/window\.TTTokenSektion/.test(board)) fehler.push('Der Pile-Hover-Tooltip des Bretts (app-board.jsx) zeigt keine TTTokenSektion.');

// 3. Kein zweiter Tooltip
if (/CARD_TOKEN_MAP/.test(board)) fehler.push('app-board.jsx hat noch die feste Token-Liste CARD_TOKEN_MAP — Tokens gehören in den Tooltip der Karte.');
if (/\/Pollution Token\/i\.test\(/.test(board)) fehler.push('app-board.jsx öffnet noch einen eigenen Tooltip für „Pollution Token".');

if (fehler.length) {
  for (const f of fehler) console.error('[check-token-tooltip] ' + f);
  process.exit(1);
}
console.log(`[check-token-tooltip] OK — ${tokenKarten.length} Token-Karten, ${mitToken} Karten nennen einen und zeigen ihn unten im Tooltip; kein zweiter Tooltip mehr.`);
