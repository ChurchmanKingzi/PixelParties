// ═══════════════════════════════════════════
//  SPELL: "String of Fine"
//  Has no effect from your hand.
//
//  When it is the top of your Coolness Stack, you
//  may delete it to make a target you control take
//  0 damage until the start of your next turn.
//  This counts as an additional Action. A given
//  target can only be affected once per game.
// ═══════════════════════════════════════════

const CARD_NAME = 'String of Fine';

module.exports = {
  playableFromCoolnessStack: true,
  // Hand-grey: Stack-only. Plays from hand do nothing.
  neverPlayable: true,

  hooks: {
    onPlay: async (ctx) => {
      // Hand cast → no effect. The card hits discard via the normal funnel.
    },
  },

  async resolveFromCoolnessStack(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.getCoolnessStackTop(pi) !== CARD_NAME) return { aborted: true, reason: 'not_top' };

    const target = await ctx.promptDamageTarget({
      side: 'my',
      types: ['hero', 'creature'],
      title: CARD_NAME,
      description: 'Choose a target you control. Until your next turn, that target takes 0 damage. (Each target can only be affected once per game.)',
      confirmLabel: '🛡️ Shield!',
      confirmClass: 'btn-success',
      cancellable: true,
      condition: (t, eng) => {
        if (t.owner !== pi) return false;
        if (t.type === 'hero') {
          const h = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
          return h && !h._stringOfFineUsed;
        }
        if (t.cardInstance) return !t.cardInstance._stringOfFineUsed;
        return true;
      },
    });
    if (!target) return { aborted: true, reason: 'cancelled' };

    // Pay the cost: delete the top-of-Stack copy of String of Fine.
    await ctx.popCoolnessStackTo(pi, 'delete', { source: CARD_NAME });

    // ── Holy magic / golden particle animation on the target zone ──
    // `johanna_cleanse` is the engine's standard golden-halo +
    // sunburst-beams + drifting-sparkle effect — the perfect "holy
    // protection" visual.
    const animSlot = target.type === 'hero' ? -1 : (target.slotIdx ?? -1);
    engine._broadcastEvent('play_zone_animation', {
      type: 'johanna_cleanse',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: animSlot,
    });
    await engine._delay(450);

    // ── Apply the `protected` buff ──
    // The buff's `damageMultiplier: 0` (declared in BUFF_EFFECTS) is
    // automatically applied by the engine's beforeDamage and
    // beforeCreatureDamageBatch buff-multiplier passes, blocking ALL
    // standard damage. True damage (Acid Vial / Rockfall) intentionally
    // bypasses buff multipliers per the engine spec, so it still lands
    // — matching the card's "0 damage" with the unblockable carve-out.
    //
    // expiresAtTurn = controller's next turn (turn+2 in turn-tick units
    // since the opponent's turn falls between). expiresForPlayer set so
    // the cleanup fires at the start of OUR next turn.
    const expiryTurn = (engine.gs.turn || 0) + 2;
    if (target.type === 'hero') {
      const h = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (h) {
        h._stringOfFineUsed = true; // once-per-game-per-target lock
        await ctx.addBuff(h, target.owner, target.heroIdx, 'damage_immune', {
          expiresAtTurn: expiryTurn,
          expiresForPlayer: pi,
        });
      }
    } else if (target.cardInstance) {
      target.cardInstance._stringOfFineUsed = true;
      await ctx.addCreatureBuff(target.cardInstance, 'damage_immune', {
        expiresAtTurn: expiryTurn,
        expiresForPlayer: pi,
      });
    }

    engine.gs._spellFreeAction = true;
    engine.log('string_of_fine_protect', {
      player: engine.gs.players[pi]?.username,
      target: target.cardName || 'target',
    });
    engine.sync();
    return { played: true, additionalAction: true };
  },
};
