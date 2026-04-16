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

const { harpyformerInherentAction } = require('./_harpyformer-shared');

const CARD_NAME    = 'Ballad Harpyformer';
const ABILITY_NAME = 'Support Magic';

module.exports = {
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

    // Confirm discard
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: [{ name: ABILITY_NAME, source: 'hand' }],
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to heal a friendly target by 100 HP.`,
      confirmLabel: '💚 Discard & Heal',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!result || result.cancelled) return false;

    const idx = ps.hand.indexOf(ABILITY_NAME);
    if (idx < 0) return false;
    ps.hand.splice(idx, 1);
    ps.discardPile.push(ABILITY_NAME);
    engine.log('ballad_discard', { player: ps.username, card: ABILITY_NAME });
    engine.sync();

    // Prompt for a friendly target (hero or creature)
    const target = await ctx.promptDamageTarget({
      side: 'own',
      types: ['hero', 'creature'],
      damageType: null,
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
