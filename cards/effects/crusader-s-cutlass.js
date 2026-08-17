// ═══════════════════════════════════════════
//  CARD EFFECT: "Crusader's Cutlass"
//  Equipment-Artefakt der „Crusader's"-Familie. Skelett (nur an
//  Cecilia, 1 je Held, 80 Schaden als Attack, Zug-Ende-Kreislauf)
//  liegt in `_crusader-shared.js`.
//
//  EIGENE KLAUSEL: „If that Attack defeats a Hero, defeat all
//  Creatures your opponent controls."
//
//  AUSLEGUNG: „your opponent" ist der Gegner des ANGREIFERS — nicht
//  der Besitzer des besiegten Helden. Schlaegt Cecilia (durch einen
//  Umlenk-Effekt) einen eigenen Helden, raeumt der Hieb trotzdem die
//  Gegnerseite ab. Der Text nennt ausdruecklich „your opponent".
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { makeCrusaderArtifact, takten, TAKT_MS } = require('./_crusader-shared');

const CARD_NAME = "Crusader's Cutlass";

/** Alle Creatures, die der Gegner gerade kontrolliert. */
function gegnerischeCreatures(engine, oppIdx) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== oppIdx) continue;
    if (inst.faceDown) continue;   // verdeckte Surprises sind nicht „in play"
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

module.exports = makeCrusaderArtifact({
  cardName: CARD_NAME,
  attackLabel: '🗡️ 80 Damage!',
  riderText: 'If that Attack defeats a Hero, all Creatures your opponent controls are defeated.',

  // Blutiger Schnitt auf dem Ziel. `red_cut` ist die vorhandene rote
  // Klingen-Animation (Burning Skeleton) — genau der gewuenschte Look,
  // deshalb kein neuer Typ.
  async attackAnim(ctx, { engine, tgtOwner, tgtHeroIdx, impactSlot }) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'red_cut', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
    });
    await engine._delay(260);   // Klinge sitzt, dann faellt der Schaden
  },

  async rider(ctx, { engine, pi, oppIdx, besiegt }) {
    if (!besiegt) return;

    // Momentaufnahme VOR dem Abraeumen: `actionDestroyCard` veraendert
    // `cardInstances` waehrend der Schleife, und Todes-Trigger koennen
    // weitere Karten bewegen.
    const opfer = gegnerischeCreatures(engine, oppIdx);
    if (opfer.length === 0) return;

    const source = { name: CARD_NAME, owner: pi, controller: pi };
    let gefallen = 0;
    for (const inst of opfer) {
      if (!inst || inst.zone !== 'support') continue;   // Trigger war schneller
      await engine.actionDestroyCard(source, inst);
      // GETAKTET (Als Befund 17.8.): ohne Pause laufen alle Opfer in
      // einem Tick aus ihren Zonen und der Client raeumt das Brett auf
      // einen Schlag ab — die Einzelfluege spielen dann ins Leere.
      // Zustand raus, kurz warten, naechstes Opfer.
      await takten(engine, TAKT_MS);
      gefallen++;
    }
    engine.log('crusader_cutlass_wipe', {
      player: engine.gs.players[pi]?.username, defeated: gefallen,
    });
  },
});
