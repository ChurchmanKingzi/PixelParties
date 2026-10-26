'use strict';
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: Mehrfachtreffer-Spells rechnen ihre Schlagzahl über `zweitwurfSchlaege`  (W77b, Al 26.10.2026)
//
//  „Ein Spell, der dasselbe Ziel – und NUR dieses – mehrfach trifft, kann Bartas auslösen. Der zweite Treffer soll nur EINMAL einschlagen!"
//
//  Zusatzziel-Helden (Bartas, Grisgar, Andras; `_second-target-shared.js`) lassen den Zweitwurf auf das zweite Ziel genau EINMAL treffen.
//  Spells/Attacks, deren KARTENTEXT dasselbe Ziel mehrfach trifft („deal 50 damage to it as many times as …", „N times", „Trigger this effect as many times as …",
//  „twice"), müssen ihre Schlagzahl daher über `zweitwurfSchlaege(gs, n)` rechnen (im Zweitwurf = 1), sonst schlägt der Zweitwurf „gleich oft" zu (W76a-Altverhalten).
//
//  Geprüft: Normal-Spells der Schulen Destruction/Decay Magic und Normal-Attacks (die Karten, die ein Zusatzziel-Held erreicht), MIT Skript. Der Text ist das Orakel;
//  Multiplikatoren („damage equal to 70 times the number …", „twice the attacker's Attack stat") sind kein Mehrfachtreffer.
//
//  Aufruf:  node scripts/check-zweitwurf-schlaege.js          Exit 1 = ein Mehrfachtreffer-Spell ohne `zweitwurfSchlaege`
//  Als Modul: require('./check-zweitwurf-schlaege').pruefe({ karten, ladeQuelle })
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCHULEN = ['Destruction Magic', 'Decay Magic'];

/** Multiplikator-Wendungen herausnehmen, dann nach „so oft wie …" suchen. */
function trifftMehrfach(effekt) {
  const t = String(effekt || '').replace(/\s+/g, ' ')
    .replace(/\b(?:\d+|two|three|four|five|twice|thrice)? ?times (?:the|its|their|that|this|his|her|your|an?|each)\b/gi, ' ')
    .replace(/\b(?:twice|thrice) (?:the|as much|its|their|that|this)\b/gi, ' ');
  return /\bas many times as\b/i.test(t) || /\bTrigger this effect\b/i.test(t) || /\b(?:\d+|two|three|four|five) times\b/i.test(t) || /\b(?:twice|thrice)\b/i.test(t);
}

function dateiFuer(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.js';
}
function ladeQuelleStandard(name) {
  const datei = path.join(ROOT, 'cards', 'effects', dateiFuer(name));
  return fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : undefined;
}

/** @returns {{ fehlend: string[], gepruefte: string[], ohneSkript: string[] }} */
function pruefe({ karten, ladeQuelle = ladeQuelleStandard }) {
  const fehlend = [], gepruefte = [], ohneSkript = [];
  for (const c of karten) {
    if (c.cardType !== 'Spell' && c.cardType !== 'Attack') continue;
    if (String(c.subtype || '').toLowerCase() !== 'normal') continue;
    if (c.cardType === 'Spell' && !SCHULEN.includes(c.spellSchool1) && !SCHULEN.includes(c.spellSchool2)) continue;
    if (!trifftMehrfach(c.effect)) continue;
    const quelle = ladeQuelle(c.name);
    if (quelle === undefined) { ohneSkript.push(c.name); continue; }
    gepruefte.push(c.name);
    if (!/\bzweitwurfSchlaege\s*\(/.test(quelle)) fehlend.push(c.name);
  }
  return { fehlend: fehlend.sort(), gepruefte: gepruefte.sort(), ohneSkript: ohneSkript.sort() };
}

module.exports = { pruefe, trifftMehrfach };

if (require.main === module) {
  const karten = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
  const r = pruefe({ karten });
  if (r.ohneSkript.length) console.log(`[check-zweitwurf-schlaege] ohne Skript (bekommen es mit ihrem Skript): ${r.ohneSkript.join(', ')}`);
  if (r.fehlend.length) {
    console.error(`[check-zweitwurf-schlaege] ${r.fehlend.length} Mehrfachtreffer-Spell(s) ohne \`zweitwurfSchlaege(\`:`);
    for (const n of r.fehlend) console.error('  ✗ ' + n);
    process.exit(1);
  }
  console.log(`[check-zweitwurf-schlaege] sauber — ${r.gepruefte.length} Mehrfachtreffer-Spells geprüft (${r.gepruefte.join(', ')}).`);
}
