// ═══════════════════════════════════════════
//  CARD EFFECT: „Inconspicuous Lawn Gnome"
//  Creature (Summoning Magic Lv 0, 50 HP, PP MBS1)
//
//  „You may once per turn change this card's level in your hand or on
//   your side of the board to any level from 0 to 3."
//
//  BAUART
//  ──────
//  • ★ ZWEI ORTE, ZWEI VERTRAEGE — die Karte ist in der HAND und auf
//    dem BRETT aktivierbar:
//      – Hand: `handActivatedEffect` + `canHandActivate` +
//        `onHandActivate` (Muster Luna Kiai). Der Spieler klickt die
//        Karte in der Hand an, ohne sie zu spielen.
//      – Brett: `creatureEffect` + `onCreatureEffect`, der normale
//        aktive Kreatureffekt.
//    Beide Wege stempeln ihre Einmal-je-Zug-Sperre selbst (Hand) bzw.
//    ueber die Engine (Brett).
//
//  • ★ GESETZT, NICHT GESENKT. Die vorhandene Levelmechanik kennt nur
//    REDUKTIONEN (`reduceCardLevel`, `_handLevelOffsets`) und den
//    heldengebundenen `levelOverrideCards`. Fuer „auf Stufe 0 bis 3
//    setzen" gibt es deshalb seit v988 die absolute Setzung:
//      – HAND: `inst.counters.levelSet` an der Handinstanz, gelesen von
//        `_handLevelSetFor` in `heroMeetsLevelReq` UND
//        `effectiveCardLevel`. An der INSTANZ, nicht am Handplatz —
//        so ueberlebt sie jedes Nachrutschen der Hand.
//      – BRETT: `counters._cardDataOverride` mit geaenderter Stufe
//        (dasselbe Mittel wie bei Boulder in a Bottle), das
//        `getEffectiveCardData` ohnehin liest.
//
//  • Die Stufe steigt oder faellt — 0 bis 3, frei waehlbar. Hoeher
//    machen ist kein Unsinn: manche Effekte verlangen eine MINDEST-
//    stufe (Tribute, „Creature of level 2 or higher").
// ═══════════════════════════════════════════

const CARD_NAME = 'Inconspicuous Lawn Gnome';
const STUFEN = [0, 1, 2, 3];

/** Vier Knoepfe, aktuelle Stufe markiert. */
function stufenOptionen(aktuell) {
  return STUFEN.map(n => ({
    id: `lvl${n}`,
    label: n === aktuell ? `Level ${n} (current)` : `Level ${n}`,
    color: n === aktuell ? '#666' : '#44aaff',
  }));
}

/** Antwort → Zahl. */
function gewaehlteStufe(wahl) {
  const m = /^lvl([0-3])$/.exec(wahl?.optionId || '');
  return m ? Number(m[1]) : null;
}

module.exports = {
  creatureEffect: true,
  handActivatedEffect: true,
  handActivateLabel: 'Change level (0–3)',

  // Der Optionspicker ist Pflicht-los („you may"), die Engine bricht
  // ihn fuer die CPU sonst ab (Befund v828). Sie setzt auf 0 — das
  // macht den Gnom immer beschwoerbar, und mehr will sie von ihm nicht.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'optionPicker') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    return { optionId: 'lvl0' };
  },

  canHandActivate(gs, pi) {
    return !!gs.players[pi];
  },

  async onHandActivate(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const handIndex = ctx.handIndex;
    const inst = engine._findHandInstanceAt?.(pi, handIndex);
    if (!inst) return false;

    const cd = engine._getCardDB()[CARD_NAME];
    const aktuell = typeof inst.counters?.levelSet === 'number'
      ? inst.counters.levelSet : (cd?.level || 0);

    const wahl = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      message: `Set this copy's level (currently ${aktuell}).`,
      showCard: CARD_NAME,
      options: stufenOptionen(aktuell),
      cancellable: true,
    });
    const stufe = gewaehlteStufe(wahl);
    if (stufe == null) return false;                    // abgebrochen

    inst.counters = inst.counters || {};
    inst.counters.levelSet = stufe;
    engine.log('gnome_level', {
      player: engine.gs.players[pi]?.username, level: stufe, where: 'hand',
    });
    engine._broadcastEvent('play_zone_animation', {
      type: 'modifier_sparkle', owner: pi, heroIdx: -1, zoneSlot: -1,
    });
    engine.sync();
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ich = ctx.card;
    const pi = engine.physicalSide(ich) ?? ctx.cardOwner;
    const cd = engine.getEffectiveCardData(ich) || engine._getCardDB()[CARD_NAME];
    const aktuell = cd?.level || 0;

    const wahl = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      message: `Set this Creature's level (currently ${aktuell}).`,
      showCard: CARD_NAME,
      options: stufenOptionen(aktuell),
      cancellable: true,
    });
    const stufe = gewaehlteStufe(wahl);
    if (stufe == null) return false;                    // abgebrochen

    // Nur die STUFE aendern — alles andere bleibt die gedruckte Karte.
    const basis = engine._getCardDB()[CARD_NAME];
    ich.counters = ich.counters || {};
    ich.counters._cardDataOverride = {
      ...(ich.counters._cardDataOverride || basis || {}),
      level: stufe,
    };
    engine.log('gnome_level', {
      player: engine.gs.players[pi]?.username, level: stufe, where: 'board',
    });
    engine._broadcastEvent('play_zone_animation', {
      type: 'modifier_sparkle', owner: pi, heroIdx: ich.heroIdx, zoneSlot: ich.zoneSlot,
    });
    engine.sync();
    return true;
  },
};
