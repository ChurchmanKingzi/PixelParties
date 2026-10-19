'use strict';
// W15b · C1 (Q161-Nachfrage, S01-14, Chaos Magic) · Al, 16.10.2026: „Nein, ein Spell, der ansonsten ein legales Ziel für Chaos Magic wäre, aber wegen irgendeiner Restriktion fizzelt, zählt als der von Chaos Magic gewirkte Zauber
//   und beendet Chaos Magic. Einzig ein Spell, der *wirklich* dieses Spiel schon mal gewählt wurde, zählt als schon gewählt."
// Auslegung: (a) ein aufgedeckter, sonst legaler Spell, der fizzelt (verbrauchter Einmal-Stempel), ist DER gewirkte Zauber: sichtbares Fizzeln, Chaos Magic ist beendet (kein Weiteraufdecken).
//   (b) Er zählt aber NICHT als „resolved": er steht danach nicht in `_spellsResolvedThisGame`, ein späteres Chaos Magic darf ihn wieder aufdecken (und diesmal wirklich wirken).
//   (c) Ein wirklich aufgelöster Zauber steht in der Liste und wird danach übersprungen (zählt zu den 5 Aufdeckungen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BO = 'Big Oopsie';
  const t = await H.fresh({ hand: [['Chaos Magic', 'Chaos Magic'], []], deck: [[BO, H.INERT.creature, H.INERT.creature], []] });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const liste = () => [...(t.gs.players[0]._spellsResolvedThisGame || [])];
  const hp = () => t.hp(1, 0);

  R.section('(a) Big Oopsie mit verbrauchtem „1 pro Zug": gewählt, fizzelt, beendet Chaos Magic');
  t.gs.hoptUsed = { ...(t.gs.hoptUsed || {}), ['big-oopsie:0']: t.gs.turn };
  const hp0 = hp();
  await t.play(0, 'Chaos Magic', { hero: 0 });
  R.check('Big Oopsie wurde gewählt und fizzelt sichtbar, kein Schaden', t.logs.some(l => l.type === 'chaos_magic_become' && l.data.spell === BO) && t.events.some(e => e.ev === 'card_reveal' && e.data?.fizzled) && hp() === hp0, { hp: hp(), fizz: t.events.filter(e => e.data?.fizzled).length });
  R.check('Chaos Magic ist beendet: nur 1 Karte aufgedeckt (die Dummies bleiben im Deck)', t.logs.filter(l => l.type === 'chaos_magic_reveal').length === 1 && t.pile(0, 'mainDeck').filter(n => n === H.INERT.creature).length === 2, { deck: t.pile(0, 'mainDeck') });
  R.check('(b) der fizzelnde Big Oopsie steht NICHT in der Liste der aufgelösten Zauber', !liste().includes(BO), liste());

  R.section('(b) späteres Chaos Magic darf Big Oopsie wieder aufdecken und wirklich wirken');
  t.gs.hoptUsed = {};
  t.setDeck(0, [BO, H.INERT.creature, H.INERT.creature]);
  const hp1 = hp();
  await t.play(0, 'Chaos Magic', { hero: 0 });
  R.check('Big Oopsie wurde wieder gewählt und wirkte (Schaden am Ziel)', t.logs.filter(l => l.type === 'chaos_magic_become' && l.data.spell === BO).length === 2 && hp() < hp1, { hp: hp(), vorher: hp1 });
  R.check('(c) jetzt steht Big Oopsie in der Liste', liste().includes(BO), liste());

  R.section('(c) wirklich Aufgelöstes wird übersprungen');
  t.addHand(0, 'Chaos Magic');
  t.setDeck(0, [BO, H.INERT.creature, H.INERT.creature, H.INERT.creature, H.INERT.creature, H.INERT.creature]);
  t.gs.hoptUsed = {};
  const hp2 = hp();
  const hand0 = t.pile(0, 'hand').length;
  await t.play(0, 'Chaos Magic', { hero: 0 });
  R.check('Big Oopsie zählt als schon gewirkt: übersprungen, 5 Aufdeckungen ohne Treffer, kein weiterer Schaden', hp() === hp2 && t.logs.some(l => l.type === 'chaos_magic_fizzle' && l.data.reason === 'no_spell_in_5'), { hp: hp(), log: t.logs.filter(l => /chaos/.test(l.type)).map(l => l.type + ':' + (l.data.reason || l.data.card || '')) });
  R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  R.finish();
})();
