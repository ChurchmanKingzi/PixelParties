'use strict';
// W4-I1 · Tharxian Horse („You can only play 1 "Tharxian Horse" per game") — Al, Welle 3/4: "Darf gesetzt, aber nie aktiviert werden." Das Setzen ist immer erlaubt (beliebig viele
//   Kopien, auch an mehreren Helden, auch NACH der ersten Aktivierung); die Aktivierung ist einmalig pro Spiel: nach der ersten (nicht negierten) Aktivierung löst KEINE Kopie mehr aus
//   (weder eine schon liegende noch eine später gesetzte), alle bleiben verdeckt liegen.
// Aufbau: Sitz 1 hat je ein verdecktes Horse an Held 0 und Held 1 (Magic Arts 3); Sitz 0 spielt drei Fireballs.
// Erwartung: (a) 1. Fireball (Held 0) wird negiert, Grenze verbraucht; (b) 2. Fireball (Held 1): das zweite Horse löst nicht mehr aus, bleibt verdeckt;
//   (c) nach der Aktivierung darf ein weiteres Horse aus der Hand gesetzt werden (Setzen akzeptiert, Karte liegt verdeckt) und löst bei einem 3. Fireball NICHT aus.
// Aufruf: node docs/niche-tests/repro/W4-kosten/I1-tharxian-horse-nie-mehr-aktivierbar.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'Fireball'], ['Tharxian Horse']] });
  t.putSurprise(1, 0, 'Tharxian Horse'); t.grantFor(1, 0, 'Tharxian Horse');
  t.putSurprise(1, 1, 'Tharxian Horse'); t.grantFor(1, 1, 'Tharxian Horse');
  t.policy.confirm = true;
  const ziel = (hi) => (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === hi).id];
  const angeboten = (p0) => t.prompts.slice(p0).some(p => /Tharxian Horse/.test(JSON.stringify(p.d)));
  const horseAn = (hi) => (t.gs.players[1].surpriseZones[hi] || []).filter(n => n === 'Tharxian Horse').length;

  t.targetFn = ziel(0);
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('(a) 1. Fireball vom Horse negiert (Held 0 unversehrt)', t.hp(1, 0) === 800, t.hp(1, 0));
  R.check('(a) die Aktivierung hat die Grenze verbraucht', !!t.gs.players[1]._oncePerGameUsed?.has('Tharxian Horse'), [...(t.gs.players[1]._oncePerGameUsed || [])]);

  t.reset();
  t.targetFn = ziel(1);
  let p0 = t.prompts.length;
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('(b) das zweite Horse wird nicht mehr angeboten, der Fireball trifft Held 1', !angeboten(p0) && t.hp(1, 1) === 650, { hp: t.hp(1, 1), angeboten: angeboten(p0) });
  R.check('(b) die zweite Kopie bleibt verdeckt liegen', horseAn(1) === 1, t.gs.players[1].surpriseZones[1]);

  // (c) Setzen nach der Aktivierung: Sitz 1 ist am Zug und setzt das Horse aus der Hand
  await t.endTurn();
  t.reset();
  const r = await t.play(1, 'Tharxian Horse', { hero: 0, phase: 2 });
  R.check('(c) ein weiteres Horse darf nach der Aktivierung gesetzt werden (verdeckt, Held 0)', r === true && horseAn(0) === 1 && !t.pile(1, 'hand').includes('Tharxian Horse'), { r, zone0: t.gs.players[1].surpriseZones[0], hand: t.pile(1, 'hand') });
  await t.endTurn();
  t.reset();
  t.targetFn = ziel(0);
  p0 = t.prompts.length;
  const hpVor = t.hp(1, 0);
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('(c) das später gesetzte Horse löst nie aus: nicht angeboten, Fireball trifft Held 0 (−150)', !angeboten(p0) && t.hp(1, 0) === hpVor - 150, { hp: t.hp(1, 0), vor: hpVor, angeboten: angeboten(p0) });
  R.check('(c) beide Kopien liegen weiter verdeckt', horseAn(0) === 1 && horseAn(1) === 1, t.gs.players[1].surpriseZones);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})();
