'use strict';
// N4-archetypen-12 · Alleria: bietet die Umleitung auch an, wenn der Gegner MEHRERE Ziele wählt, die ich kontrolliere
// Kartentext (Alleria, the Queen of Spiders): „Once per turn, when your opponent chooses exactly 1 target you control for an Attack, Spell or Creature effect, you may redirect that Attack,
//   Spell or effect to any of your Heroes that has a Surprise in its Surprise Zone."
// Aufbau: Sitz 0: Alleria (Held 0), Surprise in der Zone von Held 2. Sitz 1 wirkt Pyroblast („Choose any number of targets and deal 100 damage to them") auf (a) nur Alleria, (b) Held 0 und Held 1 von Sitz 0.
// Erwartung: (a) Alleria wird gefragt (genau 1 Ziel). (b) Der Gegner wählt 2 Ziele, die ich kontrolliere → die Bedingung „exactly 1" ist nicht erfüllt, Alleria bietet nichts an.
// Beobachtet: Die Umleitungs-Fenster geben `config._redirectPickCount` mit (Rolling Boulder gated damit), `canHeroRedirect` in alleria-the-queen-of-spiders.js liest es nicht → (b) wird gefragt und umgeleitet.
const H = require('../../lib/h.js');
async function lauf(anz) {
  const heroes = [['Alleria, the Queen of Spiders', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
  const t = await H.fresh({ heroes, hand: [['ZZ Filler'], ['Pyroblast']], deckSize: 30, active: 1 });
  t.putSurprise(0, 2, 'Spider Avalanche');
  t.script.push({ match: d => d.type === 'confirm' && /Alleria/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.targetFn = (valid) => [0, 1].slice(0, anz).map(i => valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === i).id);
  await t.play(1, 'Pyroblast', { hero: 0 });
  return { t, gefragt: t.prompts.filter(p => /Alleria/.test(p.d.title || '')).length };
}
(async () => {
  const R = H.runner();
  const a = await lauf(1);
  R.check('Gegenprobe (a): genau 1 gewähltes Ziel → Alleria wird gefragt', a.gefragt === 1, a.gefragt);
  const b = await lauf(2);
  R.check('Aufbau (b): beide Helden wurden getroffen oder umgeleitet (Pyroblast lief)', b.t.hp(0, 0) + b.t.hp(0, 1) + b.t.hp(0, 2) < 2400, [b.t.hp(0, 0), b.t.hp(0, 1), b.t.hp(0, 2)]);
  R.check('(b) 2 gewählte Ziele → Alleria wird NICHT gefragt', b.gefragt === 0, b.gefragt);
  R.check('keine Engine-Fehler', b.t.errors.length === 0, b.t.errors);
  R.finish();
})();
