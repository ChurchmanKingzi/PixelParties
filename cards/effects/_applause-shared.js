// ═══════════════════════════════════════════
//  FUN-FUN CIRCUS — Applause Counter (gemeinsame Bausteine)
//
//  Der Applause Counter ist ein reiner Zaehler an einer Creature:
//  `inst.counters.applause` (Zahl). Er stirbt mit der Instanz (verlaesst
//  die Creature das Brett, sind die Zaehler weg — ausser eine Karte
//  nimmt sie vorher mit, Director).
//
//  ── „ON THE BOARD" ─────────────────────────────────────────────────
//  Als Auslegung: BEIDE Brettseiten, alle Creatures in Support Zonen
//  (`boardTotal`). Handkarten zaehlen nicht — auch nicht die Zaehler
//  des Elephant in der Hand.
//
//  ── ZAEHLER AUF DER HAND (Elephant) ────────────────────────────────
//  Handkarten haben keine eigene Instanz-Identitaet, deshalb liegt der
//  Zaehler als Hand-Index-Feld `ps._handApplause[handIdx]` (Engine:
//  `registerHandIndexedField` — folgt der physischen Kopie durch
//  Sortieren/Ziehen/Abwerfen und wandert beim Beschwoeren als
//  `inst.counters.applause` aufs Brett mit).
//  Skripte, die in der Hand mitzaehlen, tragen `collectsApplauseInHand:
//  true`.
//
//  ── PLATZIEREN ─────────────────────────────────────────────────────
//  `placeApplause` ist der EINE Weg, Zaehler auf eine Board-Creature zu
//  legen. Er zaehlt PRO ZAEHLER: legt eine Karte 3 Zaehler auf eine
//  Creature, bekommt jeder Elephant in irgendeiner Hand 3. Auch
//  VERSCHIEBEN (`moveApplause`, Director) zaehlt so (Als Ruling 29.9.:
//  20 verschobene Counter → +20 auf dem Elephant in der Hand).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const KEY = 'applause';
const ARCHETYPE = 'Fun-Fun Circus';

/**
 * Meldet einen GESTIEGENEN Zaehler an beide Clients (Klang + Aufleuchten
 * des Abzeichens, Als Vorgabe 29.9.: bei JEDEM steigenden Applause Counter).
 * Ziel: Brett `{owner, heroIdx, zoneSlot}` oder Hand `{owner, handIdx}`.
 */
function meldeGewinn(engine, ziel) {
  try { engine._broadcastEvent('applause_gain', ziel); } catch { /* Anzeige darf nie stoeren */ }
}

/**
 * Mitsammelnde Handkarten (Elephant, `collectsApplauseInHand`) beider
 * Spieler: PRO Counter, der auf eine Board-Creature kommt, einer. Solange
 * die Karte in der Hand liegt, ist sie aufgedeckt (Kartentext).
 */
function sammelnInDerHand(engine, n) {
  for (let pi = 0; pi < engine.gs.players.length; pi++) {
    const ps = engine.gs.players[pi];
    (ps.hand || []).forEach((name, idx) => {
      if (!loadCardEffect(name)?.collectsApplauseInHand) return;
      if (!ps._handApplause) ps._handApplause = {};
      ps._handApplause[idx] = (ps._handApplause[idx] || 0) + n;
      if (!ps._permanentlyRevealedHandIndices) ps._permanentlyRevealedHandIndices = {};
      ps._permanentlyRevealedHandIndices[idx] = true;
      meldeGewinn(engine, { kind: 'hand', owner: pi, handIdx: idx, amount: n });
    });
  }
}

/** Ist das eine Creature in einer Support Zone (kein Verdeckter)? */
function istBrettCreature(engine, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
  return !!cd && hasCardType(cd, 'Creature');
}

function zaehler(inst) { return Math.max(0, inst?.counters?.[KEY] || 0); }

/** Alle Applause Counter auf dem Brett (beide Seiten). */
function boardTotal(engine) {
  let sum = 0;
  for (const inst of engine.cardInstances) {
    if (istBrettCreature(engine, inst)) sum += zaehler(inst);
  }
  return sum;
}

/** Gehoert die Karte (Name) zum Archetyp „Fun-Fun Circus"? */
function istCircus(engine, name) {
  return engine._getCardDB()[name]?.archetype === ARCHETYPE;
}

/** Fun-Fun-Circus-Creatures auf dem Brett (beide Seiten), optional ohne `ausser`. */
function circusCreatures(engine, ausser = null) {
  return engine.cardInstances.filter(i =>
    i !== ausser && istBrettCreature(engine, i) && istCircus(engine, i.name));
}

/**
 * Legt `n` Applause Counter auf `inst` — pro Zaehler zaehlen die
 * mitsammelnden Handkarten (Elephant) mit. Rueckgabe: tatsaechlich
 * platzierte Anzahl.
 */
async function placeApplause(engine, inst, n, opts = {}) {
  n = Math.floor(n);
  if (!istBrettCreature(engine, inst) || n <= 0) return 0;
  if (!inst.counters) inst.counters = {};
  inst.counters[KEY] = zaehler(inst) + n;

  meldeGewinn(engine, { kind: 'board', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, amount: n });

  sammelnInDerHand(engine, n);

  engine.log('applause_placed', {
    card: inst.name, amount: n, total: inst.counters[KEY],
    source: opts.source || null,
  });
  engine.sync();
  return n;
}

/** Nimmt bis zu `n` Zaehler von `inst` weg; Rueckgabe: wirklich entfernt. */
function removeApplause(engine, inst, n) {
  const weg = Math.min(zaehler(inst), Math.max(0, Math.floor(n)));
  if (weg <= 0) return 0;
  inst.counters[KEY] = zaehler(inst) - weg;
  if (inst.counters[KEY] <= 0) delete inst.counters[KEY];
  engine.sync();
  return weg;
}

/** Verschiebt ALLE Zaehler von `von` auf `nach` (zaehlt fuer mitsammelnde Handkarten wie Platzieren). */
function moveApplause(engine, von, nach) {
  const n = zaehler(von);
  if (n <= 0 || !nach) return 0;
  if (!nach.counters) nach.counters = {};
  nach.counters[KEY] = zaehler(nach) + n;
  if (von.counters) delete von.counters[KEY];
  meldeGewinn(engine, { kind: 'board', owner: engine.physicalSide(nach), heroIdx: nach.heroIdx, zoneSlot: nach.zoneSlot, amount: n });
  // Als Ruling 29.9. (Director → Elephant): Counter, die auf eine Creature
  // VERSCHOBEN werden, zaehlen fuer den Elephant in der Hand wie platzierte.
  sammelnInDerHand(engine, n);
  engine.sync();
  return n;
}

module.exports = {
  KEY, ARCHETYPE,
  istBrettCreature, zaehler, boardTotal, istCircus, circusCreatures,
  placeApplause, removeApplause, moveApplause,
};
