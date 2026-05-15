// ═══════════════════════════════════════════
//  SHARED: "Diver Helmet" Area-immunity helpers
//
//  Diver Helmet (Artifact / Equipment): "The
//  equipped Hero and all cards in its Support
//  Zones are unaffected by Areas."
//
//  Diver Helmet is a passive equip — it carries NO
//  active behaviour itself. Instead, EVERY Area
//  card (and the engine, for engine-level Area
//  rules like Stinky Stables) must consult these
//  helpers and skip any Hero / Creature that is
//  protected, so the protected side never feels
//  the Area's effect.
//
//  Equips physically sit as a CardInstance in a
//  Hero's Support Zone (zone 'support', heroIdx =
//  the equipped Hero, owner = that Hero's side).
//  A Creature is protected when the Hero whose
//  Support Zones it occupies has a Diver Helmet.
//
//  See cards/effects/CARD_API.md → "Areas — respect
//  Diver Helmet" for the authoring rule.
// ═══════════════════════════════════════════

const DIVER_HELMET = 'Diver Helmet';

/**
 * Is the Hero at (playerIdx, heroIdx) equipped with a Diver Helmet?
 * Matches on the physical side (owner) AND controller so a
 * control-transferred helmet still protects the Hero it sits on.
 */
function heroHasDiverHelmet(engine, playerIdx, heroIdx) {
  if (!engine || playerIdx == null || playerIdx < 0) return false;
  if (heroIdx == null || heroIdx < 0) return false;
  const insts = engine.cardInstances || [];
  for (const inst of insts) {
    if (!inst || inst.name !== DIVER_HELMET) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (inst.heroIdx !== heroIdx) continue;
    if (inst.owner !== playerIdx && (inst.controller ?? inst.owner) !== playerIdx) continue;
    return true;
  }
  return false;
}

/** Alias — "is this Hero unaffected by Areas?" */
function isAreaImmuneHero(engine, playerIdx, heroIdx) {
  return heroHasDiverHelmet(engine, playerIdx, heroIdx);
}

/**
 * Is this card instance (Creature / equip / anything in a Support
 * Zone) unaffected by Areas — i.e. does the Hero whose Support Zones
 * it sits in carry a Diver Helmet? Uses the instance's PHYSICAL side
 * (owner) because Support Zones are physical; a charmed Creature still
 * sits in its owner's zone.
 */
function isAreaImmuneInst(engine, inst) {
  if (!inst) return false;
  if (inst.heroIdx == null || inst.heroIdx < 0) return false;
  return heroHasDiverHelmet(engine, inst.owner, inst.heroIdx);
}

/**
 * Is this hero OBJECT unaffected by Areas? Resolves the hero's
 * (playerIdx, heroIdx) by reference search, then defers to
 * `heroHasDiverHelmet`. Convenient for engine damage/heal sites that
 * only hold the hero object.
 */
function isAreaImmuneHeroObject(engine, heroObj) {
  if (!heroObj || !engine?.gs?.players) return false;
  for (let pi = 0; pi < engine.gs.players.length; pi++) {
    const heroes = engine.gs.players[pi]?.heroes || [];
    const hi = heroes.indexOf(heroObj);
    if (hi >= 0) return heroHasDiverHelmet(engine, pi, hi);
  }
  return false;
}

module.exports = {
  DIVER_HELMET,
  heroHasDiverHelmet,
  isAreaImmuneHero,
  isAreaImmuneInst,
  isAreaImmuneHeroObject,
};
