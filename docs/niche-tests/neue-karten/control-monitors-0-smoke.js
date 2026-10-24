const H = require('../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 1, hand: [['Control Monitors'], [H.INERT.filler, 'Fireball']], deck: [[], ['Lunatic Cycle - Half Moon', H.INERT.filler, H.INERT.filler, H.INERT.filler]] });
  t.grantFor(0, 0, 'Control Monitors');
  const eq = t.put(1, 0, 0, 'Lunatic Cycle - New Moon'); eq.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: H.INERT.filler, handIndex: 0 }), once: true });
  const r = await t.activateEquip(1, 0, 0);
  R.note('prompts', JSON.stringify(t.prompts.map(p=>p.pi+':'+p.d.type+':'+(p.d.title||''))));
  R.note('after', JSON.stringify({ h1: t.pile(1,'hand'), del1: t.pile(1,'deletedPile'), dis1: t.pile(1,'discardPile'), h0: t.pile(0,'hand'), dis0: t.pile(0,'discardPile') }));
  R.note('lg', JSON.stringify(t.lg('control_monitors')));
  R.check('Half Moon geloescht', t.pile(1,'deletedPile').includes('Lunatic Cycle - Half Moon'));
  R.check('Monitors in Ablage Seat 0', t.pile(0,'discardPile').includes('Control Monitors'));
  R.check('keine Fehler', t.errors.length === 0, t.errors);
  R.check('audit', t.audit().length === 0, t.audit());
  R.finish();
})();
