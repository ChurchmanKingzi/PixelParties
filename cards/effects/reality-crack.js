// ═══════════════════════════════════════════
//  CARD EFFECT: "Reality Crack"
//  Spell (Magic Arts Lv0, Normal)
//  Pollution archetype.
//
//  Send all Areas on the board to the discard pile.
//  Then, choose a level-3-or-lower Area from your
//  hand OR deck and bring it directly into play.
//  Then, place 1 Pollution Token into your free
//  Support Zone for every level the chosen Area
//  is higher than the user's Magic Arts level.
//  This counts as an additional Action. You cannot
//  play another Area for the rest of this turn.
// ═══════════════════════════════════════════

const { placePollutionTokens } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');

module.exports = {
  placesPollutionTokens: true,
  inherentAction: true,
  cpuMeta: { scalesWithSchool: 'Magic Arts' },

  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Per card text: the _cantPlayAreaThisTurn flag blocks another Reality
    // Crack (or any Area cast) for the rest of the turn. We'd need the turn
    // value recorded to know the lock is stale; since the flag is cleared
    // at end-of-turn externally, a simple truthy check suffices.
    if (ps._cantPlayAreaThisTurn === gs.turn) return false;
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const userHeroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      const hero = ps.heroes?.[userHeroIdx];
      if (!hero?.name || hero.hp <= 0) {
        gs._spellCancelled = true;
        return;
      }

      const cardDB = engine._getCardDB();

      // ── Step 1: wipe all Areas currently on the board ──
      const wipedCount = await engine.removeAllAreas(-2, 'Reality Crack');
      engine.log('reality_crack_wipe', {
        player: ps.username, wiped: wipedCount,
      });

      // ── Step 2: gather eligible Lv≤3 Area spells from hand + deck ──
      const areaFromHand = {};
      const areaFromDeck = {};

      for (const n of (ps.hand || [])) {
        if (n === ctx.cardName) continue; // Exclude the Reality Crack being played
        const cd = cardDB[n];
        if (!cd || cd.cardType !== 'Spell') continue;
        if ((cd.subtype || '').toLowerCase() !== 'area') continue;
        if ((cd.level || 0) > 3) continue;
        areaFromHand[n] = (areaFromHand[n] || 0) + 1;
      }
      for (const n of (ps.mainDeck || [])) {
        const cd = cardDB[n];
        if (!cd || cd.cardType !== 'Spell') continue;
        if ((cd.subtype || '').toLowerCase() !== 'area') continue;
        if ((cd.level || 0) > 3) continue;
        areaFromDeck[n] = (areaFromDeck[n] || 0) + 1;
      }

      const gallery = [];
      for (const [name, count] of Object.entries(areaFromHand)) {
        gallery.push({ name, source: 'hand', count, level: cardDB[name]?.level || 0 });
      }
      for (const [name, count] of Object.entries(areaFromDeck)) {
        gallery.push({ name, source: 'deck', count, level: cardDB[name]?.level || 0 });
      }
      gallery.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

      // Lock further Area plays this turn (takes effect immediately)
      ps._cantPlayAreaThisTurn = gs.turn;

      // Even with no eligible Area, the spell still consumes (wiped all areas)
      if (gallery.length === 0) {
        gs._spellFreeAction = true;
        engine.log('reality_crack', {
          player: ps.username, wiped: wipedCount,
          broughtIn: null, tokensPlaced: 0,
        });
        engine.sync();
        return;
      }

      // ── Step 3: pick the Area ──
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: 'Reality Crack',
        description: 'Choose a level 3 or lower Area from your hand or deck to bring into play.',
        cancellable: true,
      });
      if (!picked || picked.cancelled) {
        // The wipe already happened; the player can still decline the bring-
        // in. Additional Action still applies.
        gs._spellFreeAction = true;
        engine.sync();
        return;
      }

      const chosenName = picked.cardName;
      const chosenSource = picked.source || 'hand';
      const chosenLevel = cardDB[chosenName]?.level || 0;

      // ── Step 4: remove the chosen Area from its source pile ──
      let found = false;
      if (chosenSource === 'hand') {
        const idx = (ps.hand || []).indexOf(chosenName);
        if (idx >= 0) { ps.hand.splice(idx, 1); found = true; }
      }
      if (!found) {
        const idx = (ps.mainDeck || []).indexOf(chosenName);
        if (idx >= 0) { ps.mainDeck.splice(idx, 1); found = true; engine.shuffleDeck(pi, 'main'); }
      }
      if (!found) {
        // Extremely edge-case — card disappeared between gallery build and
        // selection. Fizzle gracefully.
        gs._spellFreeAction = true;
        engine.sync();
        return;
      }

      // If from deck, reveal it like other deck-search spells
      if (chosenSource === 'deck') {
        engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
      }

      // ── Step 5: create an instance, route it through placeArea ──
      const newInst = engine._trackCard(chosenName, pi, 'hand', userHeroIdx, -1);
      // Fire onPlay so the Area's own setup logic runs — but flag the ctx
      // so we don't loop (Reality Crack is still mid-resolve).
      await engine.runHooks('onPlay', {
        _onlyCard: newInst, playedCard: newInst,
        cardName: chosenName, zone: 'hand',
        heroIdx: userHeroIdx,
        _skipReactionCheck: true,
      });
      // If the Area's own onPlay didn't place itself (shouldn't happen for
      // a properly-written Area card), fall back to placing directly.
      if (newInst.zone !== 'area') {
        await engine.placeArea(pi, newInst);
      }

      // ── Step 6: calculate excess level and place Pollution Tokens ──
      const abZones = ps.abilityZones?.[userHeroIdx] || [];
      const magicArtsLevel = engine.countAbilitiesForSchool('Magic Arts', abZones);
      const excess = Math.max(0, chosenLevel - magicArtsLevel);
      let tokensPlaced = 0;
      if (excess > 0) {
        const result = await placePollutionTokens(engine, pi, excess, 'Reality Crack', {
          promptCtx: ctx,
        });
        tokensPlaced = result.placed;
      }

      // ── Step 7: additional Action ──
      gs._spellFreeAction = true;

      engine.log('reality_crack', {
        player: ps.username,
        wiped: wipedCount,
        broughtIn: chosenName,
        chosenLevel, magicArtsLevel, excess,
        tokensPlaced,
      });
      engine.sync();

      // Reveal chosen area to opponent if from deck
      if (chosenSource === 'deck') {
        const oi = pi === 0 ? 1 : 0;
        await engine.promptGeneric(oi, {
          type: 'deckSearchReveal',
          cardName: chosenName,
          searcherName: ps.username,
          title: 'Reality Crack',
          cancellable: false,
        });
      }
    },
  },
};
