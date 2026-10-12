'use strict';
// A06-rebelliokai-10 · Camouflaged Kappa opfert sich unter der Knight-[B]-Sperre, die Suche scheitert → reiner Verlust
// Kartentexte: Camouflaged Kappa: „You may once per turn sacrifice this Creature you control to search your deck for a card, reveal
//   it, add it to your hand and immediately discard it afterwards." · Knight of Kings [B]: siehe Befund 08.
// Beobachtung: `canActivateCreatureEffect` (rebelliokai-camouflaged-kappa.js) prüft Deck gefüllt + Handsperre, nicht `pileOutAllowed`.
//   Kappa wird geopfert (landet in der Ablage), die Suche liefert `pile_out_blocked`, es kommt nichts auf die Hand.
//   Vergleich: Bishop of Kings [W] und Pawn Sacrifice prüfen die Sperre vorab und bieten nichts an; Loyal Rottweiler verpufft bewusst mit
//   sichtbarem Fizzle `deck_locked` (v1360).
// Frage (Stufe C): Soll der Effekt unter der Sperre gar nicht aktivierbar sein (Opfer bleibt erspart) oder verpuffen?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({ deck: [['Fireball', ...Array(10).fill(D)], []] });
  t.putArea(1, 'Board of Kings'); t.put(1, 0, 0, 'Knight of Kings [B]'); t.put(1, 0, 1, 'Rook of Kings [B]');
  const k = t.put(0, 0, 0, 'Rebelliokai Camouflaged Kappa'); k.turnPlayed = t.gs.turn - 1;
  t.gs.currentPhase = 2; t.resetActions(0);
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fireball' }) });
  await t.activateCreature(0, 0, 0);
  R.check('Unter der Sperre wird Kappa NICHT geopfert, solange die Suche nicht möglich ist', t.zone(0, 0, 0) === 'Rebelliokai Camouflaged Kappa',
    { slot: t.zone(0, 0, 0), discard: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
