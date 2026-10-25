'use strict';
// W75 · Darion — Breaking Strike wirft Equips aus dem Stapel ab: der Spielstand zeigt den Stapel zu KEINEM Zeitpunkt leer (Al: „die komplette Zone wird kurz leer dargestellt").
// Kartentext: „All Artifacts equipped to this Hero share 1 Support Zone. …"; Breaking Strike: „Discard any number of Artifacts equipped to the user and choose a target. …"
// Erwartet: bei jedem sync() und jedem Flug-Ereignis steht der Rest des Stapels im Zustand; der Flug nennt Held und Platz des Stapels. Aufruf: node docs/niche-tests/repro/W75/g-01-darion-abwurf-zone-nie-leer.js   (Exit 0 = korrekt)
const U = require('../../lib/umhaengen.js');
const { H } = U;
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
(async () => {
  const R = H.runner();
  for (const namen of [['Club of Gobbo', 'Club of Gobbo', 'Blade of the Frostbringer'], ['Club of Gobbo', 'Blade of the Frostbringer', 'Club of Gobbo']]) {
    R.section('Stapel ' + namen.join(' / '));
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Breaking Strike'], [F]] });
    t.grantFor(0, 0, 'Breaking Strike');
    const ps = t.gs.players[0];
    ps.supportZones[0][1] = [];
    for (const n of namen) { ps.supportZones[0][1].push(n); t.engine._trackCard(n, 0, 'support', 0, 1).turnPlayed = 1; }
    const log = [];
    const zone = () => JSON.stringify(ps.supportZones[0][1]);
    const sync0 = t.engine.sync.bind(t.engine);
    t.engine.sync = (...a) => { log.push('sync ' + zone()); return sync0(...a); };
    const bc0 = t.engine._broadcastEvent.bind(t.engine);
    t.engine._broadcastEvent = (n, d, ...r) => { if (n === 'play_pile_transfer') log.push('flug ' + JSON.stringify({ von: d.from, held: d.fromHeroIdx, platz: d.fromSlotIdx, karte: d.cardName }) + ' | Zustand ' + zone()); return bc0(n, d, ...r); };
    let n = 0;
    t.targetFn = (valid) => {
      const eqs = valid.filter(v => v.type === 'equip');
      if (eqs.length && n++ < 2) return [eqs[0].id];
      return [(valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
    };
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => ({ instId: d.instances?.[0]?.id ?? d.options?.[0]?.id }) });
    await t.play(0, 'Breaking Strike', { hero: 0 });
    R.note('prompts', JSON.stringify(t.prompts.map(p => p.d.type + ':' + (p.d.title || ''))));
    const leer = log.filter(l => / \[\]$/.test(l));
    R.check('der Stapel stand nie leer, solange noch Equips darin lagen', leer.length === 0 || zone() === '[]', leer);
    R.check('Fluege nennen Held 0 / Platz 1', log.filter(l => l.startsWith('flug {\"von\":\"support\"')).every(l => /"held":0,"platz":1/.test(l)), log.filter(l => l.startsWith('flug {\"von\":\"support\"') && !/"held":0,"platz":1/.test(l)));
    R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);
  }
  R.finish();
})();
