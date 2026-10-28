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
//
//  Als Ruling (Al 26.10.): die Area-Wahl nach dem Abräumen ist Pflichtwahl (Galerie nicht abbrechbar), sobald mindestens eine passende Area
//  in Hand oder Deck liegt.
//
//  Als Ruling (Al 27.10.): „You cannot play another Area for the rest of the turn" gilt für JEDEN Weg, auf dem der Nutzer eine Area spielt oder ins Spiel bringt —
//  Handspiel, Zusatzaktionen (Circles-of-Hell-Wiederholung, Third Circle, Learning, Rubin, Taio, Time Distortion, Cleansing of the Land …), Cooldin, Dante, Planet in a Bottle,
//  Orkallion, Spirit of the Barbarian Sword, Doom Prophecy. EINE Frage: `engine.areaSpielGesperrt(pi)` / `areaKarteGesperrt(cd, pi)` (Stempel `ps._cantPlayAreaThisTurn` = Zug).
//  Der Stempel steht VOR dem Abräumen (Abgangs-Effekte der abgeräumten Areas laufen schon unter der Sperre); die EINE Area dieser Karte bringt Reality Crack selbst ins Spiel
//  (kein „play" über die Spielwege — „another" = alle weiteren). Auch ohne passende Area (leere Galerie) steht die Sperre.
// ═══════════════════════════════════════════

const { placePollutionTokens } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');
const { isTutorableArea } = require('./_area-shared');

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

      // Als Ruling (Al 27.10.): die Sperre gilt ab hier (Karte ist gespielt, kein Abbruch mehr) — VOR dem Abräumen, damit auch Abgangs-Effekte der abgeräumten
      // Areas (Circles of Hell …) keine weitere Area spielen können. Die Area dieser Karte kommt unten über `runHooks('onPlay')` ins Spiel, nicht über einen Spielweg.
      ps._cantPlayAreaThisTurn = gs.turn;

      // ── Step 1: wipe all Areas currently on the board ──
      const wipedCount = await engine.removeAllAreas(-2, 'Reality Crack');
      engine.log('reality_crack_wipe', {
        player: ps.username, wiped: wipedCount,
      });

      // ── Step 2: gather eligible Lv≤3 Area spells from hand + deck ──
      const areaFromHand = {};
      const areaFromDeck = {};

      // Effective-level filter — picks the post-reduction level so
      // Cataclysm-rebated Areas (and any future Area-level modifier)
      // pass the Lv≤3 gate correctly.
      // Eignung kommt aus `_area-shared.js` — dieselbe Regel wie bei
      // Planet in a Bottle und Cooldin. Vorher stand hier
      // `cardType !== 'Spell'`, was Blood Rock (Area ATTACK) ausschloss,
      // obwohl der Kartentext wortgleich "a level 3 or lower Area" sagt.
      for (const n of (ps.hand || [])) {
        if (n === ctx.cardName) continue; // Exclude the Reality Crack being played
        if (!isTutorableArea(cardDB[n], engine, pi)) continue;
        if (!engine.canPlaceAnotherArea(pi, n)) continue;   // Als Fix (Al 27.10.): bleibt nach dem Abraeumen eine Area liegen (Gigalopolis, unentfernbar), ist dort kein Platz — nicht waehlbar
        areaFromHand[n] = (areaFromHand[n] || 0) + 1;
      }
      for (const n of (ps.mainDeck || [])) {
        if (!isTutorableArea(cardDB[n], engine, pi)) continue;
        if (!engine.canPlaceAnotherArea(pi, n)) continue;   // Als Fix (Al 27.10.): s. o.
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

      // (Die Sperre für weitere Area-Plays steht schon oben, vor dem Abräumen.)
      // W82 (Shipwrecked): der Ausgenommene darf keine Area ins Spiel bringen — die Areas sind schon abgeraeumt (Schritt 1), es gibt nichts zu waehlen (kein Pollution-Teil).
      if (engine.spielerIstVonAreasAusgenommen(pi)) gallery.length = 0;

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
      // Als Ruling (Al 26.10.): „Pflichtwahl" — die Areas sind schon abgeräumt (Schritt 1), der Text sagt „choose": gibt es mindestens eine passende Area,
      // ist die Galerie NICHT abbrechbar (kein Ablehnen der neuen Area). Ohne passende Area gibt es gar keine Frage (s. o.).
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: 'Reality Crack',
        description: 'Choose a level 3 or lower Area from your hand or deck to bring into play.',
        cancellable: false,
      });
      if (!picked || picked.cancelled || !picked.cardName) {
        // Sicherheitsnetz (der Client kann nicht abbrechen; CPU/Zeitüberschreitung ohne Antwort): die Areas sind weg, die Zusatzaktion bleibt.
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
        if (idx >= 0) { engine.takeFromPileSync(ps, 'hand', idx); found = true; }
      }
      if (!found) {
        const _taken_idx = await engine.takeFromPile(ps, 'deck', chosenName, { source: 'reality-crack' });   // v820: Stapel-Schicht
        if (_taken_idx) {
          found = true; engine.shuffleDeck(pi, 'main');
        }
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
      const magicArtsLevel = engine.heroSchoolLevel('Magic Arts', pi, userHeroIdx);   // W4a: harte Negierung -> Stufe 0
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
        const oi = engine.opponentOf(pi);
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
