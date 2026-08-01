// ═══════════════════════════════════════════
//  HERO EFFECT: "Sid, the King of Thieves"
//
//  At the start of the game, before both players
//  draw their starting hands, Sid's controller
//  looks at the opponent's deck, picks up to 2
//  cards with different names, and openly adds
//  them to their hand. Sid himself may use any
//  Attack / Spell / Creature added this way of
//  level 3 or lower as if it were level 0.
//
//  Wiring:
//   • `onBeforeHandDraw` hook fires in BOTH the
//     normal pre-draw window AND the puzzle
//     startup (mirrored explicitly in
//     server.js's createPuzzleGame), so Sid's
//     opening trigger fires on every puzzle
//     attempt too.
//   • Cards are streamed via `play_pile_transfer`
//     (cross-side flight from opp's deck to our
//     hand) — same channel Sparkfly Queen and
//     Enigma use for opp-deck steals.
//   • "Openly added" → `_permanentlyRevealedHand-
//     Indices[handIdx] = true` so the engine's
//     hand-redaction filter exposes the card name
//     to the opponent for as long as it stays in
//     hand. The engine keeps the index in sync
//     across hand reorders / splices.
//   • Level rebate is the same per-hand-index
//     map Sparkfly Queen uses (`_handLevelOffsets-
//     Transient` + `_handLevelOffsetHeroFilter`),
//     so the existing in-hand level badge and
//     `heroMeetsLevelReq` aggregation pick it up
//     for free. Offset is `-cd.level` so each
//     card lands at exactly Lv0; the hero filter
//     pins the rebate to Sid's host slot ("This
//     Hero may use ..."), and the offset
//     evaporates the moment the card leaves the
//     hand (transient, mirroring the Queen).
//   • Lv0 Attacks / Spells / Creatures get no
//     offset (already Lv0). Abilities, Artifacts,
//     Potions, and Lv4+ cards aren't covered by
//     Sid's text — they go to hand publicly but
//     at their printed level.
// ═══════════════════════════════════════════

const CARD_NAME = 'Sid, the King of Thieves';

module.exports = {
  // ── CPU: Steal-Auswahl ────────────────────────────────────────────
  // Sids Wert ist EXTREM matchup-abhängig — statt eines eigenen
  // Lernkanals konsumiert er das trainierte Profil des GEGNER-Decks:
  // dessen cardValues SIND die matchup-spezifische Stärke-Information.
  // Live: Top-2 der Galerie nach Gegner-Profil-Wert. Training: uniforme
  // Exploration + Logging via gameStartPickDecision (validierbar über
  // record.gameStartPicks × oppHeroKey). Ohne Gegner-Profil: Fallback
  // auf den Galerie-Default (erste Optionen).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGalleryMulti') return undefined;
    const cards = promptData.cards || [];
    if (!cards.length) return undefined;
    const maxCount = promptData.selectCount || 2;
    const pi = typeof promptData.gameStartPi === 'number'
      ? promptData.gameStartPi : engine._cpuPlayerIdx;
    const prof_mod = require('./_deck-profile');
    const { gameStartPickDecision, profileForHeroes } = prof_mod;
    // Teildeployment-Schutz: ältere _deck-profile.js ohne Kanal → Default.
    if (typeof gameStartPickDecision !== 'function'
        || typeof profileForHeroes !== 'function') return undefined;
    const isCollecting = typeof prof_mod.isCollecting === 'function'
      ? prof_mod.isCollecting : () => process.env.PP_TRAIN === '1';
    if (isCollecting()) {
      const picked = gameStartPickDecision(engine, pi, 'Sid, the King of Thieves',
        cards, { count: maxCount });
      if (picked) return { selectedCards: picked.map(o => o.name) };
      return undefined;
    }
    try {
      const oppHeroes = (engine.gs.players[pi === 0 ? 1 : 0]?.heroes || [])
        .map(h => h?.name).filter(Boolean);
      const prof = profileForHeroes(oppHeroes);
      const cv = prof?.cardValues || null;
      if (cv) {
        const seen = new Set();
        const ranked = [...cards]
          .sort((a, b) => (cv[b.name] || 0) - (cv[a.name] || 0))
          .filter(c => !seen.has(c.name) && seen.add(c.name))
          .slice(0, maxCount);
        if (ranked.length) {
          if (!engine._inMctsSim) {
            (engine._gameStartLog = engine._gameStartLog || []).push({
              card: 'Sid, the King of Thieves', pi,
              picks: ranked.map(c => c.name), src: 'oppProfile',
            });
          }
          return { selectedCards: ranked.map(c => c.name) };
        }
      }
    } catch {}
    return undefined;
  },

  activeIn: ['hero'],

  hooks: {
    onBeforeHandDraw: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const sidHeroIdx = ctx.cardHeroIdx;
      const oi = pi === 0 ? 1 : 0;
      const ops = gs.players[oi];
      if (!ps || !ops) return;
      if (ps.handLocked) return; // defensive
      if ((ops.mainDeck || []).length === 0) return;

      // Build a deduplicated gallery of opp's deck contents — the
      // text says "with different names" so the picker is keyed on
      // names, not raw deck slots. A name with multiple copies still
      // counts as one option (and the count is shown for context).
      const cardDB = engine._getCardDB();
      const counts = new Map();
      for (const name of ops.mainDeck) {
        if (!cardDB[name]) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
      if (counts.size === 0) return;
      const galleryCards = [...counts.entries()]
        .map(([name, count]) => ({ name, source: 'deck', count }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const maxPicks = Math.min(2, galleryCards.length);

      // Wait for the "GO FIRST/SECOND" announcement to clear in
      // normal games — same 3.8s pause Bill uses so the prompt
      // doesn't pop under the announcement banner. Puzzles have no
      // such announcement; skip the wait.
      engine.sync();
      if (!engine.isPuzzle) {
        await engine._delay(3800);
      }

      // Tell the opp's client a pre-draw hero-effect is mid-resolve
      // (used by the same status banner Bill flips on for his prompt).
      gs.heroEffectPending = { ownerIdx: pi, heroName: CARD_NAME };
      engine.sync();

      try {
        const result = await engine.promptGeneric(pi, {
          type: 'cardGalleryMulti',
          gameStartPi: pi,
          cards: galleryCards,
          title: CARD_NAME,
          description: `Look at ${ops.username}'s deck. Choose up to ${maxPicks} Card${maxPicks > 1 ? 's' : ''} with different names to openly add to your Hand.`,
          selectCount: maxPicks,
          minSelect: 1,
          confirmLabel: '🪙 Steal!',
          confirmClass: 'btn-success',
          cancellable: true,
        });
        if (!result || result.cancelled) return;
        const chosen = (result.selectedCards || []).slice(0, maxPicks);
        if (chosen.length === 0) return;

        // Reveal Sid himself to both sides — same `card_reveal`
        // broadcast active Hero / Spell / Ability activations use,
        // so opp sees who's stealing before the picked cards stream
        // across.
        engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });
        await engine._delay(300);

        if (!ps._handLevelOffsetsTransient) ps._handLevelOffsetsTransient = {};
        if (!ps._handLevelOffsetHeroFilter) ps._handLevelOffsetHeroFilter = {};
        if (!ps._permanentlyRevealedHandIndices) ps._permanentlyRevealedHandIndices = {};

        for (const name of chosen) {
          const deckIdx = ops.mainDeck.indexOf(name);
          if (deckIdx < 0) continue;
          ops.mainDeck.splice(deckIdx, 1);
          ps.hand.push(name);
          const newHandIdx = ps.hand.length - 1;

          const newInst = engine._trackCard(name, pi, 'hand');
          newInst.originalOwner = oi;

          // Per-card level rebate — Lv1/2/3 Attacks, Spells, and
          // Creatures become effective Lv0 when Sid himself plays /
          // summons them. Pinned to Sid's host slot via the parallel
          // filter map; the transient map evaporates the moment the
          // card leaves the hand.
          const cd = cardDB[name];
          if (cd && (cd.cardType === 'Attack' || cd.cardType === 'Spell' || cd.cardType === 'Creature')
              && typeof cd.level === 'number' && cd.level >= 1 && cd.level <= 3) {
            ps._handLevelOffsetsTransient[newHandIdx] = -cd.level;
            ps._handLevelOffsetHeroFilter[newHandIdx] = sidHeroIdx;
          }

          // "Openly added" — both players see the card name in Sid's
          // hand for as long as it stays there. The engine's hand
          // redaction filter respects this map per-side.
          ps._permanentlyRevealedHandIndices[newHandIdx] = true;

          // Cross-side flight from opp's deck pile into our hand,
          // staggered by the per-card 400ms delay below so two picks
          // don't overlap visually.
          engine._broadcastEvent('play_pile_transfer', {
            fromOwner: oi, toOwner: pi, cardName: name,
            from: 'deck', to: 'hand',
            toHandIdx: newHandIdx,
          });
          engine.log('sid_steal', {
            player: ps.username, fromOpp: ops.username, card: name,
          });

          await engine.runHooks('onCardAddedToHand', {
            playerIdx: pi, card: newInst, cardName: name,
            source: CARD_NAME, _skipReactionCheck: true,
          });
          engine.sync();
          await engine._delay(400);
        }
      } finally {
        gs.heroEffectPending = null;
      }

      engine.sync();
    },
  },
};
