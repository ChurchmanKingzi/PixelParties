'use strict';
// F01-artifacts-08 · Anti-Magnet ist auch spielbar, wenn der Besitzer KEIN weiteres eigenes Ziel kontrolliert (Frage an Al)
// Kartentext: „Play this card immediately when exactly 1 target you control is chosen by an Attack, Spell or Creature effect while you control other possible targets.
//   The Attack/Spell/effect is redirected to a different target of your opponent's choice."
// Aufbau: Sitz 1 hat NUR einen Helden (Atta, keine Kreaturen) und Anti-Magnet auf der Hand (100 Gold); Sitz 0 greift diesen Helden mit „Attack" an (Sitz 0 hat 3 Helden).
// Wörtliche Lesart: „while you control other possible targets" → Sitz 1 kontrolliert kein weiteres mögliches Ziel → Anti-Magnet darf nicht gespielt werden, der Held bekommt den Schaden.
// Beobachtet: Anti-Magnet wird angeboten, bezahlt (2 Gold) und leitet den Schlag auf einen Helden des ANGREIFERS um (Sitz 0 Held 1 verliert 40 HP).
// Skript: `anti-magnet.js` Z. 49–53 / 99–104 liest „other possible targets" bewusst als „≥ 1 anderes gültiges Ziel des Effekts, auf BEIDEN Seiten" (`getOtherValidTargets`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [undefined, ['Atta, Speaker of Desires', null, null]], hand: [['Attack'], ['Anti-Magnet']], gold: [100, 100] });
  t.policy.confirm = true;
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return [v ? v.id : valid[0].id]; };
  const hp1 = t.hp(1, 0), hp0 = [0, 1, 2].map(i => t.hp(0, i));
  await t.play(0, 'Attack', { hero: 0 });
  const eigeneWeitereZiele = 0;
  R.check('Anti-Magnet nicht spielbar ohne weitere eigene Ziele: Held von Sitz 1 nimmt den Schaden', hp1 - t.hp(1, 0) === 40, { schadenAnSitz1: hp1 - t.hp(1, 0), schadenAnSitz0: [0, 1, 2].map(i => hp0[i] - t.hp(0, i)), anwesendeEigeneZiele: eigeneWeitereZiele, goldSitz1: t.gs.players[1].gold });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
