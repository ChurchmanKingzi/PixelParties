'use strict';
// A07-04 · Unsettling Opportunist Vullary und Stellin, the Calm Dictator „beschwören" per actionPlaceCreature und
//          umgehen damit die Beschwörungsbedingungen der Karten (canSummon / beforeSummon)
//
// Kartentexte:
//   Vullary: „… You may once per turn summon a level 3 or lower Creature regardless of its level as an additional Action
//     with the corresponding Hero, but negate its effects until the beginning of your next turn." (nur das LEVEL entfällt)
//   Stellin: „… when this Creature takes damage, you may summon up to 3 level 0 Creatures with different names from
//     your hand OR 1 level 0 Creature from your deck as additional Actions."
//   Gigantisaur-Kreaturen: „A Hero can only have 1 "Gigantisaur" Creature in its Support Zones at a time."
//   Guardian Beast (Lv0): „You can only summon this Creature while you have no cards in your discard pile."
//   Blue-Ice Dragon (Lv3): „You can only summon this Creature by sacrificing 2 Creatures you control that were not summoned this turn."
//
// Erwartung: Wie bei Skullmael's Greatsword (CARD_API.md ~Z. 9408 „SUMMON, NICHT PLACE") gelten beim Beschwören die
//   kartenseitigen Tore: `canSummon` und die Kosten aus `beforeSummon`.
// Beobachtet: beide Karten legen über `engine.actionPlaceCreature` (unsettling-opportunist-vullary.js:143, stellin-the-calm-dictator.js:273), das weder
//   `canSummon` noch `beforeSummon` ausführt; die Galerien bieten die Karten sogar an (`isSummonablePileCreature` prüft
//   nur Kartenart). Ergebnis: zwei Gigantisaurier an einem Helden, Guardian Beasts trotz voller Ablage, Blue-Ice Dragon
//   ohne Opfer.
const H = require('../../lib/h.js');
const F = H.INERT.filler;

async function vullary(hand, discard, vorher) {
  const t = await H.fresh({ hand: [['Cute Princess Mary', ...hand], []], discard: [discard || [], []], deckSize: 20 });
  const v = t.put(0, 0, 0, 'Unsettling Opportunist Vullary'); v.turnPlayed = 1;
  if (vorher) vorher(t);
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);                                        // Mary anlegen (eigener Modus)
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
  t.phase(2);
  const r = await t.activateCreature(0, 0, 0);                              // Modus B: Kreatur beschwören
  return { t, r, v };
}

(async () => {
  const R = H.runner();

  R.section('Vullary + zweiter Gigantisaur am selben Helden');
  let o = await vullary(['Gigantisaur Pteranos'], [], t => { const g = t.put(0, 0, 1, 'Gigantisaur Triceras'); g.turnPlayed = 1; });
  let n = o.t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 0 && /^Gigantisaur /.test(c.name)).map(c => c.name);
  R.check('höchstens 1 Gigantisaur-Kreatur an Held 0', n.length <= 1, n);

  R.section('Vullary + Guardian Beast bei nicht leerer Ablage');
  o = await vullary(['Guardian Beast Tu'], [F, F]);
  R.check('Guardian Beast Tu wird bei gefüllter Ablage NICHT beschworen', !o.t.find('Guardian Beast Tu', 'support'), o.t.pile(0, 'discardPile').length);

  R.section('Vullary + Blue-Ice Dragon ohne Opfer');
  o = await vullary(['Blue-Ice Dragon']);
  R.check('Blue-Ice Dragon kommt nicht ohne Opfer von 2 Kreaturen aufs Brett', !o.t.find('Blue-Ice Dragon', 'support'), o.t.inst(c => c.zone === 'support' && c.owner === 0).map(c => c.name));

  R.section('Stellin + Guardian Beasts bei nicht leerer Ablage');
  const t = await H.fresh({ hand: [['Stellan, the Calm Cat', 'Guardian Beast Tu', 'Guardian Beast Gou'], []], discard: [[F, F], []], deckSize: 20 });
  const st = t.put(0, 0, 0, 'Stellin, the Calm Dictator'); st.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);                                        // Stellan anlegen
  t.script.push({ match: d => d && d.type === 'optionPicker', answer: () => ({ optionId: 'hand' }) });
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.map(c => c.name), selectedIndices: d.cards.map((c, i) => i) }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  await t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, st, 10, 'creature');
  await t.engine._flushSurpriseDrawChecks();
  const gb = t.inst(c => c.zone === 'support' && c.owner === 0 && /^Guardian Beast /.test(c.name)).map(c => c.name);
  R.check('Guardian Beasts werden bei gefüllter Ablage NICHT über Stellin beschworen', gb.length === 0, gb);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  // Ergänzung (Fortsetzungsagent): auch der Deck-Weg von Stellin („1 level 0 Creature from your deck") läuft über
  // `summonCreatureWithHooks` und prüft `canSummon` nicht – Guardian Beast Tu landet trotz gefüllter Ablage auf dem Brett.
  R.section('Stellin, Deck-Weg + Guardian Beast Tu bei nicht leerer Ablage');
  {
    const t2 = await H.fresh({ hand: [['Stellan, the Calm Cat'], []], discard: [[F, F], []], deck: [['Guardian Beast Tu', ...Array(9).fill(F)], []] });
    const st2 = t2.put(0, 0, 0, 'Stellin, the Calm Dictator'); st2.turnPlayed = 1;
    t2.gs.activePlayer = 0; t2.phase(2);
    await t2.activateCreature(0, 0, 0);
    t2.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t2.script.push({ match: d => d && d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: 'deck' }) });
    t2.script.push({ match: d => d && d.type === 'optionPicker', answer: () => ({ optionId: 'deck' }) });
    await t2.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, st2, 10, 'creature');
    await t2.engine._flushSurpriseDrawChecks();
    R.check('Guardian Beast Tu wird bei gefüllter Ablage NICHT über Stellins Deck-Weg beschworen', !t2.find('Guardian Beast Tu', 'support'), t2.inst(c => c.zone === 'support' && c.owner === 0).map(c => c.name));
    R.check('keine Engine-Fehler (Deck-Weg)', t2.errors.length === 0, t2.errors);
  }
  R.finish();
})();
