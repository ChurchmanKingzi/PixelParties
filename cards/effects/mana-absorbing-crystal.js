// ═══════════════════════════════════════════
//  CARD EFFECT: "Mana Absorbing Crystal"
//  Artifact (Normal, cost 15) — Crystals
//
//  When you draw or add this card to your hand,
//  you must immediately reveal it. While this
//  card is in your hand, the levels of all
//  Spells in your hand are increased by 1. You
//  may at any time choose a Hero you control and
//  deal 200 damage to it to delete this card
//  from your hand.
//
//  Implementation:
//   • `revealOnEnterHand: true` — auto-reveal on
//     every add-to-hand path.
//   • +1 Spell level in hand: enforced engine-
//     side in `heroMeetsLevelReq` and surfaced
//     visually by the hand-card level badge.
//     Applies as long as ANY copy of this card
//     is in the controller's hand; the boost
//     vanishes the moment the last copy leaves.
//   • Hand-active "delete via 200 self-damage":
//     `handActivatedEffect` + `onHandActivate`
//     (Luna Kiai's mechanism). Splices the card
//     out of hand to the deleted pile after the
//     damage resolves so the boost auto-clears
//     for the rest of the turn.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mana Absorbing Crystal';
const SELF_DAMAGE = 200;

module.exports = {
  isTargetingArtifact: true,
  revealOnEnterHand: true,

  // Standard "discard for gold cost" play path. The hand-active path
  // is the strategic option; this exists so the Crystal can simply
  // be paid off without paying its self-damage tax.
  canActivate: () => true,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Mana Absorbing Crystal has no effect when played from hand. Pay 15 Gold to discard it.',
    confirmLabel: '🔮 Discard',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'none',

  async resolve(engine, pi) {
    engine.log('mana_absorbing_crystal_discarded', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
  },

  // ── Hand-activated path ─────────────────────────────────────────
  handActivatedEffect: true,
  handActivateLabel: 'Delete (200 self-damage)',

  /**
   * Activatable iff the controller has at least one alive Hero. The
   * effect always succeeds (200 damage to a chosen own Hero, then
   * delete this Crystal from hand), so the gate just confirms there
   * IS a target to take the damage.
   */
  canHandActivate(gs, pi, _engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    return (ps.heroes || []).some(h => h?.name && h.hp > 0);
  },

  async onHandActivate(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    const handIndex = ctx.handIndex;

    // Build target list: every alive Hero on our side.
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      targets.push({
        id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi,
        cardName: h.name,
      });
    }
    if (targets.length === 0) return false;

    const selected = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: `Choose a Hero you control to take ${SELF_DAMAGE} damage. ${CARD_NAME} will be deleted from your hand.`,
      confirmLabel: `💎 Absorb (${SELF_DAMAGE} self)`,
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!selected || selected.length === 0) return false;
    const target = targets.find(t => t.id === selected[0]);
    if (!target) return false;

    const hero = ps.heroes?.[target.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const source = { name: CARD_NAME, owner: pi, heroIdx: -1 };
    engine._broadcastEvent('play_zone_animation', {
      type: 'red_cut', owner: pi, heroIdx: target.heroIdx, zoneSlot: -1,
    });
    await engine._delay(300);
    await engine.actionDealDamage(source, hero, SELF_DAMAGE, 'other', {
      _skipReactionCheck: true, selfInflicted: true,
    });

    // Splice the Crystal out of hand and route to deleted pile. Use
    // the live hand index from ctx.handIndex; defensively re-locate
    // by name in case the hand mutated mid-prompt.
    let idx = handIndex;
    if (ps.hand[idx] !== CARD_NAME) idx = ps.hand.indexOf(CARD_NAME);
    if (idx >= 0) {
      ps.hand.splice(idx, 1);
      ps.deletedPile.push(CARD_NAME);
      // Untrack the hand inst so the engine state stays clean.
      const inst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME,
      );
      if (inst) engine._untrackCard(inst.id);
    }

    engine.log('mana_absorbing_crystal_delete', {
      player: ps.username, hero: hero.name, damage: SELF_DAMAGE,
    });
    engine.sync();
    return true;
  },
};
