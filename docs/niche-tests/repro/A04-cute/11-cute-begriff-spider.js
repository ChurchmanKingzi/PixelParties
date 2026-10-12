'use strict';
// A04-cute-11 (C) · Was ist eine „Cute" Creature? Namensbezug (Cute Crown, Princess Mary, Monami) gegen Archetyp (Army, Pink Sky, Conversion, Mini)
//
// "Cute Spider" (Archetyp Spiders, Name enthält das Wort Cute) und umgekehrt jede Cute-Archetyp-Karte ohne das Wort im Namen (Cuteness Sensor,
//   Pink Sky, Molinda the Cutest …) werden von den Karten der Gruppe unterschiedlich behandelt:
//   · Namensbezug (`hasCuteInName`, ganzes Wort): Cute Crown, Cute Princess Mary, Cute Ditz Monami
//   · Archetyp (`archetype === 'Cute'`): Army of the Cute, Pink Sky (`isCuteCreatureInst`), Cute Conversion, Cute Annoyance Mini
//   · Namens-Präfix: Cuteness Sensor
// Erwartung: ein und derselbe Begriff „Cute" Creature (CARD_API: die Anführungszeichen bedeuten „zählt als") für alle Karten.
// Beobachtet: Cute Spider wird von Princess Mary als Cute behandelt (summonbar, Stufenbypass), von Pink Sky NICHT verschont und von
//   Army of the Cute nicht angeboten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // 1) Pink Sky: wird Cute Spider verschont?
  let t = await H.fresh({ hand: [['Pink Sky'], []], deck: [Array(4).fill(H.INERT.creature), Array(4).fill(H.INERT.creature)] });
  const spider = t.put(0, 0, 0, 'Cute Spider');
  const bunny = t.put(0, 0, 1, 'Cute Bunny');
  t.put(1, 0, 0, H.INERT.creature);
  await t.play(0, 'Pink Sky', { hero: 0 });
  const verschont = !(spider.counters.negated || spider.counters.nulled);
  R.note('Pink Sky verschont Cute Spider', verschont);
  R.note('Pink Sky verschont Cute Bunny', !(bunny.counters.negated || bunny.counters.nulled));

  // 2) Army of the Cute: bietet sie Cute Spider an?
  t = await H.fresh({ hand: [['Army of the Cute', 'Cute Spider'], []], deck: [[H.INERT.creature], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  let angebot = null;
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: d => { angebot = d.cards.map(c => c.name); return { cancelled: true }; } });
  await t.play(0, 'Army of the Cute', { hero: 0, noGrant: true });
  const armyBietet = (angebot || []).includes('Cute Spider');
  R.note('Army of the Cute bietet Cute Spider an (Angebot: ' + JSON.stringify(angebot) + ')', armyBietet);

  // 3) Cute Princess Mary: darf sie Cute Spider (Lv?) beschwören?
  t = await H.fresh({ heroes: [['Cute Princess Mary', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [['Cute Spider'], []], deck: [[H.INERT.creature], []] });
  await t.play(0, 'Cute Spider', { hero: 0, noGrant: true });
  const maryDarf = !!t.find('Cute Spider', 'support');
  R.note('Cute Princess Mary beschwört Cute Spider ohne Schule', maryDarf);

  R.check('Alle drei Karten behandeln Cute Spider gleich (alle „Cute" oder alle „nicht Cute")', verschont === armyBietet && armyBietet === maryDarf, { pinkSky: verschont, army: armyBietet, mary: maryDarf });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
