'use strict';
// W75b-02 · Puzzle-CPU mit 1, 2 und 3 lebenden Helden nutzt Nasty Prank (Lv0 = jeder Held kann sie wirken).
// Meldung 25.10.: „die CPU nutzt Nasty Prank nur mit einem einzigen lebenden Helden." Mit dem echten CPU-Gehirn (`installCpuBrain`, nur Sitz 1 als CPU) nicht reproduzierbar —
// der Test hält das Sollverhalten fest (Angebot beantwortet das Gehirn selbst, daher kein Prompt im Protokoll).
const H = require('../../lib/h.js');
const cpu = require('../../../../cards/effects/_cpu.js');
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

(async () => {
  const R = H.runner();
  R.section('A · echtes CPU-Gehirn auf Sitz 1: Prank gegen einen Spell des Menschen');
  for (const [heroes, karte] of [[1, 'Burning Finger'], [2, 'Burning Finger'], [3, 'Burning Finger'], [2, 'Quick Attack']]) {
    const t = await H.fresh({ hand: [[karte], ['Nasty Prank']], deckSize: 30, gold: [100, 100], active: 0 });
    t.engine._cpuPlayerIdx = 1;
    cpu.installCpuBrain(t.engine);
    t.grantFor(0, 0, karte);
    for (let h = heroes; h < 3; h++) t.gs.players[1].heroes[h].hp = 0;
    t.targetFn = (valid) => { const h = valid.find(v => v.id === 'hero-1-0'); return h ? [h.id] : undefined; };
    await t.play(0, karte, { hero: 0, noGrant: true });
    R.check(`${heroes} Held(en), ${karte}: die CPU hat Prank gespielt (Ablage)`, t.pile(1, 'discardPile').includes('Nasty Prank'), t.pile(1, 'discardPile'));
    R.check(`${heroes} Held(en), ${karte}: Status „pranked" auf dem Angreifer`, !!t.gs.players[0].heroes[0].statuses.pranked?.names?.[karte], t.gs.players[0].heroes[0].statuses);
    R.check(`${heroes} Held(en), ${karte}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
