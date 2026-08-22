// ═══════════════════════════════════════════
//  CARD EFFECT: "Blueprints"
//  Artifact (Normal, Cost 4)
//
//  "Choose an Artifact from your discard pile and add a copy of it
//   from your deck to your hand."
//
//  ── Die Feinheit steckt im Wort „copy" ──
//  Die Karte holt NICHT die Karte aus der Ablage. Sie sucht die
//  gewählte Karte als Vorlage und zieht eine ZWEITE Kopie aus dem
//  Deck. Die Ablage bleibt unangetastet — was im Future-Tech-Deck der
//  eigentliche Witz ist: dort ist jede abgelegte Karte eine Zählmarke,
//  die man ungern zurücknimmt.
//
//  Daraus folgt das Gate: ein Artefaktname zählt nur dann als gültige
//  Wahl, wenn er in der Ablage liegt UND noch eine Kopie im Deck
//  steckt. Steht der Name nur in der Ablage, wäre die Wahl folgenlos —
//  solche Namen kommen gar nicht erst in die Galerie.
//
//  Der Weg in die Hand läuft über `actionAddCardFromDeckToHand`, damit
//  `ON_CARD_ADDED_TO_HAND` feuert (Cosmic Depths Analyzer und Gatherer
//  hängen daran) und die Suchanimation samt Log entsteht.
//
//  Wie Mysterious Core: der Text sagt „an Artifact", nicht „a Future
//  Tech Artifact" — jedes Artefakt ist erlaubt.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { waehleAusNamen } = require('./_future-tech-shared');

const CARD_NAME = 'Blueprints';

/**
 * Namen, die in der Ablage liegen UND noch eine Kopie im Deck haben.
 * EINE Quelle für Gate und Galerie — sonst leuchtet eine Wahl auf, die
 * anschließend nichts bewirkt.
 */
function gueltigeVorlagen(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const db = engine._getCardDB();
  const imDeck = new Set(ps.mainDeck || []);
  const gesehen = new Set();
  const out = [];
  for (const n of (ps.discardPile || [])) {
    if (gesehen.has(n)) continue;
    gesehen.add(n);
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if (!imDeck.has(n)) continue;
    out.push(n);
  }
  return out;
}

module.exports = {
  isTargetingArtifact: false,
  // Die Karte endet in einer Handkarte — bei gesperrter Hand ist sie
  // wirkungslos und wird deshalb ganz gesperrt.
  blockedByHandLock: true,

  canActivate(gs, pi, engine) {
    return gueltigeVorlagen(gs, pi, engine).length > 0;
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const vorlagen = gueltigeVorlagen(gs, pi, engine);
    if (vorlagen.length === 0) return { cancelled: true };

    const name = await waehleAusNamen(engine, pi, vorlagen, {
      source: 'discard',
      title: CARD_NAME,
      description: 'Pick an Artifact in your discard pile — a copy comes from your deck to your hand.',
      cancellable: true,
    });
    if (!name) return { cancelled: true };

    // Gegenprüfung nach dem Prompt: zwischen Anzeige und Antwort kann
    // sich das Deck geändert haben (Reaktionsfenster).
    if ((ps.mainDeck || []).indexOf(name) < 0) return { cancelled: true };

    await engine.actionAddCardFromDeckToHand(pi, name, {
      source: CARD_NAME,
      reveal: true,
    });

    engine.log('blueprints_copy', { player: ps.username, card: name });
    engine.sync();
    return { ok: true };
  },
};
