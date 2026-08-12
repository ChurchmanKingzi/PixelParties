// ═══════════════════════════════════════════
//  CARD EFFECT: "Rap Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for a
//    "Decay Magic" Ability, reveal and
//    add it to hand.
//  ③ Once per turn: discard a Decay Magic
//    Ability from hand to Poison any target
//    (1 stack). If the target is already
//    Poisoned, adds 1 more stack instead.
// ═══════════════════════════════════════════

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');

const CARD_NAME    = 'Rap Harpyformer';
const ABILITY_NAME = 'Decay Magic';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: harpyformerInherentAction,

  // ── On summon: search deck for Decay Magic ────────────────────────────────
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

  // ── Once-per-turn creature effect: add 1 Poison stack ────────────────────
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
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    const ps = gs.players[pi];
    if (!ps) return false;

    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to add 1 Poison Stack to any target.`,
      source: CARD_NAME,
      logType: 'rap_discard',
    });
    if (!ok) return false;
    engine.sync();

    // Prompt for any target
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'status',
      dealsDamage: false, // Poison only — no damage; don't wake damage-mitigation Reactions (Spectral Armor)
      title: CARD_NAME,
        // Statusangabe fuer den LERNKANAL (Als Vorgabe 9.8.): diese Karte
        // traegt Schaden UND Status. Das Ziel-Gate filtert deshalb NICHT —
        // `classifyTargetTags` stempelt stattdessen `stat:sticks` bzw.
        // `stat:blocked`, damit `targetPriors` je Karte lernt, wie stark
        // das Haften die Schadens-Rangfolge verschiebt.
        appliesStatus: 'poisoned',
      description: 'Choose a target to inflict 1 Poison Stack.',
      confirmLabel: '☠️ Poison! (+1 Stack)',
      confirmClass: 'btn-danger',
      cancellable: false, // Decay Magic already discarded
    });
    if (!target) return true;

    const tgtOwner   = target.owner;
    const tgtHeroIdx = target.heroIdx;
    const tgtSlot    = target.type === 'hero' ? -1 : target.slotIdx;

    engine._broadcastEvent('play_zone_animation', {
      type: 'poison_ooze', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
    });
    await engine._delay(500);

    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'poisoned', {
          addStacks: 1,
          appliedBy: pi,
        });
      }
    } else if (target.cardInstance) {
      const inst = target.cardInstance;
      await engine.actionApplyCreaturePoison(
        { name: CARD_NAME, owner: pi, heroIdx },
        inst,
      );
    }

    engine.log('rap_poison', { player: ps.username, target: target.cardName });
    engine.sync();
    return true;
  },
};
