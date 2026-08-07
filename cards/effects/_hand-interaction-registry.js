// ═══════════════════════════════════════════
//  HAND-INTERAKTIONEN — Register und Prüflauf
//
//  Hintergrund
//  ───────────
//  „Ambush the Scout" negiert einen Effekt, der die Hand des
//  Ambush-Spielers anfasst. Damit das ohne Namensliste
//  funktioniert, feuert JEDE Hand-Interaktion den abbrechbaren
//  Hook `onHandInteraction` (siehe _hooks.js).
//
//  Der Normalfall braucht dafür KEINE Kartenänderung: die drei
//  Engine-Primitiven, über die praktisch alle Karten laufen,
//  feuern ihn zentral (siehe ENGINE_COVERED unten). Eine Karte,
//  die ihre Hand-Interaktion selbst zusammenbaut statt eine
//  Primitive zu nutzen, muss den Hook dagegen SELBST feuern —
//  über `engine.checkHandInteractionReaction(...)`.
//
//  Genau dafür ist diese Datei da.
//
//  Als Vorgabe (4.8.): „Karten, die noch nicht implementiert
//  sind, müssen irgendwo VORGEMERKT werden, sodass sie das Flag
//  garantiert bekommen, sobald sie implementiert werden." Und
//  auf die Rückfrage nach dem Wie: die Variante, die sich nicht
//  überlesen lässt — ein Prüflauf, der beim Serverstart meckert.
//
//  Wer eine der unten gelisteten Karten implementiert, bekommt
//  eine Warnung ins Log, bis er entweder
//    (a) `engine.checkHandInteractionReaction(...)` aufruft, oder
//    (b) die Karte hier aus PENDING entfernt und begründet,
//        warum sie doch keine Hand-Interaktion ist.
// ═══════════════════════════════════════════

const fs = require('fs');
const path = require('path');

/** Kategorien laut Als Ruling vom 4.8. */
const HAND_INTERACTION_KINDS = {
  DISCARD: 'discard',   // (a) Zwangs-Abwurf aus der Hand
  REVEAL:  'reveal',    // (b) Hand ansehen / aufdecken
  STEAL:   'steal',     // (c) Karten aus der Hand nehmen
  LOCK:    'lock',      // (e) Hand sperren — NUR bei Aktivierung
  INSERT:  'insert',    // (f) Karte in die Hand legen
};

// AUSDRÜCKLICH KEINE Hand-Interaktion (Als Ruling): das bloße
// ZÄHLEN von Handkarten. Argos (Change Counter je Handkarte) und
// Arthors Bedingung („more than 1 card in their hand") lesen nur,
// sie fassen nichts an. Steht hier, damit niemand sie später
// „nachträgt", weil sie in einer Textsuche auftauchen.
const NOT_HAND_INTERACTION = [
  'Argos, the Eye of the Cosmos',
  'Arthor, the King of Blackport',
];

// Ebenfalls ausgenommen: BOUNCES (Als Ruling 5.8.). Eine Karte, die vom
// BRETT in eine Hand zurueckgeht, ist KEINE Hand-Interaktion im Sinne
// dieser Karte — auch wenn dabei eine Karte auf einer Hand landet.
// Kategorie (f) meint Effekte, deren Zweck es IST, jemandem eine Karte
// in die Hand zu legen (Birthday Present, Magic Lamp, Letter of
// Misinformations), nicht das Zurueckholen von Brettkarten.
// Betroffen und ausdruecklich NICHT anzuschliessen:
const NOT_HAND_INTERACTION_BOUNCE = [
  'Idej Sword - Onima',      // Ability vom Gegnerbrett in dessen Hand
  'Noble Mummy Guards',      // Ability an den urspruenglichen Besitzer
  'Winged Skeleton',         // eigene Creature in die eigene Hand (Eigenkosten)
];

// Ebenfalls ausgenommen: PERMANENTE Handsperren. Der Hook feuert
// bei Aktivierung, ein Dauereffekt aktiviert nichts.
const NOT_HAND_INTERACTION_PERMANENT = [
  'Siege',
  'Boris, the Guardian of Blackport',
  'Knight of Kings [B]',
];

// Diese Engine-Primitiven feuern den Hook zentral. Jede Karte, die
// sie nutzt, ist automatisch abgedeckt — heute wie in Zukunft.
const ENGINE_COVERED = [
  'actionPromptForceDiscard',   // (a)
  'actionStealFromHand',        // (b) + (c) — zeigt die Hand UND nimmt daraus
  'actionTransferCardToOppHand',// (f)
];

/**
 * VORGEMERKT: Karten mit Hand-Interaktion, die noch KEIN Skript
 * haben. Sobald eines existiert, prüft der Audit unten, ob der
 * Hook auch wirklich gefeuert wird.
 *
 * `via` sagt, welcher Weg erwartet wird:
 *   'engine'  — sollte über eine ENGINE_COVERED-Primitive laufen,
 *               dann ist nichts weiter zu tun
 *   'manual'  — baut die Interaktion voraussichtlich selbst,
 *               braucht also einen eigenen Aufruf von
 *               `engine.checkHandInteractionReaction(...)`
 */
const PENDING = [
  { name: 'Assault for Teocuilatl', kind: 'discard', via: 'engine',
    note: 'Gegner muss 2 Karten abwerfen, sonst wird die Creature besiegt.' },
  { name: 'Gather Intel', kind: 'reveal', via: 'manual',
    note: 'Sieht die Hand AN und lässt dann wählen — eigener Ablauf, keine Standard-Primitive.' },
  { name: 'I Found You!', kind: 'discard', via: 'manual',
    note: 'Zufällige Karte aus der Gegnerhand abwerfen — nicht die Wahl-Primitive.' },
  { name: 'Trial of Annoyance', kind: 'discard', via: 'engine',
    note: 'Abwerfen bis nur noch 2 Karten übrig sind.' },
  { name: 'Tryse, the Shadow Slayer', kind: 'discard', via: 'manual',
    note: '2 ZUFÄLLIGE Karten — der Gegner wählt nicht.' },
  { name: 'Liberation', kind: 'reveal', via: 'manual',
    note: 'Hand ansehen, bis zu 3 Creatures daraus abwerfen — reveal UND discard.' },
  { name: 'Looting', kind: 'steal', via: 'engine',
    note: 'Zufällige Karte aus der Gegnerhand auf die eigene Hand.' },
  { name: 'Secret Entrance', kind: 'steal', via: 'engine',
    note: 'Bis zu 1/2/3 zufällige Karten aus der Gegnerhand.' },
  { name: 'Control Monitors', kind: 'discard', via: 'manual',
    note: 'Reaction — prüfen, ob sie selbst überhaupt eine Hand-Interaktion auslöst.' },
  { name: 'Vampire on Fire', kind: 'insert', via: 'manual',
    note: 'Verhindert das Hinzufügen und löscht stattdessen — Grenzfall, bei Umsetzung klären.' },
];

/** Slug wie im _loader (muss identisch bleiben). */
function nameToFile(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Prüflauf beim Serverstart.
 *
 * Meldet jede vorgemerkte Karte, die inzwischen ein Skript hat,
 * dieses Skript aber weder eine abgedeckte Primitive noch
 * `checkHandInteractionReaction` benutzt. Rein diagnostisch —
 * bricht nie etwas ab.
 *
 * @returns {{checked:number, warnings:string[]}}
 */
function auditHandInteraction(effectsDir = __dirname) {
  const warnings = [];
  let checked = 0;

  for (const entry of PENDING) {
    const file = path.join(effectsDir, nameToFile(entry.name) + '.js');
    if (!fs.existsSync(file)) continue;      // noch nicht implementiert — alles gut
    checked++;
    let src = '';
    try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }

    const firesManually = src.includes('checkHandInteractionReaction');
    const usesCovered   = ENGINE_COVERED.some(fn => src.includes(fn));
    if (firesManually || usesCovered) continue;

    warnings.push(
      `[hand-interaction] "${entry.name}" ist inzwischen implementiert ` +
      `(${path.basename(file)}), feuert aber onHandInteraction NICHT. ` +
      `Erwartet: ${entry.via === 'engine' ? 'eine der Primitiven ' + ENGINE_COVERED.join('/') : 'ein eigener checkHandInteractionReaction-Aufruf'}. ` +
      `Kategorie: ${entry.kind}. ${entry.note} ` +
      `→ Ohne das greift "Ambush the Scout" gegen diese Karte nicht. ` +
      `Wenn die Karte doch keine Hand-Interaktion ist, den Eintrag aus ` +
      `PENDING in cards/effects/_hand-interaction-registry.js entfernen.`
    );
  }
  return { checked, warnings };
}

/** Bequemer Aufruf beim Start: schreibt die Warnungen nach stderr. */
function reportHandInteractionAudit(effectsDir) {
  const { checked, warnings } = auditHandInteraction(effectsDir);
  for (const w of warnings) console.warn(w);
  return { checked, warnings };
}

module.exports = {
  HAND_INTERACTION_KINDS,
  NOT_HAND_INTERACTION,
  NOT_HAND_INTERACTION_PERMANENT,
  NOT_HAND_INTERACTION_BOUNCE,
  ENGINE_COVERED,
  PENDING,
  auditHandInteraction,
  reportHandInteractionAudit,
};
