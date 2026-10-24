// ════════════════════════════════════════════════════════════════
//  WÄCHTER: ABILITY-SKRIPTE LESEN IHREN STAPEL ÜBER DIE ENGINE
//
//  Eine Ability liegt in einer ECHTEN Ability Zone (`ps.abilityZones`) — oder, bei Xal / Xalibur / einem
//  gewonnenen Xal-Effekt, in einer SUPPORT Zone (`ps.supportZones`, Instanz mit `zone: 'support'`). Beide
//  sollen für das Skript gleich aussehen (CARD_API.md → „Abilities in Support Zonen: Hook-Vertrag").
//
//  Ein Ability-Skript, das den Stapel seiner Instanz selbst aus `ps.abilityZones[…][card.zoneSlot]` liest oder
//  seine Geschwister mit `c.zone === 'ability'` sucht, sieht eine Support-Ability NICHT: die Stufe wäre 0, der
//  Anlege-Bonus bliebe aus (Fighting in Xals Support Zone gab 0 ATK, bis dieser Wächter und die Engine-Helfer kamen).
//
//  RICHTIG ist:
//    engine.abilityStapelVon(inst)                 der Namen-Stapel der Instanz (Stufe = Länge)
//    engine.abilityStapelListe(seite, heroIdx)     alle Stapel eines Helden (echte Zonen + Support-Stapel)
//    engine.abilityStapelEintrag(seite, hi, name)  der Stapel einer Ability → { art, slot, namen }
//    engine.istWirksameAbility(inst)               statt `inst.zone === 'ability'`
//    ability_activated / ability_block_flash       mit `zoneKind: eintrag.art`
//
//  GEPRÜFT WIRD: Skripte von Karten mit Kartentyp Ability (Code ohne Kommentare):
//    (1) `abilityZones[…][… zoneSlot]` — der Stapel einer Instanz über ihren Slot,
//    (2) `zone === 'ability'` / `zone !== 'ability'` auf einer Instanz.
//  Absichtliche Ausnahmen (z. B. nur echte Zonen gemeint) tragen in derselben Zeile den Vermerk `ability-stapel-ok`.
//
//  Aufruf:  node scripts/check-ability-stapel.js
//  Rückgabe 0 = sauber, 1 = mindestens ein Verdachtsfall.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = require(path.join(EFFEKTE, '_card-db')).getCardDB();

const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Kommentare raus — geprüft wird nur CODE (Zeilenstruktur bleibt erhalten). */
function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^(\s*)\/\/.*$/gm, '$1')
    .replace(/([^:'"`])\/\/(?!.*ability-stapel-ok).*$/gm, '$1');
}

const STAPEL_UEBER_SLOT = /abilityZones[^;\n]*\[\s*[\w.$?]*zoneSlot\s*\]/;
const ZONEN_VERGLEICH = /\bzone\s*(?:===|!==)\s*['"]ability['"]/;

const verdacht = [];
for (const [name, karte] of Object.entries(KARTEN)) {
  if (karte.cardType !== 'Ability') continue;
  const datei = slug(name) + '.js';
  const voll = path.join(EFFEKTE, datei);
  if (!fs.existsSync(voll)) continue;
  const roh = fs.readFileSync(voll, 'utf8');
  const code = ohneKommentare(roh).split('\n');
  const rohZeilen = roh.split('\n');
  for (let i = 0; i < code.length; i++) {
    if (/ability-stapel-ok/.test(rohZeilen[i])) continue;
    if (STAPEL_UEBER_SLOT.test(code[i])) verdacht.push({ datei, zeile: i + 1, art: 'abilityZones[…zoneSlot]', text: rohZeilen[i].trim() });
    else if (ZONEN_VERGLEICH.test(code[i])) verdacht.push({ datei, zeile: i + 1, art: "zone === 'ability'", text: rohZeilen[i].trim() });
  }
}

if (verdacht.length === 0) {
  console.log('[check-ability-stapel] OK — alle Ability-Skripte lesen ihren Stapel über die Engine-Helfer.');
  process.exit(0);
}
console.log(`[check-ability-stapel] ${verdacht.length} Verdachtsfall/-fälle:\n`);
for (const v of verdacht) console.log(`  ${v.datei}:${v.zeile}  [${v.art}]  ${v.text.slice(0, 140)}`);
console.log('\n  → engine.abilityStapelVon / abilityStapelListe / abilityStapelEintrag / istWirksameAbility (siehe CARD_API.md, „Abilities in Support Zonen").');
process.exit(1);
