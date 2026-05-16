// ═══════════════════════════════════════════
//  CARD EFFECT: "Timeless King Zi"
//  Hero (HP 400 / ATK 40, Magic Arts + Trade)
//
//  "You may spend your Action to reveal 3 Spells
//   with different names whose total levels do not
//   exceed 6 from your deck. Your opponent chooses
//   1 of them. This Hero immediately performs that
//   Spell, regardless of its level, if possible.
//   Delete the other Spells."
//
//  FLOW
//  ────
//   1. canActivateHeroEffect: a valid pick must
//      EXIST — ≥3 different-named Spells in deck
//      and the 3 SMALLEST distinct-name levels sum
//      ≤ 6 (3 smallest = minimum achievable sum, so
//      if that's > 6 no legal trio exists).
//   2. `cardGalleryMulti` over every unique-named
//      deck Spell (Surprises & Reactions excluded —
//      a Hero can't perform those on demand).
//      `validCounts:[3]` → Confirm only
//      at exactly 3; `maxBudget:6` + `costKey:level`
//      → any Spell that would push the running
//      level total past 6 greys out, and a 4th
//      pick is impossible. Clicking a selected
//      Spell deselects it. `hideCostUI` hides the
//      gold-flavoured budget chrome (this budget is
//      "levels", not gold).
//   3. Reveal the 3 in the centre (Birthday-Present
//      pattern: fly in one-by-one, flip, hold) and
//      let the OPPONENT click one
//      (`birthdayPresentPick`).
//   4. `timeless_king_reveal_clear`: the 2 non-
//      chosen Spells fly one-by-one to the
//      activator's Deleted pile; the chosen Spell
//      grows large and slowly vanishes as it's cast.
//   5. Zi performs the chosen Spell IGNORING its
//      level — direct runHooks('onPlay') sub-cast
//      (Chaos Magic / Victory Phoenix pattern;
//      bypasses validateActionPlay so level / spell-
//      school are irrelevant). "if possible": only
//      if Zi is alive & not CC'd. Performed Spell →
//      discard (normal cast disposition). The other
//      2 → DELETED pile per the card text.
//
//  ACTION COST: `heroEffectActionCost: true` — the
//  server consumes Zi's Action slot. Returning
//  `false` from onHeroEffect (player cancelled the
//  gallery) makes the server refund it.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Timeless King Zi';
const PICK_COUNT = 3;
const MAX_TOTAL_LEVEL = 6;
const REVEAL_ANIM_MS = 600 + (PICK_COUNT * 250) + 600 + 200; // matches Birthday Present

/** Spell level as a number (missing/null level → 0). */
function spellLevel(cd) {
  return (cd && typeof cd.level === 'number') ? cd.level : 0;
}

/** Unique-by-name Spells in `pi`'s deck → [{ name, level }] (sorted). */
function uniqueDeckSpells(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  for (const name of (ps.mainDeck || [])) {
    if (seen.has(name)) continue;
    const cd = cardDB[name];
    if (!cd || !hasCardType(cd, 'Spell')) continue;
    // Surprises and Reactions can't be "performed" on demand by a Hero
    // — exclude them from the pool entirely.
    const sub = cd.subtype || '';
    if (sub === 'Surprise' || sub === 'Reaction') continue;
    seen.add(name);
    out.push({ name, level: spellLevel(cd) });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Offensive = direct-damage Spell. Destruction Magic is the game's
 * damage school — the same proxy Zi's opponent-pick heuristic already
 * uses for "damage at us". (Reusing the existing criterion rather than
 * inventing a new one.)
 */
function isOffensiveSpell(cd) {
  return !!cd && (cd.spellSchool1 === 'Destruction Magic'
    || cd.spellSchool2 === 'Destruction Magic');
}

/**
 * Spells the ACTIVATOR may reveal. Identical to `uniqueDeckSpells`,
 * EXCEPT: when the CPU activates Zi while its opponent still holds
 * game-start turn-1 full protection (`gs.firstTurnProtectedPlayer ===
 * oppIdx`), every offensive Spell Zi could perform is wasted (the
 * shielded opponent takes no damage). Per user spec the CPU must then
 * treat ONLY non-offensive Spells as eligible — and if that leaves no
 * legal trio, Zi simply isn't usable turn 1 (canActivate returns
 * false). CPU-only: a human activator may still knowingly reveal
 * anything (the card's wording is unchanged for them).
 */
function activatorEligibleSpells(engine, pi) {
  const all = uniqueDeckSpells(engine, pi);
  const gs = engine.gs;
  const oppIdx = pi === 0 ? 1 : 0;
  const cpuTurnOneShielded = pi === engine._cpuPlayerIdx
    && gs.firstTurnProtectedPlayer === oppIdx;
  if (!cpuTurnOneShielded) return all;
  const cardDB = engine._getCardDB();
  return all.filter(s => !isOffensiveSpell(cardDB[s.name]));
}

/** Does ANY trio of different-named deck Spells total ≤ 6? */
function hasLegalTrio(spells) {
  if (spells.length < PICK_COUNT) return false;
  const lowest3 = spells.map(s => s.level).sort((a, b) => a - b).slice(0, PICK_COUNT);
  return lowest3.reduce((a, b) => a + b, 0) <= MAX_TOTAL_LEVEL;
}

module.exports = {
  heroEffect: true,
  // Spends Zi's Action (server-side action-economy in doActivateHeroEffect).
  heroEffectActionCost: true,

  /**
   * CPU response for the OPPONENT-pick step (`birthdayPresentPick`).
   * When the human casts Zi, the CPU is the opponent and must choose
   * which of the 3 revealed Spells Zi performs — AT the CPU. The
   * engine default just picks `cards[0]` (the bug: "always the first").
   * Instead choose the LEAST damaging Spell for the CPU to suffer.
   *
   * Heuristic (no per-option simulation — that's MCTS-rollout territory
   * and unsafe inside a live prompt): Zi's whole mechanic caps the
   * trio's total level at 6 precisely because Spell LEVEL is the power
   * proxy, so prefer the lowest level. Tiebreak: among equal levels
   * prefer a non-Destruction-Magic Spell (Destruction = direct damage
   * at us), then alphabetical for determinism.
   *
   * Only handles THIS prompt; returns undefined for anything else so
   * the engine's default handling (incl. the activator-side
   * cardGalleryMulti when a CPU casts Zi) is untouched.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'birthdayPresentPick') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    const names = (promptData.cards || [])
      .map(c => (typeof c === 'string' ? c : c?.name))
      .filter(Boolean);
    if (names.length === 0) return undefined;

    const cardDB = engine._getCardDB();
    const scoreOf = (n) => {
      const cd = cardDB[n] || {};
      const lvl = (typeof cd.level === 'number') ? cd.level : 0;
      const isDmg = isOffensiveSpell(cd) ? 1 : 0;
      return [lvl, isDmg, n];
    };
    let best = names[0];
    let bestS = scoreOf(best);
    for (let i = 1; i < names.length; i++) {
      const s = scoreOf(names[i]);
      const better = s[0] < bestS[0]
        || (s[0] === bestS[0] && (s[1] < bestS[1]
          || (s[1] === bestS[1] && s[2] < bestS[2])));
      if (better) { best = names[i]; bestS = s; }
    }
    return { cardName: best };
  },

  canActivateHeroEffect(ctx) {
    const hero = ctx.attachedHero;
    const pi = ctx.cardOwner;
    if (!hero?.name || hero.hp <= 0) return false;
    return hasLegalTrio(activatorEligibleSpells(ctx._engine, pi));
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    const heroIdx = ctx.cardHeroIdx;
    if (!ps || !oppPs) return false;

    const spells = activatorEligibleSpells(engine, pi);
    if (!hasLegalTrio(spells)) return false; // defensive (gated by canActivate)

    // ── Step 1: activator picks exactly 3 (Σlevel ≤ 6) ──
    const result = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: spells, // [{ name, level }] — level is the budget cost
      validCounts: [PICK_COUNT],
      maxBudget: MAX_TOTAL_LEVEL,
      costKey: 'level',
      hideCostUI: true,
      title: CARD_NAME,
      description: 'Reveal 3 different Spells from your deck whose total levels are 6 or less. Your opponent picks 1 for this Hero to perform; the other 2 are deleted.',
      confirmLabel: '⏳ Reveal!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!result || result.cancelled || !Array.isArray(result.selectedCards)) {
      return false; // cancelled → server refunds the Action
    }

    // Defensive validation (mirror Magic Lamp): exactly 3 distinct
    // gallery names, all Spells, total level ≤ 6.
    const cardDB = engine._getCardDB();
    const galleryNames = new Set(spells.map(s => s.name));
    const chosen = [];
    const chosenSet = new Set();
    for (const name of result.selectedCards) {
      if (typeof name !== 'string' || !galleryNames.has(name) || chosenSet.has(name)) continue;
      chosenSet.add(name);
      chosen.push(name);
    }
    const totalLvl = chosen.reduce((s, n) => s + spellLevel(cardDB[n]), 0);
    if (chosen.length !== PICK_COUNT || totalLvl > MAX_TOTAL_LEVEL) {
      engine.log('timeless_king_zi_invalid_pick', {
        player: ps.username, sent: result.selectedCards, accepted: chosen, totalLvl,
      });
      return false;
    }

    // Zi's resolution is a long, deliberate sequence (reveal animation
    // + opponent pick + reveal-clear + the performed sub-cast). On the
    // CPU's own turn that wall-clock can push past the live-turn
    // deadline; the runHooks deadline check would then throw mid-
    // sub-cast and force-end Zi's performed Spell. Grant that
    // intentional animation/sub-cast time back to the budget so Zi
    // resolves fully (the rest of the turn stays bounded by the
    // extended deadline; MAX_HOOKS_PER_TURN still guards a runaway).
    engine.extendCpuTurnDeadline?.(REVEAL_ANIM_MS + 6000);

    // ── Step 2: remove one copy of each chosen Spell from the deck ──
    for (const name of chosen) {
      const idx = ps.mainDeck.indexOf(name);
      if (idx >= 0) ps.mainDeck.splice(idx, 1);
    }
    engine.sync();

    // ── Step 3: reveal in centre + opponent picks (Birthday Present) ──
    engine._broadcastEvent('birthday_present_reveal_start', {
      ownerIdx: pi, oppIdx, cards: chosen.slice(),
    });
    await engine._delay(REVEAL_ANIM_MS);

    const oppResult = await engine.promptGeneric(oppIdx, {
      type: 'birthdayPresentPick',
      cards: chosen.slice(),
      title: CARD_NAME,
      cancellable: false,
    });
    let oppChoice;
    if (oppResult && typeof oppResult.cardName === 'string' && chosen.includes(oppResult.cardName)) {
      oppChoice = oppResult.cardName;
    } else {
      if (oppResult && oppResult.cardName) {
        engine.log('timeless_king_zi_off_list_pick', {
          player: oppPs.username, picked: oppResult.cardName, offered: chosen,
        });
      }
      oppChoice = chosen[0];
    }

    const others = (() => {
      const out = chosen.slice();
      const i = out.indexOf(oppChoice);
      if (i >= 0) out.splice(i, 1);
      return out;
    })();

    // ── Step 4: post-pick animation ──
    // The 2 non-chosen Spells fly to the activator's Deleted pile one
    // by one; the chosen Spell grows large and slowly vanishes as Zi
    // casts it. `ownerIdx` tells the client which Deleted pile is the
    // activator's. The client owns the timing/stagger.
    engine._broadcastEvent('timeless_king_reveal_clear', {
      chosen: oppChoice, ownerIdx: pi, others: others.slice(),
    });
    // Let the fly-out begin before the deleted-pile count ticks up.
    await engine._delay(950);

    // ── Step 5: delete the other 2 (state bookkeeping; the flight IS
    //    the visual) ──
    if (!ps.deletedPile) ps.deletedPile = [];
    for (const name of others) ps.deletedPile.push(name);
    engine.log('timeless_king_zi_delete', { player: ps.username, deleted: others });
    engine.sync();

    // ── Step 6: Zi performs the chosen Spell, ignoring its level ──
    // "if possible": only while Zi is alive & not crowd-controlled.
    const hero = ps.heroes?.[heroIdx];
    const canPerform = hero?.name && hero.hp > 0
      && !hero.statuses?.frozen && !hero.statuses?.stunned && !hero.statuses?.negated;

    if (canPerform) {
      engine.log('timeless_king_zi_perform', { player: ps.username, spell: oppChoice });
      // Direct runHooks('onPlay') sub-cast bypasses validateActionPlay,
      // so the Spell's level / spell-school requirements are ignored —
      // exactly "regardless of its level". Mirrors Chaos Magic /
      // Victory Phoenix Cannon (incl. resetting the spell-tracking
      // globals so Bartas-style second-casts compose).
      gs._spellDamageLog = [];
      gs._spellExcludeTargets = [];
      // Zi has NO subtype restriction (unlike Chaos Magic) — the chosen
      // Spell may be an Area / Attachment that PLACES ITSELF on the
      // board. `_spellPlacedOnBoard` is the engine's canonical "this
      // Spell became a board fixture" signal (set by placeArea etc.);
      // clear it first so we only see THIS sub-cast's result.
      delete gs._spellPlacedOnBoard;
      const subInst = engine._trackCard(oppChoice, pi, 'hand', heroIdx, -1);
      let placedOnBoard = false;
      try {
        await engine.runHooks('onPlay', {
          _onlyCard: subInst, playedCard: subInst,
          cardName: oppChoice, zone: 'hand', heroIdx,
          _skipReactionCheck: true,
        });
        const uniqueTargets = [];
        const seenIds = new Set();
        for (const t of (gs._spellDamageLog || [])) {
          if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
        }
        await engine.runHooks('afterSpellResolved', {
          spellName: oppChoice, spellCardData: cardDB[oppChoice],
          heroIdx, casterIdx: pi, damageTargets: uniqueTargets,
          isSecondCast: false, _skipReactionCheck: true,
        });
      } catch (err) {
        console.error('[Timeless King Zi] sub-spell error:', err?.message || err);
      }
      placedOnBoard = !!gs._spellPlacedOnBoard;
      delete gs._spellDamageLog;
      delete gs._spellExcludeTargets;
      delete gs._bartasSecondCast;
      delete gs._spellPlacedOnBoard;

      if (placedOnBoard) {
        // Area / Attachment placed itself — it lives on the board now
        // (subInst is its tracked instance). Don't untrack or discard.
        engine.sync();
        return true;
      }
      engine._untrackCard(subInst.id);
    }

    // Normal performed Spell (resolved, not a board fixture) — or one
    // that couldn't be performed — goes to discard. Only the OTHER
    // Spells are deleted per the card text.
    ps.discardPile.push(oppChoice);
    engine.sync();
    return true;
  },
};
