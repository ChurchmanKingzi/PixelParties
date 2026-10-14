'use strict';
// Z7c-B2 · Surprise mit „once per game" (Tharxian Horse): die AKTIVIERUNG verbraucht die Grenze; weitere verdeckt liegende Kopien lösen danach nicht mehr aus.
// Aufbau: Sitz 1 hat je eine Tharxian Horse an Held 0 und Held 1 (verdeckt, Magic Arts 3). Sitz 0 spielt zwei Fireballs: erst auf Held 0, dann auf Held 1.
// Erwartung: (a) 1. Fireball wird vom Horse an Held 0 negiert (Held 0 unversehrt), `_oncePerGameUsed` enthält jetzt 'Tharxian Horse';
//            (b) 2. Fireball (Held 1): das zweite Horse wird NICHT mehr angeboten, der Fireball trifft (Held 1 −150); die Kopie liegt weiter verdeckt in Held 1s Surprise Zone.
//            (c) Kontrolle: das 1. Horse wurde wirklich aktiviert (Ablage von Sitz 1 enthält es); B3 deckt die negierte Aktivierung ab.
// Aufruf: node docs/niche-tests/repro/Z7c/B2-surprise-once-per-game-aktivierung-verbraucht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball', 'Fireball'], []] });
  t.putSurprise(1, 0, 'Tharxian Horse'); t.grantFor(1, 0, 'Tharxian Horse');
  t.putSurprise(1, 1, 'Tharxian Horse'); t.grantFor(1, 1, 'Tharxian Horse');
  t.policy.confirm = true;
  const ziel = (hi) => (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === hi).id];
  R.check('Ausgangslage: Grenze unverbraucht', !t.gs.players[1]._oncePerGameUsed?.has('Tharxian Horse'));

  t.targetFn = ziel(0);
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('(a) 1. Fireball vom Horse an Held 0 negiert (Held 0 unversehrt)', t.hp(1, 0) === 800, t.hp(1, 0));
  R.check('(a) die Aktivierung hat die Grenze verbraucht', !!t.gs.players[1]._oncePerGameUsed?.has('Tharxian Horse'), [...(t.gs.players[1]._oncePerGameUsed || [])]);
  R.check('(a) das aktivierte Horse liegt in der Ablage von Sitz 1', t.pile(1, 'discardPile').includes('Tharxian Horse'), t.pile(1, 'discardPile'));

  t.reset();
  t.targetFn = ziel(1);
  const prompts0 = t.prompts.length;
  await t.play(0, 'Fireball', { hero: 0 });
  const horseAngeboten = t.prompts.slice(prompts0).some(p => /Tharxian Horse/.test(JSON.stringify(p.d)));
  R.check('(b) das zweite Horse wird nicht mehr angeboten', !horseAngeboten, t.prompts.map(p => p.d.title || p.d.type));
  R.check('(b) 2. Fireball trifft Held 1 (−150)', t.hp(1, 1) === 650, t.hp(1, 1));
  R.check('(b) die zweite Kopie liegt weiter verdeckt in der Surprise Zone von Held 1', (t.gs.players[1].surpriseZones[1] || []).includes('Tharxian Horse'), t.gs.players[1].surpriseZones[1]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})();
