'use strict';
// H04-17 · Timeless King Zi: der Sofort-Guss ignoriert „once per game" (Divine Gift) und die Spielbedingung (Call for Help)
//
// Kartentext Zi: „… This Hero immediately performs that Spell, regardless of its level, if possible. Delete the other Spells."
// Divine Gift of Creation/Death/…: „You can only activate 1 "Divine Gift" card per game."
// Call for Help: „You can only play this card if a Creature you control was defeated since the start of your turn."
// Konvention der Engine (`_engine.js` ~Z. 21894 „Only 1 per game … auch der Sofort-Guss verbraucht das Einmal-Limit"; Taio Absorber/Difficulty Lever
//   filtern `oncePerGame` + `spellPlayCondition` vor dem Guss): Sofort-Güsse stempeln das Einmal-Limit und halten die Spielbedingung ein.
// Beobachtet: Zi wirkt den Zauber per direktem `runHooks('onPlay')`: (a) Divine Gift of Creation wirkt, `_oncePerGameUsed` bleibt leer
//   (ein zweites Divine Gift ist danach noch spielbar); (b) ist `divineGift` schon verbraucht, wird ein weiteres Divine Gift trotzdem gewirkt;
//   (c) Call for Help wird ohne besiegte Kreatur gewirkt und spielt seinerseits einen Zauber aus dem Deck.
// Ursache: timeless-king-zi.js Schritt 6 (`canPerform` prüft nur Heldenzustand; kein Stempel, kein `oncePerGame`/`spellPlayCondition`-Filter).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ZI = 'Timeless King Zi';
  const mk = async (picked) => {
    const deck = [picked, 'Haste', 'Heal', ...Array(12).fill(H.INERT.filler)];
    const t = await H.fresh({ heroes: [[ZI, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []], deck: [deck, Array(10).fill(H.INERT.filler)] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === ZI, answer: () => ({ selectedCards: [picked, 'Haste', 'Heal'] }), once: true });
    t.script.push({ match: d => d.type === 'birthdayPresentPick', answer: () => ({ cardName: picked }), once: true });
    return t;
  };
  const go = (t) => { t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; }; return t.activateHero(0, 0, { effect: ZI, phase: 3 }); };
  const gallerien = (t) => t.prompts.filter(p => p.d.type === 'cardGalleryMulti').length;

  // (a) Stempel
  let t = await mk('Divine Gift of Creation');
  // Welle 13 (Q129/Q132, Al): der Einmal-pro-Spiel-Stempel wird erst nach dem Commit gesetzt – die Suchgalerie wird deshalb bestätigt
  // (ein Abbruch ließe den Stempel frei, siehe W13/a-q132-zi-nur-stufe-ignoriert.js).
  t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Divine Gift of Creation', answer: d => ({ selectedCards: [(d.cards[0].name || d.cards[0])] }), once: true });
  await go(t);
  R.check('Divine Gift per Zi gewirkt (Suchgalerie erschien)', gallerien(t) >= 2, gallerien(t));
  R.check('(a) Zi stempelt das Einmal-pro-Spiel-Limit von Divine Gift', t.gs.players[0]._oncePerGameUsed?.has('divineGift'), [...(t.gs.players[0]._oncePerGameUsed || [])]);

  // (b) bereits verbraucht
  t = await mk('Divine Gift of Creation');
  t.gs.players[0]._oncePerGameUsed = new Set(['divineGift']);
  await go(t);
  R.check('(b) Zi wirkt kein zweites Divine Gift im selben Spiel', gallerien(t) < 2, gallerien(t));

  // (c) Spielbedingung
  t = await mk('Call for Help');
  await go(t);
  const gespielt = t.lg ? t.lg('timeless_king_zi_perform').length : 0;
  const filler = t.pile(0, 'discardPile').includes(H.INERT.filler);
  R.note('(c) Call for Help ohne besiegte Kreatur', JSON.stringify({ gespielt, fillerAusDeckGespielt: filler, ablage: t.pile(0, 'discardPile') }));
  R.check('(c) Call for Help ohne besiegte Kreatur spielt keinen weiteren Zauber', !filler, t.pile(0, 'discardPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
