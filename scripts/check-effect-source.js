#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: QUELLE BEI BUFFS UND STATUS AM HELDEN
//
//  Anlass (v1067, Als Befund 14.9.): „Warum dann nicht das Buff-System
//  so erweitern, dass die Quelle immer mitgegeben wird?"
//
//  Er hatte recht, und die Lücke war messbar: von 14 `actionAddBuff`-
//  Aufrufen gab genau EINER eine Quelle mit. Jeder Effekt vom Zuschnitt
//  „whenever this Hero is affected by an OPPONENT's card or effect"
//  („The Stormblade", „Charm of Balance") kann ohne Quelle nicht
//  entscheiden, ob er auslösen darf — und schweigt dann lieber, was den
//  Kartentext still unvollständig macht.
//
//  Dieses Skript hält die Lücke geschlossen: Wer einem HELDEN einen
//  Buff oder Status verpasst, muss sagen, von wem er kommt.
//
//  Erkannt wird `sourceOwner:` (Buffs) bzw. `appliedBy:` / `sourceOwner:`
//  (Status). Ein reines `source: 'Kartenname'` genügt NICHT — daraus
//  lässt sich die Seite nicht ablesen.
//
//  Aufruf:  node scripts/check-effect-source.js
//  Rückgabe 0 = sauber, 1 = Fundstellen ohne Quelle.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const EFFEKTE = path.join(__dirname, '..', 'cards', 'effects');

// ── Bekannte Ausnahmen ────────────────────────────────────────────
// Durchreicher und generische Trichter: sie bekommen die opts von
// aussen und dürfen keine eigene Quelle erfinden.
const AUSNAHMEN = new Set([
  '_engine.js',            // Trichter selbst (`opts` wird durchgereicht)
  '_hooks.js',
  '_waflav-shared.js',     // reicht `statusOpts` des Aufrufers durch
  'tea.js',                // reicht `opts` des kopierten Effekts durch
  'cactus-creature.js',    // spiegelt einen fremden Status samt opts
]);

/**
 * Kommentare unschädlich machen, OHNE die Zeichen-Positionen zu
 * verschieben: jedes Zeichen wird durch ein Leerzeichen ersetzt,
 * Zeilenumbrüche bleiben stehen.
 *
 * ★ Wichtig für die Meldung: würde man Kommentare einfach entfernen,
 * zeigten die gemeldeten Zeilennummern auf ganz andere Stellen — beim
 * ersten Lauf verwiesen sie auf unbeteiligten Code und schickten die
 * Suche in die Irre.
 */
function stripKommentare(src) {
  const leeren = (m) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, leeren)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + leeren(m.slice(p1.length)));
}

/** Alle Aufrufe von `name(` mit ihrem Argumentblock. */
function aufrufe(src, name) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf(name + '(', i)) >= 0) {
    // Deklarationen überspringen
    const davor = src.slice(Math.max(0, i - 24), i);
    if (/\b(async\s+)?function\s*$|\basync\s+$/.test(davor)) { i += name.length; continue; }
    let tiefe = 0, j = src.indexOf('(', i);
    const start = j;
    for (; j < src.length; j++) {
      if (src[j] === '(') tiefe++;
      else if (src[j] === ')') { tiefe--; if (tiefe === 0) break; }
    }
    out.push({ pos: i, arg: src.slice(start + 1, j) });
    i = j > i ? j : i + name.length;
  }
  return out;
}

function zeileVon(src, pos) {
  return src.slice(0, pos).split('\n').length;
}

const fehler = [];
for (const datei of fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js')).sort()) {
  if (AUSNAHMEN.has(datei)) continue;
  const roh = fs.readFileSync(path.join(EFFEKTE, datei), 'utf8');
  const src = stripKommentare(roh);

  for (const { pos, arg } of aufrufe(src, 'actionAddBuff')) {
    // Kurzschreibweise (`sourceOwner,`) zählt genauso wie `sourceOwner: x`.
    if (!/\bsourceOwner\s*[:,}]/.test(arg)) {
      fehler.push(`  ✗ ${datei}:${zeileVon(src, pos)}  actionAddBuff ohne \`sourceOwner\``);
    }
  }
  for (const { pos, arg } of aufrufe(src, 'addHeroStatus')) {
    if (!/\b(appliedBy|sourceOwner)\s*[:,}]/.test(arg) && !/\.\.\.\s*\w*[Oo]pts/.test(arg)) {
      fehler.push(`  ✗ ${datei}:${zeileVon(src, pos)}  addHeroStatus ohne \`appliedBy\`/\`sourceOwner\``);
    }
  }
}

// ── HINWEIS-TEIL: noch nicht eingeordnete Such-Karten (v1072) ──────
// Al 14.9.: „Stelle sicher, dass diese 14 Karten automatisch eingeordnet
// werden, sobald sie ihr Skript bekommen."
//
// Die Einordnung selbst passiert automatisch im Loader — aber nur, wenn
// die neue Karte die Standard-Wege benutzt. Dieser Block macht sichtbar,
// wo Kartentext und Erkennung auseinandergehen: er listet Karten, deren
// TEXT eine Suche bzw. ein Hand-Add verspricht, die aber KEINE der
// beiden Such-Flaggen tragen. Wer eine der offenen Karten neu schreibt,
// sieht hier sofort, ob sie angekommen ist.
//
// Bewusst nur ein Hinweis, kein Fehler: es gibt legitime Faelle (Side
// Deck, Add aufs Brett statt auf die Hand, Kosten-vs-Ertrag).
(() => {
  const KARTEN = path.join(__dirname, '..', 'data', 'cards.json');
  const { loadCardEffect } = require(path.join(EFFEKTE, '_loader.js'));
  let karten;
  try { karten = JSON.parse(fs.readFileSync(KARTEN, 'utf8')); } catch { return; }
  const sucht = /(add (it|them|that card|a copy)[^.]{0,40}to your hand|search your deck)/i;
  const offen = [];
  for (const c of karten) {
    if (!['Artifact', 'Spell', 'Potion'].includes(c.cardType)) continue;
    if (!sucht.test((c.effect || '').replace(/\n/g, ' '))) continue;
    let mod = null;
    try { mod = loadCardEffect(c.name); } catch { continue; }
    if (!mod) continue;                       // noch kein Skript — nichts zu melden
    if (mod.blockedBySearchLock || mod.blockedBySearchLockDiscard) continue;
    offen.push(c.name);
  }
  if (offen.length === 0) return;
  console.log(`[check-effect-source] Hinweis — ${offen.length} Karte(n) mit Such-Text, aber ohne Such-Sperr-Flagge:`);
  console.log('  ' + offen.join(', '));
  console.log('  (kein Fehler: Side Deck, Add aufs Brett oder Kosten-statt-Ertrag sind legitime Gruende)');
})();

if (fehler.length === 0) {
  console.log('[check-effect-source] OK — jeder Helden-Buff und -Status nennt seine Quelle.');
  process.exit(0);
}
console.log(`[check-effect-source] ${fehler.length} Stelle(n) ohne Quelle:\n`);
console.log(fehler.join('\n'));
console.log('\n  Grund: Effekte wie „The Stormblade" und „Charm of Balance" reagieren auf');
console.log('  „affected by an OPPONENT\'s card or effect" und brauchen die Seite.');
console.log('  `source: \'Kartenname\'` genügt nicht — daraus folgt keine Seite.\n');
process.exit(1);
