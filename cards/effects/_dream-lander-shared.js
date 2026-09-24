'use strict';
// ═══════════════════════════════════════════
//  Dream Landers — gemeinsame Helfer (v1368)
//
//  Ein Dream Lander ist eine Creature, die einen Helden unter sich tragen
//  kann (`attachableHeroes`, Engine `actionAttachHeroToCreature`, Marke
//  `inst.counters.attachedHero`). Die drei Zauber des Archetyps (Dream
//  Dust, Dream World Switcheroo, Dream World Portal) fragen dieselben
//  Dinge — sie stehen hier an EINER Stelle.
// ═══════════════════════════════════════════

/** Offene Creatures, die `pi` kontrolliert und die einen Helden tragen. */
function traeger(engine, pi) {
  return (engine.cardInstances || []).filter(c =>
    c.zone === 'support' && !c.faceDown
    && (c.controller ?? c.owner) === pi
    && !!c.counters?.attachedHero
    && engine._istKreaturenInstanz?.(c));
}

/** Zielobjekt im Format der Zielwahl (`equip-<seite>-<held>-<platz>`). */
function zielVon(inst) {
  return {
    id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
    type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
    cardName: inst.name, cardInstance: inst,
  };
}

/** Ist dieses gewaehlte Ziel eine Creature, die einen Helden traegt und `pi` gehoert? */
function istTraegerZiel(engine, t, pi) {
  const inst = t?.cardInstance;
  if (!inst || inst.zone !== 'support') return false;
  if ((inst.controller ?? inst.owner) !== pi) return false;
  return !!inst.counters?.attachedHero;
}

/**
 * Creatures von `pi`, die JETZT einen Helden anlegen koennten: Skript nennt
 * `attachableHeroes`, noch keiner angelegt, und mindestens einer der
 * passenden Helden liegt in Hand oder Deck.
 */
function portalKandidaten(engine, pi, loadCardEffect) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (const c of (engine.cardInstances || [])) {
    if (c.zone !== 'support' || c.faceDown) continue;
    if ((c.controller ?? c.owner) !== pi) continue;
    if (c.counters?.attachedHero) continue;
    const helden = loadCardEffect(c.name)?.attachableHeroes;
    if (!Array.isArray(helden) || helden.length === 0) continue;
    const verfuegbar = helden.filter(h => (ps?.hand || []).includes(h) || (ps?.mainDeck || []).includes(h));
    if (verfuegbar.length === 0) continue;
    out.push({ inst: c, helden: verfuegbar });
  }
  return out;
}

/** Ist die Quelle eine Attack- oder Spell-KARTE? */
function istAttackOderSpell(engine, quelle, hasCardType) {
  const name = quelle?.name || quelle?.cardName;
  const cd = quelle?.cardInstance
    ? (engine.getEffectiveCardData?.(quelle.cardInstance) || engine._getCardDB()[name])
    : engine._getCardDB()[name];
  return !!cd && (hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell'));
}

module.exports = { traeger, zielVon, istTraegerZiel, portalKandidaten, istAttackOderSpell };
