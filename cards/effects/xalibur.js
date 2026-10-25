// ═══════════════════════════════════════════
//  CARD EFFECT: "Xalibur"
//  Artifact (Equipment)
//
//  „Equip this card to a Hero you control. You can place Abilities from
//   your hand into the equipped Hero's free Support Zones as if they
//   were Ability Zones. If this card leaves the board, send all
//   Abilities in the equipped Hero's Support Zones to the discard
//   pile.\"
//
//  Zwei Teile
//  ──────────
//  ① Dieselbe Eigenschaft wie Xal, the Animated Armor, ueber dasselbe
//    Flag: `abilitiesInSupportZones: true`.
//    `engine.heroAcceptsAbilitiesInSupport` liest es am Helden UND an
//    seinen Artefakten — hier braucht es also keine eigene Mechanik.
//
//  ② Beim Abgang raeumen: „send ALL Abilities in the equipped Hero's
//    Support Zones to the discard pile\". Das gilt AUCH, wenn der Held
//    stirbt und das Schwert dabei mit abgeraeumt wird (Al 5.9.) —
//    deshalb haengt es an `onCardLeaveZone` dieser Karte und nicht an
//    einem Heldentod-Reiter: jeder Weg vom Brett fuehrt hier durch.
//
//    Traegt der Held eine ZWEITE Quelle (er IST Xal, oder ein zweites
//    Xalibur liegt an), bleibt alles liegen — die Erlaubnis besteht ja
//    fort.
//
//    ABLAGE, nicht Loeschung: der Kartentext sagt „discard pile\". Nur
//    das Loeschen des Helden selbst (Spirit of the Super-Killing Knife)
//    loescht sie.
// ═══════════════════════════════════════════

const CARD_NAME = 'Xalibur';

module.exports = {

  /**
   * „Equip this card to a Hero you control." — Seitenbindung, siehe
   * `equipOwnSideOnly` in CARD_API.md. Ohne die Fahne gilt die
   * Hausvorgabe „Ausruestung darf an beide Seiten" (Al, 5.9.: der
   * Kartentext ist bindend).
   */
  equipOwnSideOnly: true,
  activeIn: ['support'],
  isEquip: true,

  /** ① Der Held darf Abilities in seine Support Zones legen. */
  abilitiesInSupportZones: true,

  cpuMeta: { dealsDamage: false },

  hooks: {
    /** ② Geht das Schwert, gehen die Abilities mit. */
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      // `leavingCard` fehlt auf einem Weg: der Todes-Aufraeumer des
      // Helden ruft mit `_onlyCard` statt `leavingCard` (Als Befund
      // 5.9. — genau der Fall „Xalibur geht mit dem Helden").
      const weg = ctx.leavingCard || ctx._onlyCard;
      if (!weg || weg.id !== ctx.card.id) return;        // nur ich selbst
      if (ctx.fromZone !== 'support') return;
      // Teleport tauscht nur die Plätze der Helden (Xalibur bleibt in seiner Spalte): nicht abräumen — Teleport prüft die Erlaubnis NACH dem Tausch
      // und schickt die Abilities des Helden, der sie nicht mehr tragen darf, dann selbst in die Ablage.
      if (ctx._teleportBewegung) return;

      const pi = ctx.fromOwner ?? weg.owner;
      const heroIdx = ctx.fromHeroIdx ?? weg.heroIdx;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      // Besteht die Erlaubnis aus einer anderen Quelle fort (der Held
      // IST Xal, oder ein zweites Xalibur liegt an), bleibt alles.
      if (engine.heroAcceptsAbilitiesInSupport(pi, heroIdx, weg.id)) return;

      // Der Abwurf liegt in der Engine (`sendeSupportAbilitiesInAblage`) — Teleport und Compulsory Body Swap brauchen ihn ebenfalls.
      await engine.sendeSupportAbilitiesInAblage(pi, heroIdx, CARD_NAME, { excludeId: weg.id });
      engine.sync();
    },
  },
};
