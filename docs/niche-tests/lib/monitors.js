'use strict';
// W72a — gemeinsame Hilfen der Control-Monitors-Repros (Szene, Fenster/Preis-Fragen, Zustandsvergleich).
const H = require('./h.js');
const F = H.INERT.filler;
const MC = 'Control Monitors';

/** Fragen an den Monitors-Besitzer: Bestaetigung („Activate?"), Preiswahl (handPick), Wahl des Hinzufuegenden (optionPicker). */
const fenster = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === MC && !p.sim);
const preisWahl = (t) => t.prompts.filter(p => p.d.type === 'handPick' && p.d.title === MC && !p.sim);
const wahlHinzufuegender = (t) => t.prompts.filter(p => p.d.type === 'optionPicker' && p.d.title === MC && !p.sim);

/**
 * Szene: Sitz M haelt Control Monitors (+ Held, der die Karte wirken kann), Sitz A = 1 − M ist am Zug und spielt die Karte.
 * o: { handM, handA, deckA, discardA, keinHeld, abilitiesA, heroesA }
 */
async function szene(M, o = {}) {
  const A = 1 - M;
  const hand = [[], []]; hand[M] = o.handM || [MC, F, 'Fireball']; hand[A] = o.handA || [F];
  const deck = [[], []]; deck[A] = o.deckA || ['Fireball', F, F, F]; deck[M] = [F, F, F];
  const discard = [[], []]; discard[A] = o.discardA || [];
  const t = await H.fresh({ active: A, hand, deck, discard, gold: [300, 300], ...(o.abilitiesA ? { abilities: { [A]: o.abilitiesA } } : {}) });
  if (!o.keinHeld) t.grantFor(M, 0, MC);
  t.M = M; t.A = A;
  return t;
}

/** Kompakter Schnappschuss beider Sitze: Hand/Deck/Ablage/Geloescht/Gold — fuer „nichts hat sich veraendert". */
function zustand(t) {
  return JSON.stringify(t.gs.players.map(p => ({ h: p.hand, d: p.mainDeck, a: p.discardPile, g: p.deletedPile, gold: p.gold, pd: p.potionDeck })));
}

module.exports = { H, F, MC, fenster, preisWahl, wahlHinzufuegender, szene, zustand };
