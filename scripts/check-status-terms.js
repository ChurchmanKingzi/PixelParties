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
//    5. SCHUTZ, KEIN STATUS — „cannot be negated" (auch „can't be …") wird nicht hervorgehoben (Als Vorgabe 20.10.); „Negate that Spell"
//       und „cannot be Frozen" bleiben Treffer.
//
//    6. REMINDER = REGELN — die Remindertexte von Stun, Freeze, Blind, Poison, Burn und Bleed sind WORT FÜR WORT die Definitionen im
//       Regelwerk (`RulesScreen`, „Status Effects" in app-screens.jsx), ebenso der Hinweis zur Immunität nach dem Ausfall.
//
//    7. LESBAR AUF JEDEM RAHMEN — auf den sechs gemessenen Textbox-Farben (Artifact-Creme, Lila der Helden, Braun der Potions, Blau der
//       Fähigkeiten, Rot der Spells/Creatures, Grau der Tokens) hat jeder Begriff genug Kontrast: ohne Kontur ≥ 4,5 zum Untergrund; mit
//       dunkler Kontur ≥ 6 zur Kontur und Kontur oder Ton hebt sich vom Untergrund ab; mit heller Kontur ≥ 3,5 zur Kontur und ≥ 3 zum
//       Untergrund. Neuer Rahmen oder neue Farbe? In `RAHMEN` unten eintragen (Messung: Mittelwert der Textbox vor dem Text).
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

// 5. Schutz, kein Status
for (const [text, erwartet] of [['This Ability cannot be negated.', 0], ["These effects can't be Negated or redirected.", 0], ['Negate that Spell and delete it.', 1],
  ['A target cannot be Frozen in 2 consecutive turns.', 1], ['Negate the effect. It cannot be negated.', 1]]) {
  const n = CR.statusMatches(text).length;
  if (n !== erwartet) fehler.push(`„${text}": ${n} Treffer, erwartet ${erwartet}.`);
}

// 6. Reminder = Regeln
{
  const regeln = fs.readFileSync(path.join(WURZEL, 'public', 'app-screens.jsx'), 'utf8');
  const a = sharedSrc.indexOf('const TT_STATUS_REMINDER = {');
  const block = sharedSrc.slice(a, sharedSrc.indexOf('\n};', a));
  const reminder = {};
  for (const m of block.matchAll(/^\s{2}([a-z_]+):\s*'((?:[^'\\]|\\.)*)'/gm)) reminder[m[1]] = m[2].replace(/\\'/g, "'");
  const REGEL_NAME = { stun: 'Stunned', freeze: 'Frozen', blind: 'Blinded', poison: 'Poisoned', burn: 'Burned', bleed: 'Bleeding' };
  for (const [key, name] of Object.entries(REGEL_NAME)) {
    const m = new RegExp(`<div className="rules-status-name">${name}</div>\\s*<p>([^<]*)</p>`).exec(regeln);
    if (!m) { fehler.push(`Regelwerk: kein Eintrag „${name}" unter „Status Effects" gefunden (app-screens.jsx).`); continue; }
    if (reminder[key] !== m[1].trim()) fehler.push(`Reminder '${key}' weicht vom Regelwerk ab:\n      Reminder: ${reminder[key]}\n      Regeln:   ${m[1].trim()}`);
  }
  const callout = /After recovering from a Freeze[\s\S]*?\(until the beginning of its owner's next turn\)!/.exec(regeln.replace(/<\/?strong>/g, ''));
  const rec = (/const TT_STATUS_RECOVERY = '((?:[^'\\]|\\.)*)';/.exec(sharedSrc) || [])[1];
  if (!callout) fehler.push('Regelwerk: der Hinweis zur Immunität nach dem Ausfall wurde nicht gefunden.');
  else if (!rec || rec.replace(/\\'/g, "'") !== callout[0]) fehler.push('TT_STATUS_RECOVERY weicht vom Hinweis im Regelwerk ab.');
}

// 7. Lesbar auf jedem Rahmen
{
  const RAHMEN = { 'Artifact (Creme)': [247, 247, 172], 'Held (Lila)': [160, 65, 254], 'Potion (Braun)': [176, 103, 70], 'Fähigkeit (Blau)': [56, 102, 240],
    'Spell/Creature (Rot)': [254, 81, 84], 'Token (Grau)': [146, 146, 146] };
  const rgb = c => (c.startsWith('#') ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : c.match(/\d+/g).map(Number));
  const K = CR._kontrast, DUNKEL = rgb(CR.STATUS_OUTLINES.dark), HELL = rgb(CR.STATUS_OUTLINES.light);
  for (const [rahmen, bg] of Object.entries(RAHMEN)) for (const t of terme) {
    const d = CR._statusDarstellung(t, bg, false), c = rgb(d.color), wo = `${t.key} auf ${rahmen}`;
    if (d.outline == null) { if (K(c, bg) < 4.5) fehler.push(`${wo}: ohne Kontur nur Kontrast ${K(c, bg).toFixed(1)} (< 4,5).`); }
    else if (d.outline === CR.STATUS_OUTLINES.dark) {
      if (K(c, DUNKEL) < 6) fehler.push(`${wo}: Ton gegen dunkle Kontur nur ${K(c, DUNKEL).toFixed(1)} (< 6).`);
      if (K(DUNKEL, bg) < 3 && K(c, bg) < 2.2) fehler.push(`${wo}: weder Kontur (${K(DUNKEL, bg).toFixed(1)}) noch Ton (${K(c, bg).toFixed(1)}) heben sich vom Untergrund ab.`);
    } else {
      if (K(c, HELL) < 3.5) fehler.push(`${wo}: Ton gegen helle Kontur nur ${K(c, HELL).toFixed(1)} (< 3,5).`);
      if (K(HELL, bg) < 3) fehler.push(`${wo}: helle Kontur gegen den Untergrund nur ${K(HELL, bg).toFixed(1)} (< 3).`);
    }
  }
}

if (fehler.length) {
  for (const f of fehler) console.error('[check-status-terms] ' + f);
  process.exit(1);
}
console.log(`[check-status-terms] OK — ${terme.length} Begriffe mit Farbe und Reminder, ${geprueft} Kartennamen mit Statuswort bleiben im Text ungefärbt, nur Textblöcke gestylt, Reminder = Regelwerk, lesbar auf allen 6 Rahmenfarben.`);
