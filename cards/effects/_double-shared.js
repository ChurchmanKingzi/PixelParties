'use strict';
// ═══════════════════════════════════════════
//  GETEILT: „Double Spell" / „Double Creature" (v1307)
//
//  Standard-Termini (Al 23.9.): ein Spell bzw. eine Creature mit ZWEI
//  Spell Schools — beide Schulfelder der Karte belegt (Ruling 1).
//  Genutzt vom Klassenzimmer-Batch: Albrecht, Crum, Ellie, Lord Mithuru,
//  Maho, Tobi. Dazu die zwei Bausteine, die mehrere davon brauchen:
//    • `kontrolliert` — fuer „You can only control 1 …" (`beforeSummon`);
//    • `sofortAusHandBeschwoeren` (seit v1344 in `_summon-eligibility.js`,
//      hier weitergereicht) — „summon this Creature from your hand
//      as an additional Action": eine GANZ NORMALE Beschwoerung (Als
//      Ruling 8.8.), also tauglicher Caster Pflicht (`_summon-eligibility`),
//      Zone waehlbar, Entnahme ueber die Stapel-Schicht.
// ═══════════════════════════════════════════
// v1344: der Sofort-Beschwoerungshelfer lebt jetzt im allgemeinen
// Beschwoerungsmodul; hier nur weitergereicht (Albrecht, Ellie).
const { sofortAusHandBeschwoeren } = require('./_summon-eligibility');

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

module.exports = { istDoppel, istDoppelSpell, istDoppelKreatur, doppelSpellName, kontrolliert, sofortAusHandBeschwoeren };
