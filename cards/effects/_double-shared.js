'use strict';
// ═══════════════════════════════════════════
//  GETEILT: „Double Spell" / „Double Creature" (v1307)
//
//  Standard-Termini (Al 23.9.): ein Spell bzw. eine Creature mit ZWEI
//  Spell Schools — beide Schulfelder der Karte belegt (Ruling 1).
//  Genutzt vom Klassenzimmer-Batch: Albrecht, Crum, Ellie, Lord Mithuru,
//  Maho, Tobi. Dazu die zwei Bausteine, die mehrere davon brauchen:
//    • `kontrolliert` — fuer „You can only control 1 …" (`beforeSummon`);
//    • `sofortAusHandBeschwoeren` — „summon this Creature from your hand
//      as an additional Action": eine GANZ NORMALE Beschwoerung (Als
//      Ruling 8.8.), also tauglicher Caster Pflicht (`_summon-eligibility`),
//      Zone waehlbar, Entnahme ueber die Stapel-Schicht.
// ═══════════════════════════════════════════
const { eligibleSummonZones } = require('./_summon-eligibility');

function istDoppel(cd, typ) {
  if (!cd) return false;
  if (typ && cd.cardType !== typ) return false;
  return !!(cd.spellSchool1 && cd.spellSchool2);
}
const istDoppelSpell = (cd) => istDoppel(cd, 'Spell');
const istDoppelKreatur = (cd) => istDoppel(cd, 'Creature');
const doppelSpellName = (engine, name) => istDoppelSpell(engine._getCardDB()[name]);

/** Kontrolliert `pi` bereits eine offene Kopie von `name` auf dem Brett? */
function kontrolliert(engine, pi, name) {
  return (engine.cardInstances || []).some(c =>
    c.name === name && c.zone === 'support' && !c.faceDown && (c.controller ?? c.owner) === pi);
}

/** @returns {Promise<boolean>} beschworen? Abbruch in der Zonenwahl → false. */
async function sofortAusHandBeschwoeren(engine, pi, name, { source } = {}) {
  const ps = engine.gs.players[pi];
  if (!ps || !(ps.hand || []).includes(name)) return false;
  const zonen = eligibleSummonZones(engine, pi, name);
  if (zonen.length === 0) return false;
  let ziel = zonen[0];
  if (zonen.length > 1) {
    const wahl = await engine.promptGeneric(pi, {
      type: 'zonePick', title: source || name,
      description: `Summon ${name} into which Support Zone?`,
      zones: zonen, cancellable: true,
    });
    if (!wahl || wahl.cancelled) return false;
    ziel = zonen.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx) || null;
    if (!ziel) return false;
  }
  const inst = await engine.summonFromPile(pi, 'hand', name, ziel.heroIdx, ziel.slotIdx, {
    source: source || name, hookExtras: { _isNormalSummon: false },
  });
  return !!inst;
}

module.exports = { istDoppel, istDoppelSpell, istDoppelKreatur, doppelSpellName, kontrolliert, sofortAusHandBeschwoeren };
