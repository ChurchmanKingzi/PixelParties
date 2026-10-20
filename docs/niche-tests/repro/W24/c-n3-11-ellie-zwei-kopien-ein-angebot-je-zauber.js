'use strict';
// W24 · N3-11 Gegenprobe/Absicherung: zwei Ellie-Kopien auf der Hand bieten je gewirktem Double Spell nur EINMAL an (Entprellung je Durchgang);
// ein zweiter gleichnamiger Double Spell im selben Zug ist ein neuer Auslöser (wieder genau ein Angebot).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Ellie, the Class President', 'Ellie, the Class President', 'Icebolt', 'Icebolt'], []] });
  t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Decay Magic', 'Decay Magic', 'Decay Magic'], ['Summoning Magic']]);
  t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip')?.id ?? valid[0].id];
  let angebote = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Ellie, the Class President', answer: () => { angebote++; return null; } });
  await t.play(0, 'Icebolt', { hero: 0, noGrant: true });
  R.check('1. Icebolt mit zwei Ellies auf der Hand: genau ein Angebot', angebote === 1, angebote);
  await t.play(0, 'Icebolt', { hero: 0, noGrant: true });
  R.check('2. Icebolt: wieder genau ein Angebot (insgesamt 2)', angebote === 2, angebote);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
