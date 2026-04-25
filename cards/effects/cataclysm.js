// ═══════════════════════════════════════════
//  CARD EFFECT: "Cataclysm"
//  Spell (Destruction Magic Lv3, Normal)
//
//  While ANY Area is in play (own OR opponent's),
//  this Spell's effective level becomes 0.
//
//  On cast: deal 100 destruction-spell damage to
//  EVERY target on the board (heroes + creatures,
//  both sides — including the caster's own side
//  per card text). Then send all Areas on the
//  board to their respective owners' discard
//  piles.
//
//  Animation: a giant orange-red burning meteor
//  crashes from the top-right of the screen into
//  the centre of the battlefield, then radiating
//  flame impacts on every target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Cataclysm';
const DAMAGE    = 100;

module.exports = {
  // Active in 'hand' so the level reduction hook fires while in hand.
  activeIn: ['hand'],

  /**
   * Self-reduction: while ANY Area is in play, drop this card's level
   * from 3 → 0. The engine's `_applyCardLevelReductions` walks every
   * tracked instance the controller owns and sums their hooks, so we
   * only return the rebate when the cardData passed in is THIS card.
   */
  reduceCardLevel(cardData, engine /*, ownerIdx */) {
    if (cardData?.name !== CARD_NAME) return 0;
    const gs = engine?.gs;
    const hasArea = !!(
      (gs?.areaZones?.[0] || []).length > 0 ||
      (gs?.areaZones?.[1] || []).length > 0
    );
    return hasArea ? 3 : 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const cardDB = engine._getCardDB();

      // ── Collect every target on the board (both sides, all heroes + creatures) ──
      const heroTargets = [];
      const creatureTargets = [];
      for (let tpi = 0; tpi < 2; tpi++) {
        const tps = gs.players[tpi];
        if (!tps) continue;
        for (let hi = 0; hi < (tps.heroes || []).length; hi++) {
          const h = tps.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          heroTargets.push({ owner: tpi, heroIdx: hi, hero: h });
        }
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        creatureTargets.push(inst);
      }

      // ── Animation: meteor falls from top-right into centre ──
      // Anchored to the caster's hero element so playAnimation has a
      // valid DOM target — the Cataclysm React component itself ignores
      // the (x,y) position and renders to the full viewport.
      engine._broadcastEvent('play_zone_animation', {
        type: 'cataclysm', owner: pi,
        heroIdx: Math.max(0, heroIdx), zoneSlot: -1,
      });
      // The meteor needs ~1.4s to travel across the screen before impact.
      await engine._delay(1400);

      // Burst flame on every hero target (heroes + creatures)
      for (const ht of heroTargets) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_avalanche', owner: ht.owner,
          heroIdx: ht.heroIdx, zoneSlot: -1,
        });
      }
      for (const inst of creatureTargets) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_avalanche', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
      }
      await engine._delay(450);

      // ── Resolve damage ──
      const source = { name: CARD_NAME, owner: pi, heroIdx };
      // Heroes — sequential dealDamage so afterDamage hooks fire cleanly per target.
      for (const ht of heroTargets) {
        const live = gs.players[ht.owner]?.heroes?.[ht.heroIdx];
        if (!live || live.hp <= 0) continue;
        await ctx.dealDamage(live, DAMAGE, 'destruction_spell');
      }
      // Creatures — batch via dealCreatureDamage. Each call invokes the
      // creature-damage pipeline (immunities, batch hook, post-death cleanup).
      for (const inst of creatureTargets) {
        if (inst.zone !== 'support') continue;
        await engine.actionDealCreatureDamage(
          source, inst, DAMAGE, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true }
        );
      }

      engine.sync();
      await engine._delay(300);

      // ── Wipe every Area on the board ──
      const removed = await engine.removeAllAreas(-2, CARD_NAME);

      engine.log('cataclysm_resolved', {
        player: gs.players[pi]?.username,
        heroes: heroTargets.length,
        creatures: creatureTargets.length,
        areasRemoved: removed,
      });
      engine.sync();
    },
  },
};
