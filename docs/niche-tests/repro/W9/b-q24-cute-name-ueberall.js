'use strict';
// W9b · Q24 (A04-cute-11) · „Cute“ Creature = der NAME (Wort „Cute“) – überall dieselbe Prüfung
//
// ENTSCHIEDEN (Al, Welle 9, Q24): „Der Name zählt, Substring 'Cute' als ein Wort.“ Cute Spider (Archetyp Spiders, Name enthält Cute) zählt damit bei Crown, Mary, Monami, Army of the Cute,
//   Pink Sky, Cute Conversion und Cute Annoyance Mini als Cute Creature. Zentral: `_cute-shared.js` (`hasCuteInName` / `isCuteCreatureCard` / `isCuteCreatureInst`).
// Geprüft: (a) Pink Sky verschont Cute Spider (und negiert eine Nicht-Cute-Kreatur); (b) Army of the Cute bietet Cute Spider an, aber keine Nicht-Cute-Kreatur; (c) Cute Conversion: Stufe in der Hand sinkt
//   um 1 durch Cute Spider auf dem Brett; (d) Cute Annoyance Mini bietet Cute Spider aus dem Deck an; (e) Helfer: Cuteness (kein ganzes Wort) und Acute zählen nicht.
const H = require('../../lib/h.js');
const CS = require('../../../../cards/effects/_cute-shared.js');
(async () => {
  const R = H.runner();
  // (a) Pink Sky
  let t = await H.fresh({ hand: [['Pink Sky'], []], deck: [Array(4).fill(H.INERT.creature), Array(4).fill(H.INERT.creature)] });
  const spider = t.put(0, 0, 0, 'Cute Spider');
  const dummy = t.put(0, 0, 1, H.INERT.creature);
  await t.play(0, 'Pink Sky', { hero: 0 });
  const neg = (i) => !!(i.counters.negated || i.counters.nulled);
  R.check('(a) Pink Sky verschont Cute Spider', !neg(spider));
  R.check('(a) Pink Sky negiert die Nicht-Cute-Kreatur (Kontrolle)', neg(dummy), dummy.counters);
  R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  // (b) Army
  t = await H.fresh({ hand: [['Army of the Cute', 'Cute Spider', H.INERT.creature], []], deck: [[H.INERT.creature], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  let angebot = null;
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: d => { angebot = d.cards.map(c => c.name); return { cancelled: true }; } });
  await t.play(0, 'Army of the Cute', { hero: 0, noGrant: true });
  R.check('(b) Army bietet Cute Spider an, die Nicht-Cute-Kreatur nicht', !!angebot && angebot.includes('Cute Spider') && !angebot.includes(H.INERT.creature), angebot);
  // (c) Conversion: Stufe in der Hand
  t = await H.fresh({ hand: [['Cute Conversion'], []] });
  const cd = t.engine._getCardDB()['Cute Conversion'];
  const ohne = t.engine.effectiveCardLevel(cd, 0);
  t.put(0, 0, 0, 'Cute Spider');
  const mit = t.engine.effectiveCardLevel(cd, 0);
  R.check('(c) Cute Conversion: Cute Spider senkt die Stufe um 1', mit === ohne - 1, { ohne, mit });
  t.put(0, 0, 1, H.INERT.creature);
  R.check('(c) eine Nicht-Cute-Kreatur senkt nicht', t.engine.effectiveCardLevel(cd, 0) === mit, t.engine.effectiveCardLevel(cd, 0));
  // (d) Mini
  t = await H.fresh({ heroes: [['Cute Annoyance Mini', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [['Fireball'], []], deck: [['Cute Spider', H.INERT.creature], []] });
  let galerie = null;
  t.script.push({ match: d => d.type === 'cardGallery', answer: d => { galerie = d.cards.map(c => c.name); return { cancelled: true }; } });
  await t.run(() => t.activateHero(0, 0, {}));
  R.check('(d) Mini bietet Cute Spider aus dem Deck an', !!galerie && galerie.includes('Cute Spider') && !galerie.includes(H.INERT.creature), { galerie, prompts: t.prompts.map(p => p.d.type) });
  // (e) Helfer
  R.check('(e) Namensregel: Cute Spider ja; Cuteness Sensor / Acute Vision nein', CS.hasCuteInName('Cute Spider') && !CS.hasCuteInName('Cuteness Sensor') && !CS.hasCuteInName('Acute Vision'));
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
