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

const { anyName } = require('./_alias-name');   // Shroomasaur: Zusatzname zählt für Namensfamilien
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
    if (!anyName(inst, (n) => isWarCounselorName(n))) return false;
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

/**
 * Feuert dieser `onCardLeaveZone` fuer den ABGANG DER EIGENEN KARTE SELBST
 * (statt fuer eine fremde)? Der Todes-/Zerstoerungs-/Bounce-Pfad nennt sie als
 * `leavingCard`; `actionTransferCreature` (Kontrollwechsel) nur ueber
 * `_onlyCard`. Zu diesem Zeitpunkt steht die Instanz noch im Support und
 * zaehlt sich bei jeder Feldzaehlung selbst mit (A06-18/19).
 */
function istEigenerAbgang(ctx) {
  const inst = ctx.card;
  if (!inst || ctx.fromZone !== 'support') return false;
  if (ctx.leavingCard) return ctx.leavingCard.id === inst.id;
  return !!ctx._onlyCard && ctx._onlyCard.id === inst.id;
}

/**
 * ★ Welle 10 (Al, Q46 / A06-rebelliokai-35): vom Spieler `chooserPi` WÄHLBARE Kreaturen, die `ownerIdx` kontrolliert — dieselben harten
 * Wahl-Schutzfilter wie im Zielfenster (`untargetable_all`, `untargetable_by_opponent`, Board-of-Kings-Deckung/`guardsCreatureChoice`).
 * Für „wird der Effekt überhaupt angeboten?" (War Council Gathering Place); die weichen Schutz-Formen (Perfect Disguise: „ausser einziges Ziel") bleiben außen vor.
 */
function waehlbareKreaturen(engine, chooserPi, ownerIdx) {
  return engine.getCreatureTargets(ownerIdx).filter((t) => {
    const inst = t.cardInstance;
    if (!inst || inst.faceDown) return false;
    if (inst.counters?.untargetable_all) return false;
    if (inst.counters?.untargetable_by_opponent && inst.counters.untargetable_by_opponent_pi === chooserPi) return false;
    if (typeof engine._boardGuardsCreatureChoice === 'function' && engine._boardGuardsCreatureChoice(inst, chooserPi)) return false;
    return true;
  });
}

/**
 * ★ Welle 11 (Al, R3): die 8 Gold des War Council Gathering Place werden NICHT beim Annehmen des Angebots abgezogen, sondern erst, wenn der
 * ausgelöste Ratgeber-Effekt sein Ziel bestätigt hat — und zwar VOR der Auflösung (goldskalierende Effekte wie Harpthenean sehen den reduzierten
 * Stand). Ratgeber-Effekte ohne Zielwahl zahlen direkt vor der Auflösung. Bricht der Spieler die Zielwahl ab, wird nie Gold abgezogen.
 * Das Gathering Place hinterlegt die offene Gebühr in `engine._gatheringGebuehr` (`{ instId, betrag, bezahlt, bezahle() }`); der Ratgeber-Effekt
 * ruft `zahleGatheringGebuehr` am Zusagepunkt auf und bricht ab (`return false`), wenn die Zahlung nicht mehr möglich ist.
 * Ohne offene Gebühr (normale Aktivierung) tut beides nichts.
 */
function offeneGatheringGebuehr(engine, inst) {
  const g = engine?._gatheringGebuehr;
  return (g && inst && g.instId === inst.id && !g.bezahlt) ? g.betrag : 0;
}

async function zahleGatheringGebuehr(engine, inst) {
  const g = engine?._gatheringGebuehr;
  if (!g || !inst || g.instId !== inst.id || g.bezahlt) return true;
  return await g.bezahle();
}

module.exports = {
  offeneGatheringGebuehr,
  zahleGatheringGebuehr,
  waehlbareKreaturen,
  WC,
  istEigenerAbgang,
  isWarCounselorName,
  isWarCounselorCreatureName,
  controlledWarCounselors,
  countWarCounselors,
  countDistinctWarCounselors,
  alreadyControls,
  makeSingletonCanSummon,
};
