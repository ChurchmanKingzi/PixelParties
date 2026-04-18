// ═══════════════════════════════════════════
//  CARD EFFECT: "Acid Rain"
//  Spell (Decay Magic Lv2, Area)
//  Pollution archetype.
//
//  The first time every turn the turn player plays
//  a Spell from their hand, they must EITHER delete
//  2 cards from their hand (not counting the Spell
//  just played) OR place a Pollution Token into one
//  of their Heroes' free Support Zones.
//
//  Implementation:
//    • Area placement on cast from hand (onPlay with
//      cardZone === 'hand' routes to placeArea).
//    • `activeIn: ['area']` keeps the card's hooks
//      live after it enters the area zone.
//    • The turn-recurring penalty is wired into
//      `afterSpellResolved` — that hook fires for ALL
//      tracked cards (no _onlyCard), which is exactly
//      what we need for a board-state trigger.
//    • Per-turn guard: counters.triggeredOnTurn holds
//      the turn number of the last firing.
// ═══════════════════════════════════════════

const { placeArea } = require('./_area-shared');
const { placePollutionTokens, countFreeZones } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');

module.exports = {
  // Active in 'hand' so the self-cast onPlay hook fires when the spell is
  // played from hand; active in 'area' so afterSpellResolved fires while
  // the card is sitting on the board reacting to other spells.
  activeIn: ['hand', 'area'],

  hooks: {
    /**
     * Self-placement on cast: when this Spell's own onPlay fires (still in
     * the 'hand' zone on its CardInstance, matched by playedCard id), move
     * it to the caster's Area zone.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await placeArea(ctx._engine, ctx.cardOwner, ctx.card);
    },

    /**
     * Turn-player penalty on their first Spell of the turn. Fires after the
     * spell resolves (damage / status / etc. already applied), so by the
     * time we compute the delete option the spell is no longer counted.
     *
     * Runs via the engine's normal broadcast afterSpellResolved — no
     * _onlyCard is set there, so every active Acid Rain card instance on
     * the board gets a chance to act. Only one fires per turn thanks to
     * the per-turn guard.
     */
    afterSpellResolved: async (ctx) => {
      if (ctx.cardZone !== 'area') return;

      const engine = ctx._engine;
      const gs = ctx.gameState;

      // Ignore the self-cast that placed Acid Rain in the area zone —
      // that spell's resolution fires afterSpellResolved too.
      if (ctx.spellName === ctx.card.name) return;
      // Also ignore the second pass of Bartas's re-cast (same turn, same
      // caster) — the first pass already set the per-turn guard.
      if (ctx.isSecondCast) return;
      // If this Acid Rain was brought in by the very spell currently
      // resolving (e.g. Reality Crack → Acid Rain), skip that spell once.
      if (ctx.card.counters?._skipAfterResolveName === ctx.spellName) {
        delete ctx.card.counters._skipAfterResolveName;
        return;
      }

      // Only the TURN PLAYER's own Spells count, per card text.
      const turnPlayer = gs.activePlayer;
      if (ctx.casterIdx !== turnPlayer) return;

      // Acid Rain is a Spell trigger — reject Attacks / Creatures.
      const spellData = ctx.spellCardData;
      if (!spellData || !hasCardType(spellData, 'Spell')) return;

      // Per-turn guard: first qualifying Spell each turn only.
      if (ctx.card.counters.triggeredOnTurn === gs.turn) return;
      ctx.card.counters.triggeredOnTurn = gs.turn;

      const turnPs = gs.players[turnPlayer];
      if (!turnPs) return;

      // `afterSpellResolved` fires BEFORE the server's post-resolve hand
      // splice + discard push, so the spell just played is still sitting
      // in turnPs.hand. Subtract it out — the penalty "2 from hand" per
      // card text ignores the Spell that triggered Acid Rain.
      const spellStillInHand = turnPs._resolvingCard ? 1 : 0;
      const effectiveHandSize = (turnPs.hand || []).length - spellStillInHand;
      const canDelete = effectiveHandSize >= 2;
      const canPlaceToken = countFreeZones(gs, turnPlayer) > 0;

      if (!canDelete && !canPlaceToken) {
        engine.log('acid_rain_fizzle', {
          player: turnPs.username, reason: 'no_options',
        });
        return;
      }

      // If only one option is legal, skip the picker — auto-apply it.
      let chosen;
      if (canDelete && canPlaceToken) {
        const options = [
          { id: 'delete', label: `💀 Delete 2 cards from hand (${effectiveHandSize} in hand)` },
          { id: 'token', label: '☁️ Place 1 Pollution Token' },
        ];
        const result = await engine.promptGeneric(turnPlayer, {
          type: 'optionPicker',
          title: 'Acid Rain',
          description: 'Your Spell triggered Acid Rain. Pick your penalty.',
          options,
          cancellable: false,
        });
        chosen = result?.optionId || 'delete';
      } else {
        chosen = canDelete ? 'delete' : 'token';
      }

      if (chosen === 'token') {
        const promptCtxShim = {
          promptZonePick: (zs, cfg) => engine.promptGeneric(turnPlayer, {
            type: 'zonePick', zones: zs,
            title: cfg?.title || 'Acid Rain',
            description: cfg?.description || 'Select a zone.',
            cancellable: cfg?.cancellable !== false,
          }),
        };
        await placePollutionTokens(engine, turnPlayer, 1, 'Acid Rain', { promptCtx: promptCtxShim });
      } else {
        await engine.actionPromptForceDiscard(turnPlayer, 2, {
          title: 'Acid Rain — Delete 2 Cards',
          description: 'Acid Rain forces you to delete 2 cards from your hand.',
          source: 'Acid Rain',
          deleteMode: true,
          selfInflicted: false,
        });
      }

      engine.log('acid_rain_trigger', {
        player: turnPs.username, choice: chosen,
      });
      engine.sync();
    },
  },
};
