'use strict';
// N3-11 · Ellie, the Class President: nach einem abgelehnten Angebot wird derselbe Double Spell (gleicher Name) im selben Zug nie wieder angeboten
// Kartentext: „You may immediately summon this Creature as an additional Action when a Hero you control performs a Double Spell."
// Erwartet: JEDES Wirken eines Double Spells ist ein neuer Auslöser; ein zweiter Icebolt im selben Zug (weitere Aktion) bietet Ellie erneut an.
// Beobachtet: Das erste Icebolt fragt (Nein), das zweite nicht; ein anderer Double Spell (Frost Breaker) fragt wieder.
// Ursache: cards/effects/ellie-the-class-president.js `afterSpellResolved` (Z. 60-61): `engine._ellieLetzterSpell === ctx.spellCardData && gs._ellieLetzterZug === gs.turn` – `spellCardData` ist das
//   Datenbank-Objekt der KARTE (für alle Kopien gleich); gedacht ist die Entprellung je Wirkvorgang (mehrere Ellie-Kopien auf der Hand), sie gilt aber für den ganzen Zug.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Ellie, the Class President', 'Icebolt', 'Icebolt', 'Frost Breaker'], []] });
  t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Decay Magic', 'Decay Magic', 'Decay Magic'], ['Summoning Magic']]);
  t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip')?.id ?? valid[0].id];
  let angebote = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Ellie, the Class President', answer: () => { angebote++; return null; } });   // echtes „Nein"
  await t.play(0, 'Icebolt', { hero: 0, noGrant: true });
  R.check('1. Icebolt (Double Spell): Ellie wird angeboten', angebote === 1, angebote);
  await t.play(0, 'Icebolt', { hero: 0, noGrant: true });
  R.check('2. Icebolt im selben Zug (weiteres Wirken eines Double Spells): Ellie wird erneut angeboten', angebote === 2, angebote);
  const vor = angebote;
  await t.play(0, 'Frost Breaker', { hero: 0, noGrant: true });
  R.check('Gegenprobe: ein anderer Double Spell (Frost Breaker) bietet Ellie an', angebote === vor + 1, { vor, nach: angebote });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
