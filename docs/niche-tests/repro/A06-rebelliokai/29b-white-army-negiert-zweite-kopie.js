'use strict';
// A06-rebelliokai-29 (Ergänzung) · Negierte The White Army zählt nicht gegen „You can only activate 1 "The White Army" per turn"
// Kartentext: „You can only activate 1 "The White Army" per turn." Gleiche Klasse wie Pawn Sacrifice/Mischief Invasion (Befund -29).
// Beobachtung: `the-white-army.js` stempelt `ps._whiteArmyUsedTurn` erst NACH der Zielwahl im onPlay (Z. ~92); wird der Zauber von Silence negiert,
//   läuft der onPlay nie. Die zweite Kopie im selben Zug ist spielbar und friert Ziele ein.
// Erwartung (Lesart A „gespielt = gezählt", wie -29): die zweite Kopie ist nach der Negierung nicht spielbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({ hand: [['The White Army', 'The White Army'], ['Silence']] });
  t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic']]);
  t.put(0, 0, 0, D); t.put(0, 0, 1, D); t.put(1, 0, 0, D);
  t.targetFn = (valid) => { const x = valid.find(v => v.owner === 1 && v.type === 'equip') || valid[0]; return x ? [x.id] : []; };
  const r = await t.play(0, 'The White Army', { hero: 0 });
  const reacted = t.prompts.some(p => /Silence/.test(p.d.title || ''));
  R.check('erste Kopie von Silence negiert (Aufbau)', r === true && reacted && t.pile(0, 'discardPile').includes('The White Army'), { r, reacted });
  t.reset(); t.gs.activePlayer = 0; t.gs.currentPhase = 3; t.resetActions(0);
  const r2 = await t.play(0, 'The White Army', { hero: 0 });
  const frozen = t.inst(c => c.owner === 1 && c.zone === 'support' && c.counters.frozen).length;
  R.check('zweite Kopie im selben Zug nicht spielbar / ohne Wirkung', r2 === false || frozen === 0, { r2, frozen });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
