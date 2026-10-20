// ═══════════════════════════════════════════
//  CARD EFFECT: "Dark Deepsea God"
//  Creature (Summoning Magic Lv4 — bypassed) — 150 HP
//
//  Normal Action-cost summon with a tribute path:
//  sacrifice 2+ of your own Creatures (not summoned
//  this turn) whose combined original levels are
//  ≥ 4. Those Creatures return to HAND (not the
//  discard pile), and DDG takes ONE OF THEIR
//  VACATED SUPPORT ZONES, chosen by the controller.
//
//  The entire flow runs inside `beforeSummon` so
//  we can interleave the placement and the summon
//  animation:
//
//    1. Pick tributes (`promptEffectTarget`, the
//       standard click-to-select flow with a
//       `minSumLevel: 4` gate).
//    2. Pick which tributed slot DDG rises from
//       (`promptZonePick`). Runs before any bounce
//       so labels still read the tributed
//       Creatures' names.
//    3. Bounce every tribute back to hand via
//       `returnSupportCreatureToHand` — fires the
//       generic `onCardsReturnedToHand` hook so
//       Teppes / Siphem etc. react naturally.
//    4. Broadcast the DDG.png manifest and wait
//       HALF the animation duration so the card
//       materializes on the board at the midpoint.
//    5. Place DDG into the chosen slot via
//       `placeCreature` with `fireHooks: true`.
//       (DDG's own `onPlay` is intentionally
//       empty — all manifest / damage timing is
//       sequenced here so we can split placement
//       across the animation.)
//    6. Wait the remaining half of the manifest
//       so damage lands AFTER the image fades.
//    7. Claim a HARD ONCE PER TURN gate on the
//       AoE damage (`claimHOPT('ddg_aoe', pi)`).
//       If it was already used this turn by this
//       controller (e.g. a second DDG), the
//       animation still played but no damage is
//       dealt.
//    8. Apply 150 standard Creature damage to
//       every enemy target via the normal damage
//       pipelines so every immunity / shield /
//       protection path applies uniformly.
//    9. Set `ps._placementConsumedByCard` so the
//       server skips its default `summonCreature`
//       path (the card is already placed).
//
//  Playability flags:
//    • `canBypassLevelReq: () => true` — no
//      Summoning Magic needed.
//    • `canBypassFreeZoneRequirement` — the
//      casting Hero doesn't need a free slot
//      because DDG lands in a tributed slot.
//    • `getBouncePlacementTargets` — every
//      tribute-candidate slot is a drop target.
//    • `canPlaceOnOccupiedSlot` — server accepts
//      a drop on an occupied tribute candidate
//      (actual placement slot is still the one
//      chosen inside the zone-picker).
//    • `canSummon` greys DDG out in hand when
//      no valid tribute set is available.
// ═══════════════════════════════════════════

const { hasCardType, hasNumericCreatureLevel } = require('./_hooks');
const { returnSupportCreatureToHand, fireReturnedBatch } = require('./_deepsea-shared');

const CARD_NAME = 'Dark Deepsea God';
// Als Ruling: DDG macht 150 — die Konstante hier war IMMER richtig.
// Falsch war der effect-TEXT in data/cards.json ("deal 250 damage"),
// den der Client wörtlich auf der Karte anzeigt; er ist auf 150
// korrigiert. (Kurzzeitig stand hier 250, weil der Datentext fälschlich
// als Quelle der Wahrheit gelesen wurde — zurückgedreht.)
const DAMAGE = 150;

// Full manifest runs 2500ms. The card materializes at the 50% mark so
// it's already on the board as the image peaks and fades. Halves are
// stored explicitly so both sides of the split are easy to tweak.
const MANIFEST_HALF_MS = 1250;

const SACRIFICE_SPEC = {
  minCount: 2,
  minSumLevel: 4,
  returnsToHand: true,   // W16b: Tribut = Rückgabe auf die Hand, kein Besiegen — geliehene (`_stealImmortal`) Kreaturen bleiben zulässig
};

function _collectTributeCandidates(engine, playerIdx, selfId) {
  let cs = engine.getSacrificableCreatures(playerIdx);
  if (selfId != null) cs = cs.filter(c => c.inst.id !== selfId);
  // W5a (A02-37, Al 14.10.2026: „Auch geliehene Creatures sollen sogar möglich sein!"): eine GELIEHENE Kreatur (Succubus & Co.)
  // darf als Tribut dienen; sie geht auf die Hand des Spielers („returning … to your hand"), bleibt aber Eigentum ihres Besitzers.
  // DDG's text: "not summoned this turn." The generic
  // `getSacrificableCreatures` deliberately skips this filter (cards
  // like Sacrifice to Divinity sacrifice anything you control), so
  // DDG enforces it here.
  const currentTurn = engine.gs.turn || 0;
  cs = cs.filter(c => c.inst.turnPlayed !== currentTurn);
  // Der Tribut zaehlt Levels zusammen — Artifact Creatures haben keins (Als Ruling 9.10.).
  cs = cs.filter(c => hasNumericCreatureLevel(engine.getEffectiveCardData(c.inst) || engine._getCardDB()[c.inst.name]));
  return cs;
}

/**
 * Styx 28.9.: geliehene Helden der Gegenspalte. Darf DDG im Platz dieses
 * Tributs landen? Eigene Spalte: immer (wie bisher). Gegenspalte: nur,
 * wenn `pi` den Helden dort gerade kontrolliert — sonst wuerde DDG ueber
 * einen fremden Helden beschworen.
 */
function _landingAllowed(engine, pi, inst, verfuegbar) {
  if (!inst) return false;
  // W19a (Al, 19.10.2026): „Es ist jede Zone ein Ziel, die durch Opfern für die Beschwörung leer wird; bei mehr Creatures als benötigten
  // Opfern ist eine Zone nicht viable." (löst W17a „nur Zonen mit exakt einer Karte" ab.) DDG gibt eine beliebige Zahl (>= 2) Kreaturen
  // zurück: eine Zone ist Landeplatz, wenn ALLE ihre Insassen zurückgegeben werden — `verfuegbar` = Set der Instanz-IDs, die zurückgegeben
  // werden können (alle Tribut-Kandidaten) bzw. werden (die gewählten).
  // Das Zonen-Array zählt (wie bisher): so viele zurückgebbare Kreaturen wie Karten in der Zone müssen dort stehen.
  const zonenKarten = engine.gs?.players?.[inst.owner]?.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
  if (!Array.isArray(zonenKarten) || zonenKarten.length === 0) return false;
  const gedeckt = engine.zoneInsassen(inst.owner, inst.heroIdx, inst.zoneSlot).filter(c => verfuegbar.has(c.id)).length;
  if (gedeckt < zonenKarten.length) return false;
  if (inst.owner === pi) return true;
  const hero = engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx];
  return engine.heroSideOf(inst.owner, hero) === pi;
}

/**
 * DDG's on-summon effect: AoE `DAMAGE` to every opp Hero + Creature.
 * HOPT-gated (`ddg_aoe` per controller) so a second DDG this turn
 * still fires its manifest animation but does not double-dip. Used by
 * both the normal-summon path and Deepsea Monstrosity's copy path.
 * `sourceInst` is the damage source (DDG itself on normal summons,
 * Monstrosity on copies).
 */
async function _fireAoEAsSource(engine, pi, sourceInst, isCopy) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!engine.claimHOPT('ddg_aoe', pi)) {
    engine.log('dark_deepsea_god_repeat', {
      player: ps?.username,
      reason: 'ddg_aoe_already_fired_this_turn',
      viaCopy: !!isCopy,
    });
    return;
  }
  const oi = engine.opponentOf(pi);
  const ops = gs.players[oi];
  if (!ops) return;
  const cardDB = engine._getCardDB();

  // Collect all targets up front so the post-target hand-reaction
  // window can fire ONCE with the full hero+creature list (Sculpture
  // Guards / Spectral Armor get one consolidated prompt per source).
  const heroTargetsList = [];
  // Kontrolle statt Seite (Styx 28.9.) — „all targets your opponent controls"
  for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(oi)) {
    if (!h?.name || h.hp <= 0) continue;
    heroTargetsList.push({ type: 'hero', owner: physOwner, heroIdx: hi, cardName: h.name });
  }
  const creatureEntries = [];
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== oi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    creatureEntries.push({
      inst, amount: DAMAGE, type: 'creature',
      source: sourceInst, sourceOwner: pi, canBeNegated: true,
    });
  }
  // ★ v1392: über die EINE Stelle für Mehrfachtreffer (Hand-Reaktionen,
  // Interference + Idol-Fenster, Brett-Wächter). Bis v1391 lief der
  // Kreatur-Stapel hier NACH der Interference-Klammer.
  await engine.dealDamageToTargets(sourceInst, [
    ...heroTargetsList.map(ht => ({ type: 'hero', owner: ht.owner, heroIdx: ht.heroIdx })),
    ...creatureEntries.map(e => ({ type: 'creature', inst: e.inst })),
  ], {
    damage: DAMAGE, damageType: 'creature', sourceName: 'Dark Deepsea God', hitDelay: 0,
    surpriseCheck: false,
    trefferOpts: { sourceOwner: pi, canBeNegated: true },
  });

  engine.log('dark_deepsea_god_awakened', {
    player: ps?.username, damage: DAMAGE,
    heroHits: heroTargetsList.length,
    creatureHits: creatureEntries.length,
    viaCopy: !!isCopy,
  });
}

/**
 * ★ W20b (Al, 20.10.2026: „ja, auch einzelne aus einer Zone sollten möglich sein"): Welche Kreaturen eines angeklickten Alice-Stapels
 * gibt der Spieler zurück? Der Client klickt nur Zonen, darum eine Folgewahl NUR bei mehreren Insassen: „alle zurückgeben?" (Ja = alle, die
 * Zone kann Landeplatz sein; Nein = einzelne), dann je eine Kreatur über die vorhandene `instancePick`-Abfrage (HP/Status sichtbar), bis der
 * Spieler keine weitere mehr will. Mindestens eine, höchstens n-1 (alle = „Ja"). Die CPU bestätigt „alle" (`_cpuAutoConfirm`, wie bisher).
 * Rückgabe: Teilmenge von `t._insts` und ob es eine echte Teilmenge ist.
 */
async function _waehleStapelTeil(engine, pi, t) {
  const alice = require('./_alice-shared');
  const alle = t._insts;
  const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
  const antwort = await engine.promptGeneric(pi, {
    type: 'confirm', title: `${CARD_NAME} — Tribute`,
    message: `${hero?.name || 'Hero'}, Slot ${t.slotIdx + 1} holds ${alle.length} Creatures (${alle.map(i => i.name).join(' + ')}). `
      + 'Return all of them to your hand? Only a zone whose Creatures ALL return can be the landing spot.',
    confirmLabel: 'Return all', cancelLabel: 'Choose which ones',
    cancellable: false, _cpuAutoConfirm: true, showCard: CARD_NAME,
  });
  if (antwort?.confirmed === true) return { insts: alle, teil: false };
  const gewaehlt = [];
  let rest = alle.slice();
  while (rest.length > 1) {
    const wahl = await engine.promptGeneric(pi, {
      type: 'instancePick', title: `${CARD_NAME} — Tribute`,
      description: gewaehlt.length === 0
        ? 'Choose the Creature of this shared zone that you return to your hand.'
        : 'Choose another Creature of this shared zone to return to your hand.',
      instances: rest.map(i => alice.describeInstance(engine, i)),
      cancellable: false,
    });
    const inst = (wahl && wahl.instId != null ? rest.find(i => i.id === wahl.instId) : null) || rest[rest.length - 1];
    gewaehlt.push(inst);
    rest = rest.filter(i => i !== inst);
    if (rest.length <= 1) break;   // die letzte bleibt: „alle" wäre die Ja-Antwort oben
    const mehr = await engine.promptGeneric(pi, {
      type: 'confirm', title: `${CARD_NAME} — Tribute`,
      message: `Return another Creature of this zone as well? (${gewaehlt.length} chosen so far)`,
      confirmLabel: 'Yes, another', cancelLabel: 'No, that is all',
      cancellable: false, showCard: CARD_NAME,
    });
    if (mehr?.confirmed !== true) break;
  }
  return { insts: gewaehlt, teil: true };
}

/**
 * ★ W4b (Al, Welle 4): der TRIBUT (Wahl der Kreaturen, Landeplatz, Rückkehr auf die Hand) ist der Kostenpunkt
 * („You can only play this Creature by returning 2 or more Creatures …") und läuft VOR dem Reaktionsfenster der
 * Beschwörung (`paySummonCost`); wird die Beschwörung danach komplett negiert (Off Duty …), bleiben die Kreaturen auf
 * der Hand. Rückgabe: `false` = abgebrochen / nicht zahlbar (nichts bezahlt), sonst
 * `{ heroIdx, slotIdx, landSeite, tributed }` für die Landung. Eine Stelle für `paySummonCost` und den Fallback.
 */
async function _zahleTribut(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];
  if (!ps) return false;
  const candidates = _collectTributeCandidates(engine, pi, ctx.card?.id);
  if (!engine.hasValidSacrificeSet(candidates, SACRIFICE_SPEC.minCount, 0, SACRIFICE_SPEC.minSumLevel)) {
    engine.log('ddg_fizzle', { reason: 'no_valid_tribute' });
    return false;
  }

  // ── Step 1: pick the tribute set ─────────
  const targets = [];
  for (const c of candidates) {
    const id = `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`;
    const da = targets.find(t => t.id === id);
    if (da) {
      // W19a: ein Alice-Stapel (mehrere Karten in EINER Zone) ist EIN Ziel (der Client klickt Zonen): Anklicken gibt alle seine Kreaturen zurück.
      da._insts.push(c.inst);
      da._meta.level += c.level || 0; da._meta.maxHp += c.maxHp || 0;
      continue;
    }
    targets.push({
      id,
      type: 'equip', owner: c.inst.owner,
      heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot,
      cardName: c.cardName, cardInstance: c.inst, _insts: [c.inst],
      _meta: { level: c.level || 0, maxHp: c.maxHp || 0 },
    });
  }
  const hatStapel = targets.some(t => t._insts.length > 1);
  for (const t of targets) if (t._insts.length > 1) t._eigeneStapelWahl = true;   // W20b: die Folgewahl unten ersetzt die Engine-Rückfrage „welche Kopie?"
  const levelVon = new Map(candidates.map(c => [c.inst.id, c.level || 0]));

  let chosenTargets, chosenInsts;
  for (;;) {
    const picked = await engine.promptEffectTarget(pi, targets, {
      title: `${CARD_NAME} — Tribute`,
      description: 'Select 2+ of your Creatures (not summoned this turn) whose combined original levels are 4 or higher. They will be returned to your hand.'
        + (hatStapel ? ' In a shared zone you may return just some of its Creatures.' : ''),
      confirmLabel: '🌊 Confirm Tribute',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: targets.length,
      minRequired: hatStapel ? 1 : SACRIFICE_SPEC.minCount,   // W19a: ein Stapel-Ziel zaehlt fuer mehrere Kreaturen (unten nachgeprueft)
      minSumLevel: SACRIFICE_SPEC.minSumLevel,
    });
    if (!picked || picked.length < 1) return false;

    chosenTargets = [...new Set(picked)].map(id => targets.find(t => t.id === id)).filter(Boolean);
    // W20b: ein Alice-Stapel liefert nur die Kreaturen, die der Spieler zurückgibt (Folgewahl); sonst wie W19a alle seine Kreaturen.
    let teilGewaehlt = false;
    for (const t of chosenTargets) {
      if (t._insts.length > 1) {
        const w = await _waehleStapelTeil(engine, pi, t);
        t._gewaehlt = w.insts; teilGewaehlt = teilGewaehlt || w.teil;
      } else t._gewaehlt = t._insts;
    }
    chosenInsts = chosenTargets.flatMap(t => t._gewaehlt);
    const sumLvl = chosenInsts.reduce((s, i) => s + (levelVon.get(i.id) || 0), 0);
    const gewaehlteIds = new Set(chosenInsts.map(i => i.id));
    const hatLandeplatz = chosenTargets.some(t => _landingAllowed(engine, pi, t.cardInstance, gewaehlteIds));
    if (chosenInsts.length >= SACRIFICE_SPEC.minCount && sumLvl >= SACRIFICE_SPEC.minSumLevel && (hatLandeplatz || !teilGewaehlt)) break;
    // Ohne Teilwahl wie bisher: abgebrochen. Mit Teilwahl hat der Spieler die Bedingungen u. U. nur wegen der Teilmenge verfehlt
    // (Level-Summe, Anzahl, kein vollständig zurückgegebener Landeplatz) - dann neu fragen (CPU/Schnellmodus: Abbruch).
    if (!teilGewaehlt || engine.isCpuPlayer(pi) || engine._inMctsSim || engine._fastMode) return false;
    engine._broadcastEvent('hero_announcement', { text: `${CARD_NAME}: return 2+ Creatures (Levels 4+) and ALL Creatures of at least one zone` });
  }

  // ── Step 2: pick DDG's placement slot (one of the tribute slots) ──
  // Styx 28.9.: geliehene Helden der Gegenspalte — Landeplatz auf der
  // Gegenspalte nur ueber einen Helden, den `pi` kontrolliert.
  // W19a: eine Zone mit mehreren Karten (Alice) ist Landeplatz, wenn alle ihre Insassen gewaehlt sind (einmal je Zone anbieten).
  const gewaehlteIds = new Set(chosenInsts.map(i => i.id));
  const zones = [];
  for (const t of chosenTargets) {
    if (!_landingAllowed(engine, pi, t.cardInstance, gewaehlteIds)) continue;
    if (zones.some(z => z.heroIdx === t.heroIdx && z.slotIdx === t.slotIdx && (z.owner ?? pi) === t.owner)) continue;
    const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
    const namen = t._gewaehlt.map(i => i.name).join(' + ');
    zones.push({
      heroIdx: t.heroIdx, slotIdx: t.slotIdx,
      ...(t.owner !== pi ? { owner: t.owner } : {}),
      label: `${hero?.name || 'Hero'} — ${namen} (Slot ${t.slotIdx + 1})`,
    });
  }
  if (zones.length === 0) return false;
  const zonePick = await ctx.promptZonePick(zones, {
    title: `${CARD_NAME} — Rise From`,
    description: `Pick which tributed Support Zone ${CARD_NAME} rises into.`,
    cancellable: true,
  });
  if (!zonePick) return false;
  const landSeite = zonePick.owner ?? pi;   // Styx 28.9.: physische Seite
  const _istLandung = (t) => t.heroIdx === zonePick.heroIdx && t.slotIdx === zonePick.slotIdx
    && t.owner === landSeite;
  if (!zones.some(z => z.heroIdx === zonePick.heroIdx && z.slotIdx === zonePick.slotIdx
    && (z.owner ?? pi) === landSeite)) return false;

  // ── Step 3: bounce every chosen Creature back to hand ────────────
  // Non-landing tributes first, landing tribute last so the destination
  // slot stays "occupied by a departing sacrifice" right up to the
  // moment DDG takes its place.
  const landingInsts = chosenTargets.filter(_istLandung).flatMap(t => t._gewaehlt);   // W19a: bei einem Alice-Stapel mehrere
  const others = chosenTargets
    .filter(t => !_istLandung(t))
    .flatMap(t => t._gewaehlt);
  // ★ Welle 10 (Al, R3 / A02-deepsea-16): „returning 2 or more Creatures" ist EIN Rückgabe-Ereignis — Siphem/Teppes/Analyzer/Gatherer
  // reagieren einmal (nicht je Kreatur); Blood Moon zählt weiter je Kreatur (liest `returnedInsts`).
  const batch = [];
  for (const inst of others) {
    if (!inst) continue;
    await returnSupportCreatureToHand(engine, inst, CARD_NAME, { toPlayer: pi, batch, sourceOwner: pi });
  }
  for (const landingInst of landingInsts) {
    if (!landingInst) continue;
    await returnSupportCreatureToHand(engine, landingInst, CARD_NAME, { toPlayer: pi, batch, sourceOwner: pi });
  }
  await fireReturnedBatch(engine, batch, CARD_NAME);

  return {
    heroIdx: zonePick.heroIdx, slotIdx: zonePick.slotIdx, landSeite,
    tributed: chosenInsts.map(i => i.name),
  };
}

module.exports = {

  // ★ v1021: Der AoE-Helfer wird jetzt AUCH von „Creepy Villager"
  // gebraucht (die Karte PLATZIERT einen DDG in ihre eigene Zone).
  // Platzieren durch einen Effekt zaehlt als Effekt-Beschwoerung und
  // loest On-Summon-Effekte aus (Als Ruling 8.9.) — und DDGs
  // On-Summon-Effekt liegt hier, nicht in `onPlay`. Der HOPT-Riegel
  // (`ddg_aoe`) steckt im Helfer selbst, der Weg kann also nicht
  // doppelt zuenden.
  fireDdgAoE: (engine, pi, sourceInst, isCopy) => _fireAoEAsSource(engine, pi, sourceInst, !!isCopy),

  // Als Ruling nach dem Batch-21-09-32-Befund: der Standing-Kanal
  // lernte behind −13.5, real gewinnen behind-Spiele MIT DDG-Cast
  // 20.0% gegen 7.3% ohne — die Wincon wurde genau dann gemieden, wenn
  // das Comeback sie braucht. Floor 0: kein fehl-gelernter Malus im
  // Rückstand; positive gelernte Werte bleiben unangetastet.
  cpuStandingDeltaFloor: { behind: 0 },
  // ── Gewicht in Als Hauptmetrik (On-Summon-Trigger je Runde) ─────────
  // Als Vorgabe: "der Trigger von Dark Deepsea God ist DEUTLICH
  // wertvoller als andere (und als einziger reduziert er die Breite des
  // eigenen Boards; ein Balancing-Mechanismus für seinen EXTREM starken
  // Effekt)". Der Recorder liest diesen Vertrag; ohne ihn zählt jeder
  // On-Summon-Trigger 1. Die Zahl steht bewusst HIER und nicht im
  // Mess-Kern, damit sie ohne Engine-Änderung justierbar bleibt.
  // Referenz aus den Demo-Spielen: DDG steuert bei Al 1.34 der 4.49
  // gewichteten Trigger je eigenem Zug bei — knapp ein Drittel.
  // `cardValueFloor` aus demselben Grund wie bei Primordium (Als Ruling:
  // die beiden wichtigsten Karten des Decks). DDG hatte sich zuletzt von
  // 8 auf 31.6 erholt — der Boden verhindert den Rückfall in die
  // Lernspirale, die schon einmal von 0.26 auf 0.14 Casts/Spiel führte.
  // KEIN playOrderPriority: DDG läuft nicht über den Gratis-Pfad, dort
  // wäre die Vorgabe wirkungslos; seine Vorfahrt regelt `spec:ready`.
  cpuMeta: { onSummonTriggerWeight: 5, cardValueFloor: 60 },
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  canBypassLevelReq: () => true,
  // Opfer-Spec als GENERISCHER Vertrag exportiert (Als Auftrag "System,
  // das gezielt auf DDG hinarbeitet"): der Opfer-Fortschritts-Term in
  // evaluateState liest minCount/minSumLevel jeder Handkarte und belohnt
  // Board-Zustände Richtung Erfüllung. Jede künftige Opfer-Karte, die
  // ihre Spec so exportiert, wird automatisch mitgeplant.
  sacrificeSpec: SACRIFICE_SPEC,

  // DDG's text is "tribute 2+ Creatures NOT summoned this turn (sum-
  // level ≥ 4)". The `canSatisfySacrifice` engine helper doesn't apply
  // the not-summoned-this-turn rule on its own (cards like Sacrifice
  // to Divinity sacrifice anything you control), so we layer it on
  // here via spec.filter — otherwise DDG would highlight as playable
  // in hand on turns where the only available tributes were summoned
  // this turn (which can't actually pay the cost).
  canSummon: (ctx) => {
    const engine = ctx._engine;
    const turn = engine.gs?.turn || 0;
    return engine.canSatisfySacrifice(ctx.cardOwner, {
      ...SACRIFICE_SPEC,
      filter: (c) => (c.inst?.turnPlayed || 0) !== turn,
    }, ctx.card?.id);
  },

  canBypassFreeZoneRequirement: (gs, pi, heroIdx, cardData, engine) => {
    const turn = engine.gs?.turn || 0;
    return engine.canSatisfySacrifice(pi, {
      ...SACRIFICE_SPEC,
      filter: (c) => (c.inst?.turnPlayed || 0) !== turn,
    }, null)
      && (() => { const cs = _collectTributeCandidates(engine, pi, null); const ids = new Set(cs.map(c => c.inst.id)); return cs.some(c => _landingAllowed(engine, pi, c.inst, ids)); })();   // W17a/W19a: es muss eine freiwerdende Zone geben
  },

  // Styx 28.9.: geliehene Helden der Gegenspalte. `heroOwner` = physische
  // Seite des Zielplatzes; ein Platz auf der Gegenspalte zaehlt nur, wenn
  // `pi` den Helden dort kontrolliert (`_landingAllowed`).
  canPlaceOnOccupiedSlot: (gs, pi, heroIdx, slotIdx, engine, heroOwner = pi) => {
    const cands = _collectTributeCandidates(engine, pi, null);
    const ids = new Set(cands.map(c => c.inst.id));
    return cands.some(c => c.inst.owner === heroOwner
      && c.inst.heroIdx === heroIdx && c.inst.zoneSlot === slotIdx
      && _landingAllowed(engine, pi, c.inst, ids));
  },
  getBouncePlacementTargets: (gs, pi, engine) => {
    const cands = _collectTributeCandidates(engine, pi, null);
    const ids = new Set(cands.map(c => c.inst.id));
    const out = [];
    for (const c of cands) {
      if (!_landingAllowed(engine, pi, c.inst, ids)) continue;
      const z = { heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot, ...(c.inst.owner !== pi ? { owner: c.inst.owner } : {}) };
      if (!out.some(o => o.heroIdx === z.heroIdx && o.slotIdx === z.slotIdx && (o.owner ?? pi) === (z.owner ?? pi))) out.push(z);   // W19a: ein Alice-Stapel nur einmal
    }
    return out;
  },

  paySummonCost: async (ctx) => (ctx._monstrosityCopy ? {} : _zahleTribut(ctx)),   // W4b: Tribut vor dem Reaktionsfenster

  beforeSummon: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // ═════════════════════════════════════════════════════════════════
    //  Two distinct entry paths.
    //
    //  NORMAL SUMMON:
    //    • Summoning condition → tribute 2+ own Creatures (sum-level ≥4).
    //    • On-summon effect    → AoE 90 to every opp target.
    //    Both live together in `beforeSummon` historically because DDG's
    //    placement-inside-a-tribute-slot animation couples them.
    //
    //  DEEPSEA MONSTROSITY COPY (`ctx._monstrosityCopy`):
    //    • The COST (tribute of 2 creatures) is DDG's SUMMONING
    //      CONDITION, not its on-summon effect, so it does NOT copy.
    //    • Only the AoE is the on-summon effect — that's what Monstrosity
    //      should fire.
    //    • HOPT still gates it (one detonation per turn per controller).
    // ═════════════════════════════════════════════════════════════════
    const isCopy = !!ctx._monstrosityCopy;

    if (isCopy) {
      await _fireAoEAsSource(engine, pi, ctx.card, /*isCopy*/ true);
      // Return value is ignored on the copy path — we're not in an
      // actual summon flow. Return false so no unintended side effects.
      return false;
    }

    // ── Normal summon from here ──────────────────────────────────────
    // W4b: Normalweg — der Tribut ist schon vor dem Reaktionsfenster bezahlt (`paySummonCost`); sonst jetzt.
    const kosten = ctx._summonKosten || await _zahleTribut(ctx);
    if (!kosten) return false;
    const zonePick = { heroIdx: kosten.heroIdx, slotIdx: kosten.slotIdx };
    const landSeite = kosten.landSeite;
    const chosenTargetsNamen = kosten.tributed;

    // ── Step 4: start the manifest, then wait to the midpoint ───────
    engine._broadcastEvent('dark_deepsea_god_manifest', { owner: pi });
    engine._broadcastEvent('hero_announcement', { text: `${CARD_NAME} awakens!` });
    await engine._delay(MANIFEST_HALF_MS);

    // ── Step 5: place DDG into the vacated landing slot ─────────────
    const result = await engine.actionPlaceCreature(CARD_NAME, pi, zonePick.heroIdx, zonePick.slotIdx, {
      source: 'external',
      sourceName: CARD_NAME,
      animationType: 'none',
      fireHooks: true,
      ...(landSeite !== pi ? { heldSeite: landSeite } : {}),   // Styx 28.9.
    });
    if (!result) return false;

    // ── Step 6: wait the remaining half of the animation ────────────
    await engine._delay(MANIFEST_HALF_MS);

    // ── Step 7 + 8: on-summon AoE, HOPT-gated ───────────────────────
    await _fireAoEAsSource(engine, pi, result.inst, /*isCopy*/ false);

    // ── Step 9: server skips summonCreature ─────────────────────────
    ps._placementConsumedByCard = CARD_NAME;
    engine.log('ddg_summon', {
      player: ps.username,
      tributed: chosenTargetsNamen,
      landedAt: { heroIdx: zonePick.heroIdx, slotIdx: zonePick.slotIdx,
        ...(landSeite !== pi ? { owner: landSeite } : {}) },
    });
    engine.sync();
    return false;
  },

  // onPlay is intentionally a no-op. The manifest + damage sequence is
  // orchestrated inside beforeSummon so we can appear the card ON the
  // board in the middle of its entrance animation — placing DDG fires
  // this hook at the animation midpoint, and we explicitly don't want
  // it to spawn a second animation / extra damage (e.g. via Blood Moon
  // under the Sea's retrigger, which would pass through here).
  hooks: {},
};
