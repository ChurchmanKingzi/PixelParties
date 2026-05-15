// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaos Magic"
//  Spell (Destruction Magic Lv0, Normal)
//
//  Shuffle your deck. Then reveal the top cards
//  of your deck until you reveal a level-3-or-lower
//  NORMAL Spell whose effect you have not resolved
//  yet this game. This Spell's name, level and effect
//  become the revealed Spell's, but it can still
//  be used regardless of its level. Delete all
//  cards revealed by this effect afterwards. If
//  you reveal 5 cards before you reveal such a
//  Spell, discard your entire hand and terminate.
//
//  RULES (confirmed with the designer):
//   • Only a QUALIFYING Spell stops the reveal:
//     cardType Spell AND subtype 'Normal' (NOT
//     Area / Reaction / Surprise / Attachment),
//     level ≤ 3, and its name is NOT in the
//     player's whole-game resolved-Spell list.
//     Everything else (non-Normal Spells, level
//     4+, already resolved this game, non-Spells)
//     just counts toward the 5.
//   • "Resolved this game" is tracked per-PLAYER by
//     Spell NAME (any Hero, normal cast OR via
//     Chaos Magic; negated Spells don't count) in
//     `ps._spellsResolvedThisGame` — populated by
//     server.js doPlaySpell and, for the copied
//     sub-Spell, here.
//   • Chaos Magic marks itself resolved up front:
//     this both satisfies "(and Chaos Magic)" and
//     prevents a revealed Chaos Magic from
//     recursing into itself.
//   • Every revealed card (including the found
//     Spell's physical card) is deleted. The Chaos
//     Magic instance itself goes to discard via the
//     normal doPlaySpell flow (we don't touch it).
//   • Failure (5 revealed, none qualifying) →
//     discard the entire hand. Deck exhausted with
//     < 5 revealed and none qualifying → just
//     terminate (the hand-discard clause is tied
//     specifically to revealing 5).
//
//  "Become & resolve regardless of level" reuses
//  the Victory Phoenix Cannon sub-cast pattern:
//  resolve the found Spell's onPlay via a temp
//  instance + runHooks, which bypasses
//  validateActionPlay entirely (so level / spell-
//  school requirements are inherently ignored).
//
//  ANIMATION: each reveal flies deck → screen
//  centre face-down, flips face-up, holds, then
//  vanishes (Kassaran-style — see app-board.jsx
//  `onChaosMagicReveal`, reusing KassaranFlipCard).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Chaos Magic';
const MAX_REVEALS = 5;
const REVEAL_MS = 2000; // matches the kassaran-flip CSS duration

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      if (!ps) return;
      const cardDB = engine._getCardDB();

      // Mark Chaos Magic itself resolved up front — satisfies the
      // "(and Chaos Magic)" rule AND guards against a revealed Chaos
      // Magic qualifying and recursing into itself.
      if (!ps._spellsResolvedThisGame) ps._spellsResolvedThisGame = [];
      if (!ps._spellsResolvedThisGame.includes(CARD_NAME)) {
        ps._spellsResolvedThisGame.push(CARD_NAME);
      }

      // ── Shuffle the deck ──
      engine.shuffleDeck(pi, 'main');
      engine.log('chaos_magic_shuffle', { player: ps.username });
      engine.sync();
      await engine._delay(450);

      // ── Reveal loop ──
      const resolved = ps._spellsResolvedThisGame;
      let found = null;
      let revealedCount = 0;

      while (revealedCount < MAX_REVEALS && (ps.mainDeck || []).length > 0) {
        const name = ps.mainDeck[0];

        // Qualifying = NORMAL Spell (not Area / Reaction / Surprise /
        // Attachment), level ≤ 3, effect not resolved this game.
        // Computed BEFORE the broadcast so the reveal animation knows
        // whether to fly the card to the deleted pile (ineligible) or
        // keep it at centre to "become" Chaos Magic (eligible).
        const cd = cardDB[name];
        const isNormalSpell = !!cd && hasCardType(cd, 'Spell') && cd.subtype === 'Normal';
        const lvl = (cd && typeof cd.level === 'number') ? cd.level : 99;
        const qualifies = isNormalSpell && lvl <= 3 && !resolved.includes(name);

        // Kassaran-style reveal: deck → centre, flip face-up, hold,
        // then the card visibly flies on to the deleted pile (every
        // revealed card — eligible or not — is deleted). Broadcast
        // first, then await the full animation before mutating state
        // so the flip reads cleanly.
        engine._broadcastEvent('chaos_magic_reveal', { owner: pi, cardName: name });
        await engine._delay(REVEAL_MS);

        // Move the revealed card from the deck to the deleted pile.
        ps.mainDeck.shift();
        if (ps.deckTopVisible && ps.deckTopVisible.length > 0) ps.deckTopVisible.shift();
        if (!ps.deletedPile) ps.deletedPile = [];
        ps.deletedPile.push(name);
        revealedCount++;
        engine.log('chaos_magic_reveal', { player: ps.username, card: name, n: revealedCount, qualifies });
        engine.sync();

        if (qualifies) {
          found = name;
          break;
        }
      }

      if (found) {
        // Record the copied Spell so a later Chaos Magic skips it.
        if (!resolved.includes(found)) resolved.push(found);
        engine.log('chaos_magic_become', { player: ps.username, spell: found });
        await engine._delay(250);

        // ── Become & resolve the found Spell, ignoring its level ──
        // Direct runHooks('onPlay') bypasses validateActionPlay, so
        // level / spell-school gating is inherently skipped. Mirrors
        // the Victory Phoenix Cannon sub-cast (incl. its accepted
        // tradeoff of resetting the spell-tracking globals).
        gs._spellDamageLog = [];
        gs._spellExcludeTargets = [];
        const subInst = engine._trackCard(found, pi, 'hand', heroIdx, -1);
        try {
          await engine.runHooks('onPlay', {
            _onlyCard: subInst, playedCard: subInst,
            cardName: found, zone: 'hand', heroIdx,
            _skipReactionCheck: true,
          });

          const uniqueTargets = [];
          const seenIds = new Set();
          for (const t of (gs._spellDamageLog || [])) {
            if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
          }
          await engine.runHooks('afterSpellResolved', {
            spellName: found, spellCardData: cardDB[found], heroIdx, casterIdx: pi,
            damageTargets: uniqueTargets, isSecondCast: false,
            _skipReactionCheck: true,
          });
        } catch (err) {
          console.error('[Chaos Magic] sub-spell error:', err?.message || err);
        }

        delete gs._spellDamageLog;
        delete gs._spellExcludeTargets;
        delete gs._bartasSecondCast;
        engine._untrackCard(subInst.id);
        // The found Spell's physical card was already deleted during
        // its reveal — do NOT push it to discard. Chaos Magic itself
        // discards via the normal doPlaySpell flow.
        engine.sync();
        return;
      }

      // ── No qualifying Spell ──
      if (revealedCount >= MAX_REVEALS) {
        // Failure clause: discard the entire hand.
        const handCount = (ps.hand || []).length;
        if (handCount > 0) await engine.actionDiscardCardsAnimated(pi, handCount);
        engine.log('chaos_magic_fizzle', {
          player: ps.username, reason: 'no_spell_in_5', discarded: handCount,
        });
      } else {
        // Deck ran out before 5 reveals — the hand-discard penalty is
        // tied specifically to revealing 5, so just terminate.
        engine.log('chaos_magic_fizzle', {
          player: ps.username, reason: 'deck_exhausted', revealed: revealedCount,
        });
      }
      engine.sync();
    },
  },
};
