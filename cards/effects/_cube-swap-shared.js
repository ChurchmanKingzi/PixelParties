'use strict';
// ═══════════════════════════════════════════
//  Cube-Draft-Deckbau: Kartentausch (Cuberto, Supreme Lord of Edges) — gemeinsame Regeln für Server (`validateDraftedDeck`) und Test.
//  Das Skript der Heldenkarte trägt das Kennzeichen `cubeDraftSwap: { max, verschiedeneNamen }` (`cards/effects/cuberto-supreme-lord-of-edges.js`).
// ═══════════════════════════════════════════
const { loadCardEffect } = require('./_loader');

/** Wie viele Karten dürfen die Starthelden dieses Decks tauschen? 0 = keine. (Höchstwert über alle Starthelden.) */
function tauschMax(heroes) {
  let max = 0;
  for (const h of (heroes || [])) {
    const name = h && (h.hero || h.name);
    if (!name) continue;
    const f = loadCardEffect(name)?.cubeDraftSwap;
    if (f && f.max > max) max = f.max;
  }
  return max;
}

/** Heldenkarten mit Tauschfähigkeit (Name → max), z. B. für die Oberfläche. */
function tauschHelden(namen, cardDB) {
  const out = {};
  for (const n of (namen || [])) {
    if (cardDB?.[n]?.cardType !== 'Hero') continue;
    const f = loadCardEffect(n)?.cubeDraftSwap;
    if (f) out[n] = f.max;
  }
  return out;
}

/**
 * Prüft den Tauschplan eines eingereichten Decks. `swaps` = [{ from, to }]. Rückgabe { ok, reason, swaps } — `swaps` ist leer, wenn nichts getauscht wird.
 * Ohne tauschfähigen Starthelden im Deck sind Tausche ungültig (die Oberfläche streicht sie, der Server lässt sie nicht durch).
 */
function pruefeTausch(deck, poolCounts, cardDB) {
  const swaps = Array.isArray(deck?.cubertoSwaps) ? deck.cubertoSwaps : [];
  if (swaps.length === 0) return { ok: true, swaps: [] };
  const max = tauschMax(deck.heroes);
  if (max <= 0) return { ok: false, reason: 'Card swaps need a Starting Hero that allows them (Cuberto, Supreme Lord of Edges)' };
  if (swaps.length > max) return { ok: false, reason: `At most ${max} cards may be swapped (you swapped ${swaps.length})` };
  const nach = new Set();
  const rest = { ...poolCounts };
  for (const s of swaps) {
    const von = s?.from, zu = s?.to;
    if (typeof von !== 'string' || typeof zu !== 'string') return { ok: false, reason: 'Invalid card swap' };
    if (von === zu) return { ok: false, reason: `"${von}" cannot be swapped for itself` };
    const cf = cardDB[von], ct = cardDB[zu];
    if (!cf || !ct) return { ok: false, reason: `Unknown card in swap ("${!cf ? von : zu}")` };
    if (cf.cardType === 'Hero' || ct.cardType === 'Hero') return { ok: false, reason: 'Heroes cannot be swapped' };
    if (ct.cardType === 'Token') return { ok: false, reason: `"${zu}" cannot be swapped in` };
    if (nach.has(zu)) return { ok: false, reason: `The cards you swap in must have different names ("${zu}" twice)` };
    nach.add(zu);
    if ((rest[von] || 0) <= 0) return { ok: false, reason: `"${von}" is not in your drafted pool` };
    rest[von]--;
  }
  return { ok: true, swaps: swaps.map(s => ({ from: s.from, to: s.to })) };
}

/** Pool-Zähler nach den Tauschen (`from` −1, `to` +1). */
function poolNachTausch(poolCounts, swaps) {
  const c = { ...poolCounts };
  for (const s of (swaps || [])) { c[s.from] = (c[s.from] || 0) - 1; c[s.to] = (c[s.to] || 0) + 1; }
  return c;
}

module.exports = { tauschMax, tauschHelden, pruefeTausch, poolNachTausch };
