'use strict';
// W16c · A04-cute-04 (Gegenprobe): Swagdri legt die Stack-Spitze „Lunatic Cycle - Crescent Moon" nur aus, wenn deren Spielbedingung
// (mind. 1 New Moon auf dem Brett) erfüllt ist – „as if it was part of your hand": nur die KOSTEN entfallen. Mit New Moon klappt es.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const mitNewMoon of [false, true]) {
    const t = await H.fresh({ deck: [[H.INERT.creature], []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const sw = t.put(0, 0, 0, 'Swagdri, Forger of Coolness'); sw.turnPlayed = 0;
    if (mitNewMoon) t.put(0, 1, 0, 'Lunatic Cycle - New Moon');
    const ps = t.gs.players[0];
    ps.coolnessStack.push('Lunatic Cycle - Crescent Moon'); t.engine._trackCard('Lunatic Cycle - Crescent Moon', 0, 'coolnessStack');
    t.gs.activePlayer = 0; t.phase(2);
    t.targetFn = (v) => { const e = v.find(x => x.type === 'hero' && x.owner === 0); return e ? [e.id] : null; };
    await t.activateCreature(0, 0, 0);
    const da = !!t.find('Lunatic Cycle - Crescent Moon', 'support');
    R.check(mitNewMoon ? 'mit New Moon: Crescent Moon wird ausgerüstet' : 'ohne New Moon: Crescent Moon wird NICHT ausgerüstet', da === mitNewMoon, { da, stack: ps.coolnessStack.slice() });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
