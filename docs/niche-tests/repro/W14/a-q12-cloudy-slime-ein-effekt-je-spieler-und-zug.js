'use strict';
// W14a · Rückfrage 12 (Welle 13 / W13c; Bishop of Kings, Cloudy Slime, Exploding Skull) · Al, 16.10.2026: „Ja, das ist gewollt. Nur ein Cloudy Slime pro Spieler pro Runde."
//   Ist-Zustand bestätigt, Absicherung. Kartentext Cloudy Slime: „When you summon this Creature, you may immediately place a level 0 Creature from your hand … You can only
//   activate this effect once per turn." → spielerweit EIN Einsatz je Zug, egal wie viele Cloudy Slimes (Kopien) beschworen werden.
// Erwartet: der 1. Cloudy Slime des Zuges platziert die Lv-0-Kreatur; der 2. (zweite Kopie, gleicher Zug) tut nichts (keine Abfrage, kein zweiter Platzierer, Hand bleibt);
//   im nächsten eigenen Zug ist der Effekt wieder frei. Exploding Skull: zweiter Tod im selben Zug löst nicht noch einmal aus (dieselbe Regel).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SLIME = 'Cloudy Slime';
  const D = H.INERT.creature;
  const t = await H.fresh({ hand: [[SLIME, SLIME, D, D, D], []] });
  t.policy.confirm = true;
  let zone = 0;
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === SLIME, answer: () => ({ cardName: D }) });
  t.script.push({ match: d => d && d.type === 'zonePick' && d.title === SLIME, answer: () => ({ heroIdx: 2, slotIdx: zone++ % 3 }) });
  const imBrett = () => t.inst(x => x.zone === 'support' && x.owner === 0 && x.name === D).length;

  const r1 = await t.play(0, SLIME, { hero: 0, slot: 0 });
  const nach1 = imBrett();
  R.check('1. Cloudy Slime beschworen, platziert eine Lv-0-Kreatur', r1 === true && nach1 === 1, { r1, dummies: nach1 });
  const handNach1 = t.pile(0, 'hand').length;
  const r2 = await t.play(0, SLIME, { hero: 0, slot: 2, keepActions: false });
  R.check('2. Cloudy Slime beschworen (Zusatz-Kopie)', r2 === true, r2);
  R.check('… platziert KEINE weitere Kreatur (ein Cloudy-Slime-Effekt je Spieler und Zug)', imBrett() === 1, { dummies: imBrett(), hand: t.pile(0, 'hand') });
  R.check('Hand verliert nur den Slime (kein zweiter Platzierer)', t.pile(0, 'hand').length === handNach1 - 1, { vorher: handNach1, nachher: t.pile(0, 'hand').length });
  R.check('Stempel nur für Sitz 0', t.gs.hoptUsed?.[`cloudy-slime-summon:0`] === t.gs.turn && t.gs.hoptUsed?.[`cloudy-slime-summon:1`] == null, t.gs.hoptUsed);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  await t.endTurn(); await t.endTurn();
  t.addHead = null;
  t.setHand(0, [SLIME, D, D]);
  const vor = imBrett();
  await t.play(0, SLIME, { hero: 1, slot: 0 });
  R.check('im nächsten eigenen Zug ist der Effekt wieder frei (Platzierung)', imBrett() === vor + 1, { vor, nach: imBrett() });
  R.check('keine Engine-Fehler (2)', t.errors.length === 0, t.errors);

  // Exploding Skull: zweiter Tod im selben Zug, der Effekt feuert nur einmal je Spieler und Zug
  {
    const u = await H.fresh({ hand: [[], []] });
    u.put(0, 0, 0, 'Exploding Skull'); u.put(0, 0, 1, 'Exploding Skull');
    const hp0 = u.hp(1, 0);
    for (const slot of [0, 1]) { const inst = u.zone(0, 0, slot) && u.inst(x => x.zone === 'support' && x.owner === 0 && x.zoneSlot === slot)[0]; if (inst) await u.run(() => u.engine.actionDestroyCard({ name: 'ZZ', owner: 1, heroIdx: 0 }, inst, { source: 'ZZ' })); }
    R.check('Exploding Skull: zwei Tode im selben Zug lösen nur EINMAL 80 Schaden aus', hp0 - u.hp(1, 0) === 80, { schaden: hp0 - u.hp(1, 0) });
    R.check('Exploding Skull: keine Engine-Fehler', u.errors.length === 0, u.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
