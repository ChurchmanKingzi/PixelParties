// ═══════════════════════════════════════════
//  CARD EFFECT: "Frost Rune"
//  Spell (Surprise) — Decay Magic Lv3
//
//  "Activate this Surprise when the user is chosen by an Attack, Spell
//   or Creature effect. Negate the Attack, Spell or effect and Freeze
//   the attacker until the end of your opponent's next turn."
//
//  • Same Surprise shape as Booby Trap / Magic Mirror — `surpriseTrigger`
//    fires when the host Hero is chosen as a target by an Attack, Spell
//    or Creature effect (the engine's pre-resolution Surprise window);
//    `onSurpriseActivate` returning `{ effectNegated: true }` aborts the
//    triggering effect entirely.
//  • The attacker is Frozen for 2 turns (`duration: 2` — the engine's
//    `processStatusExpiry` freeze tick counts down one per the frozen
//    unit's own turn).
//  • Telekinesis is disallowed (like Magic Mirror) — Frost Rune needs a
//    real triggering effect to negate and a real attacker to Freeze.
// ═══════════════════════════════════════════

const { resolveSourceCreature, isCreatureSource } = require('./_hooks');

const CARD_NAME = 'Frost Rune';

// "Freeze for 2 turns" — `duration: N` keeps the attacker frozen
// through N of its own turns.
const FREEZE_DURATION = 2;

module.exports = {
  isSurprise: true,

  // No triggering effect under Telekinesis → nothing to negate, no
  // attacker to Freeze. Disallow it (Magic Mirror does the same).
  canTelekinesisActivate: false,

  /**
   * Trigger: the host Hero has been chosen by an Attack, Spell or
   * Creature effect. Require a live attacker (a Creature still on the
   * board, or an alive caster Hero) — mirrors Booby Trap's gate.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (!sourceInfo || sourceInfo.owner == null || sourceInfo.owner < 0) return false;

    if (isCreatureSource(engine, sourceInfo)) {
      return !!resolveSourceCreature(engine, sourceInfo);
    }
    if (sourceInfo.heroIdx == null || sourceInfo.heroIdx < 0) return false;
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return !!(attacker && attacker.hp > 0);
  },

  /**
   * On activation: Freeze the attacker, then negate the triggering
   * effect by returning `{ effectNegated: true }`.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const ownerIdx = ctx.cardOwner;        // who set the Surprise
    const hostHeroIdx = ctx.cardHeroIdx;   // the Hero it was hosted on

    // ── Frost flash on the protected Hero — the Rune triggers ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'ice_encase', owner: ownerIdx, heroIdx: hostHeroIdx, zoneSlot: -1,
    });
    await engine._delay(450);

    // ── Freeze the attacker ──
    if (isCreatureSource(engine, sourceInfo)) {
      const srcInst = resolveSourceCreature(engine, sourceInfo);
      if (srcInst) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'ice_encase', owner: srcInst.owner,
          heroIdx: srcInst.heroIdx, zoneSlot: srcInst.zoneSlot,
        });
        await engine._delay(300);
        // applyCreatureStatus internally honours negative-status /
        // Cardinal immunity (returns false if blocked).
        const applied = await engine.applyCreatureStatus(srcInst, 'frozen', {
          sourceOwner: ownerIdx, source: CARD_NAME, duration: FREEZE_DURATION,
        });
        if (applied) {
          engine.log('freeze', { target: srcInst.name, by: CARD_NAME, type: 'creature' });
        }
      }
    } else {
      const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
      if (attacker && attacker.hp > 0) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'ice_encase', owner: sourceInfo.owner,
          heroIdx: sourceInfo.heroIdx, zoneSlot: -1,
        });
        await engine._delay(300);
        await engine.addHeroStatus(sourceInfo.owner, sourceInfo.heroIdx, 'frozen', {
          appliedBy: ownerIdx, duration: FREEZE_DURATION,
        });
        engine.log('freeze', { target: attacker.name, by: CARD_NAME, type: 'hero' });
      }
    }

    engine.log('frost_rune', {
      player: gs.players[ownerIdx]?.username,
      negated: sourceInfo.cardName || '?',
    });
    engine.sync();

    // Negate the Attack, Spell or Creature effect entirely.
    return { effectNegated: true };
  },
};
