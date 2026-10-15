'use strict';
// W10b · Q33 (A05-18) · Raise the Minions! beendet den Zug NICHT mehr
//
// Kartentext: „Choose up to 3 "Skeleton" Creatures from your discard pile and place them into free Support Zones of the user." – keine Zugende-Klausel.
// ENTSCHIEDEN (Al, Welle 10, Q33): „Zeile entfernen" → das Skript setzt `gs._spellEndsTurn` nicht mehr.
// Geprüft: (a) Skelett wird gelegt; (b) der Wirker bleibt am Zug (Zugnummer/aktiver Spieler unverändert); (c) `_spellEndsTurn` ist nicht gesetzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Raise the Minions!'], []], discard: [['Skeleton Archer'], []] });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: ['Skeleton Archer'] }) });
  const turn0 = t.gs.turn;
  await t.play(0, 'Raise the Minions!', { hero: 0 });
  R.check('(a) Skelett wurde gelegt', t.gs.players[0].supportZones[0].some(z => z[0] === 'Skeleton Archer'), t.gs.players[0].supportZones[0]);
  R.check('(b) der Zug des Wirkers endet nicht', t.gs.activePlayer === 0 && t.gs.turn === turn0, { turn: t.gs.turn, aktiv: t.gs.activePlayer });
  R.check('(c) `_spellEndsTurn` nicht gesetzt', !t.gs._spellEndsTurn, t.gs._spellEndsTurn);
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
