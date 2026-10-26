const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  CARD EFFECT: "Suspicious Monster"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  "You may sacrifice a Creature you control that was not summoned this
//   turn to summon this Creature as an additional Action into the same
//   Support Zone. You may once per turn choose a target and deal 100
//   damage to it."
//
//  ── Part 1: sacrifice-summon into the same slot (drop-on-occupied) ──
//  Mirrors the Deepsea bounce-place framework, but the occupant is
//  SACRIFICED instead of bounced. Dropping Suspicious Monster onto an
//  occupied Support slot whose Creature was NOT summoned this turn makes
//  it the additional-Action mode: that Creature is sacrificed and
//  Suspicious Monster takes its exact slot. Dropping onto an EMPTY slot
//  is a normal Action summon (no sacrifice). The placement is atomic —
//  Suspicious Monster occupies the slot BEFORE the sacrifice's post-
//  destroy hooks fire, so a resummon-into-the-freed-slot reaction
//  (Corpse Cannibal) finds the slot taken and skips it.
//
//  ── Part 2: once per turn, 100 damage to any target. ──
// ═══════════════════════════════════════════

const CARD_NAME = 'Suspicious Monster';

/** Can `heroIdx` legally summon Suspicious Monster right now? (Alive +
 *  meets its level/school requirement.) The sacrifice-summon places this
 *  Creature into the SACRIFICED Creature's slot, so the host is THAT
 *  slot's Hero — only sacrifices sitting on Heroes able to summon
 *  Suspicious Monster are offered as targets (highlight / drop / picker),
 *  matching the normal-summon level gate. */
// Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` = physische
// Seite des Helden (fehlt → pi); nur Helden, die `pi` kontrolliert.
function heroCanSummon(engine, pi, heroIdx, heroOwner = pi) {
  const hero = engine.gs.players[heroOwner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (engine.heroSideOf(heroOwner, hero) !== pi) return false;
  const cd = engine._getCardDB()[CARD_NAME];
  if (heroOwner === pi) return engine.heroMeetsLevelReq(pi, heroIdx, cd);
  return engine.heroMeetsLevelReq(heroOwner, heroIdx, cd, { levelSourcePi: pi });
}

/** The sacrificeable Creature (not summoned this turn) occupying a slot,
 *  or null. Also requires the slot's Hero to be able to summon Suspicious
 *  Monster (it becomes the host). */
// Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` = physische
// Seite des Platzes; der Bewohner steht dort und wird von `pi` kontrolliert.
function findOccupant(engine, pi, heroIdx, slotIdx, heroOwner = pi) {
  const gs = engine.gs;
  const slot = (gs.players[heroOwner]?.supportZones?.[heroIdx] || [])[slotIdx] || [];
  if (slot.length === 0) return null;
  // W17a (Al, 19.10.2026): Ersetzen nur in Zonen mit exakt EINER Karte (Alice-Zone mit 2+ Karten wird durch ein Opfer nicht frei).
  if (!engine.zoneFreiNachKostenzahlung(heroOwner, heroIdx, slotIdx)) return null;
  // Host Hero (this slot's Hero) must itself be able to summon this card.
  if (!heroCanSummon(engine, pi, heroIdx, heroOwner)) return null;
  const inst = engine.cardInstances.find(c =>
    c.zone === 'support' && (c.controller ?? c.owner) === pi && c.owner === heroOwner
    && c.heroIdx === heroIdx && c.zoneSlot === slotIdx && !c.faceDown);
  if (!inst) return null;
  if ((inst.turnPlayed || 0) >= (gs.turn || 0)) return null; // summoned this turn
  // Engine helper drops Cardinal Beasts / immovables / "cannot be sacrificed".
  if (!engine.getSacrificableCreatures(pi).some(c => c.inst.id === inst.id)) return null;
  return inst;
}

/** All occupied slots with a sacrificeable (not-summoned-this-turn)
 *  Creature whose Hero can host (summon) Suspicious Monster. */
function sacrificeableSlots(engine, pi) {
  const turn = engine.gs.turn;
  return engine.getSacrificableCreatures(pi)
    .filter(c => c.inst.zone === 'support' && c.inst.turnPlayed !== turn
      && engine.zoneFreiNachKostenzahlung(c.inst.owner ?? pi, c.inst.heroIdx, c.inst.zoneSlot)   // W17a: nur Zonen mit exakt einer Karte
      && heroCanSummon(engine, pi, c.inst.heroIdx, c.inst.owner ?? pi))
    // Styx 28.9.: `owner` = physische Seite des Platzes.
    .map(c => ({ heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot, owner: c.inst.owner ?? pi, cardName: c.cardName, inst: c.inst }));
}

/**
 * Opfer-Wahl des Tausches: der Bewohner des angeforderten (Drop-)Platzes `req` oder — ohne passende Marke — per Zonenwahl.
 * Rückgabe `{ heroIdx, slotIdx, owner, inst }` oder `null` (nichts opferbar / abgebrochen).
 */
async function wahleOpfer(ctx, req) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  let target = null;
  if (req) {
    // Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` der Marke.
    const side = (isSeat(gs, req.heroOwner)) ? req.heroOwner : pi;
    const occ = findOccupant(engine, pi, req.heroIdx, req.slotIdx, side);
    if (occ) target = { heroIdx: req.heroIdx, slotIdx: req.slotIdx, owner: side, inst: occ };
  }
  if (!target) {
    const slots = sacrificeableSlots(engine, pi);
    if (slots.length === 0) return null; // nothing to sacrifice → abort
    const zones = slots.map(s => ({
      heroIdx: s.heroIdx, slotIdx: s.slotIdx,
      ...(s.owner !== pi ? { owner: s.owner } : {}),
      label: `${gs.players[s.owner]?.heroes?.[s.heroIdx]?.name || 'Hero'} — ${s.cardName} (Slot ${s.slotIdx + 1})`,
    }));
    const picked = await ctx.promptZonePick(zones, {
      title: CARD_NAME,
      description: `Sacrifice a Creature (not summoned this turn) to summon ${CARD_NAME} into its Support Zone?`,
      confirmLabel: '🗡️ Sacrifice & Summon',
      cancellable: true,
      // Es wird eine KARTE gewaehlt, nicht ein Platz: ein Klick auf den Helden
      // darf nicht stillschweigend dessen linkeste waehlen (s. promptZonePick).
      heroShortcut: false,
    });
    if (!picked) return null; // cancel → abort (card back to hand, Action kept)
    const pickSide = (isSeat(gs, picked.owner)) ? picked.owner : pi;
    const occ = findOccupant(engine, pi, picked.heroIdx, picked.slotIdx, pickSide);
    if (!occ) return null;
    target = { heroIdx: picked.heroIdx, slotIdx: picked.slotIdx, owner: pickSide, inst: occ };
  }
  return target;
}

/** W4b: Landung nach dem Kettenfenster in den (gehaltenen) Platz des geopferten Bewohners. `true` = platziert, `false` = Abbruch (Opfer bleibt bezahlt). */
async function landeNachTausch(engine, pi, data) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const { heroIdx, heroOwner, occName } = data;
  let slotIdx = data.slotIdx;
  const fps = gs.players[heroOwner];
  if (((fps.supportZones?.[heroIdx] || [])[slotIdx] || []).length > 0) {
    // Im Fenster belegt worden: anderer freier Platz desselben Helden, sonst Abbruch.
    const frei = [0, 1, 2].find(z => ((fps.supportZones?.[heroIdx] || [])[z] || []).length === 0);
    if (frei == null) return false;
    slotIdx = frei;
  }
  if (!fps.supportZones[heroIdx]) fps.supportZones[heroIdx] = [[], [], []];
  fps.supportZones[heroIdx][slotIdx] = [CARD_NAME];
  const newInst = engine._trackCard(CARD_NAME, heroOwner, 'support', heroIdx, slotIdx);
  newInst.counters = newInst.counters || {};
  if (heroOwner !== pi) engine.markiereSeitenfremd(newInst, pi);   // wie `safePlaceInSupport(…, { controller: pi })`
  newInst.counters.isPlacement = 1;
  engine.zaehleBeschwoerung(pi);   // Welle 10 (Q47): Platzierung zaehlt als Beschwoerung
  newInst.turnPlayed = gs.turn || 0;

  // Hand-Entnahme (der Server hat die Kopie ueber `_resolvingCard` gemerkt), Flug + Glanz.
  let fromHandIdx = -1;
  if (ps._resolvingCard) {
    const { name, nth } = ps._resolvingCard;
    let seen = 0;
    for (let i = 0; i < ps.hand.length; i++) {
      if (ps.hand[i] === name) { seen++; if (seen === nth) { fromHandIdx = i; break; } }
    }
    if (fromHandIdx >= 0) {
      engine.takeFromPileSync(ps, 'hand', fromHandIdx);
      engine.notePlayedFromHand(pi);
    }
    ps._resolvingCard = null;
  }
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: CARD_NAME, from: 'hand', to: 'support',
    fromHandIdx, toHeroIdx: heroIdx, toSlotIdx: slotIdx,
    ...(heroOwner !== pi ? { toOwner: heroOwner } : {}),
  });
  engine._broadcastEvent('summon_effect', {
    owner: heroOwner, heroIdx, zoneSlot: slotIdx, cardName: CARD_NAME,
  });
  ps._placementConsumedByCard = CARD_NAME;
  engine.log('suspicious_monster_sacrifice_summon', {
    player: ps.username, sacrificed: occName, heroIdx, slotIdx,
  });
  engine.sync();

  const hostHero = fps?.heroes?.[heroIdx];
  const onDeadHero = !hostHero?.name || hostHero.hp <= 0;
  await engine.runHooks('onPlay', {
    _onlyCard: newInst, playedCard: newInst, cardName: CARD_NAME,
    zone: 'support', heroIdx, zoneSlot: slotIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: newInst, toZone: 'support', toHeroIdx: heroIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  engine.sync();
  return false; // placement consumed (`_placementConsumedByCard`) — wie bei den Deepsea-Tauschen `false`: der Server platziert nicht selbst, und Wege mit `summonCreatureWithHooks` (Sofort-Aktion aus der Hand) legen nicht ein zweites Mal (N3-06, W24).
}

/** Alter atomarer Tausch (Platzierung VOR den Todes-Signalen) — Fallback fuer Wege ohne `paySummonCost` (Effekt-Beschwoerungen u. ä.). */
async function sacrificeSwapAtomar(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];

  // Free-slot drop → normal Action summon (no sacrifice); let the
  // engine place it.
  if (ps._requestedNormalSummonSlot) {
    delete ps._requestedNormalSummonSlot;
    return true;
  }

  // Resolve the target occupied slot — the drop slot if provided,
  // otherwise prompt.
  let target = null;
  if (ps._requestedBouncePlaceSlot) {
    const req = ps._requestedBouncePlaceSlot;
    delete ps._requestedBouncePlaceSlot;
    // Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` der Marke.
    const side = (isSeat(gs, req.heroOwner)) ? req.heroOwner : pi;
    const occ = findOccupant(engine, pi, req.heroIdx, req.slotIdx, side);
    if (occ) target = { heroIdx: req.heroIdx, slotIdx: req.slotIdx, owner: side, inst: occ };
  }
  if (!target) {
    const slots = sacrificeableSlots(engine, pi);
    if (slots.length === 0) return false; // nothing to sacrifice → abort
    const zones = slots.map(s => ({
      heroIdx: s.heroIdx, slotIdx: s.slotIdx,
      ...(s.owner !== pi ? { owner: s.owner } : {}),
      label: `${gs.players[s.owner]?.heroes?.[s.heroIdx]?.name || 'Hero'} — ${s.cardName} (Slot ${s.slotIdx + 1})`,
    }));
    const picked = await ctx.promptZonePick(zones, {
      title: CARD_NAME,
      description: `Sacrifice a Creature (not summoned this turn) to summon ${CARD_NAME} into its Support Zone?`,
      confirmLabel: '🗡️ Sacrifice & Summon',
      cancellable: true,
      // Es wird eine KARTE gewaehlt, nicht ein Platz: ein Klick auf den Helden
      // darf nicht stillschweigend dessen linkeste waehlen (s. promptZonePick).
      heroShortcut: false,
    });
    if (!picked) return false; // cancel → abort (card back to hand, Action kept)
    const pickSide = (isSeat(gs, picked.owner)) ? picked.owner : pi;
    const occ = findOccupant(engine, pi, picked.heroIdx, picked.slotIdx, pickSide);
    if (!occ) return false;
    target = { heroIdx: picked.heroIdx, slotIdx: picked.slotIdx, owner: pickSide, inst: occ };
  }

  const { heroIdx, slotIdx, inst: occ } = target;
  const occName = occ.name;
  // Styx 28.9.: geliehene Helden der Gegenspalte — Platz, Zone und Ablage
  // des Bewohners auf der physischen Seite; Hand und Kontrolle bei `pi`.
  const heroOwner = target.owner ?? pi;
  const fps = gs.players[heroOwner];

  // (1) Fire ON_CREATURE_SACRIFICED while the occupant is still in its
  //     slot — feeds Temple / Ruin Mourner / Corpse Cannibal / etc. The
  //     per-turn tally and the `_sacrificedTurn` stamp are applied
  //     centrally in runHooks(onCreatureSacrificed) — don't do them here.
  engine._broadcastEvent('play_zone_animation', {
    type: 'knife_sacrifice', owner: heroOwner, heroIdx, zoneSlot: slotIdx,
  });
  await engine.runHooks('onCreatureSacrificed', {
    creature: occ, cardName: occName, owner: occ.owner,
    heroIdx, zoneSlot: slotIdx,
    source: { name: CARD_NAME, owner: pi, heroIdx },
    _skipReactionCheck: true,
  });

  // (2) Atomic swap: remove the occupant's name, place Suspicious
  //     Monster's name + a fresh instance into the SAME slot.
  const slotArr = fps.supportZones?.[heroIdx]?.[slotIdx];
  if (Array.isArray(slotArr)) {
    const idx = slotArr.indexOf(occName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }
  if (!fps.supportZones[heroIdx]) fps.supportZones[heroIdx] = [[], [], []];
  fps.supportZones[heroIdx][slotIdx] = [CARD_NAME];
  const newInst = engine._trackCard(CARD_NAME, heroOwner, 'support', heroIdx, slotIdx);
  newInst.counters = newInst.counters || {};
  if (heroOwner !== pi) engine.markiereSeitenfremd(newInst, pi);   // wie `safePlaceInSupport(…, { controller: pi })`
  newInst.counters.isPlacement = 1;
  engine.zaehleBeschwoerung(pi);   // Welle 10 (Q47): Platzierung zaehlt als Beschwoerung
  newInst.turnPlayed = gs.turn || 0;

  // (3) Splice Suspicious Monster from hand (server pinned the copy via
  //     `_resolvingCard`); clearing it makes the server's commitHandRemoval
  //     a no-op, and `_placementConsumedByCard` skips its placement.
  let fromHandIdx = -1;
  if (ps._resolvingCard) {
    const { name, nth } = ps._resolvingCard;
    let seen = 0;
    for (let i = 0; i < ps.hand.length; i++) {
      if (ps.hand[i] === name) { seen++; if (seen === nth) { fromHandIdx = i; break; } }
    }
    if (fromHandIdx >= 0) {
      engine.takeFromPileSync(ps, 'hand', fromHandIdx);
      engine.notePlayedFromHand(pi);
    }
    ps._resolvingCard = null;
  }

  // (4) Hand→support flight + summon glow.
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: CARD_NAME, from: 'hand', to: 'support',
    fromHandIdx, toHeroIdx: heroIdx, toSlotIdx: slotIdx,
    ...(heroOwner !== pi ? { toOwner: heroOwner } : {}),
  });
  engine._broadcastEvent('summon_effect', {
    owner: heroOwner, heroIdx, zoneSlot: slotIdx, cardName: CARD_NAME,
  });
  ps._placementConsumedByCard = CARD_NAME;
  engine.log('suspicious_monster_sacrifice_summon', {
    player: ps.username, sacrificed: occName, heroIdx, slotIdx,
  });
  engine.sync();

  // (5) Route the sacrificed occupant to discard + fire ON_CREATURE_DEATH
  //     (sacrifice is a sub-type of dying). The slot is already taken by
  //     Suspicious Monster, so a resummon-into-the-freed-slot reaction
  //     (Corpse Cannibal) correctly finds it occupied and skips.
  const _ankhotaVorab = engine.ankhotaLoeschtVomBrett(occ);   // Ankhota: vor dem Zonenwechsel auswerten (Ankhota selbst zählt mit)
  occ.zone = 'discard'; occ.heroIdx = -1; occ.zoneSlot = -1;
  const _occPs = gs.players[engine.kartenBesitzerVon(occ)] || fps;   // W63c: Ablage des permanenten Besitzers des Geopferten
  if (!_occPs.discardPile) _occPs.discardPile = [];
  // Ankhota: „Delete all Creatures that are moved from the board to anywhere else" — der Opfer-Tausch umgeht den zentralen Move: gelöscht statt abgelegt.
  if (!engine.ankhotaLoeschtSonderweg(occ, gs.players[engine.kartenBesitzerVon(occ)] ? engine.kartenBesitzerVon(occ) : heroOwner, { source: CARD_NAME, vorab: _ankhotaVorab })) _occPs.discardPile.push(occName);
  await engine.runHooks('onCardLeaveZone', {
    card: occ, leavingCard: occ, fromZone: 'support',
    fromOwner: heroOwner, fromHeroIdx: heroIdx, fromZoneSlot: slotIdx,
    toZone: 'discard', _skipReactionCheck: true,
  });
  await engine.runHooks('onCreatureDeath', {
    creature: {
      name: occName, owner: occ.owner, originalOwner: occ.originalOwner,
      // v1360: stand hier `heroIdx: slotIdx` — Todes-Listener, die den
      // Platz lesen (Call of the Deepsea, Grave Worm …), sahen den falschen Helden.
      heroIdx, zoneSlot: slotIdx, instId: occ.id,
      controller: occ.controller ?? occ.owner,
    },
    source: { name: CARD_NAME, owner: pi, heroIdx },
    _skipReactionCheck: true,
  });
  engine._untrackCard(occ.id);

  // (6) Suspicious Monster's own on-summon lifecycle.
  const hostHero = fps?.heroes?.[heroIdx];
  const onDeadHero = !hostHero?.name || hostHero.hp <= 0;
  await engine.runHooks('onPlay', {
    _onlyCard: newInst, playedCard: newInst, cardName: CARD_NAME,
    zone: 'support', heroIdx, zoneSlot: slotIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: newInst, toZone: 'support', toHeroIdx: heroIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  engine.sync();

  return false; // placement consumed (`_placementConsumedByCard`) — wie bei den Deepsea-Tauschen `false`: der Server platziert nicht selbst, und Wege mit `summonCreatureWithHooks` (Sofort-Aktion aus der Hand) legen nicht ein zweites Mal (N3-06, W24).
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'knife_sacrifice' }, impactMs: 260,
  },

  creatureEffect: true,
  requiresTarget: true, // Part 2 picks a damage target (Blinded gating).

  // ── Part 1 play-mode helpers (Deepsea-style, but sacrifice) ──
  // Additional-Action mode iff dropping onto a sacrificeable occupied
  // slot; a free-slot drop is a normal Action summon.
  inherentAction(gs, pi, heroIdx, engine, opts) {
    if (opts && opts.zoneSlot != null) {
      // Styx 28.9.: geliehene Helden der Gegenspalte — Seite, falls die
      // Engine sie mitgibt (sonst eigene Seite wie bisher).
      const side = opts.heroOwner ?? opts.charmedOwner ?? pi;
      return !!findOccupant(engine, pi, heroIdx, opts.zoneSlot, side);
    }
    return sacrificeableSlots(engine, pi).length > 0;
  },
  // Playable on a full-zoned Hero only while THAT Hero owns a
  // sacrificeable Creature (the destination slot is the sacrificed
  // Creature's, so the host is this same Hero) — and `sacrificeableSlots`
  // already excludes Heroes that can't summon Suspicious Monster.
  // ★ v1167: Die Ersetzung KOSTET ein Opfer — das ist eine Handlung des
  // Helden. Ein eingefrorener, betaeubter oder negierter Held darf sie
  // deshalb NICHT ausfuehren (der Zonen-Bypass allein waere sonst ein
  // Freibrief, siehe `heroParalyzed` in der Engine).
  requiresActiveCaster: true,

  canBypassFreeZoneRequirement(gs, pi, heroIdx, cardData, engine) {
    // Styx 28.9.: geliehene Helden der Gegenspalte — nur eigene Plaetze
    // (der Bypass wird nur fuer Helden der eigenen Spalte gefragt).
    return sacrificeableSlots(engine, pi).some(s => s.heroIdx === heroIdx && s.owner === pi);
  },
  // Legal drop onto an occupied slot iff its occupant is sacrificeable.
  // Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` = physische Seite.
  canPlaceOnOccupiedSlot(gs, pi, heroIdx, slotIdx, engine, heroOwner = pi) {
    return !!findOccupant(engine, pi, heroIdx, slotIdx, heroOwner);
  },
  // Client highlight for the draggable drop targets.
  getBouncePlacementTargets(gs, pi, engine) {
    return sacrificeableSlots(engine, pi).map(s => (s.owner !== pi
      ? { heroIdx: s.heroIdx, slotIdx: s.slotIdx, owner: s.owner }
      : { heroIdx: s.heroIdx, slotIdx: s.slotIdx }));
  },

  // ★ W4b (Al, Welle 4): das OPFER des Bewohners ist KOSTE der Beschwörung und wird VOR dem Reaktionsfenster bezahlt
  // (`paySummonCost`, Engine `_payCreatureSummonCost`): Messer, `onCreatureSacrificed`, Ablage, Todes-Signale; der frei
  // gewordene Platz bleibt gehalten (`engine.haltePlatzFuerTausch`: Corpse Cannibal, Green Dragoneer). Wird die Beschwörung
  // danach komplett negiert (Off Duty …), bleibt der Bewohner geopfert und Suspicious Monster kommt nicht ins Spiel.
  // `beforeSummon` setzt die neue Kreatur nach dem Fenster in den Platz (`ctx._summonKosten`); ohne `paySummonCost`-Lauf
  // (Effekt-Beschwörung o. ä.) läuft der alte atomare Tausch (`sacrificeSwapAtomar`).
  async paySummonCost(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (ps._requestedNormalSummonSlot) return { kind: 'none' };   // Marke bleibt: `beforeSummon` räumt sie ab
    const target = await wahleOpfer(ctx, ps._requestedBouncePlaceSlot || null);
    if (!target) return false;
    const { heroIdx, slotIdx, inst: occ } = target;
    const occName = occ.name;
    const heroOwner = target.owner ?? pi;
    const fps = gs.players[heroOwner];
    engine.haltePlatzFuerTausch(heroOwner, heroIdx, slotIdx);

    engine._broadcastEvent('play_zone_animation', {
      type: 'knife_sacrifice', owner: heroOwner, heroIdx, zoneSlot: slotIdx,
    });
    await engine.runHooks('onCreatureSacrificed', {
      creature: occ, cardName: occName, owner: occ.owner,
      heroIdx, zoneSlot: slotIdx,
      source: { name: CARD_NAME, owner: pi, heroIdx },
      _skipReactionCheck: true,
    });
    const slotArr = fps.supportZones?.[heroIdx]?.[slotIdx];
    if (Array.isArray(slotArr)) {
      const idx = slotArr.indexOf(occName);
      if (idx >= 0) slotArr.splice(idx, 1);
    }
    const _ankhotaVorab = engine.ankhotaLoeschtVomBrett(occ);   // Ankhota: vor dem Zonenwechsel auswerten (Ankhota selbst zählt mit)
    occ.zone = 'discard'; occ.heroIdx = -1; occ.zoneSlot = -1;
    const _occPs = gs.players[engine.kartenBesitzerVon(occ)] || fps;   // W63c: Ablage des permanenten Besitzers des Geopferten
    if (!_occPs.discardPile) _occPs.discardPile = [];
    // Ankhota: „Delete all Creatures that are moved from the board to anywhere else" — der Opfer-Tausch umgeht den zentralen Move: gelöscht statt abgelegt.
    if (!engine.ankhotaLoeschtSonderweg(occ, gs.players[engine.kartenBesitzerVon(occ)] ? engine.kartenBesitzerVon(occ) : heroOwner, { source: CARD_NAME, vorab: _ankhotaVorab })) _occPs.discardPile.push(occName);
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
        controller: occ.controller ?? occ.owner,
      },
      source: { name: CARD_NAME, owner: pi, heroIdx },
      _skipReactionCheck: true,
    });
    engine._untrackCard(occ.id);
    return { kind: 'swap', heroIdx, slotIdx, heroOwner, occName };
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];

    // W4b: Kosten schon vor dem Reaktionsfenster bezahlt → nur noch landen.
    const pre = ctx._summonKosten;
    if (pre) {
      if (ps._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;
      if (ps._requestedNormalSummonSlot) delete ps._requestedNormalSummonSlot;
      if (pre.kind !== 'swap') return true;   // Platz war frei: normale Beschwörung, die Engine platziert
      return await landeNachTausch(engine, pi, pre);
    }
    // N3-06 (W24): Effekt-Beschwoerungen (Slave Trader, Tharxian Horse, Master's Key …) legen die Karte in eine FREIE Zone und
    // zahlen kein Opfer — der Tausch ist ein Wahlweg der Hand-Beschwoerung (`_isNormalSummon`). Ohne diese Pruefung lief der
    // Fallback zusaetzlich zur Engine-Platzierung (zwei Kopien, Opfer in der Ablage, Kartenbilanz +1).
    if (ctx._isNormalSummon !== true) return true;
    return await sacrificeSwapAtomar(ctx);
  },

  // ── Part 2: once per turn, 100 damage to any target. ──
  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: 100,
      title: CARD_NAME,
      description: 'Deal 100 damage to a target.',
      confirmLabel: '👹 100 Damage!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const slot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot ?? -1,
    });
    await engine._delay(400);

    const source = { name: CARD_NAME, owner: pi, heroIdx };
    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) await engine.actionDealDamage(source, tgtHero, 100, 'creature');
    } else if (target.cardInstance) {
      const live = engine.cardInstances.find(c => c.id === target.cardInstance.id);
      if (live && live.zone === 'support') {
        await engine.actionDealCreatureDamage(source, live, 100, 'creature', { sourceOwner: pi, canBeNegated: true });
      }
    }
    engine.log('suspicious_monster_strike', { player: gs.players[pi]?.username, target: target.cardName || target.type });
    engine.sync();
    return true;
  },

  cpuMeta: {
    onDeathBenefit: 6,
  },
};
