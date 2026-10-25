'use strict';
// W75d-02 · Die CPU wirft Explosion Toss nicht als Kosten der Hot Skull Potato ab (die Übergabe löst die Toss gleich aus).
const H = require('../../lib/h.js');
const cpu = require('../../../../cards/effects/_cpu.js');

(async () => {
  const R = H.runner();
  R.section('A · Abwurf-Wahl der CPU für die Kartoffel-Kosten');
  for (const hand of [['Explosion Toss', 'ZZ Filler'], ['ZZ Filler', 'Explosion Toss'], ['ZZ Filler', 'Explosion Toss', 'ZZ Filler']]) {
    const t = await H.fresh({ hand: [['ZZ Filler'], hand], deckSize: 30, gold: [100, 100], active: 1 });
    t.engine._cpuPlayerIdx = 1;
    const r = cpu._test.cpuGenericChoice(t.engine, { type: 'forceDiscard', costFor: 'Hot Skull Potato', source: 'Hot Skull Potato', eligibleIndices: hand.map((_, i) => i) }, 1);
    R.check(`Hand ${hand.join(' / ')}: es wird NICHT die Toss gewählt`, !!r && r.cardName !== 'Explosion Toss', r);
  }
  {
    // andere Quelle: kein Schutz (die Toss ist ein ganz normaler Abwurfkandidat)
    const t = await H.fresh({ hand: [['ZZ Filler'], ['Explosion Toss', 'ZZ Filler']], deckSize: 30, gold: [100, 100], active: 1 });
    t.engine._cpuPlayerIdx = 1;
    const r = cpu._test.cpuGenericChoice(t.engine, { type: 'forceDiscard', source: 'Something Else', eligibleIndices: [0, 1] }, 1);
    R.check('andere Quelle: kein Sonderschutz (Wahl ist gültig)', !!r && typeof r.cardName === 'string', r);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
