// ═══════════════════════════════════════════
//  CARD EFFECT: "Forbidden Zone"
//  Spell (Decay Magic Lv3, Normal) — Banned base
//
//  Inflict 50 damage to all targets your opponent
//  controls. Heroes hit by this Spell cannot
//  perform an Action and Creatures have their
//  effects negated until the end of your
//  opponent's turn. This counts as a negative
//  status effect. Delete this card.
//
//  Implementation
//  ──────────────
//  • Targets: every alive opp Hero + every opp
//    Creature in support zones. Cardinal Beasts
//    and other generically-immune Creatures are
//    skipped via the engine's existing creature
//    damage / status guards.
//  • Damage: 50 destruction_spell on each target,
//    in turn-player order so on-damage hooks
//    settle deterministically.
//  • Hero lockout: applied as the new 'bound'
//    status — a negative status that ONLY blocks
//    Actions (spell/attack/creature plays,
//    ability-action activations, hero-effect
//    activations). Unlike Stunned, Bound does
//    NOT silence the hero's hooks: their
//    abilities, hero passives, and creature
//    effects keep firing. Expires at the start
//    of the caster's NEXT-NEXT turn — i.e.
//    through the caster's remaining turn, the
//    opponent's full turn, then lifts when the
//    caster's next turn begins. Matches "until
//    the end of your opponent's turn".
//  • Creature negation: actionNegateCreature
//    with the same expiry. The engine's buff
//    expiry pass already auto-clears the
//    `negated` counter when the buff lifts, so
//    no custom cleanup hook is needed.
//  • Deletion: the spell prevents the standard
//    "send to discard" via `_spellPlacedOnBoard`
//    and routes itself into the deletedPile.
//  • Animation: a battlefield-wide eerie red
//    light overlay broadcast as
//    `forbidden_zone_overlay`. Per-target
//    damage hits keep their normal red flash.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Forbidden Zone';
const DAMAGE    = 50;

module.exports = {
  activeIn: ['hand'],
  // Engine routes hand-reaction windows by this flag, but the standard
  // doPlaySpell path doesn't honour it — see the manual deletedPile
  // routing in onPlay below. The flag is kept on the script for
  // documentation + parity with similar one-shot delete spells.
  deleteOnUse: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine   = ctx._engine;
      const gs       = engine.gs;
      const pi       = ctx.cardOwner;
      const heroIdx  = ctx.cardHeroIdx;
      const ps       = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const oppIdx = pi === 0 ? 1 : 0;
      const oppPs  = gs.players[oppIdx];
      if (!oppPs) { gs._spellCancelled = true; return; }

      // ── Step 1: eerie red battlefield overlay ──
      // Client owns the actual fade — we just announce duration.
      engine._broadcastEvent('forbidden_zone_overlay', {
        source: pi, durationMs: 2200,
      });
      await engine._delay(400);

      // ── Step 2: snapshot opp targets BEFORE any damage so on-death
      //         cascades don't shorten the list mid-iteration. ──
      const cardDB = engine._getCardDB();
      const heroTargets = [];
      for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
        const h = oppPs.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        heroTargets.push({ heroIdx: hi });
      }
      const creatureTargetIds = [];
      for (const inst of engine.cardInstances) {
        if (inst.owner !== oppIdx || inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        creatureTargetIds.push(inst.id);
      }

      // Common expiry stamp for the lockout/negation: at the start of
      // caster's NEXT-NEXT turn (turn N → N+2). That spans the
      // caster's current turn + the opponent's full turn before
      // lifting. Engine's processStatusExpiry runs at PHASE.START.
      const expiresAtTurn    = gs.turn + 2;
      const expiresForPlayer = pi;

      // ── Step 3: deal damage + apply lockout to every alive opp Hero ──
      for (const t of heroTargets) {
        const hero = oppPs.heroes[t.heroIdx];
        if (!hero || hero.hp <= 0) continue;
        await ctx.dealDamage(hero, DAMAGE, 'decay_spell');
        // After-damage state: hero may have died from the hit. Skip the
        // lockout in that case — a dead hero can't act anyway, and
        // adding a status to a corpse breaks the "alive heroes only"
        // contract elsewhere in the engine.
        const stillAlive = oppPs.heroes[t.heroIdx];
        if (!stillAlive || stillAlive.hp <= 0) continue;
        await engine.addHeroStatus(oppIdx, t.heroIdx, 'bound', {
          appliedBy: pi,
          expiresAtTurn,
          expiresForPlayer,
          _skipReactionCheck: true,
        });
      }

      // ── Step 4: damage opp Creatures + negate survivors ──
      for (const id of creatureTargetIds) {
        const inst = engine.cardInstances.find(c => c.id === id);
        if (!inst || inst.zone !== 'support') continue;
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx },
          inst, DAMAGE, 'decay_spell',
          { sourceOwner: pi, canBeNegated: true },
        );
        // Verify the creature is still on the board after damage.
        const stillOn = engine.cardInstances.find(c => c.id === id);
        if (!stillOn || stillOn.zone !== 'support') continue;
        // canApplyCreatureStatus respects _cardinalImmune + faceDown +
        // gate-shield, so this doesn't need its own immunity guard.
        if (!engine.canApplyCreatureStatus(stillOn, 'negated')) continue;
        engine.actionNegateCreature(stillOn, CARD_NAME, {
          expiresAtTurn,
          expiresForPlayer,
        });
      }

      // ── Step 5: route the spell into the deleted pile ──
      // Block the standard discard-pile routing in server.js. The flag
      // is consumed there, the engine's own `_untrackCard` is bypassed
      // when `_spellPlacedOnBoard` is set, so we handle untracking
      // ourselves here.
      gs._spellPlacedOnBoard = true;
      ps.deletedPile.push(CARD_NAME);
      engine._untrackCard(ctx.card.id);

      engine.log('forbidden_zone', {
        player: ps.username,
        heroesHit: heroTargets.length,
        creaturesHit: creatureTargetIds.length,
        expiresAtTurn,
      });

      engine.sync();
    },
  },
};
