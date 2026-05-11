// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Whoolmoth"
//  Creature (Summoning Magic Lv5, 200 HP — Slippery)
//
//  If there is at least one Creature in a Support
//  Zone of EACH of your alive Heroes, this
//  Creature's level in your hand becomes 0.
//
//  At the beginning of each of your turns, slide
//  this Creature into the free Support Zone of an
//  adjacent Hero (if possible).
//
//  When this Creature is moved into a different
//  Hero's Support Zone, choose a target and deal
//  150 damage to it. Animation: a giant wooly
//  mammoth leg with brown fur slams the target —
//  see `mammoth_stomp` in app-board.jsx.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { onSlipperyTurnStart, slipperyOnMoveGate } = require('./_slippery-shared');

const CARD_NAME = 'Slippery Whoolmoth';
const HIT_DAMAGE = 150;

/**
 * True iff every ALIVE Hero of `ownerIdx` has at least one Creature
 * (any owner) in their Support Zones. Dead / missing Hero slots are
 * skipped — they can't logically "have a Creature" in a meaningful
 * sense, and gating on them would otherwise lock the discount
 * permanently after a Hero dies.
 */
function eachAliveHeroHasCreature(engine, ownerIdx) {
  const ps = engine.gs?.players?.[ownerIdx];
  if (!ps) return false;
  const cardDB = engine._getCardDB();
  let anyAlive = false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    anyAlive = true;
    const zones = ps.supportZones?.[hi] || [];
    let hasCreature = false;
    for (const slot of zones) {
      if (!slot || slot.length === 0) continue;
      const cd = cardDB[slot[0]];
      if (cd && hasCardType(cd, 'Creature')) { hasCreature = true; break; }
    }
    if (!hasCreature) return false;
  }
  return anyAlive; // No alive Hero → no discount (defensive).
}

module.exports = {
  // 'hand' for the in-hand level reduction; 'support' for the
  // turn-start auto-slide + on-move damage trigger.
  activeIn: ['hand', 'support'],

  /**
   * In-hand level rebate. Returns 5 (= card's printed Lv5) when every
   * alive own Hero has a Creature in support — collapsing Whoolmoth's
   * level to 0 so any Hero can cast him without a school stack.
   * Returns 0 otherwise (card stays at printed Lv5).
   *
   * Mirrors Crystal Well's pattern: filter by name so other Lv-5
   * cards in the same hand aren't accidentally rebated.
   */
  reduceCardLevel(cardData, engine, ownerIdx) {
    if (cardData?.name !== CARD_NAME) return 0;
    return eachAliveHeroHasCreature(engine, ownerIdx) ? 5 : 0;
  },

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'other',
        baseDamage: HIT_DAMAGE,
        title: CARD_NAME,
        description: `Deal ${HIT_DAMAGE} damage to any target.`,
        confirmLabel: `🐘 Stomp! (${HIT_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!target) return;

      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      // Mammoth-leg stomp animation — sibling of `giant_dino_stomp`,
      // brown fur palette instead of dino scales. See app-board.jsx's
      // `mammoth_stomp` for the renderer.
      engine._broadcastEvent('play_zone_animation', {
        type: 'mammoth_stomp', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(480);

      const source = { name: CARD_NAME, owner: pi, heroIdx };
      if (target.type === 'hero') {
        const h = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (h && h.hp > 0) {
          await engine.actionDealDamage(source, h, HIT_DAMAGE, 'other');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          source, target.cardInstance, HIT_DAMAGE, 'other',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      const ps = engine.gs.players[pi];
      engine.log('slippery_whoolmoth_stomp', {
        player: ps?.username, target: target.cardName, damage: HIT_DAMAGE,
      });
      engine.sync();
    },
  },
};
