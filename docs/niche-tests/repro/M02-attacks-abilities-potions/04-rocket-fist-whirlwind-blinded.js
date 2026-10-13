'use strict';
// M02-04 · Rocket Fist und Whirlwind Strike sind für geblendete Helden spielbar (Blinded-Sperre fehlt)
// Regel (`_hooks.js` STATUS_EFFECTS.blinded, Z. ~312): „`blinded` prevents the bearer from using Attacks, Spells, or activated effects that need to pick one
//   or more targets. AoE / area-wide effects keep working — the engine reads `blocksTargeting: true` plus the card script's `requiresTarget: true` flag."
// Kartentexte: Rocket Fist „Choose a target and deal damage …", Whirlwind Strike „Choose up to 2 Heroes your opponent controls …" – beide wählen Ziele.
// Erwartung: ein geblendeter Held (Smoke Vial / Trunk Sand) kann beide Karten nicht spielen (wie Quick Attack, Pusher, Ricochet …).
// Beobachtet: beide werden gespielt und richten Schaden an. Ursache: weder `rocket-fist.js` noch `whirlwind-strike.js` tragen `requiresTarget: true`
//   (die Engine gatet nur auf diese Marke: _engine.js Z. 20845, 40876 …); alle anderen Zielwahl-Attacks der Gruppe haben sie.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const st of ['blinded', 'blinded_hit']) {
    for (const [karte, soll] of [['Quick Attack', false], ['Rocket Fist', false], ['Whirlwind Strike', false]]) {
      const t = await H.fresh({ hand: [[], []], hp: 800 });
      t.put(1, 0, 0, H.INERT.creature);
      t.heroStatus(0, 1, st);
      t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1); return v ? [v.id] : null; };
      const r = await t.play(0, karte, { hero: 1 });
      const schaden = [0, 1, 2].some(i => t.hp(1, i) < 800);
      R.check(`${st}: ${karte} ist nicht spielbar (kein Schaden, Karte bleibt auf der Hand)`, r === false && !schaden && t.pile(0, 'hand').includes(karte), { r, schaden, hand: t.pile(0, 'hand') });
    }
  }
  R.finish();
})();
