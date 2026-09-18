// ═══════════════════════════════════════════
//  CARD EFFECT: „Off Duty"
//  Spell (Reaction, Decay Magic Lv 2, PP WAW)
//
//  „Play this card immediately when your opponent summons a Creature.
//   Negate the summoning and shuffle the Creature back into the deck.
//   If the Creature was their Action, your opponent may immediately
//   perform a different Action afterwards."
//
//  BAUART — Vorbild „Lunar Eclipse" (dieselbe Textform: negieren,
//  anders entsorgen, Ersatzaktion anbieten).
//
//  • ★ „NEGATE THE SUMMONING" HEISST: DAS SPIEL ERKENNT DIE
//    BESCHWOERUNG GAR NICHT AN (Als Vorgabe 12.9.) — kein On-Summon-
//    Effekt, kein Hook, kein Trigger. Genau das leistet das
//    KETTENFENSTER: `executeCardWithChain` laeuft, BEVOR die Kreatur
//    ueberhaupt auf dem Brett landet (`_runBeforeSummon` und die
//    Platzierung kommen erst danach). Eine Negierung dort laesst die
//    Beschwoerung nie stattfinden, statt sie hinterher
//    zurueckzudrehen.
//
//    Daraus folgt Als Reihenfolge von selbst: Off Dutys Trigger liegt
//    VOR allen anderen On-Summon-Reaktionen, denn die haengen an der
//    gelandeten Karte (`_checkPostSummonHandReactions` am
//    `onCardEnterZone`) und werden nie erreicht.
//
//  • ★ ZURUECK INS DECK statt in die Ablage: neue Option
//    `negateChainLink(…, { toDeck: true })` (v1017). Der Weg fliegt
//    sichtbar zum Deckstapel und MISCHT danach — sonst laege die
//    Kreatur obenauf und der Gegner zoege sie sofort wieder.
//
//  • Die Ersatzaktion nur, wenn die Beschwoerung wirklich eine Aktion
//    war (nicht inhaerent, nicht aus einer Reaktion). Sie wird NACH
//    der ganzen Kette angeboten (`queuePostChainAction`) — waehrend
//    der Kette sperrt der Reaktionsriegel noch jedes Kartenspiel, das
//    Angebot liefe also ins Leere.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Off Duty';

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'deepsea_idol_negate' }, impactMs: 260 },

  isReaction: true,
  requiresTarget: false,

  /**
   * Nur auf die BESCHWOERUNG EINER GEGNERISCHEN KREATUR aus der Hand.
   * Ohne eigene Bedingung fragte das generische Kettenfenster bei
   * JEDEM Kartenspiel (Lehre v830).
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const letzter = chainCtx.chain[chainCtx.chain.length - 1];
    if (!letzter) return false;
    if (letzter.owner === pi) return false;            // muss der Gegner sein
    if (letzter.cardType !== 'Creature') return false; // nur Beschwoerungen
    if (letzter.fromBoard) return false;               // aus der HAND
    return true;
  },

  /**
   * Aufloesung (LIFO): den Link direkt unter uns negieren und die
   * Kreatur ins Deck zurueckmischen.
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const zielIndex = myIndex - 1;
    if (zielIndex < 0) return;
    const ziel = chain[zielIndex];
    if (!ziel) return;

    const selfLink = chain[myIndex];
    const casterHeroIdx = selfLink?.casterHeroIdx ?? selfLink?.heroIdx ?? 0;
    engine._broadcastEvent('play_zone_animation', {
      // Vorhandener Negierungs-Effekt (deepsea_idol_negate) statt eines
      // neuen: er zeigt genau das, was hier passiert — ein Effekt wird
      // abgewuergt. Ein eigener Typ waere Zierde ohne Zusatznutzen.
      type: 'deepsea_idol_negate', owner: pi, heroIdx: casterHeroIdx, zoneSlot: -1,
    });
    await engine._delay(420);

    engine.negateChainLink(chain, zielIndex, { toDeck: true });   // ★ ins Deck
    engine.log('off_duty', {
      player: gs.players[pi]?.username,
      negated: ziel.cardName, owner: ziel.owner,
    });

    // ── Ersatzaktion — nur bei einer ECHTEN Aktion ────────────────
    if (!ziel.isInitialCard) return;
    const cardDB = engine._getCardDB();
    const cd = cardDB[ziel.cardName];
    const script = loadCardEffect(ziel.cardName);
    if (!cd || !hasCardType(cd, 'Creature')) return;
    const inhaerent = script
      ? (typeof script.inherentAction === 'function'
        ? script.inherentAction(gs, ziel.owner, ziel.heroIdx ?? -1, engine)
        : script.inherentAction === true)
      : false;
    if (inhaerent) return;

    // NACH der Kette anbieten: waehrend der Aufloesung sperrt der
    // Reaktionsriegel noch jedes Kartenspiel.
    const gegner = ziel.owner;
    engine.queuePostChainAction(async () => {
      await engine.performImmediateActionAnyHero(gegner, {
        title: CARD_NAME,
        description: 'Your summon was negated and the Creature was shuffled back into your deck. '
          + 'You may perform a different Action with any Hero — or skip.',
        cancellable: true,
      });
      engine.sync();
    });
  },
};
