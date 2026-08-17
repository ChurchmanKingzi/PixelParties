// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloudy Slime"
//  Creature — On summon, you may place a
//  lv 0 Creature from your hand into any
//  free Support Zone you control. HOPT, but
//  only consumed on successful placement.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

const { isPileCreature, hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.players;
      const pi = ctx.cardOwner;
      const ps = gs[pi];

      // Check HOPT manually — only mark used AFTER successful summon
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      const hoptKey = `cloudy-slime-summon:${pi}`;
      if (engine.gs.hoptUsed[hoptKey] === engine.gs.turn) return;

      // Check summon lock
      if (ctx.isSummonLocked()) return;

      // Load card database
      // v323: NICHT je Auslösung von der Platte lesen — 0,83 MB Datei,
      // mehrere MB Müll je Hook-Auslösung, dazu synchrone E/A im Event-Loop.
      const cardDB = require('./_card-db').getCardDB();

      // Find lv 0 Creatures in hand (excluding the just-summoned Cloudy Slime itself)
      const eligibleCards = [];
      const seen = new Set();
      for (const name of (ps.hand || [])) {
        if (seen.has(name)) continue;
        const c = cardDB[name];
        if (c && isPileCreature(c) && (c.level || 0) === 0) {
          seen.add(name);
          eligibleCards.push({ name, source: 'hand' });
        }
      }

      // Fizzle if no eligible creatures
      if (eligibleCards.length === 0) return;

      // Find ALL free support zones across all own heroes. When a
      // candidate name is passed, the per-Hero filter consults the
      // Creature's `canSummon` rule with `_bypassBeforeSummon: true`
      // (placement skips `beforeSummon`, so cards like King Trex
      // re-apply their strict per-Hero archetype rule).
      const getFreeZones = (forCardName = null) => {
        const zones = [];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (forCardName
              && !engine.isCreatureSummonable(forCardName, pi, hi, { _bypassBeforeSummon: true })) continue;
          const supZones = ps.supportZones[hi] || [];
          for (let s = 0; s < 3; s++) { // Base zones only
            if ((supZones[s] || []).length === 0) {
              zones.push({ heroIdx: hi, slotIdx: s, label: `${hero.name} — Support ${s + 1}` });
            }
          }
        }
        return zones;
      };

      // Fizzle if no free zones anywhere (sentinel — name-agnostic)
      if (getFreeZones().length === 0) return;

      // Step 1: Confirm
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Cloudy Slime',
        message: 'Summon another Lv 0 Creature from your hand?',
      });
      if (!confirmed) return;

      // Step 2 + 3: Pick creature → pick zone (with back navigation)
      //
      // v326: ZWEI RIEGEL. Beide Rueckwege dieser Schleife konnten sonst
      // ohne Fortschritt kreisen — belegt am 11.8.: die CPU beantwortete
      // GENAU DIESE Galerie 50 001 Mal in einem einzigen MCTS-Rollout,
      // bis der Heap voll war. Ursache: waehlt die CPU eine Karte, fuer
      // die es keine freie Zone gibt, fuehrt `continue` zur unveraenderten
      // Liste — und ihr Waehler trifft deterministisch dieselbe Wahl.
      //   (a) `ohneZone` merkt sich Karten ohne legale Zone und nimmt sie
      //       aus der Auswahl. Gilt fuer Mensch wie CPU: fuer diese Karte
      //       existiert kein Platz, ein erneutes Anbieten waere sinnlos.
      //   (b) `runden` deckelt die Rueckwaerts-Navigation (Escape aus der
      //       Zonenwahl), die fuer Menschen erwuenscht ist und deshalb
      //       nicht ausgeschlossen, sondern nur begrenzt wird.
      const ohneZone = new Set();
      let runden = 0;
      const MAX_RUNDEN = 24;
      while (true) {
        if (++runden > MAX_RUNDEN) return;
        // Recompute eligible cards (hand may have changed if multiple effects)
        const currentEligible = [];
        const currentSeen = new Set();
        for (const name of (ps.hand || [])) {
          if (currentSeen.has(name)) continue;
          if (ohneZone.has(name)) continue;
          const c = cardDB[name];
          if (c && isPileCreature(c) && (c.level || 0) === 0) {
            currentSeen.add(name);
            currentEligible.push({ name, source: 'hand' });
          }
        }
        if (currentEligible.length === 0) return; // No more eligible

        const selected = await ctx.promptCardGallery(currentEligible, {
          title: 'Cloudy Slime',
          description: 'Select a Lv 0 Creature to place.',
          cancellable: true,
        });
        if (!selected) return; // Escape = abort

        // Step 3: Pick a zone — filter by the selected Creature's
        // per-Hero `canSummon` rule.
        const freeZones = getFreeZones(selected.cardName);
        if (freeZones.length === 0) { ohneZone.add(selected.cardName); continue; }

        const zone = await ctx.promptZonePick(freeZones, {
          title: 'Cloudy Slime',
          description: `Place ${selected.cardName} into a Support Zone.`,
          cancellable: true,
        });
        if (!zone) continue; // Escape = back to creature picker

        // Execute placement
        const cardName = selected.cardName;
        const idx = ps.hand.indexOf(cardName);
        if (idx < 0) return; // Card no longer in hand
        ps.hand.splice(idx, 1);

        // Place into support zone
        const hi = zone.heroIdx;
        const si = zone.slotIdx;
        if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
        ps.supportZones[hi][si] = [cardName];

        // Track card instance with placement flag
        const inst = engine._trackCard(cardName, pi, 'support', hi, si);
        inst.counters.isPlacement = 1;

        engine.log('placement', { card: cardName, by: 'Cloudy Slime', from: 'hand', heroIdx: hi, zoneSlot: si });

        // Mark HOPT as used NOW — successful placement
        engine.gs.hoptUsed[hoptKey] = engine.gs.turn;

        // Emit summon effect glow + wind animation
        engine._broadcastEvent('summon_effect', { owner: pi, heroIdx: hi, zoneSlot: si, cardName });
        engine._broadcastEvent('play_zone_animation', { type: 'wind', owner: pi, heroIdx: hi, zoneSlot: si });

        // Fire on-summon hooks
        await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx: hi, zoneSlot: si });
        await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: hi });

        engine.sync();
        break;
      }
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
