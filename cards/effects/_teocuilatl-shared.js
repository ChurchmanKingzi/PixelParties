const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
const { aktionFrei } = require('./_extra-summon-shared');   // Nr. 82: „ist die Aktion des Helden noch frei?" (Action Phase)
// ═══════════════════════════════════════════
//  SHARED: Sacrifice-Summon der Teocuilatl-Creatures
//
//  "You may sacrifice a Creature you control that was
//   not summoned this turn to summon this Creature as
//   an additional Action."
//
//  Wortgleich bei Guardian, Archer und Warrior of
//  Teocuilatl. Die Mechanik ist das Suspicious-
//  Monster-Muster (Drop auf einen BELEGTEN Slot: das
//  Opfer raeumt genau den Platz, in den die neue
//  Creature faellt) und stammt aus
//  `guardian-of-teocuilatl.js` — hier nur um den
//  Kartennamen parametrisiert, damit die anderen
//  beiden sie nicht nachbauen muessen.
//
//  Guardian selbst wurde BEWUSST NICHT umgestellt:
//  die Karte laeuft, und ein Umbau ohne Anlass waere
//  reines Risiko.
// ═══════════════════════════════════════════

function hasTribute(engine, pi) {
  const turn = engine.gs.turn;
  return engine._collectSacrificeCandidates(pi, {
    filter: c => c.inst.turnPlayed !== turn,
  }).length > 0;
}

// ── Full-board sacrifice-summon (Suspicious Monster pattern) ──
// When every Support Zone is full, the only way to summon Guardian via
// its alt path is to sacrifice a board Creature INTO its own slot — the
// sacrifice frees exactly the slot Guardian then lands in. (A hand
// substitute like Chosen Sacrifice can't help here: it never frees a
// board slot.) These helpers mirror Suspicious Monster's drop-on-
// occupied framework so the card stays draggable / clickable onto a
// full Hero whose Creature is a legal tribute.

/** Can `heroIdx` legally host Guardian right now (alive + meets its
 *  level/school requirement)? The freed slot is the sacrificed
 *  Creature's, so that Creature's Hero is the host. */
// Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` = physische
// Seite des Helden (fehlt → pi). Nur Helden, die `pi` gerade kontrolliert;
// Schulen/Stufen vom Helden, Ermaessigungen aus der Hand von `pi`.
function heroCanSummon(engine, pi, heroIdx, CARD_NAME_ARG, heroOwner = pi) {
  const hero = engine.gs.players[heroOwner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (engine.heroSideOf(heroOwner, hero) !== pi) return false;
  const cd = engine._getCardDB()[CARD_NAME_ARG];
  if (heroOwner === pi) return engine.heroMeetsLevelReq(pi, heroIdx, cd);
  return engine.heroMeetsLevelReq(heroOwner, heroIdx, cd, { levelSourcePi: pi });
}

/** The sacrificeable (not-summoned-this-turn) board Creature occupying a
 *  slot whose Hero can host Guardian, or null. */
// Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` = physische
// Seite des Platzes (fehlt → pi); der Bewohner muss dort stehen UND von
// `pi` kontrolliert werden.
function findOccupant(engine, pi, heroIdx, slotIdx, CARD_NAME_ARG, heroOwner = pi) {
  const gs = engine.gs;
  const slot = (gs.players[heroOwner]?.supportZones?.[heroIdx] || [])[slotIdx] || [];
  if (slot.length === 0) return null;
  // W17a (Al, 19.10.2026): Ersetzen nur in Zonen mit exakt EINER Karte (Alice-Zone mit 2+ Karten wird durch ein Opfer nicht frei).
  if (!engine.zoneFreiNachKostenzahlung(heroOwner, heroIdx, slotIdx)) return null;
  if (!heroCanSummon(engine, pi, heroIdx, CARD_NAME_ARG, heroOwner)) return null;
  const inst = engine.cardInstances.find(c =>
    c.zone === 'support' && (c.controller ?? c.owner) === pi && c.owner === heroOwner
    && c.heroIdx === heroIdx && c.zoneSlot === slotIdx && !c.faceDown);
  if (!inst) return null;
  if ((inst.turnPlayed || 0) >= (gs.turn || 0)) return null; // summoned this turn
  // Engine helper drops Cardinal Beasts / immovables / "cannot be sacrificed".
  if (!engine.getSacrificableCreatures(pi).some(c => c.inst.id === inst.id)) return null;
  return inst;
}

/** All occupied slots holding a sacrificeable Creature whose Hero can
 *  host Guardian. `owner` = physische Seite des Platzes.
 *  Styx 28.9.: geliehene Helden der Gegenspalte — auch Plaetze von Helden,
 *  die `pi` dort kontrolliert (eigene, vom Gegner kontrollierte nicht). */
function sacrificeableSlots(engine, pi, CARD_NAME_ARG) {
  const turn = engine.gs.turn;
  return engine.getSacrificableCreatures(pi)
    .filter(c => c.inst.zone === 'support' && c.inst.turnPlayed !== turn
      && engine.zoneFreiNachKostenzahlung(c.inst.owner ?? pi, c.inst.heroIdx, c.inst.zoneSlot)   // W17a: nur Zonen mit exakt einer Karte
      && heroCanSummon(engine, pi, c.inst.heroIdx, CARD_NAME_ARG, c.inst.owner ?? pi))
    .map(c => ({ heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot, owner: c.inst.owner ?? pi, cardName: c.cardName, inst: c.inst }));
}

/** Client-Ziele (`getBouncePlacementTargets`): `owner` nur, wenn ≠ pi. */
function bounceTargets(engine, pi, CARD_NAME_ARG) {
  return sacrificeableSlots(engine, pi, CARD_NAME_ARG)
    .map(s => (s.owner !== pi
      ? { heroIdx: s.heroIdx, slotIdx: s.slotIdx, owner: s.owner }
      : { heroIdx: s.heroIdx, slotIdx: s.slotIdx }));
}

/** Full-board sacrifice-summon: sacrifice the occupant of the dropped
 *  slot and install Guardian into that same (now-freed) slot. Returns
 *  true on success (placement consumed — server skips its own placement),
 *  false to abort. The hand removal is done here BY NAME and the
 *  hand→board flight is emitted manually, because the server's pinned
 *  `_resolvingCard` is unreliable on the click-to-place route (it's unset
 *  there, so the server's commitHandRemoval no-ops and leaves the played
 *  copy in hand). */
async function sacrificeSummonIntoSlot(engine, pi, req, CARD_NAME_ARG) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  // Styx 28.9.: geliehene Helden der Gegenspalte — Platz, Zone, Ablage des
  // Bewohners und Glow auf der physischen Seite `heroOwner`; Hand, Kosten
  // und Kontrolle bei `pi`.
  const heroOwner = (isSeat(gs, req.heroOwner)) ? req.heroOwner : pi;
  const fps = gs.players[heroOwner];
  const occ = findOccupant(engine, pi, req.heroIdx, req.slotIdx, CARD_NAME_ARG, heroOwner);
  if (!occ) return false;
  const { heroIdx, slotIdx } = req;
  const occName = occ.name;

  // (1) Knife visual + ON_CREATURE_SACRIFICED while the tribute is still
  //     in its slot (feeds Temple / Ruin Mourner / Corpse Cannibal). The
  //     per-turn tally + `_sacrificedTurn` stamp are applied centrally in
  //     runHooks — mirrors engine.resolveSacrificeCost.
  engine._broadcastEvent('play_zone_animation', {
    type: 'knife_sacrifice', owner: heroOwner, heroIdx, zoneSlot: slotIdx,
  });
  await engine._delay(450);
  await engine.runHooks('onCreatureSacrificed', {
    creature: occ, cardName: occName, owner: occ.owner,
    heroIdx, zoneSlot: slotIdx,
    source: { name: CARD_NAME_ARG, owner: pi, heroIdx },
    _skipReactionCheck: true,
  });

  // (2) Hand→board flight for Guardian — emitted BEFORE the hand splice so
  //     the client still renders the source card at `fromHandIdx`.
  //     `_forceOwnerAnim` makes the OWNER see it too: the click/bounce
  //     route has no drag gesture to ride on, so this is the only flight
  //     cue. This is the same event the server's normal summon uses
  //     (`hand_to_board_fly`), NOT a pile-transfer — the latter rendered a
  //     stray card from mid-hand (looked like a duplicate).
  const fromHandIdx = ps.hand.indexOf(CARD_NAME_ARG);
  engine._broadcastEvent('hand_to_board_fly', {
    ownerIdx: pi, cardName: CARD_NAME_ARG,
    handIndex: fromHandIdx >= 0 ? fromHandIdx : 0,
    zoneType: 'support', heroIdx, slotIdx, _forceOwnerAnim: true,
    ...(heroOwner !== pi ? { destOwner: heroOwner } : {}),
  });

  // (3) Atomic swap: remove the occupant's name, place Guardian's name +
  //     a fresh instance into the SAME slot before the post-destroy hooks
  //     fire, so a resummon-into-the-freed-slot reaction (Corpse Cannibal)
  //     finds the slot taken and skips it.
  const slotArr = fps.supportZones?.[heroIdx]?.[slotIdx];
  if (Array.isArray(slotArr)) {
    const idx = slotArr.indexOf(occName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }
  if (!fps.supportZones[heroIdx]) fps.supportZones[heroIdx] = [[], [], []];
  fps.supportZones[heroIdx][slotIdx] = [CARD_NAME_ARG];
  const newInst = engine._trackCard(CARD_NAME_ARG, heroOwner, 'support', heroIdx, slotIdx);
  newInst.counters = newInst.counters || {};
  if (heroOwner !== pi) engine.markiereSeitenfremd(newInst, pi);   // wie `safePlaceInSupport(…, { controller: pi })`
  newInst.counters.isPlacement = 1;
  engine.zaehleBeschwoerung(pi);   // Welle 10 (Q47): Platzierung zaehlt als Beschwoerung
  newInst.turnPlayed = gs.turn || 0;

  // (4) Remove Guardian from hand BY NAME (path-independent — all copies
  //     are identical). Clear `_resolvingCard` so the server's
  //     commitHandRemoval is a no-op, and set `_placementConsumedByCard`
  //     so the server skips its own placement.
  if (fromHandIdx >= 0) {
    engine.takeFromPileSync(ps, 'hand', fromHandIdx);
    engine.notePlayedFromHand(pi);
  }
  ps._resolvingCard = null;
  ps._placementConsumedByCard = CARD_NAME_ARG;

  // (5) Summon glow, then sync (after the flight was emitted, so the
  //     client still had the source card when the flight fired).
  engine._broadcastEvent('summon_effect', {
    owner: heroOwner, heroIdx, zoneSlot: slotIdx, cardName: CARD_NAME_ARG,
  });
  engine.log('teocuilatl_sacrifice_summon', {
    player: ps.username, sacrificed: occName, heroIdx, slotIdx,
  });
  engine.sync();

  // (6) Route the sacrificed occupant to discard + fire ON_CREATURE_DEATH
  //     (sacrifice is a sub-type of dying). Slot already taken by Guardian.
  const _ankhotaVorab = engine.ankhotaLoeschtVomBrett(occ);   // Ankhota: vor dem Zonenwechsel auswerten (Ankhota selbst zählt mit)
  occ.zone = 'discard'; occ.heroIdx = -1; occ.zoneSlot = -1;
  // W3/W5a (Al 14.10.2026): in die Ablage des PERMANENTEN Besitzers (nicht der Brettseite/des Kontrolleurs); ein Token verschwindet.
  // Ankhota: „Delete all Creatures that are moved from the board to anywhere else" — der Opfer-Tausch umgeht den zentralen Move: gelöscht statt abgelegt.
  { const opfPs = gs.players[engine.kartenBesitzerVon(occ)] || fps;
    if (!engine.tokenAbgang(occ) && !engine.ankhotaLoeschtSonderweg(occ, gs.players[engine.kartenBesitzerVon(occ)] ? engine.kartenBesitzerVon(occ) : heroOwner, { source: CARD_NAME_ARG, vorab: _ankhotaVorab })) { if (!opfPs.discardPile) opfPs.discardPile = []; opfPs.discardPile.push(occName); } }
  await engine.runHooks('onCardLeaveZone', {
    card: occ, leavingCard: occ, fromZone: 'support',
    fromOwner: heroOwner, fromHeroIdx: heroIdx, fromZoneSlot: slotIdx,
    toZone: 'discard', _skipReactionCheck: true,
  });
  await engine.runHooks('onCreatureDeath', {
    creature: {
      name: occName, owner: occ.owner, originalOwner: occ.originalOwner,
      heroIdx, zoneSlot: slotIdx, instId: occ.id,   // war faelschlich `heroIdx: slotIdx`
    },
    source: { name: CARD_NAME_ARG, owner: pi, heroIdx },
    _skipReactionCheck: true,
  });
  engine._untrackCard(occ.id);

  // (7) Guardian's own on-summon lifecycle.
  const hostHero = fps?.heroes?.[heroIdx];
  const onDeadHero = !hostHero?.name || hostHero.hp <= 0;
  await engine.runHooks('onPlay', {
    _onlyCard: newInst, playedCard: newInst, cardName: CARD_NAME_ARG,
    zone: 'support', heroIdx, zoneSlot: slotIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: newInst, toZone: 'support', toHeroIdx: heroIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  engine.sync();
  return true; // placement consumed
}

/**
 * ★ W4b (Al, Welle 4): DIE KOSTEN DES TAUSCHES VOR DEM REAKTIONSFENSTER. Das Opfer des Bewohners ist der Kostenpunkt
 * („You may sacrifice a Creature … to summon this Creature"). `paySacrificeSwap` (aus `paySummonCost`) opfert den Bewohner
 * — Messer, `onCreatureSacrificed`, Ablage, `onCardLeaveZone`/`onCreatureDeath` — und HAELT den frei gewordenen Platz
 * (`engine.haltePlatzFuerTausch`: Corpse Cannibal und Green Dragoneer lassen ihn in Ruhe). Wird die Beschwoerung danach
 * negiert, bleibt das Opfer bezahlt und die neue Kreatur kommt nicht ins Spiel. `placeAfterSacrificeSwap` (aus
 * `beforeSummon`, nach dem Fenster) setzt die neue Kreatur in den frei gewordenen Platz (ist er trotzdem belegt, in einen
 * anderen freien Platz desselben Helden, sonst `false` = Karte bleibt auf der Hand). Der alte atomare Tausch
 * `sacrificeSummonIntoSlot` bleibt fuer Wege ohne `paySummonCost` bestehen.
 * Rueckgabe von `paySacrificeSwap`: Daten `{ heroIdx, slotIdx, heroOwner, occName }` oder `false` (Bewohner nicht mehr opferbar).
 */
async function paySacrificeSwap(engine, pi, req, CARD_NAME_ARG) {
  const gs = engine.gs;
  const heroOwner = (isSeat(gs, req.heroOwner)) ? req.heroOwner : pi;
  const fps = gs.players[heroOwner];
  const occ = findOccupant(engine, pi, req.heroIdx, req.slotIdx, CARD_NAME_ARG, heroOwner);
  if (!occ) return false;
  const { heroIdx, slotIdx } = req;
  const occName = occ.name;
  engine.haltePlatzFuerTausch(heroOwner, heroIdx, slotIdx);

  // (1) Messer + ON_CREATURE_SACRIFICED, solange der Bewohner noch im Platz steht.
  engine._broadcastEvent('play_zone_animation', {
    type: 'knife_sacrifice', owner: heroOwner, heroIdx, zoneSlot: slotIdx,
  });
  await engine._delay(450);
  await engine.runHooks('onCreatureSacrificed', {
    creature: occ, cardName: occName, owner: occ.owner,
    heroIdx, zoneSlot: slotIdx,
    source: { name: CARD_NAME_ARG, owner: pi, heroIdx },
    _skipReactionCheck: true,
  });

  // (2) Bewohner aus dem Platz in die Ablage, Todes-Signale.
  const slotArr = fps.supportZones?.[heroIdx]?.[slotIdx];
  if (Array.isArray(slotArr)) {
    const idx = slotArr.indexOf(occName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }
  const _ankhotaVorab = engine.ankhotaLoeschtVomBrett(occ);   // Ankhota: vor dem Zonenwechsel auswerten (Ankhota selbst zählt mit)
  occ.zone = 'discard'; occ.heroIdx = -1; occ.zoneSlot = -1;
  // W3/W5a (Al 14.10.2026): in die Ablage des PERMANENTEN Besitzers (nicht der Brettseite/des Kontrolleurs); ein Token verschwindet.
  // Ankhota: „Delete all Creatures that are moved from the board to anywhere else" — der Opfer-Tausch umgeht den zentralen Move: gelöscht statt abgelegt.
  { const opfPs = gs.players[engine.kartenBesitzerVon(occ)] || fps;
    if (!engine.tokenAbgang(occ) && !engine.ankhotaLoeschtSonderweg(occ, gs.players[engine.kartenBesitzerVon(occ)] ? engine.kartenBesitzerVon(occ) : heroOwner, { source: CARD_NAME_ARG, vorab: _ankhotaVorab })) { if (!opfPs.discardPile) opfPs.discardPile = []; opfPs.discardPile.push(occName); } }
  engine.sync();
  await engine.runHooks('onCardLeaveZone', {
    card: occ, leavingCard: occ, fromZone: 'support',
    fromOwner: heroOwner, fromHeroIdx: heroIdx, fromZoneSlot: slotIdx,
    toZone: 'discard', _skipReactionCheck: true,
  });
  await engine.runHooks('onCreatureDeath', {
    creature: {
      name: occName, owner: occ.owner, originalOwner: occ.originalOwner,
      heroIdx, zoneSlot: slotIdx, instId: occ.id,
    },
    source: { name: CARD_NAME_ARG, owner: pi, heroIdx },
    _skipReactionCheck: true,
  });
  engine._untrackCard(occ.id);
  return { heroIdx, slotIdx, heroOwner, occName };
}

/** Landung nach dem Fenster (siehe `paySacrificeSwap`). `true` = Platzierung erledigt (Server ueberspringt seine eigene), `false` = Abbruch. */
async function placeAfterSacrificeSwap(engine, pi, data, CARD_NAME_ARG) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const { heroOwner, occName } = data;
  const fps = gs.players[heroOwner];
  const heroIdx = data.heroIdx;
  let slotIdx = data.slotIdx;
  if (((fps.supportZones?.[heroIdx] || [])[slotIdx] || []).length > 0) {
    // Im Fenster belegt worden: anderer freier Platz desselben Helden, sonst Abbruch (Opfer bleibt bezahlt).
    const frei = [0, 1, 2].find(z => ((fps.supportZones?.[heroIdx] || [])[z] || []).length === 0);
    if (frei == null) return false;
    slotIdx = frei;
  }

  // Hand→Brett-Flug (vor der Entnahme, siehe `sacrificeSummonIntoSlot`).
  const fromHandIdx = ps.hand.indexOf(CARD_NAME_ARG);
  engine._broadcastEvent('hand_to_board_fly', {
    ownerIdx: pi, cardName: CARD_NAME_ARG,
    handIndex: fromHandIdx >= 0 ? fromHandIdx : 0,
    zoneType: 'support', heroIdx, slotIdx, _forceOwnerAnim: true,
    ...(heroOwner !== pi ? { destOwner: heroOwner } : {}),
  });

  if (!fps.supportZones[heroIdx]) fps.supportZones[heroIdx] = [[], [], []];
  fps.supportZones[heroIdx][slotIdx] = [CARD_NAME_ARG];
  const newInst = engine._trackCard(CARD_NAME_ARG, heroOwner, 'support', heroIdx, slotIdx);
  newInst.counters = newInst.counters || {};
  if (heroOwner !== pi) engine.markiereSeitenfremd(newInst, pi);   // wie `safePlaceInSupport(…, { controller: pi })`
  newInst.counters.isPlacement = 1;
  engine.zaehleBeschwoerung(pi);   // Welle 10 (Q47): Platzierung zaehlt als Beschwoerung
  newInst.turnPlayed = gs.turn || 0;

  if (fromHandIdx >= 0) {
    engine.takeFromPileSync(ps, 'hand', fromHandIdx);
    engine.notePlayedFromHand(pi);
  }
  ps._resolvingCard = null;
  ps._placementConsumedByCard = CARD_NAME_ARG;

  engine._broadcastEvent('summon_effect', {
    owner: heroOwner, heroIdx, zoneSlot: slotIdx, cardName: CARD_NAME_ARG,
  });
  engine.log('teocuilatl_sacrifice_summon', {
    player: ps.username, sacrificed: occName, heroIdx, slotIdx,
  });
  engine.sync();

  const hostHero = fps?.heroes?.[heroIdx];
  const onDeadHero = !hostHero?.name || hostHero.hp <= 0;
  await engine.runHooks('onPlay', {
    _onlyCard: newInst, playedCard: newInst, cardName: CARD_NAME_ARG,
    zone: 'support', heroIdx, zoneSlot: slotIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: newInst, toZone: 'support', toHeroIdx: heroIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  engine.sync();
  return true; // placement consumed
}

// ═══════════════════════════════════════════
//  Special/Normal-Wahl der fünf Teocuilatl-Kreaturen (Als Ruling (Al 26.10.), Nr. 82)
//
//  „Hat der Spieler Opfer bzw. einen Doom Counter für die ‚Special'-Beschwörung UND ist eine reguläre Beschwörung per Action verfügbar, wählt er
//   Special/Normal (Muster Blue-Ice Dragon / `_extra-summon-shared`); ist keine reguläre Beschwörung verfügbar, bleibt es zwangsweise Special."
//   Archer / Guardian / Warrior (Opfer) → `paySummonCost` (Kosten vor dem Reaktionsfenster); Jaguar / Eagle (Doom Counter) → `beforeSummon`.
//   `inherentAction` ist deshalb nur dort wahr, wo Special der EINZIGE Weg ist; sonst zieht die Engine die Aktion ein, und „Special" erstattet sie über
//   `gs._summonModeUpgradedToInherent` (server.js).
// ═══════════════════════════════════════════

/** Steht eine REGULÄRE Beschwörung per Action offen? Action Phase mit freier Aktion/Bonusaktion, oder eine passende Zusatzaktion (Zusatzaktions-Anbieter). */
function regulaerOffen(engine, pi, heroIdx, cardName) {
  if (aktionFrei(engine.gs, pi, heroIdx)) return true;
  const hs = typeof engine.heldSeiteFuer === 'function' ? engine.heldSeiteFuer(pi, heroIdx) : pi;
  return !!engine.findAdditionalActionForCard?.(pi, cardName, heroIdx, hs);
}

/** `inherentAction`: Special ist zwangsweise, wenn die Kosten bezahlbar sind (`bezahlbar`) und KEINE reguläre Beschwörung offensteht. */
function specialErzwungen(engine, pi, heroIdx, cardName, bezahlbar) {
  if (!engine || !bezahlbar) return false;
  return !regulaerOffen(engine, pi, heroIdx, cardName);
}

/** Wahl-Dialog (Wortlaut/Knöpfe wie `_extra-summon-shared`). `true` = Special (Kosten zahlen, Aktion zurück), `false` = Normal. */
async function frageSpecial(engine, pi, cardName, specialLabel) {
  const wahl = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: cardName,
    message: `Choose how to summon ${cardName}:`,
    showCard: cardName,
    confirmLabel: specialLabel,
    cancelLabel: '⚔️ Normal (use the Hero\'s Action)',
    cancellable: true,
    equalButtons: true,                     // zwei gleichwertige Wege: gleich breite Knöpfe
    gerrymanderEligible: false,             // zwei Wege, kein „may" (Muster Potion Juggler / `_extra-summon-shared`)
  });
  return !!wahl && !wahl.cancelled;
}

/** Sacrifice a specific Guardian instance (hand or board): fire the
 *  sacrifice signal + per-turn tally/stamp, then route it to discard. */
async function sacrificeSelf(engine, inst, pi) {
  const ps = engine.gs.players[pi];
  // Per-turn tally + `_sacrificedTurn` stamp are applied centrally in
  // `runHooks(onCreatureSacrificed)` — don't do them here (double-count).
  await engine.runHooks('onCreatureSacrificed', {
    creature: inst, cardName: inst.name, owner: inst.owner,
    heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    source: { name: inst.name, owner: pi, heroIdx: inst.heroIdx ?? -1 },
    _skipReactionCheck: true,
  });
  if (inst.zone === 'hand') {
    const hi = (ps?.hand || []).indexOf(inst.name);
    engine._broadcastEvent('play_pile_transfer', {
      owner: inst.owner, cardName: inst.name,
      from: 'hand', to: 'discard', fromHandIdx: hi >= 0 ? hi : 0,
    });
    if (hi >= 0) engine.takeFromPileSync(ps, 'hand', hi);
    (engine.gs.players[engine.kartenBesitzerVon(inst)] || ps).discardPile.push(inst.name);   // W3/W5a: Ablage des permanenten Besitzers
    inst.zone = 'discard'; inst.heroIdx = -1; inst.zoneSlot = -1;
    engine._untrackCard(inst.id);
    // ★★ v1222: Abgleich SOFORT nach dem Hand-Abgang. Der Client verdeckt den
    // Startplatz der abfliegenden Karte nur, solange die Hand noch so
    // gross ist wie beim Abflug — bleibt der `sync` aus, taucht sie
    // nach dem Flug wieder auf (Als Befund 18.9. zu „Dive Down").
    engine.sync();
  } else {
    await engine.actionDestroyCard(
      { name: inst.name, owner: pi, heroIdx: inst.heroIdx }, inst,
    );
  }
}


module.exports = {
  regulaerOffen,
  specialErzwungen,
  frageSpecial,
  hasTribute,
  heroCanSummon,
  findOccupant,
  sacrificeableSlots,
  bounceTargets,
  sacrificeSummonIntoSlot,
  paySacrificeSwap,
  placeAfterSacrificeSwap,
  // War NIE exportiert — Guardian of Teocuilatl rief sie als freien
  // Bezeichner auf und lief dort in einen ReferenceError.
  sacrificeSelf,
};
