// ═══════════════════════════════════════════
//  CARD EFFECT: "Spike Trap"
//  Spell (Surprise, Lv2, Decay Magic)
//
//  Activate when the user is chosen by an Attack
//  or Spell. Negate that Attack/Spell and inflict
//  200 damage to the attacker. Opponent may
//  discard 2 cards to negate this Surprise.
// ═══════════════════════════════════════════

const CARD_NAME = 'Spike Trap';
const SPIKE_DAMAGE = 200;
const COUNTER_DISCARD_COST = 2;

module.exports = {
  isSurprise: true,

  /**
   * Trigger gate: source must be an Attack or Spell against this
   * hero, and the opponent attacker must still be alive (no point
   * retaliating against a dead body).
   *
   * "Attack or Spell" is satisfied EITHER by the source card itself
   * being an Attack / Spell, OR by the runtime damage tag being
   * `'attack'` or a `_spell`-suffixed type. The latter covers Hero
   * effects whose card text says "treated as a Spell" (Alice the
   * Puppeteer Girl etc.) — their source card is a Hero, but the
   * damage they deal is tagged with a spell type and Spike Trap
   * should react accordingly.
   */
  surpriseTrigger(gs, ownerIdx, heroIdx, sourceInfo, engine) {
    if (!sourceInfo) return false;
    const cd = engine._getCardDB()[sourceInfo.cardName];
    const cardTypeOk = cd && (cd.cardType === 'Attack' || cd.cardType === 'Spell');
    const dmgType = sourceInfo.damageType;
    const damageTypeOk = dmgType === 'attack' || /_spell$/.test(dmgType || '');
    if (!cardTypeOk && !damageTypeOk) return false;
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return !!(attacker?.name && attacker.hp > 0);
  },

  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const ownerPi = ctx.cardOwner;
    const oppPi = ownerPi === 0 ? 1 : 0;
    const opp = gs.players[oppPi];

    // Opp counter-window: discard 2 to negate Spike Trap. Only offered
    // when opp actually has 2 cards in hand — otherwise skip the
    // prompt entirely (no point asking for an impossible cost).
    if (opp && (opp.hand?.length || 0) >= COUNTER_DISCARD_COST) {
      const eligibleIndices = [];
      for (let i = 0; i < opp.hand.length; i++) eligibleIndices.push(i);

      // Use a confirm prompt first ("pay 2 discard to negate?"); only
      // open the discard picker if they accept. forceDiscard prompts
      // on opp would be jarring if the answer is just "no".
      const confirmed = await engine.promptGeneric(oppPi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Discard ${COUNTER_DISCARD_COST} cards from your hand to negate ${CARD_NAME}?`,
        showCard: CARD_NAME,
        confirmLabel: '🗑️ Discard 2',
        cancelLabel: 'No',
        cancellable: true,
      });

      if (confirmed === true || confirmed?.confirmed === true) {
        // Sequential 2-card forced discards wrapped in a single batch
        // so the per-card on-discard reactors (Glass of Marbles, Skull
        // Necklace, etc.) wait until BOTH counter-discards have
        // landed in the pile before resolving. Each iteration shrinks
        // the eligible set so the same slot can't be picked twice.
        const discarded = await engine.withDiscardBatch(oppPi, { source: CARD_NAME }, async () => {
          let n = 0;
          for (let step = 0; step < COUNTER_DISCARD_COST; step++) {
            const eligible = [];
            for (let i = 0; i < (opp.hand?.length || 0); i++) eligible.push(i);
            if (eligible.length === 0) break;
            const result = await engine.promptGeneric(oppPi, {
              type: 'forceDiscard',
              title: CARD_NAME,
              description: `Discard ${COUNTER_DISCARD_COST - n} more card${COUNTER_DISCARD_COST - n > 1 ? 's' : ''} to negate ${CARD_NAME}.`,
              instruction: 'Click a card in your hand to discard it.',
              eligibleIndices: eligible,
              cancellable: false,
            });
            if (!result || result.cardName == null) break;
            const ok = await engine.actionDiscardHandCard(
              oppPi, result.cardName, result.handIndex,
              { source: CARD_NAME },
            );
            if (!ok) break;
            n++;
          }
          return n;
        });
        if (discarded >= COUNTER_DISCARD_COST) {
          engine.log('spike_trap_countered', {
            player: opp.username, by: CARD_NAME,
          });
          engine.sync();
          return null; // Spike Trap fizzles — no damage, no negation.
        }
        // Couldn't actually pay the full cost (hand emptied mid-flow,
        // race condition). Treat as "no counter" — Spike Trap fires.
      }
    }

    // Counter declined / not affordable: deal 200 to the attacker and
    // negate the triggering Attack/Spell.
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    if (attacker?.name && attacker.hp > 0) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'red_cut', owner: sourceInfo.owner,
        heroIdx: sourceInfo.heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);
      const source = { name: CARD_NAME, owner: ownerPi, heroIdx: ctx.cardHeroIdx };
      await engine.actionDealDamage(source, attacker, SPIKE_DAMAGE, 'other', {
        _skipReactionCheck: true,
      });
    }

    engine.log('spike_trap_fired', {
      player: gs.players[ownerPi]?.username,
      attacker: sourceInfo.cardName,
      damage: SPIKE_DAMAGE,
    });
    engine.sync();
    return { effectNegated: true };
  },
};
