// ═══════════════════════════════════════════
//  CARD EFFECT: "Mysterious Core"
//  Artifact (Normal, Cost 10)
//
//  "Choose up to 3 Artifacts with different names from your deck and
//   send them to your discard pile."
//
//  ── Warum diese Karte zuerst gebaut wird ──
//  Der ganze Archetyp rechnet mit dem Inhalt der eigenen Ablage. Ohne
//  eine Karte, die gezielt dorthin befördert, bleibt jede
//  „…so oft, wie X in deiner Ablage liegt"-Karte ein Blindgänger.
//  Mysterious Core ist dieser Motor: drei Artefakte, frei gewählt,
//  sofort in die Ablage.
//
//  ── „up to 3" und „with different names" ──
//  Beides wörtlich umgesetzt: die Auswahl läuft in bis zu drei
//  Durchgängen, jeder Durchgang ist abbrechbar (das ist das „up to"),
//  und bereits gewählte Namen verschwinden aus der Galerie (das ist
//  das „different names"). Wer nach dem ersten Artefakt abbricht,
//  behält die anderen beiden im Deck.
//
//  Der Text sagt NICHT „Future Tech"-Artefakte — jedes Artefakt zählt.
//  Das ist kein Versehen: die Karte soll auch fremde Artefakte
//  entsorgen können, etwa um Blueprints ein Ziel zu geben.
//
//  ── Was sie NICHT tut ──
//  Kein Mischen. Der Text sagt „send … to your discard pile", also
//  eine gezielte Entnahme; das Deck bleibt sonst unangetastet.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { schickeVonDeckInAblage, waehleAusNamen } = require('./_future-tech-shared');

const CARD_NAME = 'Mysterious Core';
const MAX_PICKS = 3;

/** Alle Artefaktnamen im Deck — Grundlage für Gate UND Galerie. */
function artefakteImDeck(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const db = engine._getCardDB();
  return (ps.mainDeck || []).filter(n => {
    const cd = db[n];
    return cd && hasCardType(cd, 'Artifact');
  });
}

module.exports = {
  isTargetingArtifact: false,

  // Gate auf das, was der Spieler wirklich anfassen kann (CARD_API,
  // Abschnitt „Ihr Spiel-Gate"): ohne Artefakt im Deck kommt der
  // Picker leer hoch und das Gold wäre verbrannt.
  canActivate(gs, pi, engine) {
    return artefakteImDeck(gs, pi, engine).length > 0;
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const gewaehlt = [];
    for (let runde = 0; runde < MAX_PICKS; runde++) {
      // Galerie jedes Mal neu bauen: bereits gewählte Namen sind raus
      // („with different names"), und zwischenzeitliche Änderungen am
      // Deck sind berücksichtigt.
      const kandidaten = artefakteImDeck(gs, pi, engine).filter(n => !gewaehlt.includes(n));
      if (kandidaten.length === 0) break;

      const name = await waehleAusNamen(engine, pi, kandidaten, {
        source: 'deck',
        title: CARD_NAME,
        description: gewaehlt.length === 0
          ? `Send up to ${MAX_PICKS} Artifacts with different names from your deck to your discard pile.`
          : `Chosen: ${gewaehlt.join(', ')} — pick another or cancel to stop.`,
        cancellable: true,          // das „up to"
      });
      if (!name) break;
      gewaehlt.push(name);
    }

    if (gewaehlt.length === 0) return { cancelled: true };

    const bewegt = await schickeVonDeckInAblage(engine, pi, gewaehlt, CARD_NAME);
    if (bewegt.length === 0) return { cancelled: true };

    engine.log('mysterious_core', {
      player: ps.username, cards: bewegt, count: bewegt.length,
    });
    engine.sync();
    return { ok: true };
  },
};
