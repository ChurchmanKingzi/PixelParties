'use strict';
// W24a · N1-08: Barrier of Faith negiert einen Anhänge-Zauber vollständig – die Karte liegt danach in der Ablage ihres Wirkers (nicht am Helden),
// ATK/Status bleiben unverändert, und ein späterer Anhang (ohne Immunität) legt sich normal an. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const heroPick = (s, h) => (valid, cfg) => {
  if (cfg && /Barrier/.test(cfg.title || '')) return valid.slice(0, Math.max(1, cfg.minTargets || 1)).map(x => x.id);
  const v = valid.find(x => x.type === 'hero' && x.owner === s && x.heroIdx === h); return v ? [v.id] : undefined; };
(async () => {
  const R = H.runner();
  for (const zauber of ['Curse', 'Berserk', 'Decisive Defeat']) {
    const t = await H.fresh({ hand: [[zauber], ['Barrier of Faith']] });
    t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Fighting', 'Fighting'], []]);
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    t.hero(1, 0).atk = 60;
    t.targetFn = heroPick(1, 0);
    await t.play(0, zauber, { hero: 0, noGrant: true });
    R.check(`${zauber}: Barrier of Faith wurde gewirkt`, t.prompts.some(p => p.pi === 1 && p.d.title === 'Barrier of Faith'), t.prompts.map(p => p.d.title));
    R.check(`${zauber}: Karte liegt in der Ablage des Wirkers (Sitz 0)`, t.pile(0, 'discardPile').includes(zauber), t.pile(0, 'discardPile'));
    R.check(`${zauber}: nicht am Helden angelegt`, !(t.gs.players[1].supportZones[0] || []).flat().includes(zauber), t.gs.players[1].supportZones[0]);
    R.check(`${zauber}: ATK unverändert 60, kein Zwischenspeicher`, t.hero(1, 0).atk === 60 && t.hero(1, 0)._cursedAtkSuppressed === undefined, { atk: t.hero(1, 0).atk });
    R.check(`${zauber}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    R.check(`${zauber}: Zustand sauber`, t.audit().length === 0, t.audit());
  }
  // Gegenprobe: ohne Reaktion legt sich der Zauber an
  for (const zauber of ['Curse', 'Berserk', 'Decisive Defeat']) {
    const t = await H.fresh({ hand: [[zauber], []] });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    t.targetFn = heroPick(1, 0);
    await t.play(0, zauber, { hero: 0, noGrant: true });
    R.check(`Gegenprobe ${zauber}: liegt am Helden`, (t.gs.players[1].supportZones[0] || []).flat().includes(zauber), t.gs.players[1].supportZones[0]);
  }
  R.finish();
})();
