// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Battery"
//  Artifact (Normal, Cost 0)
//
//  "Choose an Artifact from your hand. For the rest of this turn, that
//   Artifact's Cost is reduced by 10 for every card with the same name
//   as it in your discard pile."
//
//  ── Der Preisdrücker des Archetyps ──
//  Kostet selbst nichts und macht die teuren Stücke bezahlbar — aber
//  nur, wenn schon Kopien in der Ablage liegen. Wie überall zählt die
//  gewählte Karte sich nicht selbst mit (Als Ruling 21.8.): sie liegt
//  ja in der Hand.
//
//  ── Warum kein eigener Mechanismus ──
//  Die Engine hat den passenden schon: `_handCostReductions` ist ein
//  handindizierter Rabatt, den der Server bei jedem Artefaktkauf
//  abzieht (server.js ~6252) und der beim nächsten Zugbeginn verfällt —
//  also exakt „for the rest of this turn". Er wandert über die
//  Handindex-Nachführung der Engine sogar mit, wenn sich die Hand
//  umsortiert.
//
//  Bewusst NICHT `_handCostReductionsPermanent` (das ist Lunatic
//  Cycles dauerhafter Rabatt) und bewusst NICHT
//  `_nextArtifactCostReduction` (das gilt für die nächste beliebige
//  Karte, nicht für eine bestimmte).
//
//  ── Aufaddieren statt Überschreiben ──
//  Zwei Batterien auf dieselbe Karte stapeln ihre Rabatte. Der Preis
//  wird serverseitig ohnehin bei 0 gedeckelt.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Battery';
const JE_KOPIE = 10;

/**
 * HANDINDIZES der tauglichen Karten: Artefakte, von denen mindestens
 * eine Kopie in der Ablage liegt. Indizes statt Namen, weil der
 * `pickHandCard`-Picker sie so erwartet — er graut alles aus, was nicht
 * in der Liste steht.
 */
function tauglicheIndizes(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const db = engine._getCardDB();
  const out = [];
  (ps.hand || []).forEach((n, i) => {
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Artifact')) return;
    if (zaehleInAblage(gs, pi, n) <= 0) return;
    out.push(i);
  });
  return out;
}

module.exports = {
  isTargetingArtifact: false,

  // Gate auf das, was wirklich etwas bringt: ein Artefakt in der Hand,
  // dessen Name auch in der Ablage liegt. Ohne Kopie waere der Rabatt 0
  // und die Aktion verpufft.
  canActivate(gs, pi, engine) {
    return tauglicheIndizes(gs, pi, engine).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // ── Der NORMALE Handkarten-Picker (Als Vorgabe 21.8.) ──
    // `pickHandCard` zeigt die echte Hand: taugliche Karten leuchten,
    // der Rest ist ausgegraut. Kein eigenes Galerie-Untermenue mehr —
    // der Spieler klickt die Karte dort an, wo sie liegt. Der Picker
    // liefert `handIndex` gleich mit, also braucht es auch kein
    // `lastIndexOf` mehr, das bei zwei Kopien die falsche treffen kann.
    const eligible = tauglicheIndizes(gs, pi, engine);
    if (eligible.length === 0) return { cancelled: true };

    const wahl = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: `Click an Artifact in your hand — its Cost drops by ${JE_KOPIE} for every copy of it in your discard pile, until end of turn.`,
      eligibleIndices: eligible,
      confirmLabel: '🔋 Charge!',
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return { cancelled: true };
    const name = wahl.cardName;

    const kopien = zaehleInAblage(gs, pi, name);
    const rabatt = JE_KOPIE * kopien;
    if (rabatt <= 0) return { cancelled: true };

    const idx = wahl.handIndex != null ? wahl.handIndex : (ps.hand || []).lastIndexOf(name);
    if (idx < 0 || ps.hand[idx] !== name) return { cancelled: true };
    if (!ps._handCostReductions) ps._handCostReductions = {};
    ps._handCostReductions[idx] = (ps._handCostReductions[idx] || 0) + rabatt;

    // Stromstoss auf der Zielkarte — je mehr Ersparnis, desto mehr
    // Funken (Als Vorgabe 21.8.). Zwei Funken je 10 Gold, gedeckelt
    // durch die Animation selbst.
    engine._broadcastEvent('play_hand_card_animation', {
      owner: pi, handIdx: idx, animType: 'battery_charge',
      count: Math.round(rabatt / 5), duration: 700,
    });
    engine._broadcastEvent('card_reveal', { cardName: name, playerIdx: pi });
    await engine._delay(520);

    const db = engine._getCardDB();
    engine.log('ft_battery', {
      player: ps.username, card: name, copies: kopien, reduction: rabatt,
      costNow: Math.max(0, (db[name]?.cost || 0) - ps._handCostReductions[idx]),
    });
    engine.sync();
    return { ok: true };
  },
};
