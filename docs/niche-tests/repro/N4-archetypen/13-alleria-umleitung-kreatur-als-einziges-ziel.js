'use strict';
// N4-archetypen-13 · Alleria: Umleitung auch, wenn der Gegner genau 1 KREATUR von mir wählt (Al, Welle 24: Lesart A)
// Kartentext (Alleria, the Queen of Spiders): „Once per turn, when your opponent chooses exactly 1 target you control for an Attack, Spell or Creature effect, you may redirect that Attack,
//   Spell or effect to any of your Heroes that has a Surprise in its Surprise Zone. If you do, that Attack's or Spell's damage cannot be reduced or negated, except by a Surprise."
// Al: „Sagt ihr Kartentext 'Hero' oder 'target'? Falls letzteres, darf sie auch bei einzelnen Creatures umleiten." → Der Text sagt „target": Lesart A.
// Erwartung (Exit 0): (a) Fireball auf genau 1 eigene Kreatur → Alleria wird gefragt, Held 2 (Surprise) nimmt den Schaden, die Kreatur bleibt heil.
//   Gegenproben: (b) 2 gewählte eigene Ziele (Pyroblast: Kreatur + Held) → keine Umleitung; (c) kein Held mit Surprise → keine Umleitung.
const H = require('../../lib/h.js');
async function lauf(modus) {
  const heroes = [['Alleria, the Queen of Spiders', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
  const t = await H.fresh({ heroes, hand: [['ZZ Filler'], [modus === 'zwei' ? 'Pyroblast' : 'Fireball']], deckSize: 30, active: 1 });
  if (modus !== 'ohneSurprise') t.putSurprise(0, 2, 'Spider Avalanche');
  const c = t.put(0, 1, 0, H.INERT.big);
  t.script.push({ match: d => d.type === 'confirm' && /Alleria/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.targetFn = (valid) => modus === 'zwei'
    ? [valid.find(v => v.type === 'equip' && v.owner === 0).id, valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id]
    : [valid.find(v => v.type === 'equip' && v.owner === 0).id];
  await t.play(1, modus === 'zwei' ? 'Pyroblast' : 'Fireball', { hero: 0 });
  const gefragt = t.prompts.filter(p => /Alleria/.test(p.d.title || '')).length;
  return { t, c, gefragt, kreaturHp: c.counters.currentHp ?? 1000 };
}
(async () => {
  const R = H.runner();
  const a = await lauf('eins');
  R.check('(a) genau 1 gewählte Kreatur: Alleria wird gefragt', a.gefragt === 1, a.gefragt);
  R.check('(a) umgeleitet: Held 2 nimmt 150, die Kreatur bleibt heil', a.t.hp(0, 2) === 650 && a.kreaturHp === 1000, { h2: a.t.hp(0, 2), kreatur: a.kreaturHp });
  R.check('(a) keine Engine-Fehler / Zustand sauber', a.t.errors.length === 0 && a.t.audit().length === 0, { e: a.t.errors, a: a.t.audit() });
  const b = await lauf('zwei');
  R.check('(b) 2 gewählte eigene Ziele (Kreatur + Held): keine Umleitung', b.gefragt === 0, b.gefragt);
  const c = await lauf('ohneSurprise');
  R.check('(c) kein Held mit Surprise: keine Umleitung, Kreatur nimmt den Schaden', c.gefragt === 0 && c.kreaturHp < 1000, { gefragt: c.gefragt, kreatur: c.kreaturHp });
  R.finish();
})();
