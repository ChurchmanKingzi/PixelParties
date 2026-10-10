'use strict';
// ═══════════════════════════════════════════
//  GETEILT: „RACE BOAT"-AUSRUESTUNGEN
//  (Crocodile, Frog, Snake, Whale Race Boat — und jedes kuenftige Boot)
//
//  Alle vier tragen dieselbe erste Zeile: „A Hero can only have 1 "Race
//  Boat" Artifact equipped to it." — und alle vier rechnen mit derselben
//  Zahl: den CREATURES IN DEN SUPPORT ZONES DES AUSGERUESTETEN HELDEN.
//  Beides steht deshalb EINMAL hier.
//
//  ── Die Zahl (Als Vorgabe 10.10.) ───────────────────────────────────
//  Gezaehlt werden ALLE Creatures in den Support Zones des Helden, auch
//  die in den Bonus-Zonen von „Flying Island in the Sky" (Slots 3+; sie
//  liegen als weitere Eintraege im Zonen-Array des Helden). Gezaehlt wird
//  nach dem PHYSISCHEN Ort (Held + Seite), nicht nach dem Besitzer: eine
//  Creature, die ein Gegner bei meinem Helden abgelegt hat, steht in
//  seinen Support Zones. Nicht gezaehlt werden Ausruestungen (die Boote
//  selbst), verdeckte Surprises und Kreaturen mit `treatAsEquip`. Eine
//  Mehrzonen-Kreatur (Populated Island Turtle) ist EINE Instanz, zaehlt also
//  einmal; geteilte Zonen (Alice) zaehlen jede Kreatur.
//
//  ── „Only 1 Race Boat" ───────────────────────────────────────────────
//  `canEquipToHero` — der Vertrag der Engine (`canEquipCardToHero`,
//  Hand-Weg UND effektgetriebenes Ausruesten). Ein Boot ist ein ARTIFACT
//  mit dem Namensende „Race Boat"; „Race Boat Captain" ist eine Creature und
//  zaehlt nicht.
//
//  ── Der Traeger ──────────────────────────────────────────────────────
//  `traeger(ctx)` loest die Instanz eines Bootes in ihren Helden auf:
//  Brettseite (`seite`), Index, Held und Kontrolleur („you"). Das ist die
//  Frage, an der alle vier Boote anfangen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const BOOT_NAME = /\bRace Boat$/;

/** Ist `name` ein Race-Boat-Artifact? (Namensende; „Race Boat Captain" ist keins.) */
function istRaceBoat(name) {
  return typeof name === 'string' && BOOT_NAME.test(name);
}

/**
 * Traegt der Held (`seite`, `heroIdx`) schon ein Race Boat? `ausser` = Instanz-Id, die nicht mitzaehlt
 * (die Pruefung eines schon liegenden Bootes gegen sich selbst).
 */
function heroHasRaceBoat(engine, seite, heroIdx, ausser = null) {
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.heroIdx !== heroIdx) continue;
    if (ausser != null && inst.id === ausser) continue;
    if (!istRaceBoat(inst.name)) continue;
    if (engine.physicalSide(inst) !== seite) continue;
    return true;
  }
  return false;
}

/** Vertrag `canEquipToHero(gs, pi, heroIdx, engine)`: hoechstens ein Race Boat je Held. */
function canEquipToHero(gs, pi, heroIdx, engine) {
  const eng = engine || gs?._engineRef;
  if (eng) return !heroHasRaceBoat(eng, pi, heroIdx);
  // Ohne Engine (alter Aufrufer): die Namen in den Zonen lesen.
  const slots = gs?.players?.[pi]?.supportZones?.[heroIdx] || [];
  return !slots.some(s => (Array.isArray(s) ? s : [s]).some(istRaceBoat));
}

/**
 * Wie viele Creatures stehen in den Support Zones dieses Helden? (Siehe Kopf: auch Bonus-Zonen.)
 */
function kreaturenAmHeld(engine, seite, heroIdx) {
  const db = engine._getCardDB();
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.heroIdx !== heroIdx) continue;
    if (inst.faceDown) continue;
    if (inst.counters?.treatAsEquip) continue;
    if (engine.physicalSide(inst) !== seite) continue;
    const cd = engine.getEffectiveCardData(inst) || db[inst.name];
    if (cd && hasCardType(cd, 'Creature')) n++;
  }
  return n;
}

/**
 * Das Boot dieses Hook-Kontexts als {inst, seite, heroIdx, hero, kontrolleur}; `null`, solange es nicht
 * wirklich an einem lebenden Helden haengt.
 *   seite       Brettseite des ausgeruesteten Helden
 *   kontrolleur wer das Boot benutzt („you") — bei einem uebernommenen Helden der Uebernehmer
 */
function traeger(ctx) {
  const inst = ctx?.card;
  if (!inst || inst.zone !== 'support' || inst.heroIdx == null || inst.heroIdx < 0) return null;
  const engine = ctx._engine;
  const seite = engine.physicalSide(inst);
  const hero = engine.gs.players[seite]?.heroes?.[inst.heroIdx];
  if (!hero?.name) return null;
  return { inst, seite, heroIdx: inst.heroIdx, hero, kontrolleur: ctx.cardController ?? ctx.cardOwner ?? inst.controller ?? inst.owner };
}

/**
 * Stammt dieser Schaden DIREKT vom ausgeruesteten Helden? (Attack, Spell, Effekt — „in any way".)
 * Nicht: Status-Ticks (Burn/Poison tragen keinen Besitzer und keinen Heldenindex) und nicht der Schaden
 * einer Creature in seinen Zonen (Quelle mit `zone: 'support'`, oder Schadenstyp 'creature').
 * Dieselbe Auslegung wie bei „defeats a target" (Als Ruling Waflav, `_waflav-shared`).
 */
function schadenKommtVomTraeger(engine, t, source, type) {
  if (!source || typeof source !== 'object') return false;
  if (type === 'creature') return false;
  if (source.zone === 'support') return false;
  return engine.quelleIstHeld(source, t.seite, t.heroIdx);
}

/** Laeuft gerade ein Schlag auf MEHRERE Ziele (Flaechenklammer mit 2+ Zielen)? Dann ist es kein Einzelziel. */
function inFlaechenschlag(engine) {
  return (engine._multiHitScope?.total || 0) >= 2;
}

module.exports = {
  istRaceBoat, heroHasRaceBoat, canEquipToHero, kreaturenAmHeld, traeger,
  schadenKommtVomTraeger, inFlaechenschlag,
};
