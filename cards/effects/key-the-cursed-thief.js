// ═══════════════════════════════════════════
//  CARD EFFECT: "Key, the Cursed Thief"
//  Hero · 400 HP · 40 ATK · Starting Abilities: Adventurousness, Thieving
//
//  "Once per turn, when your opponent plays an Artifact from their
//   hand, you may spend Gold equal to its Cost to negate that Artifact
//   and add it to your hand instead. If you do, your opponent doesn't
//   have to pay for the Artifact."
//
//  ── UMSETZUNG ─────────────────────────────────────────────────────
//  • HELDEN-REAKTION im Kettenfenster (v691): das Reaktionsfenster
//    sammelt neben Hand- und Surprise-Reaktionen auch Helden, deren
//    Skript `isHeroReaction` + `heroReactionCondition` traegt. Key
//    erscheint dort als Option „Key, the Cursed Thief" (source 'hero'),
//    sobald ein GEGNERISCHES Artefakt in der Kette liegt.
//  • Aktivierungskosten: Gold = Cost des Artefakts (`link.goldCost`),
//    bezahlt in `payActivationCost` — VOR dem Ketten. Kein Gold → keine
//    Option (Bedingung prueft die Zahlbarkeit).
//  • Negation + Diebstahl: `negateChainLink(…, { stealToHandOf: pi })`.
//    Die Engine routet die negierte Karte in KEYS Hand statt in die
//    Ablage — fuer Initialkarten via `chainResult.negatedToHandOf` →
//    routeNegatedInitialCard, fuer Reaktions-Artefakte direkt in der
//    Kettenauflösung (inkl. Rueckgabe des schon abgezogenen
//    Reaktionspreises).
//  • „Your opponent doesn't have to pay": ist bei einer negierten
//    INITIALKARTE ohnehin so — der Server zieht den Artefaktpreis erst
//    nach der Kette ab und nur, wenn nicht negiert (Rusty Touch muss
//    ihn deshalb ausdruecklich erzwingen). Fuer Reaktions-Artefakte
//    gibt die Engine den bereits abgezogenen Preis zurueck.
//  • HOPT ueber `gs.hoptUsed['key-thief:<pi>-<hi>']`, gestempelt beim
//    Bezahlen.
//  • Nur lebend und nicht stummgeschaltet (Engine prueft
//    `_isHeroEffectSilenced` beim Sammeln).
//  • „from their hand": Brett-Aktivierungen tragen `fromBoard` und
//    zaehlen nicht. Reaktions-Artefakte werden aus der Hand gespielt
//    und zaehlen mit (Tool-Freezer-Lesart). ← LESART.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Key, the Cursed Thief';
const hoptKey = (pi, hi) => `key-thief:${pi}-${hi}`;

/** Juengstes, nicht negiertes gegnerisches Artefakt in der Kette. */
function zielArtefakt(chain, pi) {
  if (!chain || chain.length === 0) return null;
  for (let i = chain.length - 1; i >= 0; i--) {
    const link = chain[i];
    if (link.fromHero) continue;
    if (link.owner === pi || link.negated) continue;
    if (!hasCardType(link, 'Artifact')) continue;
    // „from their hand": Brett-Aktivierungen (Artefakt-Effekte vom
    // Brett) tragen `fromBoard` und zaehlen nicht.
    if (link.fromBoard) continue;
    return { link, index: i };
  }
  return null;
}

module.exports = {
  activeIn: ['hero'],
  isHeroReaction: true,

  heroReactionCondition(gs, pi, engine, chainCtx, heroIdx) {
    if (gs.hoptUsed?.[hoptKey(pi, heroIdx)] === gs.turn) return false;
    const ziel = zielArtefakt(chainCtx?.chain, pi);
    if (!ziel) return false;
    // Zahlbarkeit: Gold = Cost des Artefakts.
    const kosten = ziel.link.goldCost || 0;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (kosten > 0 && !engine.canAffordGold?.(pi, kosten)) return false;
    return true;
  },

  /** Gold bezahlen — VOR dem Ketten. `false` = nicht bezahlt. */
  async payActivationCost(engine, pi, chainCtx, heroIdx) {
    const gs = engine.gs;
    const ziel = zielArtefakt(chainCtx?.chain, pi);
    if (!ziel) return false;
    const kosten = ziel.link.goldCost || 0;
    if (kosten > 0) {
      if (!engine.canAffordGold?.(pi, kosten)) return false;
      await engine._payCardCost(pi, kosten, { cardName: CARD_NAME });
    }
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[hoptKey(pi, heroIdx)] = gs.turn;
    engine.log('key_thief_pay', {
      player: gs.players[pi]?.username, artifact: ziel.link.cardName, gold: kosten,
    });
    return true;
  },

  async heroReactionResolve(engine, pi, chain, myIndex, heroIdx) {
    const ziel = zielArtefakt(chain, pi);
    if (!ziel) return;
    engine.negateChainLink(chain, ziel.index, { negationStyle: 'thief', stealToHandOf: pi });
    engine.log('key_thief_steal', {
      player: engine.gs.players[pi]?.username, hero: heroIdx,
      artifact: ziel.link.cardName, from: engine.gs.players[ziel.link.owner]?.username,
    });
  },
};
