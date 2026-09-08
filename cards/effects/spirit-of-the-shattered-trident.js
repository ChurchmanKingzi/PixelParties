// ═══════════════════════════════════════════
//  CARD EFFECT: "Spirit of the Shattered Trident"
//  Creature (Normal, Lv0, 100 HP, Summoning Magic)
//
//  „This Creature can only be summoned by a Hero equipped with
//   \"Shattered Trident, Treasure of the Deepsea\". You may delete an
//   Artifact equipped to the summoner to make summoning this Creature
//   count as an additional Action. Whenever Artifacts equipped to
//   Heroes you control would be moved from the board to anywhere except
//   your hand, you may discard 1 card to add them back to your hand
//   instead, and if you do, gain Gold equal to half their Cost
//   (rounded up).\"   (Fassung Al 5.9.)
//
//  Drei Teile
//  ──────────
//  ① BESCHWOERUNGSSPERRE ueber `canPlayWithHero`.
//
//  ② KOSTEN FUER DIE ZUSATZAKTION. `inherentAction` meldet die
//    Moeglichkeit (der Beschwoerer traegt ein loeschbares Artefakt),
//    bezahlt wird in `beforeSummon` — dem Fenster VOR der Beschwoerung,
//    das als einziges weiss, ob die Engine diesen Zug gerade als
//    Zusatzaktion behandelt (`ctx.isInherentAction`).
//      • Hatte der Beschwoerer noch eine regulaere Aktion, ist die
//        Loeschung OPTIONAL. Lehnt er ab, wird die Aktion regulaer
//        verbucht statt geschenkt.
//      • Hatte er keine mehr, ist sie PFLICHT — gewaehlt wird nur noch,
//        WELCHES Artefakt faellt.
//    Dass die Kosten VOR der Beschwoerung liegen, hat eine Folge, die
//    ausdruecklich so gewollt ist (Al 5.9.): das dafuer geloeschte
//    Artefakt kann Teil ③ NICHT retten — der Spirit steht in dem
//    Moment noch gar nicht.
//
//  ③ RUECKHOLUNG. Ein Artefakt an einem Helden, den ich kontrolliere,
//    das das Brett Richtung IRGENDWOHIN-AUSSER-HAND verlaesst, darf
//    gegen einen Handabwurf stattdessen auf meine Hand zurueck; dazu
//    Gold in Hoehe der halben Kosten, aufgerundet.
//    Technisch ueber `_returnToHand` — die vorhandene Umleitung aus
//    `actionMoveCard` (Vorbild The White Eye), die dafuer ab v759 nicht
//    mehr nur die Ablage abdeckt, sondern jedes Ziel ausser der Hand.
//
//    Gefragt wird JE ARTEFAKT. Raeumt ein Effekt mehrere auf einmal ab
//    (Blind Destruction), kommt die Frage mehrfach — die Umleitung
//    haengt am einzelnen Kartenzug, eine Buendelung gibt es dort nicht.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Spirit of the Shattered Trident';
const TRIDENT = 'Shattered Trident, Treasure of the Deepsea';

/** Traegt dieser Held den Dreizack? (Nach EFFEKTIVER Identitaet.) */
function hatDreizack(engine, pi, heroIdx) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && c.owner === pi && c.heroIdx === heroIdx
    && !c.faceDown && (c.counters?._effectOverride || c.name) === TRIDENT);
}

/** Artefakte, die an DIESEM Helden ausgeruestet sind. */
function ausruestungAm(engine, pi, heroIdx) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if (inst.owner !== pi || inst.heroIdx !== heroIdx) continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    out.push(inst);
  }
  return out;
}

/** Steht ein wirksamer Trident-Spirit dieses Spielers? */
function spiritSteht(engine, pi) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && !c.faceDown && c.name === CARD_NAME
    && (c.controller ?? c.owner) === pi
    && !c.counters?.negated && !c.counters?.nulled);
}

module.exports = {
  activeIn: ['support'],

  cpuMeta: { dealsDamage: false, castTriggersDraw: true },

  /** ① „can only be summoned by a Hero equipped with …\" */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return hatDreizack(engine, pi, heroIdx);
  },

  /** ② Die Zusatzaktion steht nur, wenn die Kosten zahlbar sind. */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return ausruestungAm(engine, pi, heroIdx).length > 0;
  },

  /**
   * ② Kosten VOR der Beschwoerung.
   *
   * Die Engine behandelt diesen Zug immer als Zusatzaktion, sobald
   * `inherentAction` true meldet — sie kann vorher niemanden fragen.
   * Die WAHL faellt deshalb hier:
   *   • Stand dem Beschwoerer noch eine regulaere Aktion zur Verfuegung,
   *     ist die Loeschung OPTIONAL (Al 5.9.). Sagt er nein, wird nichts
   *     geloescht und die Aktion stattdessen regulaer verbucht — er
   *     bekommt die Beschwoerung also nicht geschenkt.
   *   • Hatte er keine Aktion mehr, war die Zusatzaktion der einzige
   *     Weg auf das Brett: dann ist die Loeschung PFLICHT, gewaehlt
   *     wird nur noch WELCHES Artefakt faellt.
   */
  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return true;

    if (!ctx.isInherentAction) return true;          // regulaer bezahlt, nichts zu tun

    const kandidaten = ausruestungAm(engine, pi, heroIdx);
    if (kandidaten.length === 0) return true;        // sollte `inherentAction` verhindern

    // Stand diesem Helden noch eine regulaere Aktion offen?
    const hatteAktion = gs.currentPhase === 3
      && !(ps.heroesActedThisTurn || []).includes(heroIdx);

    if (hatteAktion) {
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: `Delete an Artifact equipped to ${gs.players[pi]?.heroes?.[heroIdx]?.name || 'this Hero'} to summon this as an additional Action? Otherwise it costs the Hero's Action as usual.`,
        showCard: CARD_NAME,
        confirmLabel: '🔱 Delete one',
        cancelLabel: 'Use the Action',
        cancellable: true,
      });
      if (!engine._confirmSaidYes(ja)) {
        // Abgelehnt: nichts loeschen, aber die Aktion regulaer
        // verbuchen — die Engine hat sie wegen `inherentAction` nicht
        // angefasst.
        if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
        if (!ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);
        if (gs.currentPhase === 3) await engine.advanceToPhase(pi, 4);
        engine.sync();
        return true;
      }
    }

    let opfer = kandidaten[0];
    if (kandidaten.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery', title: CARD_NAME,
        description: "Choose the Artifact to delete.",
        cards: kandidaten.map(i => ({ name: i.name, source: 'board' })),
        cancellable: false,                          // die Zusage steht
      });
      opfer = kandidaten.find(i => i.name === wahl?.cardName) || kandidaten[0];
    }

    // Waehrend DIESER Loeschung ist Teil ③ ausgeschaltet: die Kosten
    // fallen vor der Beschwoerung, der Spirit steht noch nicht.
    engine._tridentPayingCost = true;
    try {
      await engine.actionMoveCard(opfer, 'deleted', -1, -1, {
        sourceName: CARD_NAME, source: ctx.card,
      });
    } finally {
      engine._tridentPayingCost = false;
    }
    engine.sync();
    return true;
  },

  hooks: {
    /** ③ Rueckholung statt Abgang. */
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const weg = ctx.leavingCard;
      if (!weg) return;
      if (engine._tridentPayingCost) return;       // eigene Kosten, s.o.
      if (ctx.fromZone !== 'support') return;
      if (ctx.toZone === 'hand') return;           // „except your hand\"
      if (weg._returnToHand) return;               // schon jemand schneller

      // Der Spirit muss stehen und wirksam sein.
      const pi = ctx.cardOwner;
      if (!spiritSteht(engine, pi)) return;

      // Artefakt an einem Helden, den ICH kontrolliere.
      const cd = engine.getEffectiveCardData(weg) || engine._getCardDB()[weg.name];
      if (!cd || !hasCardType(cd, 'Artifact')) return;
      if (!engine.isEquipInZone(weg.name, weg)) return;
      const spaltenBesitzer = ctx.fromOwner ?? weg.owner;
      const wirt = gs.players[spaltenBesitzer]?.heroes?.[ctx.fromHeroIdx ?? weg.heroIdx];
      if (!wirt?.name) return;
      if (engine.heroSideOf(spaltenBesitzer, wirt) !== pi) return;

      // Kosten: eine Handkarte. Ohne Hand kein Angebot.
      const ps = gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return;
      if (ps.handLocked) return;

      const gold = Math.ceil((cd.cost || 0) / 2);
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: `${weg.name} is about to leave the board. Discard 1 card to take it back to your hand instead${gold > 0 ? ` and gain ${gold} Gold` : ''}?`,
        showCard: weg.name,
        showCardLeft: CARD_NAME,
        confirmLabel: '🔱 Reclaim',
        cancelLabel: 'Let it go',
        cancellable: true,
      });
      if (!engine._confirmSaidYes(ja)) return;

      const handVorher = (ps.hand || []).length;
      await engine.actionPromptForceDiscard(pi, 1, {
        title: CARD_NAME, source: CARD_NAME, selfInflicted: true,
        cancellable: true,
        description: `Discard 1 card to reclaim ${weg.name}.`,
      });
      if ((ps.hand || []).length === handVorher) return;   // abgebrochen

      // Ab hier laeuft es: Umleitung setzen und Gold gutschreiben.
      weg._returnToHand = true;
      if (gold > 0) await engine.actionGainGold(pi, gold, CARD_NAME);
      engine.log('trident_reclaim', {
        player: ps.username, card: weg.name, gold,
      });
      engine.sync();
    },
  },
};
