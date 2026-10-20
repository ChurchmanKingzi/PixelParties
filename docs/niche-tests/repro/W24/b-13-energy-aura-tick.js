'use strict';
// W24b · N2-13 Energy Aura gegen Tick-Spell Gathering Storm + Gegenprobe gegen einen normal gewirkten Spell.
//   Tick: die Aura wehrt NUR den ersten Treffer ab, wird sofort abgeräumt (Ablage + 2 Karten); ein zweiter Gathering Storm trifft den Helden.
//   Gewirkter Spell (Fireball auf Held 0): Aura wird nach der Auflösung abgeräumt, der Held nimmt keinen Schaden (Ruling 14.9.: Abräumen NACH der Auflösung), Hand +2.
const H = require('../../lib/h.js');
const sup = (t, s, h) => t.gs.players[s].supportZones[h].map(z => z[0] || '');
(async () => {
  const R = H.runner();
  for (const [sturm, opfer] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${opfer}: Aura an Held 0; Sitz ${sturm} wirft Fireball auf Held 0`);
    {
      const t = await H.fresh({ hand: [0, 1].map(i => i === sturm ? ['Fireball'] : ['Energy Aura']), deckSize: 30, active: sturm });
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === opfer && y.heroIdx === 0).id];
      await t.play(opfer, 'Energy Aura', { hero: 0 });
      t.gs.activePlayer = sturm;
      const hand0 = t.pile(opfer, 'hand').length;
      await t.play(sturm, 'Fireball', { hero: 0 });
      R.check('Held 0 nahm keinen Schaden', t.hp(opfer, 0) === 800, t.hp(opfer, 0));
      R.check('Aura liegt in der Ablage, Hand +2', !sup(t, opfer, 0).includes('Energy Aura') && t.pile(opfer, 'discardPile').includes('Energy Aura') && t.pile(opfer, 'hand').length === hand0 + 2, [sup(t, opfer, 0), t.pile(opfer, 'hand').length - hand0]);
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
    R.section(`Sitz ${sturm}: ZWEI Gathering Storm, Sitz ${opfer} trägt Aura an Held 0 — Zugbeginn von Sitz ${opfer}`);
    {
      const t = await H.fresh({ hand: [0, 1].map(i => i === sturm ? ['Gathering Storm', 'Gathering Storm'] : ['Energy Aura']), deckSize: 30, active: sturm });
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === sturm && y.heroIdx === 0).id];
      await t.play(sturm, 'Gathering Storm', { hero: 0 });
      t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === sturm && y.heroIdx === 1).id];
      await t.play(sturm, 'Gathering Storm', { hero: 1 });
      t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === opfer && y.heroIdx === 0).id];
      await t.play(opfer, 'Energy Aura', { hero: 0 });
      t.gs.activePlayer = sturm;
      t.targetFn = (v, cfg) => (cfg && cfg.title === 'Gathering Storm') ? v.slice(0, 3).map(x => x.id) : [v[0].id];
      t.reset();
      const hand0 = t.pile(opfer, 'hand').length;
      const vor = t.census();
      await t.endTurn();
      R.check('Held 0 nahm genau einen Treffer (730)', t.hp(opfer, 0) === 730, t.hp(opfer, 0));
      R.check('Aura in der Ablage (genau einmal), 2 Karten gezogen (+1 Zugbeginn)', t.pile(opfer, 'discardPile').filter(x => x === 'Energy Aura').length === 1 && t.pile(opfer, 'hand').length === hand0 + 3, [t.pile(opfer, 'discardPile'), t.pile(opfer, 'hand').length - hand0]);
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
