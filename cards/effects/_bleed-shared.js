// ═══════════════════════════════════════════
//  SHARED HANDLER: Bleed (v712)
//
//  Einzige Auslegungsstelle fuer das Anlegen des
//  Bleed-Status durch KARTEN (Devlin, Doctor
//  Fester, Ghoul Guard). Der Status selbst und
//  sein Schaden nach Handlungen liegen in der
//  Engine (`_processBleedAfterAction`,
//  `_processBleedAfterCreatureEffect`, Hook
//  `beforeBleedDamage`) — s. _hooks.js `bleeding`.
//
//  Als Regeln (3./4.9.):
//    • boolescher Status, „for the rest of the
//      game", cleansbar, Immunitaet `bleed_immune`
//    • 50 Schaden NACH jeder eigenen Handlung
//      (Actions inkl. Zusatzaktionen, aktive
//      Heldeneffekte auch ohne Action-Kosten,
//      aktive Creature-Effekte); nicht bei
//      Equipment, place, Surprises, Potions,
//      Ascension
// ═══════════════════════════════════════════

const { hasCardType, ZONES, heroFightingLevel } = require('./_hooks');

/** Ziel-Deskriptor → blutet es? `t`: Zielobjekt aus den Pickern
 *  ({type:'hero', owner, heroIdx} | {type:'equip', cardInstance}). */
function isTargetBleeding(engine, t) {
  if (!t) return false;
  if (t.type === 'hero') return !!engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.statuses?.bleeding;
  const inst = t.cardInstance || t._cardInstance || engine.cardInstances.find(c =>
    (c.controller ?? c.owner) === t.owner && c.zone === ZONES.SUPPORT && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
  return !!inst?.counters?.bleeding;
}

// Status-Erhalt-Animation (v714, Als Vorgabe): Standard = spritzendes Blut
// (`bleed_apply`, laeuft ZUSAETZLICH zur normalen Angriffs-Animation —
// Devlin); Doctor Fester / Ghoul Guard geben `bloody_cut` mit. Helden:
// ueber `animationType` am Status (Client-Status-Diff, Burn-Muster);
// Creatures: direkter Broadcast.
const DEFAULT_BLEED_ANIM = 'bleed_apply';

/** Bleed auf einen Helden legen (permanent). */
async function bleedHero(engine, ownerIdx, heroIdx, sourceName, appliedBy, opts = {}) {
  const hero = engine.gs.players[ownerIdx]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0 || hero.statuses?.bleeding) return false;
  await engine.addHeroStatus(ownerIdx, heroIdx, 'bleeding', {
    permanent: true, appliedBy, source: sourceName, _skipReactionCheck: true,
    animationType: opts.animationType || DEFAULT_BLEED_ANIM,
  });
  return !!hero.statuses?.bleeding;
}

/** Bleed auf eine Support-Instanz legen. */
async function bleedCreature(engine, inst, sourceName, appliedBy, opts = {}) {
  if (!inst || inst.zone !== ZONES.SUPPORT || inst.counters?.bleeding) return false;
  const applied = await engine.applyCreatureStatus(inst, 'bleeding', { sourceOwner: appliedBy, source: sourceName });
  if (applied && inst.counters?.bleeding) {
    engine._broadcastEvent('play_zone_animation', {
      type: opts.animationType || DEFAULT_BLEED_ANIM,
      owner: inst.controller ?? inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    return true;
  }
  return false;
}

/** Bleed auf ein Picker-Ziel legen. */
async function bleedTarget(engine, t, sourceName, appliedBy, opts = {}) {
  if (!t) return false;
  if (t.type === 'hero') return bleedHero(engine, t.owner, t.heroIdx, sourceName, appliedBy, opts);
  const inst = t.cardInstance || t._cardInstance || engine.cardInstances.find(c =>
    (c.controller ?? c.owner) === t.owner && c.zone === ZONES.SUPPORT && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
  return bleedCreature(engine, inst, sourceName, appliedBy, opts);
}

/**
 * Alle Ziele eines Spielers als Picker-Objekte: lebende Helden + offene
 * Support-Instanzen, die wie Creatures waehlbar sind (inkl. Puppets).
 */
function collectPlayerTargets(engine, pi, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
  }
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi || inst.zone !== ZONES.SUPPORT || inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !engine.isChoosableAsCreature(inst, cd)) continue;
    out.push({ id: `equip-${pi}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: pi, heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
  }
  return opts.notBleeding ? out.filter(t => !isTargetBleeding(engine, t)) : out;
}

/** Blutet irgendein Ziel auf dem Brett? */
function anyTargetBleeding(engine) {
  return [0, 1].some(pi => collectPlayerTargets(engine, pi).some(t => isTargetBleeding(engine, t)));
}

// `heroFightingLevel` liegt seit v778 in `_hooks.js` — „wie hoch ist
// Ability X an diesem Helden" ist keine Bleed-Frage. Hier nur noch
// durchgereicht, damit bestehende Aufrufer (Doctor Fester) unveraendert
// bleiben.

module.exports = {
  isTargetBleeding, bleedHero, bleedCreature, bleedTarget,
  collectPlayerTargets, anyTargetBleeding, heroFightingLevel,
};
