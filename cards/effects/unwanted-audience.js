// ═══════════════════════════════════════════
//  CARD EFFECT: "Unwanted Audience"
//  Spell (Reaction) — Decay Magic + Magic Arts, Lv1
//
//  "Play this card at the beginning of your opponent's turn.
//   Creatures your opponent controls cannot activate their active
//   effects this turn. This counts as a negative status effect."
//
//  ── Timing / trigger ────────────────────────────────────────────
//  Same shape as "Jump in the River": NOT `isReaction` (that flag is
//  the chain-reaction system, wrong here). `spellPlayCondition`
//  returns false (never proactively playable); the card triggers
//  from its `onTurnStart` hook at the START of the OPPONENT's turn,
//  offers a confirm, then plays through `executeCardWithChain` so
//  the opponent still gets a counter window. If countered, `resolve`
//  never runs → no aura.
//
//  ── Effect ──────────────────────────────────────────────────────
//  Every Creature the opponent controls that HAS an active effect
//  (its script exports `creatureEffect` — the manually-triggered
//  kind gated by summoning sickness) is `negated` — the SAME status
//  Dark Gear / Diplomacy apply, which the engine already treats as
//  "can't activate its effect". Two differences from a normal
//  negate:
//    • It is applied `cleansable: true`, so — uniquely — Beer / Juice
//      CAN heal it off (normal negation is permanent). Handled by the
//      per-instance `<status>Cleansable` engine override.
//    • It expires on its own at the end of the opponent's turn.
//  Creatures with an active effect the opponent summons LATER that
//  same turn are caught via the discard-resident `onCardEnterZone`
//  listener and suffer the same fate + animation.
//
//  ── Animation ───────────────────────────────────────────────────
//  Each affected Creature shows a cartoony floating "Z z z" sleeping
//  effect (`unwanted_audience_zzz`).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Unwanted Audience';
const BUFF_KEY  = 'unwanted_audience_negated';

/**
 * Does this support-zone instance have an ACTIVE (manually-triggered)
 * effect? Mirrors the engine's own activatable-effect gate
 * (`script.creatureEffect`, honouring `_effectOverride`).
 */
function creatureHasActiveEffect(engine, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || !hasCardType(cd, 'Creature')) return false;
  const effectName = inst.counters?._effectOverride || inst.name;
  const s = loadCardEffect(effectName);
  return !!s?.creatureEffect;
}

/**
 * Put one Creature "to sleep": apply the cleansable `negated` status
 * expiring at the end of the opponent's turn, and — only if the
 * negation actually stuck (not Cardinal/Gate-immune) — play the Zzz.
 * @param {number} ownerPi - the Unwanted Audience controller (drives expiry)
 */
async function sleepCreature(engine, inst, ownerPi) {
  if (!inst || inst.counters?.negated) return;
  await engine.actionNegateCreature(inst, CARD_NAME, {
    // Current turn is the OPPONENT's; it ends when ownerPi's next
    // turn starts (gs.turn + 1 / expiresForPlayer = ownerPi). Same
    // arithmetic Jump in the River uses for its turn-scoped buff.
    expiresAtTurn: engine.gs.turn + 1,
    expiresForPlayer: ownerPi,
    cleansable: true,            // ← Beer / Juice may heal THIS negation
    buffKey: BUFF_KEY,
  });
  if (inst.counters?.negated) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'unwanted_audience_zzz',
      owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      duration: 1700,
    });
  }
}

module.exports = {
  // CPU: confirm Unwanted Audience's "play it?" prompt — the default brain
  // declines cancellable confirms outside a card-cast (onTurnStart trigger),
  // so without this the CPU never plays this disruption. (Title == card name.)
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type === 'confirm' && !promptData.showCard) return { confirmed: true };
    return undefined;
  },
  // Fire hooks from hand (the onTurnStart trigger) AND discard (the
  // catch-later-summons listener, after the card resolves there).
  activeIn: ['hand', 'discard'],

  // Never proactively playable — only via the onTurnStart trigger.
  // (Deliberately NOT `isReaction`; see header.)
  spellPlayCondition() { return false; },

  hooks: {
    /**
     * Beginning of the OPPONENT's turn: offer to play the card.
     */
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;   // only a hand copy triggers
      if (ctx.isMyTurn) return;              // only on the opponent's turn

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      // One prompt per turn even with multiple copies in hand.
      if (gs._unwantedAudiencePromptDone === gs.turn) return;
      gs._unwantedAudiencePromptDone = gs.turn;

      const ps = gs.players[pi];
      if (!ps?.hand?.includes(CARD_NAME)) return;

      const want = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: "Play Unwanted Audience? Your opponent's Creatures with active effects can't use them this turn.",
        confirmLabel: '🎭 Yes!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!want) return;

      // Remove one copy from hand, keep its instance (it becomes the
      // discard-resident listener for later summons).
      const removeIdx = ps.hand.indexOf(CARD_NAME);
      if (removeIdx < 0) return;

      // Zone-anchored hand→discard flight. This card is removed from
      // hand here and pushed to discard only AFTER executeCardWithChain
      // — across the chain's intervening syncs the client's diff-based
      // fly-out detector can't pair the hand-shrink with the later
      // discard-grow, so the card would just TELEPORT into the pile.
      // Broadcast an explicit pile-transfer BEFORE the splice (hand
      // slot still rendered → accurate source rect). The card always
      // ends up in discard (even if countered), so the flight is
      // correct unconditionally. `fromHandIdx` = pre-splice slot, per
      // the engine's canonical hand→pile pattern.
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: CARD_NAME,
        from: 'hand', to: 'discard',
        fromHandIdx: removeIdx,
      });

      ps.hand.splice(removeIdx, 1);
      const inst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME);

      // Reveal to opponent + spectators (same etiquette as Jump in the River).
      const oppIdx = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oppIdx]?.socketId;
      if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME });
      if (engine.room?.spectators) {
        for (const spec of engine.room.spectators) {
          if (spec.socketId) engine.io.to(spec.socketId).emit('card_reveal', { cardName: CARD_NAME });
        }
      }
      await engine._delay(100);

      const chainResult = await engine.executeCardWithChain({
        cardName: CARD_NAME,
        owner: pi,
        cardType: 'Spell',
        goldCost: 0,
        // Runs ONLY if the card isn't countered in the chain window.
        resolve: async () => {
          // Arm the turn-scoped aura so later opponent summons are
          // caught by the discard listener below.
          gs._unwantedAudience = { player: oppIdx, owner: pi, turn: gs.turn };

          // Put every current opponent Creature with an active
          // effect to sleep. (Snapshot the ids first — sleepCreature
          // mutates counters; iterating cardInstances live is fine
          // but we filter defensively.)
          for (const cInst of [...engine.cardInstances]) {
            if ((cInst.controller ?? cInst.owner) !== oppIdx) continue;
            if (!creatureHasActiveEffect(engine, cInst)) continue;
            await sleepCreature(engine, cInst, pi);
          }
          engine.log('unwanted_audience', {
            player: ps.username, target: gs.players[oppIdx]?.username,
          });
          return { success: true };
        },
      });

      // Card always heads to discard — but KEEP its instance tracked
      // (zone → discard) so its onCardEnterZone listener can catch
      // Creatures summoned later this turn. (Jump in the River
      // untracks here; this card must not, hence the manual move.)
      if (inst) {
        inst.zone = 'discard';
        inst.heroIdx = -1;
        inst.zoneSlot = -1;
      }
      ps.discardPile.push(CARD_NAME);

      if (chainResult.negated) {
        engine.log('unwanted_audience_negated', { player: ps.username });
      }
      engine.sync();
    },

    /**
     * A Creature the opponent summons LATER this turn also falls
     * asleep. Fires from the discard-resident instance (onCardEnterZone
     * is broadcast without `_onlyCard`, so passive listeners see it).
     */
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const ua = gs._unwantedAudience;
      if (!ua || ua.turn !== gs.turn) return;        // aura not armed this turn
      if (ctx.toZone !== 'support') return;
      const inst = ctx.enteringCard;
      if (!inst) return;
      if ((inst.controller ?? inst.owner) !== ua.player) return;  // opponent's side only
      if (inst.counters?.negated) return;            // already asleep (idempotent vs. dup copies)
      if (!creatureHasActiveEffect(engine, inst)) return;
      await sleepCreature(engine, inst, ua.owner);
      engine.sync();
    },

    /**
     * Disarm at the end of the opponent's turn (the negation buffs
     * expire on their own via actionNegateCreature's timed buff).
     */
    onTurnEnd: async (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._unwantedAudience && gs._unwantedAudience.turn === gs.turn) {
        delete gs._unwantedAudience;
      }
    },
  },
};
