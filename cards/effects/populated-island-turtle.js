// ═══════════════════════════════════════════
//  CARD EFFECT: "Populated Island Turtle"
//  Creature (Normal, Lv3, Summoning Magic) — BANNED
//
//  ① TAKES UP 3 SUPPORT ZONES — when summoned,
//    occupies all 3 of the host Hero's Support
//    Zone slots. Cannot be summoned unless all 3
//    are free.
//
//  ② HOPT — once per turn, draw until you have
//    10 cards in hand.
//
//  Multi-zone implementation:
//   • The Creature inst itself lives in ONE slot
//     (whichever the engine picks via the
//     standard summon path — usually slot 0).
//   • The OTHER two slots get a sentinel name
//     `_ZoneBlocked` pushed into them. The
//     sentinel:
//       - Blocks future placements there because
//         `safePlaceInSupport`'s emptiness check
//         (`slot.length === 0`) sees the slot as
//         occupied.
//       - Is invisible to targeting iteration:
//         `cardDB[creatureName]` returns
//         undefined for the sentinel, so the
//         hasCardType('Creature') filter rejects
//         it. Same goes for any creature-name
//         iteration that reads the cardDB.
//   • On Turtle's removal (death, bounce, etc.),
//     `onCardLeaveZone` clears the sentinels so
//     the host Hero's slots free up cleanly.
//
//  ★ 5.9. (v784): die Zonenlogik liegt jetzt in
//  `_multizone-shared.js` und wird mit „Land
//  Sharks" geteilt. Damit ist die am 17.8. hier
//  vermerkte offene Schuld abgetragen — sie
//  lautete, der Platzhalter-Ansatz sei „keine
//  gerechtfertigte Vereinfachung", weil er nur
//  in dieser einen Karte stand.
//
//  Verbleibende Kante, unveraendert: ein Leser,
//  der `supportZones[hi][si][0]` ROH auswertet
//  ohne cardDB-Nachschlag, saehe die
//  Platzhalter-Zeichenkette. Nachgemessen (5.9.):
//  einen solchen Leser gibt es nicht.
// ═══════════════════════════════════════════

const multizone = require('./_multizone-shared');

const CARD_NAME = 'Populated Island Turtle';
const HAND_TARGET = 10;

module.exports = {
  activeIn: ['support'],

  /**
   * Wie viele Support Zones diese Kreatur einnimmt. Gelesen von
   * `_multizone-shared.handleIslandRemoval`, um beim Wegfall einer
   * Inselzone zu erkennen, dass hier umgeschichtet statt getoetet wird.
   */
  multiZone: 3,

  /**
   * Beschwoerungspruefung — beide Fragen der Engine (pro Held und
   * kartenweit fuer die Ausgrauung) beantwortet das geteilte Modul.
   */
  canSummon(ctx) {
    return multizone.canSummonMultiZone(ctx, CARD_NAME);
  },

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if (ps.handLocked) return false;
    return (ps.hand?.length || 0) < HAND_TARGET;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const need = Math.max(0, HAND_TARGET - (ps.hand?.length || 0));
    if (need <= 0) return false;
    await engine.actionDrawCards(pi, need);
    engine.log('island_turtle_draw', {
      player: ps.username, target: HAND_TARGET, drew: need,
    });
    engine.sync();
    return true;
  },

  hooks: {
    // Platzhalter setzen und wieder abraeumen — geteilt mit „Land
    // Sharks", siehe `_multizone-shared.js`.
    ...multizone.multiZoneHooks(CARD_NAME, { claimLog: 'island_turtle_zones_claimed' }),
  },
};
