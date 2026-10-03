// ═══════════════════════════════════════════
//  CARD EFFECT: "Mountain Boars"
//  Creature (Normal, Lv1, 50 HP, Summoning Magic) — PP MS1
//
//  „You may delete an Area on the board that was not played this turn
//   to summon this Creature from your hand or discard pile as an
//   additional Action."
//
//  ── AUSLEGUNG (Als Vorgabe) ───────────────────────────────────────
//  • „an Area on the board": jede Area beider Seiten, genau EINE.
//    „Delete" = Gelöscht-Stapel (`engine.deleteArea`, Schutzfenster wie
//    bei jeder fremden Löschung; ist die Area geschützt, ist der Preis
//    nicht bezahlt und nichts passiert).
//  • „not played this turn": die Area muss vor Beginn des laufenden Zuges
//    auf dem Brett gelegen haben. Gezählt wird das Platzieren
//    (`counters._areaPlacedTurn`, gestempelt in `placeArea`) — egal ob die
//    Area gespielt, getutort oder per Effekt aus einem Stapel gelegt wurde.
//    Ohne Stempel (Puzzle-Aufbau) gilt sie als alt.
//  • Die Beschwörung unterliegt weiterhin den normalen Regeln (Level 1
//    Summoning Magic usw.): nur der PREIS und die Aktionsart ändern sich.
//
//  ── AUS DER HAND ──────────────────────────────────────────────────
//  Wie Empty Armor / Big Gwen Guard:
//    • Kein Aktionsplatz frei (Main Phase, Aktion verbraucht):
//      `inherentAction` ist wahr, `beforeSummon` fragt nach der Area.
//      Abbruch lässt die Karte in der Hand.
//    • Aktionsplatz frei: die Engine beschwört normal (Aktion), und
//      `beforeSummon` lässt WÄHLEN — normale Aktion oder Area löschen
//      (dann Zusatzaktion, `gs._summonModeUpgradedToInherent`).
//  Platzierungen durch Karteneffekte (`!_isNormalSummon`) kennen keinen Preis.
//
//  ── AUS DER ABLAGE ────────────────────────────────────────────────
//  Nur über den Area-Weg: Ablage-Dialog → Karte anklicken
//  (`discardEffect`, auch in der Action Phase). Area wählen, Zone wählen,
//  Area löschen, dann `summonFromDiscard` als Zusatzaktion.
// ═══════════════════════════════════════════

const { eligibleSummonZones } = require('./_summon-eligibility');
const { areaTargetId } = require('./_targeting-shared');
const { mainActionSlotFree } = require('./_of-kings-shared');

const CARD_NAME = 'Mountain Boars';

/** Alle löschbaren Areas (nicht in diesem Zug platziert) als Ziele. */
function areaZiele(engine) {
  const gs = engine.gs;
  const ziele = [];
  for (let owner = 0; owner < 2; owner++) {
    const arr = gs.areaZones?.[owner] || [];
    for (let platz = 0; platz < arr.length; platz++) {
      const name = arr[platz];
      const inst = engine.cardInstances.find(c =>
        c.zone === 'area' && c.owner === owner && c.name === name
        && c.counters?._areaPlacedTurn !== gs.turn);
      if (!inst) continue;
      ziele.push({
        id: areaTargetId(owner, platz), type: 'area', owner, heroIdx: -1,
        slotIdx: platz, cardName: name, cardInstance: inst, _cardInstance: inst,
      });
    }
  }
  return ziele;
}

/** Spieler wählt eine Area, sie wird gelöscht. true = Preis bezahlt. */
async function areaLoeschen(engine, pi, beschreibung) {
  const ziele = areaZiele(engine);
  if (ziele.length === 0) return false;
  const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
    title: CARD_NAME,
    source: CARD_NAME,
    description: beschreibung,
    confirmLabel: '🐗 Delete Area!',
    confirmClass: 'btn-danger',
    minRequired: 1,
    maxTotal: 1,
    alwaysConfirmable: false,
    cancellable: true,
  });
  const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
  if (!id) return false;
  // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben.
  const eintrag = areaZiele(engine).find(z => z.id === id);
  if (!eintrag?.cardInstance) return false;
  const geloescht = await engine.deleteArea(eintrag.cardInstance, CARD_NAME, { sourceOwner: pi });
  if (!geloescht) return false;
  engine.log('mountain_boars_delete_area', {
    player: engine.gs.players[pi]?.username, area: eintrag.cardName,
    from: engine.gs.players[eintrag.owner]?.username,
  });
  engine.sync();
  return true;
}

/** Läuft der Held auf dem normalen Weg (freie Aktion / Zusatzaktions-Quelle)? */
function aktionFrei(engine, pi, heroIdx) {
  if (!engine || engine.gs.activePlayer !== pi) return false;
  if (engine.findAdditionalActionForCard?.(pi, CARD_NAME, heroIdx)) return true;
  return mainActionSlotFree(engine, pi, heroIdx);
}

module.exports = {
  // 'support' = Brett, 'discard' = Ablage-Instanz für den Klick-Weg.
  activeIn: ['support', 'discard'],
  discardEffect: true,
  discardEffectInActionPhase: true,

  // ── Aus der Hand ─────────────────────────────────────────────────
  /** Nur ERZWUNGEN (kein Aktionsplatz frei) ist der Weg von vornherein frei. */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    if (areaZiele(engine).length === 0) return false;
    return !aktionFrei(engine, pi, heroIdx);
  },

  async beforeSummon(ctx) {
    if (!ctx._isNormalSummon) return true;            // Karteneffekt-Platzierung: kein Preis
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    if (areaZiele(engine).length === 0) return !ctx.isInherentAction;

    if (ctx.isInherentAction) {
      // Erzwungener Zusatzweg — Area wählen oder abbrechen.
      return await areaLoeschen(engine, pi,
        `Delete an Area that was not played this turn to summon ${CARD_NAME} as an additional Action.`);
    }

    // Aktionsplatz frei und Area da — der Spieler wählt.
    const wahl = await engine.promptGeneric(pi, {
      type: 'optionPicker', title: CARD_NAME,
      message: `Choose how to summon ${CARD_NAME}:`,
      showCard: CARD_NAME,
      options: [
        { id: 'special', label: '🐗 Delete an Area (additional Action)', description: 'Delete an Area that was not played this turn. Costs no Action.' },
        { id: 'normal', label: '⚔️ Normal Action', description: 'Uses this Hero\'s Action, no Area is deleted.' },
        { id: 'cancel', label: '✕ Cancel', description: 'Don\'t summon.' },
      ],
      cancellable: true,
    });
    const id = wahl?.optionId;
    if (!wahl || wahl.cancelled || id === 'cancel') return false;
    if (id !== 'special') return true;                // normal — Aktion ist schon verbucht
    const bezahlt = await areaLoeschen(engine, pi,
      `Delete an Area that was not played this turn to summon ${CARD_NAME} as an additional Action.`);
    if (!bezahlt) return false;
    gs._summonModeUpgradedToInherent = pi;            // Aktion zurück (server.js)
    return true;
  },

  // ── Aus der Ablage ───────────────────────────────────────────────
  canActivateDiscardEffect(gs, pi, engine, inst) {
    if (!inst || inst.zone !== 'discard') return false;
    if (areaZiele(engine).length === 0) return false;
    return eligibleSummonZones(engine, pi, CARD_NAME, { nachKontrolle: true }).length > 0;
  },

  async onDiscardEffect(engine, pi, inst) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps || !inst || inst.zone !== 'discard') return false;
    if (!(ps.discardPile || []).includes(CARD_NAME)) return false;

    const zonen = eligibleSummonZones(engine, pi, CARD_NAME, { nachKontrolle: true });
    if (zonen.length === 0 || areaZiele(engine).length === 0) return false;

    // Erst alles wählen (abbrechbar), dann bezahlen, dann beschwören.
    let ziel = zonen[0];
    if (zonen.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME,
        description: `Summon ${CARD_NAME} into which Support Zone?`,
        zones: zonen, cancellable: true,
      });
      if (!wahl || wahl.cancelled) return false;
      ziel = zonen.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx
        && (z.owner ?? pi) === (wahl.owner ?? pi)) || null;
      if (!ziel) return false;
    }

    const bezahlt = await areaLoeschen(engine, pi,
      `Delete an Area that was not played this turn to summon ${CARD_NAME} from your discard pile as an additional Action.`);
    if (!bezahlt) return false;

    if (!(ps.discardPile || []).includes(CARD_NAME)) return false;   // zwischenzeitlich weg
    // Zone könnte sich durch die Löschung geändert haben — neu prüfen.
    const seite = ziel.owner ?? pi;
    const frei = eligibleSummonZones(engine, pi, CARD_NAME, { nachKontrolle: true })
      .some(z => z.heroIdx === ziel.heroIdx && z.slotIdx === ziel.slotIdx && (z.owner ?? pi) === seite);
    if (!frei) return true;   // Preis ist bezahlt, die Zone ist weg — verfällt

    const res = await engine.summonFromDiscard(pi, pi, CARD_NAME, ziel.heroIdx, ziel.slotIdx, {
      mode: 'summon', source: CARD_NAME,
      hookExtras: { _isNormalSummon: false },
      ...(seite !== pi ? { heldSeite: seite } : {}),
    });
    if (res?.inst) await engine.meldeBeschwoerungAlsAktion(pi, ziel.heroIdx, CARD_NAME, res.inst, seite);
    engine.sync();
    return true;
  },

  // ── CPU: nur gegnerische Areas löschen ───────────────────────────
  cpuResponse(engine, kind, payload) {
    if (kind === 'effectTarget') {
      const pi = payload?.playerIdx;
      const gegner = (payload?.validTargets || []).find(t => t.owner !== pi);
      return gegner ? [gegner.id] : null;
    }
    if (kind === 'generic' && payload?.type === 'optionPicker') {
      const pi = engine._cpuPlayerIdx;
      const hatGegnerArea = areaZiele(engine).some(z => z.owner !== pi);
      return { optionId: hatGegnerArea ? 'special' : 'normal' };
    }
    return undefined;
  },
};
