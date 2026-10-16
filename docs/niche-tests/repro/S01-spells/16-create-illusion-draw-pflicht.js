'use strict';
// S01-16 · Create Illusion: „your opponent MAY draw …" wird als Pflicht ausgeführt (Deck-Out-Niederlage des Gegners)
// Kartentext: „At the end of your opponent's next turn, shuffle the Creature from your Support Zone back into your deck, and if you do, your opponent may draw as many cards as the Creature's level."
// Aufbau: Sitz 0 legt eine Level-1-Illusion (Elven Archer); Sitz 1 hat zu Beginn seines Zuges noch 2 Deckkarten, zieht 1, danach leeren wir sein Deck (genau die Lage „1 Ziehen mehr = Deck-Out").
// Erwartet: Der Gegner darf ziehen – er kann verzichten (Lesart „may"), das Spiel endet nicht durch die Illusion.
// Beobachtet: `_illusionenZurueck` (_engine.js ~Z. 26836) ruft `actionDrawCards(entry.opponent, entry.oppDrawCount)` ohne Frage auf; der Gegner verliert durch Deck-Out (winnerIdx 0).
// ★ W14 (Q162, Al: „Ja, soll er ablehnen können"): NEUE Regel – der Gegner wird gefragt (Ja/Nein) und lehnt hier ab (`answer: () => null` = echtes „Nein"); dann kein Deck-Out, keine Karte gezogen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const C = 'Elven Archer';
  const t = await H.fresh({ hand: [['Create Illusion'], []], deck: [[C, 'Fireball', 'Fireball'], ['ZZ Dummy', 'ZZ Dummy']], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Create Illusion', answer: () => ({ cardName: C }) });
  let gefragt = false;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Create Illusion', answer: () => { gefragt = true; return null; } });
  await t.play(0, 'Create Illusion', { hero: 0, noGrant: true });
  await t.endTurn();                                  // Gegnerzug beginnt (zieht 1)
  t.gs.players[1].mainDeck.length = 0;                // Deck des Gegners leer
  await t.endTurn();                                  // Ende des Gegnerzugs: Illusion geht zurück, Gegner „darf" ziehen
  R.check('der Gegner wird gefragt, ob er ziehen will', gefragt, t.prompts.map(p => p.d.title));
  R.check('das Spiel endet nicht durch die „may"-Karte des Gegners (kein Deck-Out)', !(t.engine.over && t.engine.over.called), t.engine.over);   // W14: engine.over ist immer ein Objekt (called = Spielende)
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
