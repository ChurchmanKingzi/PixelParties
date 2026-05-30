// ═══════════════════════════════════════════
//  CARD EFFECT: "Anti Magic Zone"
//  Spell (Decay Magic Lv2, Normal)
//
//  Applies the `magic_silenced` negative status
//  to EVERY target on the board (Heroes and
//  Creatures, both sides) until the end of the
//  opponent's next turn. The status:
//   • blocks Spell casting on Heroes (Attacks,
//     Abilities, Hero effects, Artifacts all
//     still work);
//   • fully negates Creature effects (same as
//     `negated` / `nulled`);
//   • is cleansable per-target via standard
//     status healing (Juice, Beer, Cure, etc.).
//
//  Creatures summoned during the window
//  auto-receive the status — this script's
//  discard-zone `onCardEnterZone` listener
//  watches for support-zone Creature arrivals
//  and applies the status with the original
//  cast's expiry.
//
//  Duration wiring:
//   • expiresAtTurn = gs.turn + 2  (caster's
//     turn N → opp's turn N+1 → caster's turn
//     N+2: cleanup fires at the start of
//     caster's NEXT turn, i.e. AT the end of
//     opp's next turn).
//   • expiresForPlayer = caster's index (pi).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Anti Magic Zone';
const STATUS_NAME = 'magic_silenced';
// Anti Magic protection check is centralised in the engine. The
// engine's `addHeroStatus` already honours `magic_immune` against any
// resolving Spell (its own gate consults `_currentResolvingSpellName`,
// which is pushed for us at the Spell-resolution entry point), so
// individual per-target applies don't need a manual check.
//
// We DO still call `_isHeroSpellProtected` locally — but only as an
// UP-FRONT animation filter so the big board-wide `dark_swarm` burst
// at the top of onPlay skips Anti-Magic-protected Heroes (visually
// telegraphing that the Spell can't touch them). The engine's
// status-apply gate is what makes the rule actually enforced, even
// for Heroes that wouldn't have been skipped here.

/** Returns true iff the AMZ window with given expiry is still active. */
function windowActive(gs, expiresAtTurn, expiresForPlayer) {
  if (typeof expiresAtTurn !== 'number') return false;
  const t = gs?.turn ?? 0;
  if (t < expiresAtTurn) return true;
  if (t > expiresAtTurn) return false;
  // t === expiresAtTurn — active until the cleanup fires at the
  // start of `expiresForPlayer`'s turn.
  return (gs.activePlayer ?? -1) !== expiresForPlayer;
}

/** Apply the status to one Hero with the given expiry. Idempotent —
 *  later calls with the same target overwrite (refreshes expiry). */
async function applyToHero(engine, ownerIdx, heroIdx, expiresAtTurn, expiresForPlayer, sourceOwner) {
  const hero = engine.gs.players[ownerIdx]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return;
  await engine.addHeroStatus(ownerIdx, heroIdx, STATUS_NAME, {
    expiresAtTurn,
    expiresForPlayer,
    appliedBy: sourceOwner,
    source: CARD_NAME,
    animationType: 'dark_swarm',
  });
}

/** Apply the status to one face-up Creature with the given expiry.
 *  Routes through `actionNegateCreature` so the engine handles:
 *    • Cardinal Beast / `_cardinalImmune` immunity (Beasts stay unsilenced),
 *    • `selfInflicted: true` to skip Defending the Gate (the silence is
 *      not a removal — Anti Magic Zone is a global effect, not opp
 *      board interference),
 *    • the canonical buffs[<buffKey>].clearCountersOnExpire pattern
 *      so the standard status-expiry sweep clears the silence at
 *      `expiresAtTurn` / `expiresForPlayer`. */
async function applyToCreature(engine, inst, expiresAtTurn, expiresForPlayer) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return;
  await engine.actionNegateCreature(inst, CARD_NAME, {
    statusKey: STATUS_NAME,
    // `magic_silenced` is cleansable by default (STATUS_EFFECTS), so
    // the per-instance Cleansable flag isn't strictly required — but
    // setting it is harmless and matches the convention used by
    // future "negated-but-cleansable" cards.
    cleansable: true,
    selfInflicted: true,
    expiresAtTurn,
    expiresForPlayer,
    buffKey: '_anti_magic_zone_silenced',
  });
}

module.exports = {
  activeIn: ['hand', 'discard'],

  hooks: {
    onPlay: async (ctx) => {
      // Only on the actual cast — the discard-zone listener uses
      // onCardEnterZone, not onPlay.
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;

      // "Until end of opp's next turn" = expiresAtTurn = current turn
      // + 2, expiresForPlayer = caster. Cleanup fires at the start of
      // caster's NEXT turn (turn N+2), which IS the end of opp's
      // next turn (N+1).
      const expiresAtTurn = (gs.turn || 0) + 2;
      const expiresForPlayer = pi;

      // Board-wide dark-magic swarm — hits every alive Hero AND
      // every face-up Creature on both sides simultaneously, so the
      // global silence reads as ONE big beat. Per-target swarm anims
      // are also fired by addHeroStatus / actionNegateCreature
      // (animationType: 'dark_swarm'), but those play during the
      // status-apply micro-steps; this up-front burst telegraphs
      // the spell's full board reach before any individual status
      // animation starts.
      for (let p = 0; p < 2; p++) {
        const ps = gs.players[p];
        for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          // Anti-Magic-protected Heroes: skip the dark_swarm and play
          // the blue shield bubble instead (canonical "Anti Magic just
          // negated something" visual, shared with the per-target
          // engine gates in `addHeroStatus`, `_actionDealDamageImpl`,
          // etc.). Other immunities (Karian / Johanna /
          // negative_status_immune / shielded) DO get the swarm here
          // because the engine's `addHeroStatus` plays its own blocked
          // anim on the rejected apply path, so the up-front burst +
          // blocked replay together read as "spell tried but bounced".
          if (engine._isHeroSpellProtected(hero, CARD_NAME)) {
            engine._playAntiMagicBlockedAnim(hero);
            continue;
          }
          engine._broadcastEvent('play_zone_animation', {
            type: 'dark_swarm', owner: p, heroIdx: hi, zoneSlot: -1,
          });
        }
        for (const inst of engine.cardInstances) {
          if (inst.zone !== 'support') continue;
          if ((inst.controller ?? inst.owner) !== p) continue;
          if (inst.faceDown) continue;
          const cd = engine._getCardDB()[inst.name];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          engine._broadcastEvent('play_zone_animation', {
            type: 'dark_swarm', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
          });
        }
      }
      await engine._delay(500);

      // Apply to every alive Hero, both sides. The engine's
      // `addHeroStatus` is responsible for honouring:
      //   • Karian's `magic_silence_immune` (per-status immuneKey),
      //   • Johanna's sibling-Hero negative-status protection,
      //   • `negative_status_immune` buff (Divine Gift of Coolness, …),
      //   • first-turn `shielded`, `submerged`, charmed.
      // Anti-Magic Spell-protection (`magic_immune` level >= 2) is the
      // ONE immunity the engine doesn't gate at status-apply time, so
      // we filter it locally before calling.
      for (let p = 0; p < 2; p++) {
        const ps = gs.players[p];
        for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (engine._isHeroSpellProtected(hero, CARD_NAME)) continue;
          await applyToHero(engine, p, hi, expiresAtTurn, expiresForPlayer, pi);
        }
      }

      // Apply to every face-up support Creature, both sides.
      const allInsts = [...engine.cardInstances];
      for (const inst of allInsts) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine._getCardDB()[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        await applyToCreature(engine, inst, expiresAtTurn, expiresForPlayer);
      }

      // Stamp the cast's expiry on this card instance — the
      // discard-zone listener below reads it from each AMZ in
      // discard to decide whether the auto-apply window is still
      // open for newly-summoned Creatures. Multiple AMZ casts
      // coexist in discard; each applies independently with its
      // own expiry.
      ctx.card.counters = ctx.card.counters || {};
      ctx.card.counters._amzExpiresAtTurn   = expiresAtTurn;
      ctx.card.counters._amzExpiresForPlayer = expiresForPlayer;

      engine.log('anti_magic_zone_cast', {
        player: gs.players[pi]?.username,
        expiresAtTurn, expiresForPlayer,
      });
      engine.sync();
    },

    // While in discard, watch for new Creatures landing on the board
    // and auto-apply the status — but only while THIS instance's
    // window is still open. Multiple AMZ casts each get their own
    // listener; addHeroStatus / applyCreatureStatus are idempotent
    // so duplicate applications on the same target are harmless.
    onCardEnterZone: async (ctx) => {
      if (ctx.cardZone !== 'discard') return;
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx.toZone !== 'support') return;
      const engine = ctx._engine;
      const cd = engine._getCardDB()[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;
      if (entering.faceDown) return; // Bakhm face-down placement — not yet active

      const expiresAtTurn = ctx.card.counters?._amzExpiresAtTurn;
      const expiresForPlayer = ctx.card.counters?._amzExpiresForPlayer;
      if (!windowActive(engine.gs, expiresAtTurn, expiresForPlayer)) return;

      await applyToCreature(engine, entering, expiresAtTurn, expiresForPlayer);
    },
  },
};
