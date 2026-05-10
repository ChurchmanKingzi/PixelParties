// ═══════════════════════════════════════════
//  CARD EFFECT: "Skull Necklace"
//  Artifact (Normal, cost 0)
//
//  Played from hand: no effect (the card resolves
//  to discard via the standard artifact-play
//  path, which uses a direct push and never
//  fires `onDiscard`).
//
//  EFFECT-driven discard / delete from hand:
//   • Damage = 50 by default ("you may choose a
//     target and deal 50 damage to it").
//   • Damage = 200 when the discard/delete was
//     caused by an OPPONENT's effect.
//
//  Detection:
//   • `_fromHand` flag in the hook ctx scopes
//     the trigger to hand-side discards/deletes
//     only — board-side leaves don't fire it.
//   • `discardedInstId === ctx.card.id` ensures
//     ONLY the freshly-discarded inst fires
//     (sibling copies already sitting in discard
//     wouldn't accidentally re-trigger because
//     the listener also lives in 'discard'/
//     'deleted' under `activeIn`).
//   • Whose-effect detection uses `gs.activePlayer`
//     as the heuristic: the active player is the
//     side currently casting / activating cards.
//     Reactive effects on the off-turn (rare
//     corner case) are mis-attributed by this
//     proxy — the engine doesn't carry an effect-
//     controller field through the discard path,
//     so this is the best signal available.
// ═══════════════════════════════════════════

const CARD_NAME = 'Skull Necklace';
const SELF_DAMAGE = 50;
const OPP_DAMAGE  = 200;

module.exports = {
  // Listener has to live in hand AND in destination piles, because
  // the engine flips `inst.zone` to 'discard' / 'deleted' BEFORE the
  // hook fires — so an `activeIn: ['hand']` script wouldn't even
  // see the trigger.
  activeIn: ['hand', 'discard', 'deleted'],

  // ── Played from hand: no effect ──
  isTargetingArtifact: true,
  canActivate: () => true,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Skull Necklace has no effect when played from your hand.',
    confirmLabel: '💀 Discard',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'none',

  async resolve(engine, pi) {
    engine.log('skull_necklace_no_effect', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
  },

  hooks: {
    onDiscard: async (ctx) => {
      await fireSkullDamage(ctx, false);
    },
    onDelete: async (ctx) => {
      await fireSkullDamage(ctx, true);
    },
  },
};

/**
 * Shared damage trigger for both discard- and delete-from-hand paths.
 * Filters to "I am the just-discarded Skull Necklace" via the
 * `discardedInstId` field set by the engine's hand-discard helpers.
 */
async function fireSkullDamage(ctx, deleted) {
  // Only fire from hand-driven removals.
  if (!ctx._fromHand) return;
  // Identify the JUST-removed inst (sibling Skull Necklaces already
  // in the destination pile would otherwise fire too, since this
  // listener's `activeIn` includes 'discard' / 'deleted').
  if (!ctx.discardedInstId) return;
  if (ctx.card?.id !== ctx.discardedInstId) return;

  const engine = ctx._engine;
  const gs = engine.gs;
  const ownerIdx = ctx.cardOwner;
  const ps = gs.players[ownerIdx];
  if (!ps) return;

  // Whose-effect heuristic. The active player is the side currently
  // executing cards / abilities; opponent reactive triggers fired on
  // the off-turn are the corner case the engine can't disambiguate
  // here.
  const byOpponent = (gs.activePlayer ?? ownerIdx) !== ownerIdx;
  const damage = byOpponent ? OPP_DAMAGE : SELF_DAMAGE;

  // No confirm step — the target picker IS the opt-in. "You may"
  // is honoured by making the picker cancellable: cancelling is
  // equivalent to declining the trigger. Skipping the confirm
  // tightens the UX to a single click flow (or a single Esc to
  // skip), instead of a confirm-then-target double prompt.
  //
  // Damage target picker — uses the standard `promptEffectTarget`
  // helper. The activator is the Skull's owner; there's no specific
  // casting hero (it's an Artifact effect from hand), so heroIdx
  // falls back to -1. `actionDealDamage` handles a -1 sourceHeroIdx
  // by attributing the damage to the card name only.
  const targets = [];
  for (let pIdx = 0; pIdx < 2; pIdx++) {
    const tps = gs.players[pIdx];
    for (let hi = 0; hi < (tps.heroes || []).length; hi++) {
      const hero = tps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({
        id: `hero-${pIdx}-${hi}`, type: 'hero',
        owner: pIdx, heroIdx: hi, cardName: hero.name,
      });
    }
    for (let hi = 0; hi < (tps.heroes || []).length; hi++) {
      for (let si = 0; si < (tps.supportZones?.[hi] || []).length; si++) {
        const slot = (tps.supportZones[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        const inst = engine.cardInstances.find(c =>
          c.owner === pIdx && c.zone === 'support'
          && c.heroIdx === hi && c.zoneSlot === si,
        );
        if (!inst || inst.faceDown) continue;
        const cardDB = engine._getCardDB();
        const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
        const { hasCardType } = require('./_hooks');
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          id: `equip-${pIdx}-${hi}-${si}`, type: 'equip',
          owner: pIdx, heroIdx: hi, slotIdx: si,
          cardName: inst.name, cardInstance: inst,
        });
      }
    }
  }
  if (targets.length === 0) return;

  const triggerLabel = deleted ? 'deleted' : 'discarded';
  const sourceLabel = byOpponent ? "by your opponent's effect" : 'by an effect';
  const selectedIds = await engine.promptEffectTarget(ownerIdx, targets, {
    title: CARD_NAME,
    description: `${CARD_NAME} was ${triggerLabel} ${sourceLabel}. Choose a target for ${damage} damage, or Cancel to skip.`,
    confirmLabel: `💀 Strike! (${damage})`,
    confirmClass: 'btn-danger',
    cancellable: true,
    maxTotal: 1,
  });
  if (!selectedIds || selectedIds.length === 0) return;
  const target = targets.find(t => t.id === selectedIds[0]);
  if (!target) return;

  const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
  engine._broadcastEvent('play_zone_animation', {
    type: 'red_cut', owner: target.owner,
    heroIdx: target.heroIdx, zoneSlot: impactSlot,
  });
  await engine._delay(200);

  const dmgSource = { name: CARD_NAME, owner: ownerIdx, heroIdx: -1 };
  if (target.type === 'hero') {
    const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (h && h.hp > 0) {
      await engine.actionDealDamage(dmgSource, h, damage, 'other');
    }
  } else if (target.cardInstance) {
    await engine.actionDealCreatureDamage(
      dmgSource, target.cardInstance, damage, 'other',
      { sourceOwner: ownerIdx, canBeNegated: true },
    );
  }

  engine.log('skull_necklace_strike', {
    player: ps.username, target: target.cardName, damage, byOpponent,
  });
  engine.sync();
}
