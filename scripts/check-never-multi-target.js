'use strict';
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: „can never hit more than 1 target" BRAUCHT `neverMultiTarget: true`  (W75b, Al)
//
//  „Unbedingt Flag setzen, Bartas darf damit nicht 2 Ziele treffen!" (Eraser Beam)
//
//  Spells und Attacks, deren KARTENTEXT ausdrücklich sagt, dass sie nie mehr als 1 Ziel treffen/betreffen
//  („This Spell can never hit more than 1 target.", „… can never affect more than 1 target", „… at once/at a time"),
//  tragen am Skript `neverMultiTarget: true`. Das Merkmal liest Bomb Berserker Bartas (kein Zweitwurf-Angebot) und der Loader
//  (keine automatische Flächenkarten-Erkennung). Der Text ist das Orakel, das unabhängig vom Code ist.
//
//  Gemeldet wird jede Karte MIT Skript, deren Text die Wendung enthält und die das Merkmal nicht trägt.
//  Karten ohne Skript (noch nicht umgesetzt) werden nur aufgelistet — sie bekommen das Merkmal mit ihrem Skript.
//  (Helden-Texte wie Ida/Toras/Kohta stehen als Held-Flags `forcesSingleTarget`/`singleTargetAttack` im Heldenskript, nicht hier.)
//
//  Aufruf:  node scripts/check-never-multi-target.js          Exit 1 = mindestens eine Karte ohne Merkmal
//  Als Modul: require('./check-never-multi-target').pruefe({ karten, ladeModul })
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// „never … more than 1 target"  |  „only … hit/affect/choose … 1 target"
const TEXT_MUSTER = [
  /\bnever\b[^.]{0,60}\bmore than (?:1|one) target\b/i,
  /\bonly\b[^.]{0,40}\b(?:hit|affect|choose)\b[^.]{0,30}\b(?:1|one) target\b/i,
];

function hatWendung(effekt) {
  const t = String(effekt || '').replace(/\s+/g, ' ');
  return TEXT_MUSTER.some(r => r.test(t));
}

function dateiFuer(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.js';
}

function ladeModulStandard(name) {
  const datei = path.join(ROOT, 'cards', 'effects', dateiFuer(name));
  if (!fs.existsSync(datei)) return undefined;   // kein Skript
  try { return require(datei); } catch { return undefined; }
}

/**
 * @param {{ karten: object[], ladeModul?: (name:string)=>object|undefined }} o
 * @returns {{ fehlend: string[], ohneSkript: string[], gepruefte: string[] }}
 */
function pruefe({ karten, ladeModul = ladeModulStandard }) {
  const fehlend = [], ohneSkript = [], gepruefte = [];
  for (const c of karten) {
    const name = c.name || c.cardName;
    if (!name || (c.cardType !== 'Spell' && c.cardType !== 'Attack')) continue;
    if (!hatWendung(c.effect)) continue;
    const mod = ladeModul(name);
    if (mod === undefined) { ohneSkript.push(name); continue; }
    gepruefte.push(name);
    if (!mod || mod.neverMultiTarget !== true) fehlend.push(name);
  }
  return { fehlend: fehlend.sort(), ohneSkript: ohneSkript.sort(), gepruefte: gepruefte.sort() };
}

module.exports = { pruefe, hatWendung, TEXT_MUSTER };

if (require.main === module) {
  const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
  const karten = Array.isArray(db) ? db : (db.cards || Object.values(db));
  const { fehlend, ohneSkript, gepruefte } = pruefe({ karten });
  if (fehlend.length) {
    console.error('[check-never-multi-target] ✖ Karte(n) mit „can never hit more than 1 target" ohne `neverMultiTarget: true`:');
    for (const n of fehlend) console.error(`   ${n}  (cards/effects/${dateiFuer(n)})`);
    console.error('   → ans Modul:   neverMultiTarget: true,   (Bartas bietet dann keinen Zweitwurf an)');
    process.exit(1);
  }
  console.log(`[check-never-multi-target] ✓ ${gepruefte.length} Karte(n) mit der Wendung tragen das Merkmal`
    + (ohneSkript.length ? ` (ohne Skript, nicht prüfbar: ${ohneSkript.join(', ')})` : '') + '.');
}
