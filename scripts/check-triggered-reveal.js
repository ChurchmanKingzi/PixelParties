// ════════════════════════════════════════════════════════════════
//  WÄCHTER: GETRIGGERTE EFFEKTE BRAUCHEN IHREN AUFTRITT
//
//  Als Regel (1.9., verschärft 12.9.):
//
//    „Jeder passive Effekt, der getriggert wird statt 24/7 aktiv zu
//     sein, MUSS das Kartenbild an beide Spieler streamen
//     (Standard-Auftritt links vom Battlefield)."
//
//  Umgesetzt wird das mit `engine.showTriggeredEffect(CARD_NAME)` — in
//  dem Moment, in dem der Effekt WIRKLICH feuert. Nach einem „you may"
//  also erst nach dem Ja, damit ein abgelehnter Trigger nichts zeigt.
//
//  Die EXPLIZITEN Aktivierungspfade (Hero-Effekt, Ability, Creature-
//  Aktiv, Artefakt, Surprise, Potion) sind ausgenommen: dort streamt
//  der Server selbst. Ebenso Dauermodifikatoren (Tempeste −100,
//  Warhorse +50) — die würden bei jedem Treffer blinken.
//
//  Erkennung: ein REAKTIVER Hook, der eine sichtbare Handlung ausführt
//  (zieht, Schaden, Status, Gold, Ablage …), in einer Datei, die
//  `showTriggeredEffect` nirgends erwähnt.
//
//  Ratchet gegen `triggered-reveal-baseline.json`: der Bestand darf
//  stehen bleiben, NEUES nicht. Nach einer Bereinigung `--update`.
//
//  Aufruf:  node scripts/check-triggered-reveal.js
//  Rückgabe 0 = sauber, 1 = mindestens ein NEUER Fall.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const GRUNDLINIE = path.join(__dirname, 'triggered-reveal-baseline.json');

// Reaktive Hooks. Bewusst NICHT dabei: `onPlay`, `resolve`,
// `onHeroEffect`, `onFreeActivate` (Server streamt) und die
// Zonen-Buchführung (`onCardEnterZone`/`onCardLeaveZone`), die meist
// nur Zustand pflegt.
const REAKTIVE_HOOKS = [
  'onDraw', 'onResourceGain', 'onAnyActionResolved', 'onSacrificeBatch',
  'onCreatureSacrificed', 'onHeroKO', 'onCreatureDeath', 'afterDamage',
  'onAttackDeclare', 'onCreatureSummoned', 'onTakeControl', 'onStatusApplied',
];

// Sichtbare Handlung = etwas, das den Spielstand für beide Seiten ändert.
const WIRKUNG = new RegExp('\\b(' + [
  'drawCards', 'actionDrawCards', 'actionDrawFromPotionDeck',
  'actionDealDamage', 'actionDealCreatureDamage', 'actionDefeatHero',
  'actionDestroyCard', 'addHeroStatus', 'applyCreatureStatus',
  'actionGainGold', 'actionPlaceCreature', 'actionDiscardHandCard',
].join('|') + ')\\s*\\(');

// Zweites Signal: der Hook FRAGT. Ein Dauermodifikator fragt nie — wer
// im Reaktionshook eine Abfrage oeffnet, ist definitionsgemaess ein
// ausloesender Effekt. Faengt die Faelle, die nur `modifyAmount` rufen
// (Humby: „you may gain 15 additional Gold") und deshalb an der
// Wirkungsliste vorbeilaufen.
const FRAGT = /\b(promptConfirmEffect|promptDamageTarget|promptEffectTarget|promptGeneric|promptCardGallery|promptZonePick)\s*\(/;

const AUFTRITT = /showTriggeredEffect|announceActiveEffect|armEffectAnnounce/;

function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

/** Rumpf eines Hooks per Klammerzähler (Regex reicht nicht — Objektliterale). */
function hookRumpf(code, name) {
  const m = new RegExp('^\\s*' + name + '\\s*:\\s*(async\\s*)?\\(', 'm').exec(code);
  if (!m) return null;
  let tiefe = 0, start = -1;
  for (let j = m.index; j < code.length; j++) {
    const c = code[j];
    if (c === '{') { tiefe++; if (start < 0) start = j; }
    else if (c === '}') { tiefe--; if (tiefe === 0 && start >= 0) return code.slice(start, j); }
  }
  return null;
}

const funde = [];
let geprueft = 0;

for (const name of fs.readdirSync(EFFEKTE).sort()) {
  if (!name.endsWith('.js') || name.startsWith('_')) continue;
  geprueft++;
  const code = ohneKommentare(fs.readFileSync(path.join(EFFEKTE, name), 'utf8'));
  if (AUFTRITT.test(code)) continue;            // Karte kennt den Auftritt
  for (const h of REAKTIVE_HOOKS) {
    const rumpf = hookRumpf(code, h);
    if (rumpf && (WIRKUNG.test(rumpf) || FRAGT.test(rumpf))) { funde.push({ datei: name, hook: h }); break; }
  }
}

// ── Ratchet ─────────────────────────────────────────────────────────
const jetzt = Object.fromEntries(funde.map(f => [f.datei, f.hook]));

if (process.argv.includes('--update')) {
  fs.writeFileSync(GRUNDLINIE, JSON.stringify(jetzt, null, 2) + '\n', 'utf8');
  console.log(`[check-triggered-reveal] Grundlinie aktualisiert — ${Object.keys(jetzt).length} Datei(en).`);
  process.exit(0);
}

let alt = {};
if (fs.existsSync(GRUNDLINIE)) {
  try { alt = JSON.parse(fs.readFileSync(GRUNDLINIE, 'utf8')); } catch { alt = {}; }
}
const neue = funde.filter(f => !(f.datei in alt));

if (neue.length === 0) {
  const rest = Object.keys(jetzt).length;
  console.log(`[check-triggered-reveal] OK — ${geprueft} Skript(e) geprüft`
    + (rest ? `, ${rest} bekannte Altlast(en).` : ', alle Trigger mit Auftritt.'));
  process.exit(0);
}

console.error(`[check-triggered-reveal] ${neue.length} NEUE(R) Trigger ohne Auftritt:\n`);
for (const f of neue) {
  console.error(`  ✗ ${f.datei}  (${f.hook})`);
}
console.error('\n  Abhilfe: `await engine.showTriggeredEffect(CARD_NAME);` in dem Moment,');
console.error('  in dem der Effekt WIRKLICH feuert (nach einem „you may" erst nach dem Ja).');
console.error('  Dauermodifikator ohne Auslösung? Dann gehört die Datei in die Grundlinie:');
console.error('  `node scripts/check-triggered-reveal.js --update`.\n');
process.exit(1);
