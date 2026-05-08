// ═══════════════════════════════════════════
//  CARD EFFECT: "Occultism"
//  Ability — Free activation (HOPT).
//
//  Once per turn, sacrifice a Creature you control that was NOT
//  summoned this turn, choose a target, and deal damage based on
//  Occultism's stack level:
//    Lv1 →  50 damage
//    Lv2 → 100 damage
//    Lv3 → 150 damage
//
//  Asriel, the Sapling Sacrificer's hero text — "You may sacrifice
//  Creatures the turn they are summoned with this Hero's Occultism."
//  — relaxes the summoning-sickness gate when Occultism is activated
//  on Asriel. Detected via the host hero's name (Asriel carries no
//  effect script of his own; his text is a constraint loosening read
//  by this ability).
//
//  Flow:
//    1. Pick a Creature to sacrifice (cancellable).
//    2. Pick a damage target (cancellable).
//    3. Resolve in order: sacrifice animation → ON_CREATURE_SACRIFICED
//       → actionDestroyCard → beam to target → deal damage.
//
//  Both prompts are cancellable; the cost is paid only after BOTH
//  selections are confirmed, so a half-committed activation never
//  loses a Creature for nothing.
// ═══════════════════════════════════════════

const { hasCardType, HOOKS } = require('./_hooks');

const CARD_NAME = 'Occultism';
const ASRIEL_NAME = 'Asriel, the Sapling Sacrificer';
const LEVEL_DAMAGE = [50, 100, 150];

/**
 * Build the list of Creatures the player can sacrifice for THIS
 * Occultism activation. Default rule: must NOT have been summoned
 * this turn. Asriel relaxes that — every owned Creature is fair game.
 */
function getOccultismSacrificeCandidates(engine, pi, hostHero) {
  const currentTurn = engine.gs.turn || 0;
  const isAsriel = hostHero?.name === ASRIEL_NAME;
  let candidates = engine.getSacrificableCreatures(pi);
  if (!isAsriel) {
    candidates = candidates.filter(c => c.inst.turnPlayed !== currentTurn);
  }
  return candidates;
}

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  requiresTarget: true, // Tagged for Blinded gating — Occultism aims a damage shot.

  /**
   * Pre-check: is at least one Creature available to sacrifice for
   * this hero's Occultism? Without this, the activation UI would
   * stay lit when the rule's cost can't be paid.
   */
  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hostHero = engine.gs.players[pi]?.heroes?.[heroIdx];
    return getOccultismSacrificeCandidates(engine, pi, hostHero).length > 0;
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    const hostHero = ps.heroes?.[heroIdx];
    if (!hostHero?.name || hostHero.hp <= 0) return false;

    const damage = LEVEL_DAMAGE[Math.min(Math.max(level, 1), 3) - 1];

    // ── Step 1: pick a Creature to sacrifice. ──
    const candidates = getOccultismSacrificeCandidates(engine, pi, hostHero);
    if (candidates.length === 0) return false;

    const sacTargets = candidates.map(c => ({
      id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
      type: 'equip',
      owner: c.inst.owner, heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot,
      cardName: c.cardName, cardInstance: c.inst,
    }));
    const sacPick = await engine.promptEffectTarget(pi, sacTargets, {
      title: CARD_NAME,
      description: hostHero.name === ASRIEL_NAME
        ? 'Sacrifice any Creature you control (Asriel allows fresh summons too).'
        : 'Sacrifice a Creature you control that was not summoned this turn.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1 },
      // Repaint eligible-target glow red (the default yellow can read as
      // "click to buff" — sacrifice flavor needs the threat colour).
      redSelect: true,
    });
    if (!sacPick || sacPick.length === 0) return false;
    const sacInst = sacTargets.find(t => t.id === sacPick[0])?.cardInstance;
    if (!sacInst) return false;

    // ── Step 2: pick a damage target. ──
    const damageTarget = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage to a target.`,
      confirmLabel: `🔥 ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!damageTarget) return false;

    // ══════════════════════════════════════════════════════════════
    //  Both selections confirmed — commit cost and effect together.
    // ══════════════════════════════════════════════════════════════

    // Capture sacrifice-site coordinates BEFORE actionDestroyCard
    // moves the instance to discard (zoneSlot survives, but using a
    // local snapshot keeps the beam origin readable.).
    const sacOwner    = sacInst.owner;
    const sacHeroIdx  = sacInst.heroIdx;
    const sacZoneSlot = sacInst.zoneSlot;
    const sacName     = sacInst.name;

    // ── Sacrifice: animation → hook → destroy. ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'knife_sacrifice',
      owner: sacOwner, heroIdx: sacHeroIdx, zoneSlot: sacZoneSlot,
    });
    await engine._delay(550);

    await engine.runHooks(HOOKS.ON_CREATURE_SACRIFICED, {
      creature: sacInst,
      cardName: sacName,
      owner: sacOwner,
      heroIdx: sacHeroIdx,
      zoneSlot: sacZoneSlot,
      source: { name: CARD_NAME, owner: pi, heroIdx },
      _skipReactionCheck: true,
    });
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx },
      sacInst,
    );

    // ── Damage: beam from the sacrifice slot to the target. ──
    const targetZoneSlot = damageTarget.type === 'hero' ? -1 : damageTarget.slotIdx;
    engine._broadcastEvent('play_beam_animation', {
      sourceOwner: sacOwner,
      sourceHeroIdx: sacHeroIdx,
      sourceZoneSlot: sacZoneSlot,
      targetOwner: damageTarget.owner,
      targetHeroIdx: damageTarget.heroIdx,
      targetZoneSlot,
      color: '#aa44ff',
      duration: 1100,
    });
    await engine._delay(350); // Let the beam draw before damage numbers pop.

    if (damageTarget.type === 'hero') {
      const hero = gs.players[damageTarget.owner]?.heroes?.[damageTarget.heroIdx];
      if (hero && hero.hp > 0) {
        await ctx.dealDamage(hero, damage, 'other');
      }
    } else {
      const inst = damageTarget.cardInstance || engine.cardInstances.find(c =>
        c.owner === damageTarget.owner && c.zone === 'support'
        && c.heroIdx === damageTarget.heroIdx && c.zoneSlot === damageTarget.slotIdx,
      );
      if (inst) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx },
          inst, damage, 'other',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.log('occultism_activated', {
      player: ps.username,
      hero: hostHero.name,
      level,
      damage,
      sacrificed: sacName,
      target: damageTarget.cardName,
    });
    engine.sync();
    await engine._delay(200);
    return true;
  },
};
