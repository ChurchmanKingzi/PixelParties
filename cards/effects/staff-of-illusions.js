// ═══════════════════════════════════════════
//  CARD EFFECT: "Staff of Illusions"
//  Artifact (Normal, Cost 10 × creature level)
//
//  Choose a level 3 or lower Creature from
//  your deck or hand and place it into the
//  Support Zone of any Hero you control.
//  Cost = 10 × chosen Creature's level.
//  You cannot summon other Creatures this turn.
//
//  At the end of your opponent's next turn,
//  the Creature is shuffled back into your deck.
//
//  Visual: creature receives the light-blue
//  illusion filter (_illusionSummon counter)
//  identical to Xuanwu's revived creatures.
//
//  Return trigger: tracked via onTurnEnd hook
//  on this card instance while it is in the
//  discard zone (activeIn includes 'discard').
// ═══════════════════════════════════════════

const { isSummonablePileCreature, hasCardType } = require('./_hooks');

const CARD_NAME  = 'Staff of Illusions';
const COST_PER_LEVEL = 10;
const MAX_LEVEL  = 3;

/** Build deduplicated gallery entries for eligible deck + hand creatures. */
function buildCreatureGallery(ps, cardDB, engine, pi) {
  const entries = new Map(); // name → {name, source, level}
  const effLvl = (cd) => (engine?.effectiveCardLevel
    ? engine.effectiveCardLevel(cd, pi)
    : (cd.level ?? 0));

  for (const cn of (ps.mainDeck || [])) {
    const cd = cardDB[cn];
    if (!cd || !isSummonablePileCreature(cd)) continue;
    const lvl = effLvl(cd);
    if (lvl > MAX_LEVEL) continue;
    if (!entries.has(cn)) entries.set(cn, { name: cn, source: 'deck', level: lvl });
  }
  for (const cn of (ps.hand || [])) {
    const cd = cardDB[cn];
    if (!cd || !isSummonablePileCreature(cd)) continue;
    const lvl = effLvl(cd);
    if (lvl > MAX_LEVEL) continue;
    if (!entries.has(cn)) entries.set(cn, { name: cn, source: 'hand', level: lvl });
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  isTargetingArtifact: true,
  manualGoldCost: true,
  // W64b: kein `deferBroadcast` mehr — der Auftritt kommt zentral (Auftritts-Puffer); `engine.commitAppearance()` markiert die Stelle, ab der es keinen Abbruch mehr gibt.
  activeIn: ['support', 'ability', 'hero', 'hand', 'discard'],

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    const cardDB = {}; // placeholder — real check below
    // X-Kosten (10 je Stufe): Stufe 0 kostet 0. Die Hand graut die Karte deshalb nicht am Grundpreis 10 aus (`selfPricedArtifacts`,
    // server.js) - ob sie spielbar ist, entscheidet allein dieses Tor mit den echten Kosten.
    // G1 (A09-11, Als Antwort): unter der Goldsperre ("cannot spend Gold") sind nur Gesamtkosten 0 erlaubt, also nur Stufe-0-Kreaturen
    // (Kartentext: Kosten = 10 x Stufe). Die "mindestens 10 Gold"-Regel unten ist KEINE Kartentext-Bedingung, nur die Vorpruefung
    // fuer Stufe >= 1 - sie sperrt die Karte unter der Goldsperre daher nicht mehr ganz, sondern laesst nur noch Stufe 0 zu.
    // W4a (F03-13, Al: "Wenn die Kosten fuer lv 0 0 sind, ja."): Auch OHNE Goldsperre ist die Karte unter 10 Gold spielbar,
    // sobald eine waehlbare Kreatur effektiv Stufe 0 hat (Gesamtkosten 0). Kosten > 0 bleiben an Gold gebunden.
    const hatStufe0 = !!engine && buildCreatureGallery(ps, engine._getCardDB(), engine, pi).some(e => e.level === 0);
    if (ps.goldLocked) {
      if (!hatStufe0) return false;
    } else
    // Player needs at least 10 gold (level 1 minimum cost) - es sei denn, eine Stufe-0-Kreatur kostet nichts - and a free support zone
    if ((ps.gold || 0) < COST_PER_LEVEL && !hatStufe0) return false;
    // ★ W22a (Al, 20.10.2026, „Hero you control": „Nur der aktuelle Kontrolleur, inklusive eines temporaeren Kontrolleurs"): Helden, die `pi` kontrolliert
    // (nicht der abgegebene eigene Held, dafuer der uebernommene der Gegenspalte).
    const hasFreeZone = engine && engine.heroesControlledBy ? engine.heroesControlledBy(pi).some(({ physOwner, heroIdx: hi, hero: h }) =>
      h?.name && h.hp > 0 &&
      (gs.players[physOwner]?.supportZones?.[hi] || []).some(slot => (slot || []).length === 0),
    ) : (ps.heroes || []).some((h, hi) =>
      h?.name && h.hp > 0 &&
      (ps.supportZones?.[hi] || []).some(slot => (slot || []).length === 0),
    );
    if (hasFreeZone) return true;
    // W62a: oder (Alice-Teilung) die Zone einer GLEICHNAMIGEN Creature fuer eine Karte aus Hand/Deck (grobe Vorpruefung; die Wahl prueft `resolve`)
    if (!engine || !engine.heroesControlledBy) return false;
    const { canShareInto } = require('./_alice-shared');
    const namen = new Set([...(ps.hand || []), ...(ps.mainDeck || [])]);
    return engine.heroesControlledBy(pi).some(({ physOwner, heroIdx: hi, hero: h }) => h?.name && [0, 1, 2].some(z => {
      const nm = ((gs.players[physOwner]?.supportZones?.[hi] || [])[z] || [])[0];
      return !!nm && namen.has(nm) && canShareInto(engine, pi, hi, z, nm, physOwner);
    }));
  },

  async resolve(engine, pi) {
    const gs  = engine.gs;
    const ps  = gs.players[pi];
    const cardDB = engine._getCardDB();
    const oppIdx = engine.opponentOf(pi);   // (unten: Rückkehr am Ende SEINES nächsten Zugs)

    // (W64b: der Auftritt wird NICHT mehr hier gezeigt — die Galerie unten ist abbrechbar; er kommt mit `engine.commitAppearance()` hinter der letzten Wahl.)

    // ── Step 1: pick a Creature from deck or hand ────────────────────────

    let gallery = buildCreatureGallery(ps, cardDB, engine, pi);
    // G1 (A09-11): Goldsperre - nur Auswahlen mit Gesamtkosten 0 (Stufe 0) sind waehlbar
    if (ps.goldLocked) gallery = gallery.filter(e => e.level === 0);
    if (gallery.length === 0) return { cancelled: true };

    const creaturePick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Choose a level ${MAX_LEVEL} or lower Creature (cost: 10 × its level).`,
      confirmLabel: '✨ Summon as Illusion!',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!creaturePick || creaturePick.cancelled || !creaturePick.cardName) return { cancelled: true };

    const chosenName = creaturePick.cardName;
    const chosenCd   = cardDB[chosenName];
    // Effective level — matches what the gallery shows the player (a
    // rebated Whoolmoth presented as Lv0 should also cost 0 gold).
    const level      = chosenCd ? engine.effectiveCardLevel(chosenCd, pi) : 0;
    const goldCost   = level * COST_PER_LEVEL;

    // Verify the player can afford it
    if ((ps.gold || 0) < goldCost || (goldCost > 0 && ps.goldLocked)) return { cancelled: true };   // G1 (A09-11): Goldsperre

    // ── Step 2: pick a free support zone ────────────────────────────────
    // Place can target ANY of the player's Heroes' Support Zones —
    // including dead, Frozen, Stunned, Bound, negated etc. — per the
    // universal "place" rule. Only fully-empty Hero slots (no name)
    // are skipped because there's no Support Zone to occupy.
    //
    // Per-Hero `canSummon` filter (`_bypassBeforeSummon: true`) honors
    // each Creature's gating rule. This is a placement that skips
    // `beforeSummon`, so cards like King Trex re-apply their strict
    // per-Hero archetype rule (no Gigantisaur-occupied Hero when the
    // auto-sacrifice can't run).
    // ★ W22a (Al, 20.10.2026, „Hero you control": „Nur der aktuelle Kontrolleur, inklusive eines temporaeren Kontrolleurs"): die Zonen der Helden, die `pi`
    // KONTROLLIERT (`heroesControlledBy`): ein abgegebener eigener Held (dauerhaft oder temporaer) wird dem Besitzer nicht angeboten, ein uebernommener Held der
    // Gegenspalte seinem Kontrolleur (Zone traegt `owner` = Brettseite; die Illusion steht dann seitenfremd, kontrolliert von `pi`).
    let freeZones = [];
    for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(pi)) {
      if (!h?.name) continue;
      if (!engine.isCreatureSummonable(chosenName, physOwner, hi, { _bypassBeforeSummon: true })) continue;
      for (let si = 0; si < 3; si++) {
        if ((gs.players[physOwner]?.supportZones?.[hi]?.[si] || []).length === 0) {
          const dead = h.hp <= 0;
          freeZones.push({
            heroIdx: hi, slotIdx: si, owner: physOwner,
            label: `${h.name}${dead ? ' (KO\'d)' : ''} — Slot ${si + 1}`,
          });
        }
      }
    }
    // ★ W62a: + (Alice-Teilung) die Zone einer GLEICHNAMIGEN Creature (W63a: geteilte Zone zuerst, dann die freien; `beschwoerZonenFuer`).
    for (const z of engine.beschwoerZonenFuer(pi, chosenName, { nachKontrolle: true })) {
      if (!z.shared) continue;
      if (!engine.isCreatureSummonable(chosenName, z.owner, z.heroIdx, { _bypassBeforeSummon: true })) continue;
      freeZones.push({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner, shared: true, label: z.label });
    }
    freeZones = require('./_alice-shared').geteiltZuerst(freeZones);   // W63a (Al, 22.10.2026): erst die geteilte Zone, DANN die erste leere
    if (freeZones.length === 0) return { cancelled: true };

    // W64b: Kreatur gewählt, bezahlbar, Zone vorhanden — ab hier gibt es keinen Abbruch mehr (die Zonenwahl unten ist Pflicht): der Auftritt kommt VOR dem Platzieren.
    engine.commitAppearance();
    await engine._delay(100);

    let destHeroIdx, destSlot, destSeite = pi;
    if (freeZones.length === 1) {
      destHeroIdx = freeZones[0].heroIdx;
      destSlot    = freeZones[0].slotIdx;
      destSeite   = freeZones[0].owner;
    } else {
      const ctx   = engine._createContext(
        engine.cardInstances.find(c => c.owner === pi && c.name === CARD_NAME) || { owner: pi, heroIdx: -1, zoneSlot: -1, counters: {} },
        {},
      );
      const zonePick = await ctx.promptZonePick(freeZones, {
        title: CARD_NAME,
        description: `Choose where to place the illusion of ${chosenName}.`,
        confirmLabel: '📍 Place here',
        cancellable: false,
      });
      if (!zonePick) return { cancelled: true };
      const zone = freeZones.find(z => z.heroIdx === zonePick.heroIdx && z.slotIdx === zonePick.slotIdx && z.owner === (zonePick.owner ?? pi))
        || (zonePick.owner == null ? freeZones.find(z => z.heroIdx === zonePick.heroIdx && z.slotIdx === zonePick.slotIdx) : null);
      if (!zone) return { cancelled: true };
      destHeroIdx = zone.heroIdx;
      destSlot    = zone.slotIdx;
      destSeite   = zone.owner;
    }

    // ── Step 3: remove from source, deduct gold, place ──────────────────

    // Remove from deck or hand
    const _taken_deckIdx = await engine.deckEntnahme(ps,  chosenName, { source: CARD_NAME, shuffle: true });   // v820: Stapel-Schicht
    if (_taken_deckIdx) {
    } else {
      const handIdx = ps.hand.indexOf(chosenName);
      if (handIdx >= 0) engine.takeFromPileSync(ps, 'hand', handIdx);
    }

    // Deduct gold
    await engine._payCardCost(pi, goldCost);

    // Place in support zone
    const dps = gs.players[destSeite];   // W22a: Brettseite der Zone (uebernommener Held der Gegenspalte)
    engine.zoneEintragen(destSeite, destHeroIdx, destSlot, chosenName, pi);   // W62a: gleichnamige Kreatur (Alice) → dazustapeln statt ueberschreiben

    const inst     = engine._trackCard(chosenName, destSeite, 'support', destHeroIdx, destSlot);
    if (destSeite !== pi) engine.markiereSeitenfremd(inst, pi);
    inst.turnPlayed = gs.turn;

    // Light-blue illusion visual filter (same as Xuanwu revived creatures)
    inst.counters._illusionSummon = true;

    ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

    engine._broadcastEvent('summon_effect', {
      owner: destSeite, heroIdx: destHeroIdx, zoneSlot: destSlot, cardName: chosenName,
    });
    await engine._delay(400);

    engine.log('staff_illusion_place', {
      player: ps.username, creature: chosenName, goldCost,
      hero: dps.heroes[destHeroIdx]?.name,
    });

    // W25c (N3-13, Al: „place triggert On-Summon"): die platzierte Kreatur loest ihre eigenen Einsatz-Effekte aus.
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName: chosenName, zone: 'support', heroIdx: destHeroIdx, zoneSlot: destSlot,
      _skipReactionCheck: true, _bypassDeadHeroFilter: true, _isPlacement: true,
      ...(_taken_deckIdx ? engine.deckLandung(inst, _taken_deckIdx) : {}),
    });
    // Fire enter-zone hooks (Ingo, Maya, Layn, etc.). Placement onto
    // any Hero (alive / dead / Frozen / Stunned / negated / Bound) is
    // legal per the universal "place" rule, and the placed Creature's
    // own on-summon hooks must still fire — `_isPlacement: true`
    // declares the placement-style summon and the dead-hero filter
    // is bypassed unconditionally for placements.
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
      _skipReactionCheck: true,
      _bypassDeadHeroFilter: true,
      _isPlacement: true,
      ...(_taken_deckIdx ? engine.deckLandung(inst, _taken_deckIdx) : {}),   // v1393
    });

    // Lock summoning for the rest of the turn
    engine.lockSummons
      ? engine.lockSummons(pi)
      : (ps.summonLocked = true);

    // ── Step 4: tag this Staff instance to return the creature later ─────
    // Find this Staff's card instance (now in discard after resolution)
    // We'll store tracking on gs._staffIllusions for the onTurnEnd hook
    if (!gs._staffIllusions) gs._staffIllusions = [];
    gs._staffIllusions.push({
      instId:         inst.id,
      owner:          pi,
      opponent:       oppIdx,       // Return triggers at end of THEIR next turn
      creatureName:   chosenName,
      heroIdx:        destHeroIdx,
      slotIdx:        destSlot,
      oppTurnPending: true,         // Waiting for opponent's turn to start
      turn:           gs.turn || 0, // v1364: die Engine gibt zurueck (`_illusionenZurueck`)
      quelle:         CARD_NAME,
    });

    engine.sync();
    return {};
  },

  // ★ v1364: die Rueckkehr erledigt die Engine (`_illusionenZurueck`,
  // switchTurn) — fuer Staff of Illusions UND Create Illusion, unabhaengig
  // davon, ob eine Staff-Instanz irgendwo lauscht.
};
