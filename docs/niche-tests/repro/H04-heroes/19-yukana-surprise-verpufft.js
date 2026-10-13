'use strict';
// H04-19 · Yukana: die Galerie bietet Surprise-Zauber an; der Sofort-Guss verpufft, die Karte (und die Wisdom-Abwürfe) sind weg  [Stufe B]
//
// Kartentext Yukana: „…you may once per turn perform a level 1 or 2 Spell with it as an additional Action."
// Regel (server.js ~Z. 8116, Skull Carpet Bombing v1308): „Surprises kommen NUR in den Main Phases ins Spiel (verdeckt gesetzt)" – in der Action Phase lehnt `doPlaySpell` sie ab.
// Erwartung: Eine Surprise (Booby Trap, Lv 1 „Spell/Surprise") wird in der Action Phase nicht angeboten (oder wenigstens nicht verbraucht).
// Beobachtet: `wirkbar()` (yukana-the-scholar-on-the-run.js) filtert nur `cardType === 'Spell'` und Stufe 1/2 → Surprise wird angeboten. Der Sofort-Guss
//   (`_castSpellImmediately`) führt nur `onPlay` aus; Surprise-Skripte haben dort nichts → Booby Trap landet wirkungslos in der Ablage, Wisdom-Abwurf (Heal) ist bezahlt,
//   die Einmal-Sperre `yukana_spell` ist verbraucht, die Surprise ist nirgends gesetzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const YK = 'Yukana, the Scholar on the Run';
  const t = await H.fresh({ heroes: [[YK, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [['Booby Trap', 'Heal', 'Heal'], []], deckSize: 20 });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.setAbilities(0, 0, [['Wisdom', 'Wisdom'], [], []]);
  let offered = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === YK, answer: (d) => { offered = d.cards.map(c => c.name); return { cardName: 'Booby Trap', source: 'hand' }; }, once: true });
  await t.activateHero(0, 0, { effect: YK });
  const gesetzt = (t.gs.players[0].surpriseZones || []).some(z => (z || []).length > 0);
  const verbraucht = t.pile(0, 'discardPile').includes('Booby Trap') && !gesetzt;
  R.check('Surprise wird in der Action Phase nicht angeboten', !(offered || []).includes('Booby Trap'), { offered });
  R.check('Surprise wird nicht wirkungslos verbraucht', !verbraucht, { ablage: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand'), surpriseGesetzt: gesetzt });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
