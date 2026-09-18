'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — AoE-ERKENNBARKEIT (v1186, Als Regel 18.9.)
//
//  „Alle künftigen AoE-Karten, inklusive solchen, die keinen Schaden
//   verursachen (z.B. Poisoned Well), sind immer als AoE gecodet,
//   damit sie als solche erkannt werden."
//
//  ── DAS LOCH ─────────────────────────────────────────────────────
//  Die Autoerkennung des Loaders (`detectMultiHit`) hängt an der
//  SCHADENSKLAMMER: `aoeHit(`, `beginMultiHit(`, `beginAoeStrike(`.
//  Eine Karte, die stattdessen Gift, Burn, Frozen, Negation oder
//  einen Buff auf alle gegnerischen Ziele legt, teilt keinen Schaden
//  aus — und war deshalb für Engine wie CPU-Pilot keine AoE-Karte.
//  Poisoned Well ist der Musterfall.
//
//  ── DIE LÖSUNG ───────────────────────────────────────────────────
//  Solche Karten deklarieren `hitsMultipleTargets: true` VON HAND am
//  Modul; der Loader lässt eine manuelle Angabe schon immer gewinnen.
//  Und dieser Wächter prüft es nach — mit dem KARTENTEXT als Orakel:
//  was in `data/cards.json` „all targets / all Heroes / all Creatures
//  … you(r opponent) control(s)" o.ä. sagt, MUSS als AoE erkennbar
//  sein.
//
//  Der Text ist das einzige Orakel, das unabhängig vom Code ist —
//  eine Prüfung „Skript legt Status in einer Schleife an" würde genau
//  die Karten übersehen, die ihre Schleife anders schreiben.
//
//  ── RATCHET ──────────────────────────────────────────────────────
//  Der Altbestand ist groß und wurde von Al ausdrücklich nicht als
//  Bedingung gesetzt („Probleme dürfen im Lauf der Zeit auffallen").
//  `aoe-text-baseline.json` hält deshalb die bekannten Fälle; gemeldet
//  wird nur, was NEU dazukommt. Jede aufgeräumte Karte verschwindet
//  aus der Baseline (`--update`), und der Stand kann nie wieder
//  steigen.
//
//  Aufruf:
//    node scripts/check-aoe-text.js            Ratchet prüfen (Exit 1 bei Verstoß)
//    node scripts/check-aoe-text.js --all      alle offenen Altfälle listen
//    node scripts/check-aoe-text.js --update   Baseline auf den Ist-Stand setzen
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EFFEKTE = path.join(ROOT, 'cards', 'effects');
const KARTEN = path.join(ROOT, 'data', 'cards.json');
const BASELINE = path.join(__dirname, 'aoe-text-baseline.json');

const args = process.argv.slice(2);
const zeigeAlle = args.includes('--all');
const update = args.includes('--update');

// ── Das Textorakel ────────────────────────────────────────────────
// Bewusst eng: nur Formulierungen, die eine GANZE Gruppe meinen.
// „up to 3 targets" ist zwar auch AoE, hängt aber an der Zielwahl und
// wird über die Schadensklammer erfasst (check-aoe-window).
const AoE_TEXT = [
  /\ball (?:other )?targets\b/i,
  /\ball (?:other )?Heroes\b/i,
  /\ball (?:other )?Creatures\b/i,
  /\bevery (?:other )?target\b/i,
  /\bevery (?:other )?Hero\b/i,
  /\bevery (?:other )?Creature\b/i,
  /\beach (?:of your |of the )?(?:opponent's )?(?:targets|Heroes|Creatures)\b/i,
];
// Was NICHT zählt: Text, der nur eine Menge BESCHREIBT statt sie zu
// treffen („look at all Creatures", „all Creatures you control gain"
// ist dagegen sehr wohl AoE — Buffs zählen mit).
const KEIN_TREFFER = [
  /\ball (?:other )?(?:Heroes|Creatures|targets)[^.]{0,40}\bin (?:your|their|any) (?:deck|discard pile|hand)\b/i,
];

function istAoeText(effekt) {
  const t = String(effekt || '');
  if (!t) return false;
  if (KEIN_TREFFER.some(r => r.test(t))) return false;
  return AoE_TEXT.some(r => r.test(t));
}

function dateiFuer(name) {
  return String(name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '.js';
}

// ── Ist-Stand ─────────────────────────────────────────────────────
const db = JSON.parse(fs.readFileSync(KARTEN, 'utf8'));
const karten = Array.isArray(db) ? db : (db.cards || Object.values(db));

const offen = [];
for (const c of karten) {
  const name = c.name || c.cardName;
  if (!name || !istAoeText(c.effect)) continue;
  const datei = path.join(EFFEKTE, dateiFuer(name));
  if (!fs.existsSync(datei)) continue;          // Karte ohne Skript — nichts zu erkennen
  let mod = null;
  try { mod = require(datei); } catch { continue; }
  if (mod && Object.prototype.hasOwnProperty.call(mod, 'hitsMultipleTargets')) continue;
  if (mod && mod.neverMultiTarget === true) continue;   // Kartentext schliesst Mehrfachziele aus
  const src = fs.readFileSync(datei, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  // Die Schadensklammern erkennt der Loader selbst — dann ist die
  // Karte bereits AoE und braucht keine Handdeklaration.
  if (/aoeHit\(/i.test(src) || /\bbeginMultiHit\(|\bbeginAoeStrike\(/.test(src)) continue;
  offen.push(name);
}
offen.sort();

if (update) {
  fs.writeFileSync(BASELINE, JSON.stringify(offen, null, 2) + '\n', 'utf8');
  console.log(`[check-aoe-text] Baseline gesetzt: ${offen.length} Altfall/Altfälle.`);
  process.exit(0);
}

let baseline = [];
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { /* keine Baseline */ }
const bekannt = new Set(baseline);
const neu = offen.filter(n => !bekannt.has(n));
const erledigt = baseline.filter(n => !offen.includes(n));

if (zeigeAlle) {
  console.log(`── offene Altfälle (${offen.length}) ──`);
  for (const n of offen) console.log(`  ${n}`);
}

if (neu.length) {
  console.error('[check-aoe-text] ✖ AoE-Karte(n) ohne AoE-Kennzeichnung:');
  for (const n of neu) console.error(`   ${n}  (cards/effects/${dateiFuer(n)})`);
  console.error('   → Trifft die Karte 2+ Ziele in EINEM Schlag, aber ohne Schaden');
  console.error('     (Status, Buff, Negation …), gehört ans Modul:');
  console.error('         hitsMultipleTargets: true,');
  console.error('   → Kann sie per Kartentext nie mehr als 1 Ziel treffen:');
  console.error('         neverMultiTarget: true,');
  console.error('   → Teilt sie Flächenschaden aus, gehört sie in eine Klammer');
  console.error('     (siehe check-aoe-window / CARD_API „ANTI-AoE MUSS REAGIEREN KÖNNEN").');
  process.exit(1);
}

if (erledigt.length) {
  console.log(`[check-aoe-text] ✓ keine neuen Fälle. ${erledigt.length} Altfall/Altfälle `
    + `inzwischen gekennzeichnet — bitte \`--update\` laufen lassen:`);
  for (const n of erledigt) console.log(`   ${n}`);
} else {
  console.log(`[check-aoe-text] ✓ keine neuen Fälle (${offen.length} bekannte Altfälle in der Baseline).`);
}
process.exit(0);
