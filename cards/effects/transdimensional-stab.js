// ═══════════════════════════════════════════
//  CARD EFFECT: "Transdimensional Stab"
//  Attack (Fighting Lv3, Normal)
//
//  Choose a target and deal damage equal to the attacker's Attack
//  stat to it. Your opponent must discard 1 card from their hand
//  for every 50 damage this Attack deals. If your opponent would
//  have no cards in their hand after this Attack resolved, negate
//  this Attack.
//
//  Hand-empty negation timing:
//    The opponent's hand size can change in the reaction-chain
//    window between Stab's activation and its resolution (Wisdom
//    costs paid by the caster, opp's reactions discarding their
//    own cards, draws from intermediate triggers, …). The card
//    text says to compare the projected discard count to the
//    opponent's CURRENT hand size DIRECTLY before the Attack
//    resolves — so the check happens after `promptDamageTarget`
//    returns (the engine's `_checkPostTargetHandReactions` window
//    has already resolved by then) and BEFORE `actionDealDamage`
//    is called.
//
//    Per the rule "cards already marked for discarding do not
//    count": the engine splices cards out of hand at the moment
//    they're committed (force-discard prompts, Wisdom costs,
//    self-mill, …), so `ps.hand.length` at this point already
//    reflects every committed-but-not-yet-finalised consumption.
//    No special bookkeeping needed.
//
//  Damage stat:
//    Card text reads "the attacker's Attack stat", which is the
//    current ATK (`hero.atk`) including Equipment / aura buffs —
//    NOT `hero.baseAtk`. Quick Attack explicitly says "Base
//    Attack stat" and uses `baseAtk`; the absence of "Base" here
//    is intentional.
//
//  Negation decision:
//    The check compares the PRE-damage attacker's ATK / 50 against
//    the opponent's hand size. Damage modifiers that fire INSIDE
//    `actionDealDamage` (Spectral Armor halve, Cloudy multiplier,
//    Smug Coin save, …) can reduce the actual dealt amount AFTER
//    this point, so the post-damage discard count may end up
//    smaller than the pre-damage projection. That's fine — the
//    text gates negation on what the Attack WOULD do, not what it
//    ends up doing.
// ═══════════════════════════════════════════

const CARD_NAME = 'Transdimensional Stab';
const DAMAGE_PER_DISCARD = 50;

module.exports = {
  requiresTarget: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const oi      = pi === 0 ? 1 : 0;
      const ps      = gs.players[pi];
      const ops     = gs.players[oi];
      const heroIdx = ctx.cardHeroIdx;
      const hero    = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const damage = hero.atk || 0;

      // ── Target selection (post-target reaction window runs inside) ──
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: damage,
        title: CARD_NAME,
        description: `Deal ${damage} damage to a target.`,
        confirmLabel: `🌀 Stab! (${damage})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      // ── Hand-empty negation gate ──
      // Resolved AFTER `promptDamageTarget` (so all post-target
      // reactions / Wisdom costs / chain-link discards have already
      // settled) and BEFORE the damage call. The discard count uses
      // the pre-damage `damage` value — modifiers inside the damage
      // call can lower the dealt amount, but the text gates the
      // negation on the Attack's projected discard.
      const projectedDiscardCount = Math.floor(damage / DAMAGE_PER_DISCARD);
      const oppHandSize = (ops?.hand || []).length;
      if (oppHandSize <= projectedDiscardCount) {
        // Negate: the discard would empty (or already-empty) opp's
        // hand. No damage, no discard, no afterSpellResolved (the
        // standard `_spellNegatedByEffect` gate at server.js's
        // doPlaySpell skips that hook for negated spells).
        gs._spellNegatedByEffect = true;
        engine.log('transdimensional_stab_negated', {
          attacker: hero.name,
          opp:      ops?.username,
          handSize: oppHandSize,
          discardCount: projectedDiscardCount,
        });
        engine._broadcastEvent('play_zone_animation', {
          type: 'spectral_armor',
          owner: target.owner, heroIdx: target.heroIdx,
          zoneSlot: target.type === 'hero' ? -1 : (target.slotIdx ?? -1),
        });
        engine.sync();
        await engine._delay(380);
        return;
      }

      // ── Deal damage ──
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'critical_slash', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(380);

      const source = { name: CARD_NAME, owner: pi, heroIdx };
      let dealt = 0;
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          const r = await engine.actionDealDamage(source, tgtHero, damage, 'attack');
          dealt = r?.dealt || 0;
        }
      } else if (target.cardInstance) {
        const r = await engine.actionDealCreatureDamage(
          source, target.cardInstance, damage, 'attack',
          { sourceOwner: pi, canBeNegated: true },
        );
        dealt = r?.dealt || 0;
      }

      // ── Force-discard based on ACTUAL damage dealt ──
      // Card text says "for every 50 damage this Attack deals" —
      // post-damage value (after Spectral Armor halve, Cloudy
      // multiplier, etc.). This may be fewer cards than the
      // negation gate's projected count, which is correct: the
      // negation is a pre-damage gate, the discard is a post-damage
      // payoff.
      const actualDiscardCount = Math.floor(dealt / DAMAGE_PER_DISCARD);
      if (actualDiscardCount > 0 && (ops?.hand?.length || 0) > 0) {
        await engine.actionPromptForceDiscard(oi, actualDiscardCount, {
          title: CARD_NAME, source: CARD_NAME,
        });
      }

      engine.log('transdimensional_stab', {
        attacker: hero.name,
        target:   target.cardName,
        damage:   dealt,
        discards: actualDiscardCount,
      });
      engine.sync();
    },
  },
};
