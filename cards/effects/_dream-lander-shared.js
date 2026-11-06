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

/** Ist die Quelle eine Attack- oder Spell-KARTE — oder ein Effekt, der als Attack/Spell ZÄHLT (W30a, Al 21.10.2026: Broghan & Co., Alice, Gegenstandseffekte, Greatmaw-Treffer; `damageType` des Fensters nötig)? */
function istAttackOderSpell(engine, quelle, hasCardType, damageType) {
  const name = quelle?.name || quelle?.cardName;
  const cd = quelle?.cardInstance
    ? (engine.getEffectiveCardData?.(quelle.cardInstance) || engine._getCardDB()[name])
    : engine._getCardDB()[name];
  if (cd && (hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell'))) return true;
  return !!name && damageType != null && typeof engine._heldenEffektStufe === 'function' && engine._heldenEffektStufe(name, damageType, quelle) != null;
}

/**
 * `onCardLeaveZone` eines Dream Landers: verlaesst er das Brett OHNE Schadens-Tod
 * (Zerstoerung per Effekt, Opfer, Zurueckmischen, auf die Hand), folgt der
 * angelegte Held in die Ablage des urspruenglichen Besitzers (Engine-Vertrag
 * `actionAttachHeroToCreature`). Sonst verschwaende er aus dem Spiel (A07-05).
 * Der Schadens-Tod feuert den Hook ohne `toZone` und raeumt in der Engine
 * selbst auf — dort tut dieser Helfer nichts (kein Doppeleintrag).
 */
function heldFolgtAbgang(ctx) {
  const inst = ctx.card;
  if (!inst || ctx.leavingCard?.id !== inst.id) return;
  if (ctx.fromZone !== 'support' || ctx.toZone == null || ctx.toZone === 'support') return;
  const held = inst.counters?.attachedHero;
  if (!held) return;
  const engine = ctx._engine;
  const ps = engine.gs.players[inst.counters.attachedHeroOwner] || engine.gs.players[inst.originalOwner ?? inst.owner];   // W64c: Besitzer der Helden-Karte
  if (!ps) return;
  if (!ps.discardPile) ps.discardPile = [];
  ps.discardPile.push(held);
  delete inst.counters.attachedHero;
  engine.log('attached_hero_discarded', { hero: held, creature: inst.name, player: ps.username });
}

module.exports = { traeger, zielVon, istTraegerZiel, portalKandidaten, istAttackOderSpell, heldFolgtAbgang };
