// ═══════════════════════════════════════════
//  CARD EFFECT: "Bamboo Staff"
//  Artifact (Equipment, Cost 10)
//
//  Once per turn, when a card is added from your
//  discard pile to your hand, you may choose a
//  target and deal damage equal to the equipped
//  Hero's Base Attack stat to it. That is treated
//  as that Hero hitting the target with an Attack.
//
//  Wiring:
//    • Listens to the engine's
//      `onCardAddedFromDiscardToHand` hook —
//      universal "card recovered from graveyard"
//      signal fired by `engine.addCardFromDiscardToHand`.
//      Xiong's tutor, future graveyard-recovery
//      cards, and the Bamboo Staff itself all
//      share that single fire-point.
//    • SOFT once-per-turn: per-instance, not
//      per-player. Two equipped Staves on the
//      same Hero each fire independently, and a
//      Staff that bounces to hand and gets re-
//      equipped this turn fires again. The
//      `_bambooFiredOnTurn` counter lives on the
//      instance and is cleared every time the
//      Staff (re-)enters a Support Zone via
//      `onCardEnterZone`, which guarantees the
//      "re-equip resets" behaviour regardless of
//      whether the bounce path reuses or replaces
//      the CardInstance.
//    • Damage routing: actionDealDamage / Action-
//      DealCreatureDamage with `type: 'attack'`
//      and source `{ name: hero.name, owner, heroIdx }`
//      so Vampiric Sword heals, armed-arrow riders,
//      and Reiza-style on-hit status application
//      all chain naturally.
//    • "Treated as that Hero hitting with an
//      Attack" rules text — fire `afterSpellResolved`
//      with a fake Attack `spellCardData` after the
//      damage call so equipment / hero hooks that
//      key off "this Hero just attacked" (Reiza,
//      Legendary Sword, etc.) trigger.
// ═══════════════════════════════════════════

const CARD_NAME = 'Bamboo Staff';

const FAKE_ATTACK_DATA = {
  name: CARD_NAME,
  cardType: 'Attack',
  subtype: 'Normal',
  level: 0,
};

/** Any valid target on the board for the Staff's strike? */
function anyValidTarget(gs) {
  for (const ps of gs.players) {
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (h?.name && h.hp > 0) return true;
      const sz = ps.supportZones?.[hi] || [];
      for (const slot of sz) if ((slot || []).length > 0) return true;
    }
  }
  return false;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * Reset the per-instance "fired this turn" stamp every time the
     * Staff (re-)enters a Support Zone. This is what makes the
     * SOFT-once-per-turn behaviour work even if the engine reuses
     * the same CardInstance across a bounce/re-equip cycle: the
     * stamp can never carry into a fresh equip.
     */
    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support') return;
      if (ctx.enteringCard?.id !== ctx.card.id) return;
      delete ctx.card.counters._bambooFiredOnTurn;
    },

    onCardAddedFromDiscardToHand: async (ctx) => {
      // Only react when the recovered card landed in OUR controller's
      // hand — opponents recovering their own cards must not fire our
      // Staff. (`cardOwner` already accounts for charm/steal.)
      if (ctx.playerIdx !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // Equipped Hero must be alive (no body to swing the Staff).
      const heroIdx = ctx.card.heroIdx;
      const hero    = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Per-instance soft-HOPT.
      if (ctx.card.counters._bambooFiredOnTurn === gs.turn) return;

      // Damage scales off the Hero's BASE Attack — printed-stat value,
      // unaffected by Vampiric Sword / Fighting / any buff or debuff.
      // Card text: "damage equal to the equipped Hero's Base Attack
      // stat". The same convention Blow of the Venom Snake / Ferocious
      // Tiger Kick use.
      const atk = hero.baseAtk || 0;
      if (atk <= 0) return;

      // No targets on the board — silently skip the prompt (matches
      // the UX from Terrier's chain: don't pop a dialog you can't
      // fulfill).
      if (!anyValidTarget(gs)) return;

      // Stamp BEFORE awaiting any prompt so a long-running player
      // pick can't get re-entered by a sibling
      // onCardAddedFromDiscardToHand fire (Xiong tutoring multiple
      // cards in a single AoE wipe, for instance).
      ctx.card.counters._bambooFiredOnTurn = gs.turn;

      // Track damage targets via the spell-damage log so the fake
      // afterSpellResolved fire has accurate `damageTargets`.
      gs._spellDamageLog = gs._spellDamageLog || [];

      // No "Activate?" confirmation step — the target picker IS the
      // opt-in path. Cancelling it is how the player declines, same
      // pattern Loyal Terrier's follow-up uses.
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: atk,
        title: CARD_NAME,
        description: `${ctx.addedCardName || 'A card'} returned to your hand! Choose a target for ${hero.name}'s ${atk}-damage Attack.`,
        confirmLabel: `⚔️ ${atk} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) {
        delete ctx.card.counters._bambooFiredOnTurn;
        delete gs._spellDamageLog;
        return;
      }

      // Punch-impact animation matches Aggressive Town Guard's pattern —
      // emitted as its own socket event so the client's onPunchImpact
      // handler renders the fist + impact ring + radiating lines. Routing
      // through play_zone_animation doesn't work here: punch_impact
      // isn't registered in the client's ANIM_REGISTRY (it's only
      // handled by the dedicated socket listener), so the animation
      // silently dropped.
      engine._broadcastEvent('punch_impact', {
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(380);

      const dmgSource = { name: hero.name, owner: pi, heroIdx };
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionDealDamage(dmgSource, tgtHero, atk, 'attack');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          dmgSource, target.cardInstance, atk, 'attack',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      // Collect unique struck targets from the damage log (matches
      // Arthor's "treat as Attack" pattern), then fire afterSpellResolved
      // with fake Attack data so anything that listens for "this Hero
      // attacked" (Reiza poison+stun, Vampiric Sword heal redundancy,
      // arrow rider clearing in server.js, …) chains naturally.
      const uniqueTargets = [];
      const seenIds = new Set();
      for (const t of (gs._spellDamageLog || [])) {
        if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
      }
      delete gs._spellDamageLog;

      await engine.runHooks('afterSpellResolved', {
        spellName: CARD_NAME,
        spellCardData: FAKE_ATTACK_DATA,
        heroIdx,
        casterIdx: pi,
        damageTargets: uniqueTargets,
        isSecondCast: false,
        _skipReactionCheck: true,
      });

      engine.log('bamboo_staff_strike', {
        player: ps.username, hero: hero.name,
        target: target.cardName, dealt: atk,
      });
      engine.sync();
    },
  },
};
