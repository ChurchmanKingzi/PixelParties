'use strict';
// S01-02 · Negiertes Big Oopsie / Butterfly Cloud zählt nicht gegen „1 pro Zug" bzw. „nicht in 2 aufeinanderfolgenden Zügen"
// Kartentexte: Big Oopsie: „You can only play 1 "Big Oopsie" per turn."  Butterfly Cloud: „You cannot play "Butterfly Cloud" on 2 consecutive turns."
// Skript-Kommentare: Big Oopsie stempelt den HOPT „sobald der Effekt wirklich läuft" (claimHOPT im onPlay, CARD_API „BIG OOPSIE"); Butterfly Cloud setzt das
//   Flag `_butterflyCloudUsedThisTurn` erst am Ende von onPlay. Wird der Zauber negiert (Silence), läuft onPlay nie → kein Stempel.
// Erwartet (Lesart „gespielt = gezählt"): nach einem negierten Big Oopsie ist ein zweites im selben Zug nicht spielbar; nach einer negierten Butterfly Cloud
//   ist sie im nächsten eigenen Zug gesperrt.
// Beobachtet: zweites Big Oopsie wird gespielt und trifft; Butterfly Cloud ist im nächsten eigenen Zug wieder spielbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // ── Big Oopsie ──
  let t = await H.fresh({ hand: [['Big Oopsie', 'Big Oopsie'], ['Silence']] });
  t.grantFor(1, 0, 'Silence');
  t.policy.confirm = true;
  await t.play(0, 'Big Oopsie', { hero: 0 });
  R.check('(Big Oopsie) erstes wurde negiert: keine Gegner-HP verloren, Silence verbraucht', t.gs.players[1].heroes.every(h => h.hp === 800) && !t.pile(1, 'hand').includes('Silence'));
  t.policy.confirm = false;
  const r2 = await t.play(0, 'Big Oopsie', { hero: 0 });
  const getroffen = t.gs.players[1].heroes.some(h => h.hp < 800);
  R.check('(Big Oopsie) zweites im selben Zug ist nicht spielbar („only 1 per turn")', r2 === false && !getroffen, { r2, hp1: t.gs.players[1].heroes.map(h => h.hp) });
  // ── Butterfly Cloud ──
  t = await H.fresh({ hand: [['Butterfly Cloud', 'Butterfly Cloud'], ['Silence']] });
  t.grantFor(1, 0, 'Silence');
  t.policy.confirm = true;
  await t.play(0, 'Butterfly Cloud', { hero: 0 });
  R.check('(Butterfly Cloud) erste wurde negiert: keine Gegner-HP verloren', t.gs.players[1].heroes.every(h => h.hp === 800));
  t.policy.confirm = false;
  await t.endTurn(); await t.endTurn();               // Gegnerzug, dann wieder Sitz 0 (nächster eigener Zug)
  const r3 = await t.play(0, 'Butterfly Cloud', { hero: 0 });
  R.check('(Butterfly Cloud) im nächsten eigenen Zug nach negierter Butterfly Cloud gesperrt', r3 === false, { r3, hp1: t.gs.players[1].heroes.map(h => h.hp), turn: t.gs.turn });
  R.finish();
})();
