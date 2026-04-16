// ═══════════════════════════════════════════
//  CARD EFFECT: "Metal Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for a "Fighting"
//    Ability, reveal and add it to hand.
//  ③ Once per turn: discard a Fighting Ability
//    from hand to deal 50 damage to any target.
// ═══════════════════════════════════════════

const { harpyformerInherentAction } = require('./_harpyformer-shared');

const CARD_NAME    = 'Metal Harpyformer';
const ABILITY_NAME = 'Fighting';

module.exports = {
  inherentAction: harpyformerInherentAction,

  // ── On summon: search deck for Fighting ───────────────────────────────────
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

  // ── Once-per-turn creature effect: deal 50 damage ─────────────────────────
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

    // Confirm discard
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: [{ name: ABILITY_NAME, source: 'hand' }],
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to deal 50 damage to any target.`,
      confirmLabel: '⚔️ Discard & Attack',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!result || result.cancelled) return false;

    const idx = ps.hand.indexOf(ABILITY_NAME);
    if (idx < 0) return false;
    ps.hand.splice(idx, 1);
    ps.discardPile.push(ABILITY_NAME);
    engine.log('metal_discard', { player: ps.username, card: ABILITY_NAME });
    engine.sync();

    // Prompt for target
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      title: CARD_NAME,
      description: 'Deal 50 damage to any target.',
      confirmLabel: '⚔️ 50 Damage!',
      confirmClass: 'btn-danger',
      cancellable: false, // Fighting already discarded
    });
    if (!target) return true;

    const tgtOwner   = target.owner;
    const tgtHeroIdx = target.heroIdx;
    const tgtSlot    = target.type === 'hero' ? -1 : target.slotIdx;

    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
    });
    await engine._delay(400);

    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, 50, 'other');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, 50, 'other',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('metal_strike', { player: ps.username, target: target.cardName });
    engine.sync();
    return true;
  },
};
