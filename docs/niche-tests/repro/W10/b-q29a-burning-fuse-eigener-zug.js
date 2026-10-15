'use strict';
// W10b · Q29a (A05-07) · Burning Fuse bleibt im eigenen Zug spielbar (Absicherung, keine Codeänderung)
//
// Kartentext: „You may activate this card when your opponent enters their Action Phase. …" (ohne „only")
// ENTSCHIEDEN (Al, Welle 10, Q29a): „Ja" → Burning Fuse ist auch im eigenen Zug spielbar (proactivePlay, ohne Aktionskosten).
// Geprüft: (a) im eigenen Zug mit einer Bomblebee (nicht frisch beschworen) spielbar, Karte verbraucht; (b) die Bomblebee wird danach besiegt;
//   (c) ohne geeignete Bomblebee ist sie nicht spielbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({ hand: [['Burning Fuse'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const bee = t.put(0, 0, 0, 'Bomblebee'); bee.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  const r = await t.play(0, 'Burning Fuse', { hero: 0, phase: 3 });
  R.check('(a) im eigenen Zug gespielt', r === true && t.pile(0, 'discardPile').includes('Burning Fuse'), { r, ablage: t.pile(0, 'discardPile') });
  R.check('(b) die Bomblebee wurde danach besiegt', !t.engine.cardInstances.includes(bee) || bee.zone !== 'support', bee.zone);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  t = await H.fresh({ hand: [['Burning Fuse'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const r2 = await t.play(0, 'Burning Fuse', { hero: 0, phase: 3 });
  R.check('(c) ohne Bomblebee nicht spielbar', r2 === false, r2);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
