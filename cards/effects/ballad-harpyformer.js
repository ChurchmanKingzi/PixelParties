// ═══════════════════════════════════════════
//  CARD EFFECT: "Ballad Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for a
//    "Support Magic" Ability, reveal and
//    add it to hand.
//  ③ Once per turn: discard a Support Magic
//    Ability from hand to heal a friendly
//    target by 100 HP.
// ═══════════════════════════════════════════

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');

const CARD_NAME    = 'Ballad Harpyformer';
const ABILITY_NAME = 'Support Magic';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: harpyformerInherentAction,

  // ── On summon: search deck for Support Magic ──────────────────────────────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return;

      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Search your deck for a "${ABILITY_NAME}" Ability and add it to your hand?`,
      });
      if (!confirm) return;

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── Once-per-turn creature effect: heal 100 to a friendly target ──────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;

    // Discard cost: in-hand click selection (ineligible cards dim,
    // copies of the named Ability highlight). Cancellable — bailing
    // here returns false so HOPT isn't stamped.
    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to heal a friendly target by 100 HP.`,
      source: CARD_NAME,
      logType: 'ballad_discard',
    });
    if (!ok) return false;
    engine.sync();

    // Prompt for a friendly target (hero or creature)
    const target = await ctx.promptDamageTarget({
      side: 'own',
      types: ['hero', 'creature'],
      damageType: null,
      dealsDamage: false, // heal only — no damage; don't wake damage-mitigation Reactions (Spectral Armor)
      title: CARD_NAME,
      description: 'Choose a friendly target to heal 100 HP.',
      confirmLabel: '💚 Heal 100',
      confirmClass: 'btn-success',
      cancellable: false, // Support Magic already discarded
    });
    if (!target) return true;

    const tgtOwner   = target.owner;
    const tgtHeroIdx = target.heroIdx;
    const tgtSlot    = target.type === 'hero' ? -1 : target.slotIdx;

    engine._broadcastEvent('play_zone_animation', {
      type: 'heal_sparkle', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
    });
    await engine._delay(400);

    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.healHero(tgtHero, 100);
      }
    } else if (target.cardInstance) {
      await engine.actionHealCreature(ctx.card, target.cardInstance, 100);
    }

    engine.log('ballad_heal', { player: ps.username, target: target.cardName });
    engine.sync();
    return true;
  },
};
