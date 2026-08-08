// ═══════════════════════════════════════════
//  GETEILT: der "War Counselor"-Archetyp
//
//  Acht Karten (PP MS1): sechs Ratgeber-Kreaturen
//  (Censpartan, Cykyran, Gorinthian, Harpthenean,
//  Minocrete, Thebinxan), das Artifact "War Chest"
//  und der Area-Spell "War Council Gathering Place".
//
//  Alle sechs Kreaturen sind Lv2 Summoning Magic,
//  tragen "You can only control 1 <ihr Name>" und
//  haben einen aktiven Effekt, den die uebrigen
//  Karten zaehlen oder ausloesen. Diese Datei haelt
//  deshalb genau die Fragen, die mehr als eine Karte
//  stellt:
//
//    · Ist X ein "War Counselor"?
//    · Wie viele kontrolliere ich (und wie viele
//      VERSCHIEDENE)?
//    · Kontrolliere ich schon eine Kopie dieser
//      Karte? (Singleton-Regel)
//
//  Namensbezug: Teilstring "War Counselor" im
//  Kartennamen, Gross-/Kleinschreibung zaehlt — wie
//  bei allen Namensbezuegen im Spiel. Alle sechs
//  tragen zusaetzlich `archetype: "War Counselors"`,
//  der Name ist aber das, was die Kartentexte nennen,
//  also pruefe ich den Namen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const WC = 'War Counselor';

/** Traegt der Kartenname "War Counselor"? */
function isWarCounselorName(cardName) {
  return String(cardName || '').includes(WC);
}

/** "War Counselor"-Karte UND Kreatur? */
function isWarCounselorCreatureName(engine, cardName) {
  if (!isWarCounselorName(cardName)) return false;
  const cd = engine._getCardDB()[cardName];
  return !!cd && hasCardType(cd, 'Creature');
}

/**
 * Alle "War Counselor"-Kreaturen, die `pi` gerade auf dem Feld
 * kontrolliert. Verdeckte Karten und alles ausserhalb der Support-Zonen
 * zaehlen nicht — eine Kreatur "kontrolliert" man erst, wenn sie offen
 * im Support liegt.
 */
function controlledWarCounselors(engine, pi) {
  return (engine.cardInstances || []).filter((inst) => {
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    if ((inst.controller ?? inst.owner) !== pi) return false;
    if (!isWarCounselorName(inst.name)) return false;
    const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
    return !!cd && hasCardType(cd, 'Creature');
  });
}

/** Anzahl kontrollierter "War Counselor"-Kreaturen (Kopien zaehlen einzeln). */
function countWarCounselors(engine, pi) {
  return controlledWarCounselors(engine, pi).length;
}

/**
 * Anzahl VERSCHIEDENER kontrollierter "War Counselor"-Kreaturen.
 * Cykyran ("at least 3 different") und Gorinthian ("at least 2
 * different") haengen daran. Praktisch deckungsgleich mit der Gesamtzahl,
 * weil jede Ratgeberkarte auf 1 Exemplar begrenzt ist — aber der Text
 * sagt "different", also zaehle ich auch so.
 */
function countDistinctWarCounselors(engine, pi) {
  return new Set(controlledWarCounselors(engine, pi).map((i) => i.name)).size;
}

/** Kontrolliert `pi` schon eine Karte dieses Namens? (Singleton-Regel) */
function alreadyControls(engine, pi, cardName) {
  return (engine.cardInstances || []).some(
    (inst) => inst
      && inst.zone === 'support'
      && (inst.controller ?? inst.owner) === pi
      && inst.name === cardName,
  );
}

/**
 * Fertiges `canSummon` fuer die Singleton-Regel. Die Engine fragt es
 * beim Handkarten-Gate und bei Fremdbeschwoerungen
 * (`isCreatureSummonable`), die Grenze gilt also auf allen Wegen.
 */
function makeSingletonCanSummon(cardName) {
  return function canSummon(ctx) {
    return !alreadyControls(ctx._engine, ctx.cardOwner, cardName);
  };
}

module.exports = {
  WC,
  isWarCounselorName,
  isWarCounselorCreatureName,
  controlledWarCounselors,
  countWarCounselors,
  countDistinctWarCounselors,
  alreadyControls,
  makeSingletonCanSummon,
};
