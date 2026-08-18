// ═══════════════════════════════════════════
//  CARD EFFECT: "Demon's Gate"
//  Creature (Summoning Magic Lv3, 250 HP)
//
//  "You may once per turn use a Destruction or Decay Magic Spell from
//   your hand as an additional Action with this Creature as if it had
//   Destruction Magic 3 or Decay Magic 3."
//
//  Demon's Gate is the canonical "Creature casts a Spell" source:
//
//   • In-hand Normal-subtype Destruction or Decay Magic Spells are
//     eligible — any level. The Spell's normal school / level / hero-
//     state requirements are bypassed (the Creature is the caster).
//
//   • The Spell scales as if its school is Lv3. Phoenix Tackle → 300
//     damage, Burning Finger → 240, Draw → "you 6 / opp 3", Slow →
//     4 forced discards, Venom Infusion → unhealable Poison, The
//     Warlord's Bite → 4 Poison stacks, Fire Bolts → enhanced mode
//     auto-eligible. Implemented engine-side via
//     `gs._castSchoolOverride` consumed by
//     `engine.effectiveSchoolLevelForCaster(school, pi, heroIdx)`.
//     Performance on the host hero does NOT stack on top — the
//     override IS the final level the Spell sees.
//
//   • Caster identity for animations, recoil, and retaliation is
//     Demon's Gate itself:
//       – `_spellCasterOverride` re-anchors caster-side animations
//         (beams / projectiles / rams) on Demon's Gate's support slot.
//       – `_spellCasterCreature` rewrites the damage source presented
//         to surprise / `afterDamage` reaction windows so Booby Trap
//         + Fireshield's `isCreatureSource` returns true and their
//         recoil hits Demon's Gate (not the host hero).
//       – Recoil-style ctx patches redirect `dealDamage(castingHero, …)`
//         (Phoenix Tackle, Fire Bolts) to `actionDealCreatureDamage`
//         on Demon's Gate. Same patch shape as Skeleton Priest.
//
//   • Cancelling out of the Spell's target prompt does NOT consume
//     Demon's Gate's once-per-turn slot — the cost is "paid" only on
//     commit (the player can pick a different Spell, or wait until
//     next turn).
//
//   • Reaction subtype is excluded (Reactions can't be played
//     proactively); Surprise / Area subtypes are excluded too — only
//     Normal-subtype Spells are eligible per design.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = "Demon's Gate";
const AS_IF_SCHOOL_LEVEL = 3;

/** Spells in this player's hand eligible for Demon's Gate's cast.
 *
 *  Demon's Gate's "as if Destruction Magic 3 or Decay Magic 3" override
 *  only waives the school / level requirement — it does NOT bypass a
 *  Spell's own play conditions. Flame Avalanche's "must be the first
 *  damage of the turn" gate (and any future per-Spell precondition
 *  declared via `spellPlayCondition`) must still apply, otherwise
 *  Demon's Gate would unlock Spells the player couldn't legally cast
 *  even with the schools met.
 */
function eligibleHandIndices(engine, ps, pi) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (let i = 0; i < (ps.hand || []).length; i++) {
    const name = ps.hand[i];
    const cd = cardDB[name];
    if (!cd) continue;
    if (cd.cardType !== 'Spell') continue;
    if ((cd.subtype || '').toLowerCase() !== 'normal') continue;
    const isDestructionOrDecay =
      cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic'
      || cd.spellSchool1 === 'Decay Magic'     || cd.spellSchool2 === 'Decay Magic';
    if (!isDestructionOrDecay) continue;
    // Per-Spell play condition (Flame Avalanche "must be first damage",
    // Disruption Ray opp-must-have-targets, Cold Coffin pollution
    // pre-cost, etc.). Defensive try/catch — a buggy condition shouldn't
    // crash the picker; we just treat it as ineligible.
    const script = loadCardEffect(name);
    if (typeof script?.spellPlayCondition === 'function') {
      let ok = false;
      try { ok = !!script.spellPlayCondition(engine.gs, pi, engine); }
      catch { ok = false; }
      if (!ok) continue;
    }
    out.push(i);
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    return eligibleHandIndices(engine, ps, pi).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const gateInst = ctx.card;
    if (!gateInst) return false;
    const heroIdx = gateInst.heroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    const castingHero = ps.heroes?.[heroIdx] || null;

    const eligibleIdx = eligibleHandIndices(engine, ps, pi);
    if (eligibleIdx.length === 0) return false;

    // ── Step 1: in-hand pick (handPick, not gallery) ──
    // Per the project's "handPick over gallery" rule, any pick from the
    // player's own hand must use the in-place handPick prompt.
    const result = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: CARD_NAME,
      description: 'Choose a Destruction or Decay Magic Spell to cast through Demon’s Gate (as if it had Destruction Magic 3 or Decay Magic 3).',
      eligibleIndices: eligibleIdx,
      minSelect: 1,
      maxSelect: 1,
      cancellable: true,
      confirmLabel: '🔥 Cast!',
      // Einsatz-Pick, kein Mulligan (18.8.). Ohne diesen Marker wies
      // der generische CPU-Handler dem Gate die SCHLECHTESTE Karte zu
      // — er ist fuer Abwurf gebaut und sortiert aufsteigend. Mit ihm
      // laeuft die Wahl ueber `tutorPickRules['Demon’s Gate→<Spell>']`
      // und MCTS. Betrifft nur die CPU; menschliche Zuege unveraendert.
      pickIntent: 'use',
    });
    if (!result || result.cancelled
        || !Array.isArray(result.selectedCards)
        || result.selectedCards.length === 0) {
      return false; // No commitment yet — HOPT not consumed.
    }
    const pick = result.selectedCards[0];
    const handIndex = pick.handIndex;
    const spellName = pick.cardName;

    // Defensive: re-verify the pick.
    if (typeof handIndex !== 'number' || ps.hand[handIndex] !== spellName) return false;
    const cardDB = engine._getCardDB();
    const cd = cardDB[spellName];
    if (!cd || cd.cardType !== 'Spell') return false;
    if ((cd.subtype || '').toLowerCase() !== 'normal') return false;
    const school = (cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic')
      ? 'Destruction Magic'
      : (cd.spellSchool1 === 'Decay Magic' || cd.spellSchool2 === 'Decay Magic')
        ? 'Decay Magic'
        : null;
    if (!school) return false;

    // ── Step 2: set engine overrides for the duration of the cast ──
    // Animation override (host-hero-anchored caster events re-anchor on
    // Demon's Gate's support slot) — same hook Wolflesia / Skeleton
    // Priest use.
    const prevCasterOverride = gs._spellCasterOverride;
    gs._spellCasterOverride = {
      owner: gateInst.owner,
      heroIdx: gateInst.heroIdx,
      zoneSlot: gateInst.zoneSlot,
    };
    // Source-rewrite override — surprise / afterDamage / Fireshield
    // treat Demon's Gate as the attacker so recoil routes here.
    const prevCasterCreature = gs._spellCasterCreature;
    gs._spellCasterCreature = gateInst;
    // School-level scaling override — Phoenix Tackle's 100/200/300,
    // Slow's 2/3/4, Venom Infusion's Lv3 gate, etc. all see Lv3 for
    // whichever school the Spell belongs to.
    const prevSchoolOverride = gs._castSchoolOverride;
    gs._castSchoolOverride = { [school]: AS_IF_SCHOOL_LEVEL };

    // Track an in-hand instance of the Spell so its onPlay sees a
    // typical-shaped ctx (host hero idx + 'hand' zone). The Spell will
    // never be physically in a "real" hand index from the engine's
    // perspective — we treat the activation as a one-shot cast.
    const spellInst = engine._trackCard(spellName, pi, 'hand', heroIdx, -1);
    spellInst.turnPlayed = gs.turn || 0;

    // Build the cast ctx and patch self-targeting helpers so anything
    // the Spell would do to "the casting hero" (Phoenix Tackle's
    // recoil, Fire Bolts' recoil, healing self) lands on Demon's Gate
    // instead. Mirrors Skeleton Priest's pattern.
    const spellCtx = engine._createContext(spellInst, {
      playedCard: spellInst, cardName: spellName, zone: 'hand',
      heroIdx,
      _onlyCard: spellInst, _skipReactionCheck: true,
      _viaDemonsGate: true,
    });
    const origDealDamage = spellCtx.dealDamage;
    const origDealTrueDamage = spellCtx.dealTrueDamage;
    const origHealHero = spellCtx.healHero;
    spellCtx.dealDamage = async (target, amount, type) => {
      if (target && castingHero && target === castingHero) {
        return engine.actionDealCreatureDamage(
          spellInst, gateInst, amount, type || 'other',
          { sourceOwner: pi, canBeNegated: false },
        );
      }
      return origDealDamage(target, amount, type);
    };
    spellCtx.dealTrueDamage = async (target, amount, type, opts) => {
      if (target && castingHero && target === castingHero) {
        return engine.actionDealTrueDamage(
          spellInst, gateInst, amount,
          { ...(opts || {}), type: type || 'other' },
        );
      }
      return origDealTrueDamage(target, amount, type, opts);
    };
    spellCtx.healHero = async (target, amount) => {
      if (target && castingHero && target === castingHero) {
        return engine.actionHealCreature(spellInst, gateInst, amount);
      }
      return origHealHero(target, amount);
    };

    // Reset the cancel flag so we can detect a fresh cancellation
    // inside this nested cast (Phoenix Tackle's target prompt etc.).
    const prevCancelled = gs._spellCancelled;
    gs._spellCancelled = false;

    let castError = null;
    try {
      const script = loadCardEffect(spellName);
      if (typeof script?.hooks?.onPlay === 'function') {
        await script.hooks.onPlay(spellCtx);
      }
    } catch (err) {
      castError = err;
      console.error(`[Demon's Gate] spell '${spellName}' onPlay threw:`, err.message);
    }

    const cancelled = gs._spellCancelled === true;
    // Restore flags so we don't leak this cast's state into any outer
    // flow / next spell.
    gs._spellCancelled = prevCancelled;
    if (prevCasterOverride === undefined) delete gs._spellCasterOverride;
    else gs._spellCasterOverride = prevCasterOverride;
    if (prevCasterCreature === undefined) delete gs._spellCasterCreature;
    else gs._spellCasterCreature = prevCasterCreature;
    if (prevSchoolOverride === undefined) delete gs._castSchoolOverride;
    else gs._castSchoolOverride = prevSchoolOverride;
    engine._untrackCard(spellInst.id);

    // Cancelled prompt or thrown cast → no cost paid, no HOPT burned.
    // Spell stays in hand at its original index (we never spliced it).
    if (cancelled || castError) {
      engine.sync();
      return false;
    }

    // ── Step 3: commit. Spell moves from hand → discard. ──
    // Re-find the actual index (downstream listeners might have
    // shifted the hand — paranoid lookup mirrors Skeleton Priest).
    const finalIdx = ps.hand.indexOf(spellName);
    if (finalIdx >= 0) {
      // Hand→discard flight (zone-anchored play_pile_transfer before
      // the splice, per the project's "Removing a chosen board card"
      // rule applied to hand→pile movement — the diff animator would
      // otherwise pick the leftmost copy if the hand had duplicates).
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: spellName,
        from: 'hand', to: 'discard',
        fromHandIdx: finalIdx,
        // `asPlay: 'sole'` — einziges Play-Signal dieser Karte.
        // Als Verdachtsfall "Destruction-Spells mit 0% Cast-Rate": der
        // Cast lief real (2989 Demon's-Gate-Aktivierungen in 1360
        // Spielen), tauchte im Report aber mit plays 0 auf. Grund: der
        // Gate castet mit `script.hooks.onPlay(spellCtx)` DIREKT und
        // umgeht damit die Spell-Pipeline — `afterSpellResolved` feuert
        // nie, und über diesen Hook zählt der Recorder Spells sonst.
        // Der Transfer war schon da, trug aber keinen Marker. 'sole'
        // statt `true`, weil `true` Spell/Attack bewusst überspringt
        // (Doppelzählung mit afterSpellResolved) — die hier gibt es
        // gerade NICHT.
        asPlay: 'sole',
      });
      ps.hand.splice(finalIdx, 1);
      ps.discardPile.push(spellName);
    }

    engine.log('demons_gate_cast', {
      player: ps.username, spell: spellName, school,
      asIfLevel: AS_IF_SCHOOL_LEVEL,
    });
    engine.sync();
    return true;
  },
};
