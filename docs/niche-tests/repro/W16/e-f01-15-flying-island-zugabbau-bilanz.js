'use strict';
// W16e · F01-15 Gegenprobe: Beim Abbau der Flying Island werden ihre Kreaturen wie jede besiegte Kreatur behandelt — normale Kreatur in die Ablage ihres Besitzers,
// kein Phantom-Held-KO, Zustand sauber (`audit`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const FI = 'Flying Island in the Sky';
  const t = await H.fresh({ hand: [[FI], []], hp: 800 });
  await t.play(0, FI, { hero: 0 });
  const c3 = t.put(0, 0, 3, H.INERT.creature);
  const c4 = t.put(0, 0, 4, 'Exploding Skull');
  const ko = [];
  const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (name, ctx) => { if (name === 'onHeroKO') ko.push(ctx.hero && ctx.hero.name); return orig(name, ctx); };
  await t.engine.actionMoveCard(t.find(FI, 'support'), 'discard');
  R.check('beide Inselkreaturen in der Ablage von Sitz 0', t.pile(0, 'discardPile').filter(n => n === H.INERT.creature || n === 'Exploding Skull').length === 2, t.pile(0, 'discardPile'));
  R.check('kein onHeroKO', ko.length === 0, ko);
  R.check('Skull-Todesschaden: Gegner-Held 0 −80', t.hp(1, 0) === 720, t.hp(1, 0));
  R.check('Inselzonen sind weg', t.gs.players[0].supportZones[0].length === 3, t.gs.players[0].supportZones[0].length);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
