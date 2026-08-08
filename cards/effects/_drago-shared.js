// ═══════════════════════════════════════════
//  GETEILT: die "Drago"-Namensregel
//
//  Karten wie Red / Green Dragoneer beziehen sich auf
//  '"Drago" Creatures'. Diese Datei ist die EINZIGE
//  Stelle, an der festgelegt ist, was das heisst —
//  aendert sich die Auslegung, aendert sie sich hier
//  fuer alle Karten gleichzeitig.
//
//  ── Die Regel ──
//  Geprueft wird der GANZE Kartenname auf den
//  Teilstring "Drago" (Gross-/Kleinschreibung zaehlt,
//  wie bei allen Namensbezuegen im Spiel). Der Beiname
//  zaehlt mit: "Sorbereus, the Adapting Dragon" und
//  "Dragsparov, the King of Dragons" tragen ihn beide
//  ueber "Dragon"/"Dragons".
//
//  Keine Ausnahmen, keine Sonderfaelle — jede Karte,
//  in deren Namen "Drago" vorkommt, gehoert dazu.
//
//  (Zwischenstand am 8.8.: kurzzeitig zaehlte nur der
//  Eigenname vor dem Komma, damit Dragsparov
//  herausfaellt. Das war ein Missverstaendnis — sein
//  Beiname enthaelt "Dragons" — und ist wieder
//  zurueckgenommen.)
//
//  Bestand:
//     ✓ Blue-Ice Dragon
//     ✓ Dragolfin
//     ✓ Dragsparov, the King of Dragons
//     ✓ Sorbereus, the Adapting Dragon
//     ✓ Steam Dwarf Dragon Pilot
//     ✓ Red Dragoneer, Green Dragoneer
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const DRAGO = 'Drago';

/** Traegt der Kartenname "Drago"? */
function isDragoName(cardName) {
  return String(cardName || '').includes(DRAGO);
}

/** "Drago"-Karte UND Kreatur? */
function isDragoCreatureName(engine, cardName) {
  if (!isDragoName(cardName)) return false;
  const cd = engine._getCardDB()[cardName];
  return !!cd && hasCardType(cd, 'Creature');
}

/**
 * Ist diese Instanz eine "Drago"-Kreatur, die `pi` gerade auf dem Feld
 * kontrolliert? Verdeckte Karten und alles ausserhalb der Support-Zonen
 * zaehlen nicht.
 */
function isControlledDragoCreature(engine, inst, pi) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if ((inst.controller ?? inst.owner) !== pi) return false;
  if (!isDragoName(inst.name)) return false;
  const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
  return !!cd && hasCardType(cd, 'Creature');
}

/** Andere "Drago"-Kreaturen, die `pi` kontrolliert (`selfId` zaehlt nicht). */
function countOtherDragoCreatures(engine, pi, selfId) {
  return (engine.cardInstances || []).filter(
    (inst) => (selfId == null || inst.id !== selfId) && isControlledDragoCreature(engine, inst, pi),
  ).length;
}

/**
 * War der gemeldete Todesfall eine "Drago"-Kreatur unter der Kontrolle
 * von `pi`? Erwartet die `creature`-Nutzlast des onCreatureDeath-Hooks.
 * `controller` ist die Spielwahrheit; `owner` nur der Ausweichwert fuer
 * aeltere Nutzlasten.
 */
function isDragoDeath(engine, deathInfo, pi) {
  if (!deathInfo) return false;
  if ((deathInfo.controller ?? deathInfo.owner) !== pi) return false;
  return isDragoCreatureName(engine, deathInfo.name);
}

module.exports = {
  DRAGO,
  isDragoName,
  isDragoCreatureName,
  isControlledDragoCreature,
  countOtherDragoCreatures,
  isDragoDeath,
};
