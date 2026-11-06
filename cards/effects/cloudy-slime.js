// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloudy Slime"
//  Creature — On summon, you may place a
//  lv 0 Creature from your hand into any
//  free Support Zone you control. HOPT, but
//  only consumed on successful placement.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

const { isSummonablePileCreature, hasCardType } = require('./_hooks');

const { slimeLevelUpHook } = require('./_slime-shared');

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'wind' }, impactMs: 260,
  },

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
      // Welle 10 (Al, Q30): ohne Kandidat/Platz FIZZELT der Effekt (Sandy Blob feuert dann nicht); Einmal-pro-Zug verbraucht / Sperre = gar nicht verfügbar.
      if (engine.gs.hoptUsed[hoptKey] === engine.gs.turn) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { stumm: true }); return; }

      // Check summon lock
      if (ctx.isSummonLocked()) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { stumm: true }); return; }

      // Load card database
      // v323: NICHT je Auslösung von der Platte lesen — 0,83 MB Datei,
      // mehrere MB Müll je Hook-Auslösung, dazu synchrone E/A im Event-Loop.
      const cardDB = require('./_card-db').getCardDB();

      // Find lv 0 Creatures in hand (excluding the just-summoned Cloudy Slime itself)
      const eligibleCards = [];
      const seen = new Set();
      for (let hi2 = 0; hi2 < (ps.hand || []).length; hi2++) {
        const name = ps.hand[hi2];
        if (seen.has(name)) continue;
        const c = cardDB[name];
        // W24d (N4-11): „level 0" nach WIRKSAMER Stufe der Handkarte (Rocky Slime & Co.), wie Psychic Scout.
        if (c && isSummonablePileCreature(c) && engine.effectiveCardLevel(c, pi, { handIdx: hi2 }) === 0) {
          seen.add(name);
          eligibleCards.push({ name, source: 'hand' });
        }
      }

      // Fizzle if no eligible creatures
      if (eligibleCards.length === 0) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { playerIdx: pi, grund: 'no_target' }); return; }

      // Find ALL free support zones across all own heroes. When a
      // candidate name is passed, the per-Hero filter consults the
      // Creature's `canSummon` rule with `_bypassBeforeSummon: true`
      // (placement skips `beforeSummon`, so cards like King Trex
      // re-apply their strict per-Hero archetype rule).
      // ★ W22a (Al, 20.10.2026, „Hero you control": „Nur der aktuelle Kontrolleur, inklusive eines temporaeren Kontrolleurs"): die Helden, die `pi` KONTROLLIERT
      // (`heroesControlledBy`) — ein an den Gegner abgegebener eigener Held (dauerhaft oder temporaer) wird dem Besitzer nicht angeboten, ein uebernommener Held der
      // Gegenspalte seinem Kontrolleur (Zone traegt `owner` = Brettseite; Platzierung unten seitenfremd, wie `actionPlaceCreature` mit `heldSeite`).
      const getFreeZones = (forCardName = null) => {
        const zones = [];
        for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
          if (!hero?.name || hero.hp <= 0) continue;
          if (forCardName
              && !engine.isCreatureSummonable(forCardName, physOwner, hi, { _bypassBeforeSummon: true })) continue;
          const supZones = gs[physOwner]?.supportZones?.[hi] || [];
          for (let s = 0; s < 3; s++) { // Base zones only
            if ((supZones[s] || []).length === 0) {
              zones.push({ heroIdx: hi, slotIdx: s, owner: physOwner, label: `${hero.name} — Support ${s + 1}` });
            }
          }
        }
        // ★ W62a: mit Alice-Teilung ist auch die Zone einer GLEICHNAMIGEN Creature ein Ziel (Slime in einen Slime-Stapel); W63a (Al): geteilte Zone zuerst.
        if (forCardName) {
          const { canShareInto } = require('./_alice-shared');
          for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
            if (!hero?.name || hero.hp <= 0) continue;
            if (!engine.isCreatureSummonable(forCardName, physOwner, hi, { _bypassBeforeSummon: true })) continue;
            for (let s = 0; s < 3; s++) {
              if (!canShareInto(engine, pi, hi, s, forCardName, physOwner)) continue;
              const tiefe = ((gs[physOwner]?.supportZones?.[hi] || [])[s] || []).length;
              zones.push({ heroIdx: hi, slotIdx: s, owner: physOwner, shared: true, label: `${hero.name} — Support ${s + 1} (×${tiefe})` });
            }
          }
        }
        return require('./_alice-shared').geteiltZuerst(zones);   // W63a (Al, 22.10.2026): erst die geteilte Zone, DANN die erste leere
      };

      // Fizzle if no free zones anywhere (sentinel — name-agnostic; W62a: oder eine geteilte Zone fuer eine der Handkarten)
      if (getFreeZones().length === 0 && !eligibleCards.some(c => getFreeZones(c.name).length > 0)) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { playerIdx: pi, grund: 'zone_taken' }); return; }

      // Step 1: Confirm
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Cloudy Slime',
        message: 'Summon another Lv 0 Creature from your hand?',
      });
      if (!confirmed) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { stumm: true }); return; }   // W24d (N4-14, W11/R4): abgelehntes „you may" = kein feuernder Effekt

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
        if (++runden > MAX_RUNDEN) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { stumm: true }); return; }   // W24d (N4-14)
        // Recompute eligible cards (hand may have changed if multiple effects)
        const currentEligible = [];
        const currentSeen = new Set();
        for (let hi2 = 0; hi2 < (ps.hand || []).length; hi2++) {
          const name = ps.hand[hi2];
          if (currentSeen.has(name)) continue;
          if (ohneZone.has(name)) continue;
          const c = cardDB[name];
          if (c && isSummonablePileCreature(c) && engine.effectiveCardLevel(c, pi, { handIdx: hi2 }) === 0) {
            currentSeen.add(name);
            currentEligible.push({ name, source: 'hand' });
          }
        }
        if (currentEligible.length === 0) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { stumm: true }); return; } // No more eligible   // W24d (N4-14)

        const selected = await ctx.promptCardGallery(currentEligible, {
          title: 'Cloudy Slime',
          description: 'Select a Lv 0 Creature to place.',
          cancellable: true,
        });
        if (!selected) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { stumm: true }); return; } // Escape = abort   // W24d (N4-14)

        // Step 3: Pick a zone — filter by the selected Creature's
        // per-Hero `canSummon` rule.
        const freeZones = getFreeZones(selected.cardName);
        if (freeZones.length === 0) { ohneZone.add(selected.cardName); continue; }

        const gewaehlt = await ctx.promptZonePick(freeZones, {
          title: 'Cloudy Slime',
          description: `Place ${selected.cardName} into a Support Zone.`,
          cancellable: true,
        });
        if (!gewaehlt) continue; // Escape = back to creature picker
        const zone = freeZones.find(z => z.heroIdx === gewaehlt.heroIdx && z.slotIdx === gewaehlt.slotIdx && z.owner === (gewaehlt.owner ?? pi))
          || (gewaehlt.owner == null ? freeZones.find(z => z.heroIdx === gewaehlt.heroIdx && z.slotIdx === gewaehlt.slotIdx) : null);
        if (!zone) continue;

        // Execute placement
        const cardName = selected.cardName;
        // W24d (N4-11): die Kopie mit wirksamer Stufe 0 (nicht blind die erste gleichnamige).
        let idx = ps.hand.findIndex((n, i2) => n === cardName && cardDB[n]
          && engine.effectiveCardLevel(cardDB[n], pi, { handIdx: i2 }) === 0);
        if (idx < 0) idx = ps.hand.indexOf(cardName);
        if (idx < 0) { await engine.summonEffektFizzelt(ctx.card, 'Cloudy Slime', { stumm: true }); return; } // Card no longer in hand   // W24d (N4-14)
        engine.takeFromPileSync(ps, 'hand', idx);

        // Place into support zone (eigene Spalte wie bisher; uebernommener Held der Gegenspalte: seitenfremd, kontrolliert von `pi`)
        const hi = zone.heroIdx;
        const si = zone.slotIdx;
        const feld = zone.owner;
        engine.zoneEintragen(feld, hi, si, cardName, pi);   // W62a: gleichnamige Kreatur (Alice) → dazustapeln statt ueberschreiben

        // Track card instance with placement flag
        const inst = engine._trackCard(cardName, feld, 'support', hi, si);
        if (feld !== pi) engine.markiereSeitenfremd(inst, pi);
        inst.counters.isPlacement = 1;
        engine.zaehleBeschwoerung(pi);   // Welle 10 (Q47): Platzierung zaehlt als Beschwoerung

        engine.log('placement', { card: cardName, by: 'Cloudy Slime', from: 'hand', heroIdx: hi, zoneSlot: si });

        // Mark HOPT as used NOW — successful placement
        engine.gs.hoptUsed[hoptKey] = engine.gs.turn;

        // Emit summon effect glow + wind animation
        engine._broadcastEvent('summon_effect', { owner: feld, heroIdx: hi, zoneSlot: si, cardName });
        engine._broadcastEvent('play_zone_animation', { type: 'wind', owner: feld, heroIdx: hi, zoneSlot: si });

        // Fire on-summon hooks
        await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx: hi, zoneSlot: si });
        await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: hi });

        engine.sync();
        break;
      }
    },

    // Als Ruling (Al 26.10.): „you may increase this Creature's level by 1" = Ja/Nein-Frage (Nein/Abbruch: Stufe bleibt) — `_slime-shared`.
    onTurnStart: slimeLevelUpHook('Cloudy Slime'),
  },
};
