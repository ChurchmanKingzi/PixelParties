// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Spinor"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//  HP 200
//
//  ① UNIQUENESS — shared archetype rule.
//
//  ② ACTIVE — Once per turn, discard your entire
//    hand → deal 50 × (cards discarded) damage to
//    a chosen target.
// ═══════════════════════════════════════════

const { gigantisaursCanSummon } = require('./_gigantisaurs-shared');

const CARD_NAME = 'Gigantisaur Spinor';
const PER_CARD_DAMAGE = 50;

module.exports = {
  activeIn: ['support'],
  canSummon: gigantisaursCanSummon,

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    // Effect is meaningless with an empty hand (zero damage).
    return (ps.hand?.length || 0) >= 1;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // Pre-pick the target BEFORE consuming the hand. The caster
    // commits to the activation by choosing a target; cancelling
    // the target prompt refunds the discard cost entirely.
    const handCount = ps.hand.length;
    const damagePreview = PER_CARD_DAMAGE * handCount;
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      title: CARD_NAME,
      description: `Discard your entire hand (${handCount} card${handCount === 1 ? '' : 's'}) and deal ${damagePreview} damage to a target.`,
      confirmLabel: `🦕 Smash! (${damagePreview})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    // Discard the entire hand. Walk left-to-right and use
    // `actionDiscardHandCard` so onDiscard hooks fire normally
    // (Cute Cat self-mill, Skull Necklace damage, etc.). The whole
    // hand-dump runs inside a single `withDiscardBatch` so the per-
    // card on-discard reactors resolve AFTER every card has landed
    // in the pile — multiple Glass of Marbles draws fire after the
    // entire hand is discarded, not interleaved between discards.
    const discarded = await engine.withDiscardBatch(pi, { source: CARD_NAME }, async () => {
      let n = 0;
      while ((ps.hand?.length || 0) > 0) {
        const handIdx = 0;
        const cardName = ps.hand[handIdx];
        const ok = await engine.actionDiscardHandCard(pi, cardName, handIdx, {
          source: CARD_NAME,
        });
        if (!ok) break;
        n++;
      }
      return n;
    });
    if (discarded === 0) return false;

    const damage = PER_CARD_DAMAGE * discarded;
    if (damage <= 0) return false;

    // Brief beat so the multi-discard syncs settle before the impact.
    await engine._delay(200);

    // Dinosaur-bite animation on the target. The client scales jaw
    // size, tooth count, blood splatter, and the "CHOMP!" roar text
    // off the `damage` payload (50 = unassuming, 400 = full-force).
    // The `duration` extends with damage so the giant-jaw retreat
    // still completes before the entry is GC'd.
    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    const animDuration = Math.round(900 + Math.min(damage, 400) / 400 * 700);
    engine._broadcastEvent('play_zone_animation', {
      type: 'dino_bite', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
      damage,
      duration: animDuration,
    });
    // Let the jaws drop in + snap closed before damage numbers pop —
    // the bite-snap frame lands at ~38–46% of the anim, so a 420 ms
    // wait covers a 900-ms baseline and stays just behind the snap on
    // the longer 1600-ms high-damage variant. Keeps the visual impact
    // perfectly aligned with the damage number.
    await engine._delay(420);

    const dmgSource = { name: CARD_NAME, owner: pi, heroIdx };
    if (target.type === 'hero') {
      const h = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (h && h.hp > 0) {
        await engine.actionDealDamage(dmgSource, h, damage, 'other');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        dmgSource, target.cardInstance, damage, 'other',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('spinor_smash', {
      player: ps.username, target: target.cardName,
      discarded, damage,
    });
    engine.sync();
    return true;
  },
};
