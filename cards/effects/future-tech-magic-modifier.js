// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Magic Modifier"
//  Artifact (Normal, Cost 5)
//
//  "Reveal a Spell in your hand until the end of the turn. That Spell's
//   level is reduced by the number of \"Future Tech Magic Modifier\"
//   cards in your discard pile while it stays revealed."
//
//  ── Der Zauber-Ermöglicher ──
//  Senkt nicht die Kosten, sondern die STUFE — also die Anforderung an
//  die Zauberschule des wirkenden Helden. Damit kommen Zauber aufs
//  Feld, für die der Held eigentlich zu niedrig steht.
//
//  Und wie überall im Archetyp zählt die Karte sich nicht selbst mit
//  (Als Ruling 21.8.): mit leerer Ablage ist die Reduktion 0, die Karte
//  deckt den Zauber dann nur auf. Sie bleibt trotzdem spielbar — die
//  erste Kopie ist die Munition der zweiten.
//
//  ── Zwei vorhandene Mechanismen, kein neuer ──
//  `_magicLevelReductions` ist die Liste, aus der die Engine beim
//  Stufenvergleich abzieht (Vorbild: Divine Gift of Magic), und sie
//  verfällt beim nächsten Zugbeginn — exakt „until the end of the
//  turn". Das Aufdecken läuft über `card_reveal`, dieselbe Anzeige wie
//  überall sonst.
//
//  „while it stays revealed" ist damit gleichbedeutend mit „bis zum
//  Zugende": in diesem Spiel gibt es kein Zurücknehmen einer
//  Aufdeckung; beides endet am selben Punkt.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Magic Modifier';

/**
 * HANDINDIZES der Zauber mit Stufe > 0 — Stufe 0 lohnt nicht, die geht
 * ohnehin durch. Indizes, weil der `pickHandCard`-Picker damit alles
 * andere ausgraut (Als Vorgabe 21.8.).
 */
function tauglicheIndizes(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const db = engine._getCardDB();
  const out = [];
  (ps.hand || []).forEach((n, i) => {
    const cd = db[n];
    if (cd && hasCardType(cd, 'Spell') && (cd.level || 0) > 0) out.push(i);
  });
  return out;
}

module.exports = {
  isTargetingArtifact: false,

  // Gate nur auf „es gibt ueberhaupt einen Zauber mit Stufe" — NICHT
  // auf Kopien in der Ablage: der Leerlauf ist im Archetyp ein
  // legitimer erster Schritt (siehe `_future-tech-shared.js`).
  canActivate(gs, pi, engine) {
    return tauglicheIndizes(gs, pi, engine).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const eligible = tauglicheIndizes(gs, pi, engine);
    if (eligible.length === 0) return { cancelled: true };

    const abzug = zaehleInAblage(gs, pi, CARD_NAME);

    // Normaler Handkarten-Picker statt Galerie: taugliche Zauber
    // leuchten, alles andere ist ausgegraut.
    const wahl = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: abzug > 0
        ? `Click a Spell in your hand to reveal it — its level drops by ${abzug} until end of turn.`
        : 'Click a Spell in your hand to reveal it. (No copies in your discard pile yet, so no level reduction.)',
      eligibleIndices: eligible,
      confirmLabel: '🔧 Reveal!',
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return { cancelled: true };
    const name = wahl.cardName;

    // Funkeln auf der Zielkarte, Menge = Hoehe der Stufensenkung
    // (Als Vorgabe 21.8.). Bei Abzug 0 bleibt ein Grundfunkeln — die
    // Karte wird ja trotzdem aufgedeckt.
    const idx = wahl.handIndex != null ? wahl.handIndex : (ps.hand || []).indexOf(name);
    if (idx >= 0) {
      engine._broadcastEvent('play_hand_card_animation', {
        owner: pi, handIdx: idx, animType: 'modifier_sparkle',
        count: Math.max(3, abzug * 4), duration: 800,
      });
    }

    // Aufdecken gehoert zum Text und passiert auch ohne Reduktion.
    engine._broadcastEvent('card_reveal', { cardName: name, playerIdx: pi });
    await engine._delay(560);

    if (abzug > 0) {
      if (!ps._magicLevelReductions) ps._magicLevelReductions = [];
      ps._magicLevelReductions.push({ cardName: name, amount: abzug });
    }

    engine.log('ft_magic_modifier', {
      player: ps.username, spell: name, amount: abzug,
    });
    engine.sync();
    return { ok: true };
  },
};
