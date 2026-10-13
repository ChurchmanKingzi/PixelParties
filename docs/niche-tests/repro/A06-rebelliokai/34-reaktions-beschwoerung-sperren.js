'use strict';
// A06-rebelliokai-34 · Rider Warg, Corpse Cannibal und Terror Tengu beschwören "as an additional Action" trotz Beschwörungs-/Aktionssperre
// Kartentexte: Chaorc Rider Warg „Immediately summon this Creature from your hand as an additional Action when a Creature you control is defeated
//   by an opponent's card or effect." · Chaorc Corpse Cannibal „You may immediately summon this Creature from your hand as an additional Action
//   when you sacrifice a Creature …" · Rebelliokai Terror Tengu „… you may immediately summon up to 3 "Rebelliokai" Creatures … as additional Actions."
// Ruling (_summon-eligibility.js Kopf, 8.8./28.8.; CARD_API.md ~Z. 18161): „summon as an additional Action" ist eine ganz normale Beschwörung;
//   `summonLocked` sperrt JEDE echte Beschwörung, Aktionssperren (`_actionLockedTurn` …) sperren auch Zusatzaktionen.
// Beobachtung: Warg und Cannibal prüfen die eigene Spalte nur mit `engine._canHeroActivateSurprise` (kennt weder summonLocked noch Aktionssperre,
//   chaorc-rider-warg.js:50, chaorc-corpse-cannibal.js:105); Terror Tengu baut `_eligibleDestinations` selbst (kein heroActionLocked).
//   Frozen/Stunned wird korrekt abgewiesen (Kontrolle).
// Erwartung: unter summonLocked bzw. bei aktionsgesperrtem Helden wird nichts beschworen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const SM1 = [['Summoning Magic']], SM2 = [['Summoning Magic', 'Summoning Magic']];
  const old = (inst, t) => { inst.turnPlayed = t.gs.turn - 1; return inst; };
  const opp = { name: 'Opp Destroy', owner: 1, heroIdx: 0 };
  const onBoard = (t, name) => [0, 1, 2].some(hi => [0, 1, 2].some(z => t.zone(0, hi, z) === name));
  const apply = (t, st) => {
    for (let hi = 0; hi < 3; hi++) {
      if (st === 'frozen') t.heroStatus(0, hi, 'frozen');
      if (st === 'actionLocked') t.hero(0, hi)._actionLockedTurn = t.gs.turn;
    }
    if (st === 'summonLocked') t.gs.players[0].summonLocked = true;
  };
  for (const st of ['frozen', 'summonLocked', 'actionLocked']) {
    // Rider Warg: eigene Kreatur wird vom Gegner zerstört
    let t = await H.fresh({ hand: [['Chaorc Rider Warg'], []] });
    for (let hi = 0; hi < 3; hi++) t.setAbilities(0, hi, SM2);
    const v = old(t.put(0, 0, 0, D), t);
    apply(t, st);
    await t.run(() => t.engine.actionDestroyCard(opp, v, { sourceOwner: 1 }));
    R.check('Rider Warg unter ' + st + ': nicht beschworen', !onBoard(t, 'Chaorc Rider Warg'), { hand: t.pile(0, 'hand') });

    // Corpse Cannibal: Opfer durch Pyre Grill Master
    t = await H.fresh({ hand: [['Chaorc Corpse Cannibal'], []] });
    for (let hi = 0; hi < 3; hi++) t.setAbilities(0, hi, SM1);
    old(t.put(0, 0, 0, 'Chaorc Pyre Grill Master'), t); old(t.put(0, 0, 1, D), t);
    apply(t, st);
    t.gs.currentPhase = 2; t.resetActions(0);
    t.targetFn = (valid) => { const x = valid.find(q => q.cardName === D && q.owner === 0); return x ? [x.id] : [valid[0].id]; };
    t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }) });
    await t.activateCreature(0, 0, 0);
    R.check('Corpse Cannibal unter ' + st + ': nicht beschworen', !onBoard(t, 'Chaorc Corpse Cannibal'), { hand: t.pile(0, 'hand') });
  }
  // Terror Tengu: Held 0 beschwört selbst, die Folge-Beschwörungen gehen nur zu Held 1
  for (const st of ['frozen', 'actionLocked']) {
    const t = await H.fresh({ hand: [['Rebelliokai Terror Tengu'], []], discard: [['Rebelliokai Kind Kitsune', 'Rebelliokai Timid Tanuki'], []] });
    t.setAbilities(0, 0, SM1); t.setAbilities(0, 1, SM1);
    t.put(0, 0, 1, D); t.put(0, 0, 2, D);
    for (let z = 0; z < 3; z++) t.put(0, 2, z, D);
    if (st === 'frozen') t.heroStatus(0, 1, 'frozen'); else t.hero(0, 1)._actionLockedTurn = t.gs.turn;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.slice(0, 2).map(c => c.name || c) }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    await t.play(0, 'Rebelliokai Terror Tengu', { hero: 0, slot: 0, noGrant: true });
    R.check('Terror Tengu: Folge-Beschwörungen nicht über Held 1 (' + st + ')', [0, 1, 2].every(z => t.zone(0, 1, z) == null), [0, 1, 2].map(z => t.zone(0, 1, z)));
  }
  R.finish();
})();
