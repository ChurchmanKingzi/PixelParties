// ═══════════════════════════════════════════
//  CARD EFFECT: "Trial of Dominance"
//  Spell (Destruction Magic Lv1, Normal, Trials)
//
//  • You cannot play other Attacks or Spells the
//    turn you play this card.
//  • Defeat all Creatures your opponent controls
//    and delete them.
//  • You can only play 1 "Trial of Dominance" per
//    game.
//
//  Implementation notes (mirrors the Trials
//  sibling `trial-of-coolness.js`):
//   • `oncePerGame` + a key UNIQUE to this card —
//     "1 Trial of Dominance per game" is per card
//     name, not shared across the archetype.
//   • The Attack/Spell lock is symmetric, exactly
//     like Trial of Coolness: `spellPlayCondition`
//     refuses the play if an Attack/Spell already
//     ran this turn, and on resolve we stamp
//     `ps._attackSpellLockedTurn = gs.turn` so the
//     engine's `validateActionPlay` blocks any
//     further Attack/Spell this turn. The lock is
//     stamped even when the wipe hits nothing —
//     you still spent the Trial.
//   • "Defeat … and delete": route each opponent
//     Creature through `actionDestroyCard` (fires
//     ON_CREATURE_DEATH, honours Cardinal / Gate /
//     Monia / Cosmic / first-turn / immovable
//     protections — same as every other removal),
//     with `inst._redirectToDeleted = true` so the
//     engine's standard discard→deleted reroute
//     (see actionMoveCard) sends the bodies to the
//     Deleted pile instead of the discard pile.
//   • Not `requiresTarget`: this is an untargeted
//     full-board wipe (no pick), so Blinded does
//     not gate it — matching MOE Bomb / Flame
//     Avalanche.
//
//  ANIMATION: blood-red hearts bloom around every
//  affected Creature, then the engine's diff-based
//  pile-flight animates each body from its slot to
//  the Deleted pile.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
// v481: Schluessel und Rundenriegel kommen aus dem gemeinsamen Modul.
// `The Final Trial` liest dieselbe Liste — zwei Kopien waeren eine
// Driftfalle. Verhalten unveraendert, nur die Quelle der Wahrheit.
const { TRIAL_KEYS, trialTurnIsClean, stampTrialLock } = require('./_trials-shared');

const CARD_NAME = 'Trial of Dominance';
const ONCE_PER_GAME_KEY = TRIAL_KEYS[CARD_NAME];
const HEART_MS = 950;

/** Live, non-face-down Creatures the opponent controls. */
function collectOpponentCreatures(engine, oppIdx) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== oppIdx) continue;
    if (inst.faceDown) continue; // face-down surprises aren't "Creatures in play"
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  oncePerGame: true,
  oncePerGameKey: ONCE_PER_GAME_KEY,

  // Symmetric Attack/Spell lock (mirrors Trial of Coolness): the turn
  // must be Trial-or-nothing — refuse if an Attack/Spell already ran.
  spellPlayCondition(gs, pi) {
    return trialTurnIsClean(gs, pi);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      const oppIdx = pi === 0 ? 1 : 0;

      // Lock out further Attacks/Spells this turn — stamped regardless
      // of whether the wipe hits anything (the Trial was still played).
      stampTrialLock(gs, pi);

      const creatures = collectOpponentCreatures(engine, oppIdx);

      if (creatures.length === 0) {
        engine.log('trial_of_dominance', {
          player: ps.username, defeated: 0, note: 'no_opponent_creatures',
        });
        engine.sync();
        return;
      }

      // ── Blood-red hearts bloom on every affected Creature ──
      for (const inst of creatures) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'blood_hearts',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          zoneSlot: inst.zoneSlot,
        });
      }
      await engine._delay(HEART_MS);

      // ── Defeat + delete each ──
      // Snapshot already taken (`creatures`); actionDestroyCard mutates
      // cardInstances / zones as it goes. Sequential awaits naturally
      // stagger the per-body deleted-pile flights.
      const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx, controller: pi };
      let defeated = 0;
      for (const inst of creatures) {
        // Still a live support Creature? (an earlier death-trigger in
        // this same loop could have removed it.)
        if (!inst || inst.zone !== 'support') continue;
        inst._redirectToDeleted = true; // discard→deleted reroute
        await engine.actionDestroyCard(source, inst);
        defeated++;
      }

      engine.log('trial_of_dominance', { player: ps.username, defeated });
      engine.sync();
    },
  },
};
