// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Database"
//  Artifact (Normal, Cost 10)
//
//  "Choose as many \"Future Tech\" cards with different names from your
//   deck as there are \"Future Tech Database\" cards in your discard
//   pile, except \"Future Tech Database\", reveal them and add them to
//   your hand."
//
//  ── Der teuerste Zahler des Archetyps ──
//  10 Gold, und mit leerer Ablage bringt sie NICHTS (Als Ruling 21.8.:
//  sie zählt sich nicht selbst). Das ist die härteste Ausprägung des
//  Archetyp-Vertrags — erst investieren, dann ernten. Sie bleibt
//  trotzdem spielbar, denn danach liegt sie selbst in der Ablage und
//  die zweite Database holt eine Karte.
//
//  ── Zwei Ausschlüsse im Text, beide wörtlich umgesetzt ──
//  „with different names" — jeder Name nur einmal je Auflösung.
//  „except Future Tech Database" — sie kann sich nicht selbst
//  nachziehen, sonst zöge man aus einer Database die nächste.
//
//  Jede Karte fliegt einzeln über `actionAddCardFromDeckToHand`
//  (Bewegung zwischen Stapeln wird animiert, Als Regel 21.8.).
// ═══════════════════════════════════════════

const { zaehleInAblage, istFutureTech, waehleAusNamen } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Database';

/** Holbare Namen: Future Tech im Deck, aber nicht die Database selbst. */
function kandidaten(gs, pi, schonGewaehlt) {
  const ps = gs.players[pi];
  if (!ps) return [];
  return (ps.mainDeck || [])
    .filter(n => istFutureTech(n) && n !== CARD_NAME && !schonGewaehlt.includes(n));
}

module.exports = {
  isTargetingArtifact: false,
  blockedByHandLock: true,

  // KEIN Gate auf die Ablage — siehe Kopf. Nur: es muss überhaupt etwas
  // Holbares im Deck liegen, sonst wäre die Abfrage leer.
  canActivate(gs, pi) {
    return kandidaten(gs, pi, []).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const wieViele = zaehleInAblage(gs, pi, CARD_NAME);
    engine.log('ft_database', { player: ps.username, allowed: wieViele });

    if (wieViele <= 0) { engine.sync(); return { ok: true }; }

    const gewaehlt = [];
    for (let i = 0; i < wieViele; i++) {
      const frei = kandidaten(gs, pi, gewaehlt);
      if (frei.length === 0) break;
      const name = await waehleAusNamen(engine, pi, frei, {
        source: 'deck',
        title: CARD_NAME,
        description: `Add a "Future Tech" card from your deck to your hand (${i + 1}/${wieViele}).`,
        cancellable: true,
      });
      if (!name) break;
      gewaehlt.push(name);
      await engine.actionAddCardFromDeckToHand(pi, name, {
        source: CARD_NAME, reveal: true,
      });
      await engine._delay(200);
    }

    engine.sync();
    return { ok: true };
  },
};
