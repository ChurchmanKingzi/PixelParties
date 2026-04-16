// ═══════════════════════════════════════════
//  Shared helpers for the Arthor archetype.
//  Ascension requires BOTH "Legendary Sword of
//  a Barbarian King" AND "Summoning Circle"
//  equipped on "Arthor, the King of Blackport".
// ═══════════════════════════════════════════

const BASE_ARTHOR   = 'Arthor, the King of Blackport';
const ASCEND_TARGET = 'Arthor, Inheritor of the Barbarian Sword';
const SWORD_NAME    = 'Legendary Sword of a Barbarian King';
const CIRCLE_NAME   = 'Summoning Circle';

/**
 * Re-evaluate whether Arthor's ascension is ready.
 * Called by both equip scripts on play and on removal.
 *
 * @param {object} engine
 * @param {number} pi        - Player index
 * @param {number} heroIdx   - Hero column index
 * @param {string} [excludeInstId] - Card instance ID to ignore
 *   (pass ctx.card.id from onCardLeaveZone so the departing card
 *    is not counted while it is still in cardInstances)
 */
function checkArthorAscension(engine, pi, heroIdx, excludeInstId) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero || hero.name !== BASE_ARTHOR) return;

  const hasSword = engine.cardInstances.some(c =>
    c.id !== excludeInstId &&
    c.owner === pi && c.zone === 'support' &&
    c.heroIdx === heroIdx && c.name === SWORD_NAME,
  );
  const hasCircle = engine.cardInstances.some(c =>
    c.id !== excludeInstId &&
    c.owner === pi && c.zone === 'support' &&
    c.heroIdx === heroIdx && c.name === CIRCLE_NAME,
  );

  if (hasSword && hasCircle) {
    hero.ascensionReady  = true;
    hero.ascensionTarget = ASCEND_TARGET;
  } else {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
  }
}

module.exports = { checkArthorAscension, BASE_ARTHOR, ASCEND_TARGET, SWORD_NAME, CIRCLE_NAME };
