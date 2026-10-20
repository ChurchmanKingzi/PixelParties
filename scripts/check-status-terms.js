#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: STATUSBEGRIFFE IM KARTENTEXT UND IM TOOLTIP
//
//  ANLASS (20.10., Als Vorgabe): Statuseffekte stehen im Effekttext fett und farbig — Poison lila, Burn orange, Stun gelb, Negate
//  grau, Bleed rot, Freeze eisblau, Blind mint — und der Tooltip führt unter dem Kartentext je erwähntem Status einen Remindertext.
//  „Nur Wörter in Effekttexten, niemals in Namen!" — weder der Kartenname noch ein Kartenname IM Text („Poison Vial",
//  „Rafflesia, the Poison Princess", „Terror") darf gefärbt werden. Tabelle und Erkennung stehen in `public/card-render.js`
//  (`STATUS_TERMS`, `statusMatches`); der Tooltip (`public/app-shared.jsx`) liest sie von dort.
//
//  Geprüft wird:
//
//    1. TABELLE — jeder Begriff hat Schlüssel, Namen, Muster und zwei Farben (`hell` für dunkle, `dunkel` für helle Textboxen).
//
//    2. REMINDER — `TT_STATUS_REMINDER` im Tooltip hat genau die Schlüssel der Tabelle, jeder mit Text.
//
//    3. KEINE NAMEN — für JEDEN Kartennamen aus `data/cards.json`, der einen Statusbegriff enthält (Poison Vial, Burning Finger …),
//       liefert „Add "<Name>" to your hand." keinen Treffer; derselbe Name ohne Anführungszeichen wohl (Gegenprobe). „negative" und
//       andere Fast-Treffer („Burnbringer" als Teil eines Wortes) werden nicht erkannt.
//
//    4. NUR TEXTBLÖCKE — der Stil wird nur in `wordsOf` (Effekttext, `drawBlock`) berechnet, nie in `drawLine` (Namen, Werte); im
//       Tooltip steht `ttMarkStatus` nur in `ttQuoted` (Effekttext), nicht im Kopf (`TTHeader`).
//
//  Aufruf:  node scripts/check-status-terms.js        Rückgabe 0 = sauber, 1 = Verstöße.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const renderSrc = fs.readFileSync(path.join(WURZEL, 'public', 'card-render.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(WURZEL, 'public', 'app-shared.jsx'), 'utf8');
const karten = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'cards.json'), 'utf8'));

new Function(renderSrc).call(globalThis);          // legt `CardRender` an (Browser-Datei, im Knoten über `globalThis`)
const CR = globalThis.CardRender;
const fehler = [];

// 1. Tabelle
const terme = CR.STATUS_TERMS || [];
if (!terme.length) fehler.push('CardRender.STATUS_TERMS ist leer oder fehlt.');
const hex = /^#[0-9a-f]{6}$/i;
for (const t of terme) {
  if (!t.key || !t.label || !t.re) fehler.push(`Begriff ${JSON.stringify(t.key)}: key, label oder re fehlt.`);
  if (!hex.test(t.hell || '') || !hex.test(t.dunkel || '')) fehler.push(`Begriff ${t.key}: hell/dunkel müssen Hex-Farben sein (hell ${t.hell}, dunkel ${t.dunkel}).`);
}
if (new Set(terme.map(t => t.key)).size !== terme.length) fehler.push('STATUS_TERMS hat doppelte Schlüssel.');

// 2. Reminder
{
  const a = sharedSrc.indexOf('const TT_STATUS_REMINDER = {');
  const b = sharedSrc.indexOf('\n};', a);
  const block = a < 0 ? '' : sharedSrc.slice(a, b);
  const schluessel = [...block.matchAll(/^\s{2}([a-z_]+):\s*'((?:[^'\\]|\\.)+)'/gm)].map(m => m[1]);
  if (a < 0) fehler.push('TT_STATUS_REMINDER fehlt in app-shared.jsx.');
  for (const t of terme) if (!schluessel.includes(t.key)) fehler.push(`Kein Remindertext für '${t.key}' (TT_STATUS_REMINDER in app-shared.jsx).`);
  for (const k of schluessel) if (!terme.some(t => t.key === k)) fehler.push(`Remindertext für '${k}', aber kein solcher Begriff in STATUS_TERMS.`);
}

// 3. Keine Namen
const treffer = s => CR.statusMatches(s).map(m => s.slice(m.start, m.end));
if (treffer('That is a negative status effect.').length) fehler.push('„negative" wird als Statusbegriff erkannt.');
if (treffer('The Burnbringer arrives.').length) fehler.push('Wortteil („Burnbringer") wird als Statusbegriff erkannt.');
const wortRe = new RegExp(terme.map(t => t.re).join('|'), 'i');
let geprueft = 0;
for (const k of karten) {
  if (!wortRe.test(k.name)) continue;
  geprueft++;
  const sauber = k.name.replace(/"/g, '');           // Namen mit eigenen Anführungszeichen ("Deadly Poison"): im Text ohne diese
  const imText = `Add "${sauber}" to your hand.`;
  if (treffer(imText).length) fehler.push(`Kartenname im Text wird gefärbt: ${imText} → ${treffer(imText).join(', ')}`);
}
if (!treffer('Poison Vial').length) fehler.push('Gegenprobe: „Poison Vial" ohne Anführungszeichen müsste ein Treffer sein.');
if (CR.statusMatches('Stunned and Poisoned. Negate it. Burn, Freeze, Bleed and Blind.').length !== 7) fehler.push('Gegenprobe: erwartet 7 Treffer in „Stunned and Poisoned. Negate it. Burn, Freeze, Bleed and Blind."');

// 4. Nur Textblöcke
{
  const aufrufe = renderSrc.split('statusStyles(').length - 1;   // Definition + Aufruf in wordsOf
  if (aufrufe !== 2) fehler.push(`statusStyles( kommt ${aufrufe}× vor (erwartet 2: Definition und wordsOf) — wird der Stil noch anderswo berechnet?`);
  const dl = renderSrc.indexOf('function drawLine(');
  const dlEnde = renderSrc.indexOf('\n  }\n', dl);
  if (/statusStyles|wordsOf|STATUS_TERMS/.test(renderSrc.slice(dl, dlEnde))) fehler.push('drawLine (Namen, Werte) greift auf Statusbegriffe zu.');
  const kopf = sharedSrc.indexOf('function TTHeader(');
  const kopfEnde = sharedSrc.indexOf('\n}\n', kopf);
  if (/ttMarkStatus|ttQuoted|TTStatusReminders/.test(sharedSrc.slice(kopf, kopfEnde))) fehler.push('TTHeader (Kartenname) greift auf die Statushervorhebung zu.');
}

if (fehler.length) {
  for (const f of fehler) console.error('[check-status-terms] ' + f);
  process.exit(1);
}
console.log(`[check-status-terms] OK — ${terme.length} Begriffe mit Farbe und Reminder, ${geprueft} Kartennamen mit Statuswort bleiben im Text ungefärbt, nur Textblöcke gestylt.`);
