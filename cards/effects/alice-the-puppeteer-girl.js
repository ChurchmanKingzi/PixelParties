// ═══════════════════════════════════════════
//  CARD EFFECT: "Alice, the Puppeteer Girl"
//  Hero — Active effect (once per turn, Main Phase).
//  Choose a target the opponent controls and deal
//  50 × (number of Creatures you control that were
//  NOT summoned this turn) damage to it.
//  Treated as a Destruction Magic Spell.
//  Animation: red laser beam from Alice to target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/**
 * True iff `inst` counts toward Alice's damage multiplier:
 *   • Lives in a support zone.
 *   • Is an actual Creature (not an Equipment Artifact / Token-only card).
 *   • Is currently CONTROLLED by `pi` — temporary steals flip
 *     `inst.controller` to the stealer while leaving `inst.owner` on
 *     the original side, so a steal-ridden creature on the opponent's
 *     board mustn't count for Alice. Permanent steals already update
 *     both fields.
 *   • Was NOT summoned this turn (`turnPlayed !== currentTurn`).
 */
function _qualifies(inst, pi, currentTurn, cardDB) {
  if (inst.zone !== 'support') return false;
  if ((inst.controller ?? inst.owner) !== pi) return false;
  if (inst.stolenBy != null) return false;
  if (inst.turnPlayed === currentTurn) return false;
  const cd = cardDB[inst.name];
  if (!cd || !hasCardType(cd, 'Creature')) return false;
  return true;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hero'],
  heroEffect: true,

  // CPU threat assessment (damage supporter). 50 damage per non-fresh
  // Creature the owner controls, once per turn.
  supportYield(ctx) {
    const { engine, pi } = ctx;
    const currentTurn = engine.gs.turn || 0;
    const cardDB = engine._getCardDB();
    let count = 0;
    for (const inst of engine.cardInstances) {
      if (_qualifies(inst, pi, currentTurn, cardDB)) count++;
    }
    return { damagePerTurn: 50 * count };
  },

  /**
   * Can activate if the player controls at least 1 Creature
   * that was NOT summoned during this turn.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const currentTurn = engine.gs.turn || 0;
    const cardDB = engine._getCardDB();

    return engine.cardInstances.some(inst => _qualifies(inst, pi, currentTurn, cardDB));
  },

  /**
   * Execute: prompt a damage target on the opponent's side,
   * fire laser beam, deal 50 × qualifying creature count.
   * Returns true if resolved, false if cancelled.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const currentTurn = engine.gs.turn || 0;
    const cardDB = engine._getCardDB();

    // Count qualifying creatures (not summoned this turn, not stolen,
    // actual Creatures — not Equipment).
    const qualifyingCreatures = engine.cardInstances.filter(inst =>
      _qualifies(inst, pi, currentTurn, cardDB)
    );
    const creatureCount = qualifyingCreatures.length;
    if (creatureCount === 0) return false; // Shouldn't happen (canActivate guards this)

    const damage = 50 * creatureCount;

    // Prompt: select an enemy target (hero or creature)
    const target = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero', 'creature'],
      damageType: 'destruction_spell',
      baseDamage: damage,
      title: 'Alice, the Puppeteer Girl',
      description: `Deal ${damage} damage (50 × ${creatureCount} Creature${creatureCount !== 1 ? 's' : ''}) to an enemy target.`,
      confirmLabel: `⚡ ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!target) return false; // Cancelled

    // Play laser beam animation from Alice to target
    const targetZoneSlot = target.type === 'equip' ? target.slotIdx : -1;
    engine._broadcastEvent('play_beam_animation', {
      sourceOwner: ctx.cardHeroOwner,
      sourceHeroIdx: heroIdx,
      targetOwner: target.owner,
      targetHeroIdx: target.heroIdx,
      targetZoneSlot,
      color: '#ff2222',
      duration: 1500,
    });
    await engine._delay(400); // Let beam draw before damage numbers appear

    // Deal the damage
    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) {
        await ctx.dealDamage(hero, damage, 'destruction_spell');
      }
    } else if (target.type === 'equip') {
      // Creature damage via generic batch system
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (inst) {
        await engine.actionDealCreatureDamage(
          { name: 'Alice, the Puppeteer Girl', heroIdx }, inst, damage, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true }
        );
      }
    }

    engine.sync();
    await engine._delay(800); // Let beam + explosion finish
    return true;
  },
};
