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
//
//  ── EXAKT N Karten (Al, QA-Welle 1 Nr. 19) ──
//  „Choose as many … as there are …" = GENAU N (N = Databases in der Ablage),
//  nicht „bis zu N". Liegen weniger als N Future-Tech-Karten mit VERSCHIEDENEN
//  Namen (ohne Database) im Deck, ist die Karte nicht spielbar. Die N Namen
//  werden erst alle gewählt, dann geholt: ein Abbruch an irgendeiner Stelle der
//  Wahl heißt „nichts passiert" (Karte bleibt auf der Hand, Kosten erstattet).
// ═══════════════════════════════════════════

const { zaehleInAblage, istFutureTech, waehleAusNamen } = require('./_future-tech-shared');

// v875: Namensvergleiche ueber den BASISNAMEN — „[B]"/„[W]" sind
// Kosmetik (siehe CARD_API, „Namen vergleichen").
const { baseCardName } = require('./_hooks');
const CARD_NAME = 'Future Tech Database';

/** Holbare Namen: Future Tech im Deck, aber nicht die Database selbst. */
function kandidaten(gs, pi, schonGewaehlt) {
  const ps = gs.players[pi];
  if (!ps) return [];
  return (ps.mainDeck || [])
    .filter(n => istFutureTech(n) && baseCardName(n) !== baseCardName(CARD_NAME) && !schonGewaehlt.some(g => baseCardName(g) === baseCardName(n)));
}

/** Wie viele VERSCHIEDENE (Basis-)Namen sind holbar? */
function verschiedeneHolbare(gs, pi) {
  return new Set(kandidaten(gs, pi, []).map(n => baseCardName(n))).size;
}

module.exports = {
  isTargetingArtifact: false,
  blockedByHandLock: true,

  // KEIN Gate auf die Ablage — siehe Kopf. Nur: es muss überhaupt etwas
  // Holbares im Deck liegen, sonst wäre die Abfrage leer. Exakt N (Al, QA-Welle 1 Nr. 19):
  // weniger verschiedene holbare Namen als N → nicht spielbar.
  canActivate(gs, pi) {
    const holbar = verschiedeneHolbare(gs, pi);
    return holbar > 0 && holbar >= zaehleInAblage(gs, pi, CARD_NAME);
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const wieViele = zaehleInAblage(gs, pi, CARD_NAME);
    engine.log('ft_database', { player: ps.username, allowed: wieViele });

    if (wieViele <= 0) { engine.sync(); return { ok: true }; }

    // Erst ALLE N Namen waehlen (jede Wahl abbrechbar, noch nichts bewegt), dann holen.
    const gewaehlt = [];
    for (let i = 0; i < wieViele; i++) {
      const frei = kandidaten(gs, pi, gewaehlt);
      if (frei.length === 0) break;
      const name = await waehleAusNamen(engine, pi, frei, {
        source: 'deck',
        title: CARD_NAME,
        description: `Add a "Future Tech" card with a different name from your deck to your hand (${i + 1}/${wieViele}).`,
        cancellable: true,
      });
      // ★ W16b (A03-futuretech-17, CARD_API „Zielende Karten sind immer abbrechbar … Abbruch heißt: nichts ist passiert"): Abbruch der Wahl =
      // nichts geholt → Karte zurück auf die Hand, Kosten erstattet (wie Blueprints / Mysterious Core). Exakt N (Al, QA-Welle 1 Nr. 19):
      // auch ein Abbruch nach einer schon gewählten Karte nimmt die ganze Wahl zurück — bewegt wurde bis hierher nichts.
      if (!name) return { cancelled: true };
      gewaehlt.push(name);
    }
    // W85c (Atta, Al 29.10.): „reveal them" — die gewählten Karten sind EIN Aufdeck-Ereignis VOR dem Verschieben; eine von Atta gelöschte Karte kommt nie auf die Hand.
    const _ereignis = await engine.aufdeckTutorEreignis(pi, gewaehlt, CARD_NAME);
    for (const name of gewaehlt) {
      if (_ereignis.geloescht.includes(name)) continue;
      await engine.actionAddCardFromDeckToHand(pi, name, {
        source: CARD_NAME, reveal: !_ereignis.fensterGezeigt,
        _noKrates: true,   // Mehrfach-Tutor: Krates greift nur bei Ein-Karten-Suchen
      });
      await engine._delay(200);
    }

    engine.sync();
    return { ok: true };
  },
};
