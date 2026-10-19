'use strict';
// W16c · A06-01 (Variante Massen-Freeze): Friert The White Army ZWEI Kreaturen ein, bietet Sculpture Theft genau diese beiden an
// (nicht die früher gefrorene dritte).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({ hand: [['The White Army'], ['Sculpture Theft']] });
  for (let s = 0; s < 4; s++) t.put(0, s < 3 ? 0 : 1, s < 3 ? s : 0, D);   // 4 eigene Kreaturen → bis zu 2 Ziele
  const alt = t.put(1, 0, 0, D); t.put(1, 0, 1, 'Loyal Beagle'); t.put(1, 0, 2, 'Loyal Pinpom');
  await t.run(() => t.engine.applyCreatureStatus(alt, 'frozen', { duration: 3, sourceOwner: 1, source: 'repro' }));
  t.grantFor(1, 0, 'Sculpture Theft');
  t.targetFn = (valid) => valid.filter(v => v.cardName === 'Loyal Beagle' || v.cardName === 'Loyal Pinpom').map(v => v.id);
  const r = await t.play(0, 'The White Army', { hero: 0 });
  const theft = t.targets.find(x => x.config && x.config.title === 'Sculpture Theft');
  R.check('The White Army gespielt', r === true, r);
  R.check('Theft bietet genau die zwei neu gefrorenen an (Beagle, Pinpom), nicht die alte Dummy',
    !!theft && theft.valid.length === 2 && theft.valid.every(v => v.cardName !== D), theft && theft.valid.map(v => v.cardName));
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
