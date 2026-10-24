'use strict';
// ═══════════════════════════════════════════
//  SHARED: ZUSATZNAMEN (W73c, Shroomasaur)
//
//  „… give this Creature the name of any other card IN ADDITION to its own name for the rest of the turn."
//  Der Zusatzname hängt an der Instanz (`counters._zusatzName`); die Engine räumt ihn zu Beginn des nächsten Zuges ab. Wo ein Skript fragt „heißt diese Karte X?" — und X NICHT die Karte
//  selbst ist (eine ANDERE Karte zählt, sucht oder beschränkt Karten dieses Namens: Damus/Armageddon zählen „Ifrit", „You can only control 1 X" …) —, fragt es hier statt `inst.name === X`.
//  NICHT hierher gehören Stellen, an denen der Name nur die IDENTITÄT einer Karte mit eigener Wirkung bedeutet (das Skript der Karte selbst, Engine-Funde „die gerade gespielte Instanz"):
//  der Zusatzname gibt keine Wirkung, nur den Namen.
// ═══════════════════════════════════════════

/** Trägt die Instanz (oder ein Objekt mit `name`/`counters`) den Namen `name` — eigenen ODER Zusatznamen? */
function hatName(inst, name) {
  if (!inst) return false;
  return inst.name === name || inst.counters?._zusatzName === name;
}

/** Trägt sie irgendeinen Namen aus `sammlung` (Set oder Array)? */
function hatNameIn(inst, sammlung) {
  if (!inst || !sammlung) return false;
  const hat = typeof sammlung.has === 'function' ? (n) => sammlung.has(n) : (n) => sammlung.includes(n);
  return hat(inst.name) || (!!inst.counters?._zusatzName && hat(inst.counters._zusatzName));
}

/** Alle Namen der Instanz, die in `sammlung` stehen (für „verschiedene Namen zählen"). */
function namenIn(inst, sammlung) {
  if (!inst || !sammlung) return [];
  const hat = typeof sammlung.has === 'function' ? (n) => sammlung.has(n) : (n) => sammlung.includes(n);
  const out = [];
  if (hat(inst.name)) out.push(inst.name);
  const z = inst.counters?._zusatzName;
  if (z && z !== inst.name && hat(z)) out.push(z);
  return out;
}

/** Der Zusatzname einer Instanz — oder eines Ereignis-Datensatzes (Tod/Eintritt tragen `zusatzName`), sonst `null`. */
function zusatz(x) {
  if (!x) return null;
  return x.counters?._zusatzName || x.zusatzName || null;
}

/**
 * Namensfamilien („X of Kings", Spider, Loyal …): trifft `fn(name)` auf den eigenen Namen ODER den Zusatznamen der Instanz zu?
 * `fn` bekommt je einen Namen (String); `x` darf eine Instanz oder ein Datensatz mit `name` sein.
 */
function anyName(x, fn) {
  if (!x) return false;
  if (x.name != null && fn(x.name)) return true;
  const z = zusatz(x);
  return !!z && z !== x.name && !!fn(z);
}

module.exports = { hatName, hatNameIn, namenIn, zusatz, anyName };
