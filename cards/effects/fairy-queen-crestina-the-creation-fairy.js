// ═══════════════════════════════════════════
//  CARD EFFECT: "Fairy Queen Crestina, the Creation Fairy"
//  Hero — 350 HP, 40 ATK — BANNED
//  Starting abilities: Support Magic, Support Magic
//
//  During your Resource Phase, you may skip
//  drawing a card to choose 3 cards with
//  different names from outside the game.
//  Your opponent chooses 1 of those cards
//  and adds it to your hand. The other 2 are
//  removed from the game. You cannot choose
//  cards with those names with this effect
//  for the rest of the game.
//
//  Wiring: hooks `onPhaseStart` at phaseIndex 1
//  (RESOURCE) on the owner's turn. Crestina's
//  hook fires BEFORE _checkResourcePhaseReactions
//  and BEFORE the auto-draw, so accepting the
//  prompt sets gs._skipResourceDraw +
//  _resourcePhaseLocked (mirroring Idol of
//  Crestina) to replace the standard draw and
//  freeze any sibling Resource-Phase reaction.
//
//  Picker: cardGalleryMulti with `searchable: true`
//  (opt-in name-filter input). Locked names live on
//  hero._crestinaLockedNames so the list survives
//  hero death/revive and is per-Crestina (a player
//  with two heroes named Crestina would have two
//  independent lists, which matches "this Hero").
//
//  Opponent's pick (1 of the 3) routes through the
//  same Magic-Lamp pattern: defensive name-validation
//  with a fallback to the first offered name.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Fairy Queen Crestina, the Creation Fairy';
const PICKS = 3;

module.exports = {
  activeIn: ['hero'],

  // ── CPU: Confirm-Prompts pauschal bejahen (Barker-Bugklasse) ──────
  // onPhaseStart-Confirm (plan-loser Turn-Grenzen-Kontext).
  // Ohne Intercept declined der Brain-Default cancellable Confirms in
  // plan-losen Kontexten und der Effekt verpufft still. Der generic-
  // Dispatch lädt dieses Skript nur für Prompts mit dem eigenen
  // Kartentitel — Pauschal-Confirm ist damit korrekt gescopet.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onPhaseStart: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // RESOURCE phase only, on Crestina's owner's turn.
      if (ctx.phaseIndex !== 1) return;
      if (gs.activePlayer !== pi) return;

      // Another Resource-Phase reaction already replaced the draw.
      if (gs._skipResourceDraw || gs._resourcePhaseLocked) return;

      // Same opening-turn lockout used by hand-side Resource-Phase reactions.
      if (gs.firstTurnProtectedPlayer === pi) return;

      // Hero must be alive and capable.
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Hand-locked: card couldn't land in hand anyway.
      if (ps.handLocked) return;

      // Lazy-init the per-Crestina locked-names list.
      if (!Array.isArray(hero._crestinaLockedNames)) hero._crestinaLockedNames = [];
      const locked = new Set(hero._crestinaLockedNames);

      // Candidate pool: every card name in the DB whose effect module is
      // actually wired up (same `loadCardEffect(name)` gate Omikron uses
      // when offering creatures), minus Crestina's own and any name
      // already locked by a prior activation. Filtering to implemented
      // effects keeps Crestina from conjuring stat-only stubs the
      // simulator can't fully resolve when the picked card is played.
      const cardDB = engine._getCardDB();
      const candidates = [];
      for (const name of Object.keys(cardDB)) {
        if (name === CARD_NAME) continue;
        if (locked.has(name)) continue;
        if (!loadCardEffect(name)) continue;
        candidates.push(name);
      }
      if (candidates.length < PICKS) return;

      // Confirm activation. The cost is the Resource-Phase draw, so a
      // cancellable confirm is the right gate — declining lets the
      // standard draw (and hand-reaction window) proceed unchanged.
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: 'Skip your Resource Phase draw to choose 3 cards from outside the game?',
        showCard: CARD_NAME,
        confirmLabel: '✨ Activate!',
        cancelLabel: 'Skip',
        cancellable: true,
      });
      if (!confirmed) return;

      // Commit: replace the draw and freeze the rest of the Resource Phase.
      gs._skipResourceDraw = true;
      gs._resourcePhaseLocked = true;
      engine.sync();

      candidates.sort((a, b) => a.localeCompare(b));
      const galleryCards = candidates.map(name => ({ name, source: 'outside' }));

      // Step 1: Crestina's controller picks 3 different names from the
      // searchable gallery. Non-cancellable — the Resource-Phase draw
      // has already been committed away.
      const result = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
      menuSource: 'Crestina',
        cards: galleryCards,
        selectCount: PICKS,
        minSelect: PICKS,
        title: CARD_NAME,
        description: 'Choose 3 cards with different names from outside the game. Your opponent will pick 1 to add to your hand; the other 2 are removed from the game.',
        confirmLabel: '✨ Reveal!',
        confirmClass: 'btn-success',
        cancellable: false,
        searchable: true,
        searchPlaceholder: 'Filter by name…',
      });

      // Validate picks against the offered candidate set (defensive against
      // a desynced client). Different names enforced via chosenSet.
      const candidateSet = new Set(candidates);
      const chosenNames = [];
      const chosenSet = new Set();
      for (const name of (result?.selectedCards || [])) {
        if (typeof name !== 'string') continue;
        if (!candidateSet.has(name)) continue;
        if (chosenSet.has(name)) continue;
        chosenSet.add(name);
        chosenNames.push(name);
      }
      if (chosenNames.length !== PICKS) {
        engine.log('crestina_invalid_pick', {
          player: ps.username,
          sent: result?.selectedCards || [],
          accepted: chosenNames,
        });
        return; // Draw still skipped — no card materializes.
      }

      // Lock all 3 names for the rest of the game (picked + the two that
      // get removed-from-game alike, per card text).
      for (const name of chosenNames) hero._crestinaLockedNames.push(name);
      engine.sync();

      // Step 2: Opponent picks 1 of the 3. Reveal Crestina to the opp's
      // socket so they see what's prompting them.
      const oppIdx = pi === 0 ? 1 : 0;
      const oppPs  = gs.players[oppIdx];
      const oppSid = oppPs?.socketId;
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME });
      }
      await engine._delay(300);

      const oppResult = await engine.promptGeneric(oppIdx, {
        type: 'cardGallery',
        cards: chosenNames.map(name => ({ name, source: 'revealed' })),
        title: CARD_NAME,
        description: 'Choose 1 card to add to your opponent\'s hand. The other 2 are removed from the game.',
        cancellable: false,
      });

      // Magic-Lamp pattern: validate the opponent's response against the
      // offered list, fall back to the first name on a desync.
      let oppChoice;
      if (oppResult && typeof oppResult.cardName === 'string'
          && chosenNames.includes(oppResult.cardName)) {
        oppChoice = oppResult.cardName;
      } else {
        if (oppResult?.cardName) {
          engine.log('crestina_off_list_pick', {
            player: oppPs?.username,
            picked: oppResult.cardName,
            offered: chosenNames,
          });
        }
        oppChoice = chosenNames[0];
      }

      // Reveal the picked card to both sides and ferry it to Crestina's
      // hand. `deck_search_add` reuses the existing flight-into-hand
      // animation; the actual splice/track mirrors Magic Lamp's manual
      // path (no actionAddCardFromDeckToHand because the card never
      // lived in any deck).
      engine._broadcastEvent('card_reveal', { cardName: oppChoice });
      engine._broadcastEvent('deck_search_add', { cardName: oppChoice, playerIdx: pi });
      ps.hand.push(oppChoice);
      engine._trackCard(oppChoice, pi, 'hand');

      const removed = chosenNames.filter(n => n !== oppChoice);
      engine.log('crestina_creation_pick', {
        player: ps.username,
        offered: chosenNames,
        addedToHand: oppChoice,
        removedFromGame: removed,
        lockedNamesTotal: hero._crestinaLockedNames.length,
      });
      engine.sync();
      await engine._delay(400);
    },
  },
};
