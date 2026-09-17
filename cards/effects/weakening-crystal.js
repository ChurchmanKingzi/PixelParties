// ═══════════════════════════════════════════
//  CARD EFFECT: "Weakening Crystal"
//  Artifact (Normal, cost 15) — Crystals
//
//  When you draw or add this card to your hand,
//  you must immediately reveal it. While this
//  card is in your hand, the effects of all your
//  Heroes are negated. This counts as a negative
//  status effect.
//
//  Implementation:
//   • `revealOnEnterHand: true` — engine auto-
//     stamps `_permanentlyRevealedHandIndices` on
//     every canonical add-to-hand path.
//   • Hero-effect negation — als ECHTER `negated`-
//     Status mit `_byWeakeningCrystal`-Marke.
//
//  ★ v1103 (Als Ruling 15.9.): „Den Status zu
//  cleansen, entfernt ihn TEMPORAER. Solange
//  Crystal auf der Hand ist, wird der Effekt (mit
//  kleiner Animation) zu Beginn jeder Runde des
//  Betroffenen neu appliziert."
//
//  Frueher schrieb JEDER `sync()` den Status neu —
//  eine Heilung war dadurch wirkungslos, der
//  naechste Zustandspush machte sie im selben
//  Augenblick rueckgaengig. Genau deshalb stand
//  die Karte im Status-Sweep (v1102) als
//  „behauptet einen Status, ist aber keiner".
//
//  Jetzt: anlegen nur beim Eintritt in die Hand,
//  zum Rundenbeginn des Betroffenen und beim Laden
//  eines Spielstands. Der Sync raeumt nur noch AUF.
//  `negated` bleibt global unheilbar; NUR die
//  Instanz mit `_byWeakeningCrystal` ist heilbar.
//   • The Artifact has no Spell-style "play me"
//     payoff — using it as an Artifact pays the
//     gold cost and discards. The mere presence
//     in hand is the threat.
// ═══════════════════════════════════════════

const CARD_NAME = 'Weakening Crystal';

module.exports = {
  // CPU: alwaysCommit — Dauer-Aura: Nutzen liegt in GEGNER-Zügen, für das Immediate-Gate unsichtbar (Equipment-Bugklasse).
  // planArtifactPlay filtert Bezahlbarkeit bereits; entspricht der
  // dokumentierten Artifact-Politik "played as soon as affordable".
  cpuMeta: { alwaysCommit: true },
  isTargetingArtifact: true,
  revealOnEnterHand: true,

  // ★ v1103: die Karte legt ihren Status NICHT selbst an, sondern der
  // Motor tut es fuer sie (`_crystals-shared.refreshWeakeningCrystalNegation`)
  // — sie liegt ja in der HAND und hat keinen eigenen Aufloesungspunkt.
  // Diese Deklaration sagt dem Waechter `check-status-claims`, welcher
  // Status gemeint ist, und dokumentiert es zugleich fuer Leser.
  declaresStatus: 'negated',

  // No board targets — playing it just discards the Crystal for its
  // gold cost (handled by the engine as a normal Artifact play).
  canActivate: () => true,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Weakening Crystal has no effect when played from hand. Pay 15 Gold to discard it.',
    confirmLabel: '🔮 Discard',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'none',

  async resolve(engine, pi) {
    // No-op: the gold cost is auto-deducted by the engine for the
    // play. The Crystal already left the hand by the time `resolve`
    // fires (Artifact plays splice the card before resolution), so
    // its hero-effect-negation aura naturally lifts when discarded.
    engine.log('weakening_crystal_discarded', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
  },
};
