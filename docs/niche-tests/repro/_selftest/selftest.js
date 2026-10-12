'use strict';
// Selbsttest der Harness (Beispiel für Repro-Skripte): Fireball trifft, Abbruch lässt alles unverändert, Surprise löst aus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({ hand: [['Fireball'], []] });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  R.check('Fireball gespielt', (await t.play(0, 'Fireball', { hero: 0 })) === true);
  R.check('Gegner-Held 0 verliert 150 HP', t.hp(1, 0) === 650, t.hp(1, 0));
  R.check('keine Engine-Fehler, sauberer Zustand', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  t = await H.fresh({ hand: [['Fireball'], []] });
  t.policy.cancelTargets = true;
  const gold = t.gs.players[0].gold;
  const r = await t.play(0, 'Fireball', { hero: 0 });
  R.check('Abbruch: Karte bleibt auf der Hand, Gold/Aktion/HP unverändert (play() liefert trotzdem true = „behandelt“)', t.pile(0, 'hand').includes('Fireball') && t.gs.players[0].gold === gold && t.hp(1, 0) === 800 && !t.pile(0, 'discardPile').includes('Fireball'), { r, hand: t.pile(0, 'hand') });

  t = await H.fresh({});
  t.putSurprise(1, 0, 'Booby Trap'); t.grantFor(1, 0, 'Booby Trap');
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Booby Trap löst aus: 100 Schaden an den Angreifer, Surprise verbraucht', t.hp(0, 0) === 700 && t.gs.players[1].surpriseZones[0].length === 0, [t.hp(0, 0), t.gs.players[1].surpriseZones]);

  t = await H.fresh({});
  const t0 = t.gs.turn, ap = t.gs.activePlayer;
  await t.endTurn();
  R.check('endTurn: Zugwechsel mit Ziehen und Gold', t.gs.activePlayer === 1 - ap && t.gs.turn === t0 + 1 && t.pile(1, 'hand').length === 1 && t.gs.players[1].gold > 100, { turn: t.gs.turn, ap: t.gs.activePlayer, hand: t.pile(1, 'hand'), gold: t.gs.players[1].gold });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
