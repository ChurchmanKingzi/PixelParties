'use strict';
// R01-10 · Flächen-Statuszauber ohne Schaden (Iceage, Poisoned Well, Medusa's Curse) öffnen kein Post-Target-Reaktionsfenster
// Kartentexte: Divine Gift of Rain „Play this card immediately when one or more targets you control would be affected by an opponent's card or effect. Negate any effects …";
//   Barrier of Faith „… when a Hero you control would be affected by a card or effect …"; Anti Magic Shield „… when a Hero that can use this Spell is hit by an opponent's Spell …".
// CARD_API (`preDamageMultiTargetWindow`-Kommentar, `_engine.js` ~35563): „Cards that build their own target list and loop … MUST call this helper before the loop".
// Aufbau: Sitz 0 spielt den Flächenzauber (Iceage / Poisoned Well / Medusa's Curse); Sitz 1 hält Divine Gift of Rain / Barrier of Faith (Support Magic 3 am Helden 0) / Anti Magic Shield (Magic Arts 3).
// Kontrolle: Boiling Oil (Fläche MIT Schaden) öffnet das Fenster in allen drei Fällen.
// Erwartet: Das Reaktionsfenster geht auf (Prompt mit dem Namen der Reaktionskarte).
// Beobachtet: Bei Iceage, Poisoned Well und Medusa's Curse kein Fenster – alle 3 Helden sind eingefroren / vergiftet / betäubt, die Reaktionskarte bleibt auf der Hand.
// Ursache: `iceage.js`, `poisoned-well.js`, `medusas-curse.js` rufen weder `actionAoeHit` noch `engine.preDamageMultiTargetWindow(...)` vor ihrer Schleife (der Nachweis steht in `iceage.js` onPlay: `engine.batchStatusWindow('frozen', …)` + `einfrieren()` je Ziel).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const faelle = [['Boiling Oil', null], ['Iceage', 'frozen'], ['Poisoned Well', 'poisoned'], ["Medusa's Curse", 'stunned']];
  for (const rx of ['Divine Gift of Rain', 'Barrier of Faith', 'Anti Magic Shield']) {
    for (const [src, status] of faelle) {
      const t = await H.fresh({ hand: [[src], [rx]] });
      t.grantFor(1, 0, rx);
      t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
      await t.play(0, src, { hero: 0 });
      const betroffen = status ? [0, 1, 2].every(h => t.hero(1, h).statuses[status]) : [0, 1, 2].some(h => t.hp(1, h) < 800);
      R.check(`${src} vs ${rx}: Reaktionsfenster geht auf`, t.prompts.some(p => p.d.title === rx), { prompts: t.prompts.map(p => p.d.title), gewirkt: betroffen });
    }
  }
  R.finish();
})();
