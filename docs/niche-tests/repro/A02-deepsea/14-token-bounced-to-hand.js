'use strict';
// A02-deepsea-14 · Shapeshift / Deepsea Castle / Deepsea Encounter: ein Token wird als KARTE auf die Hand genommen
//
// Kartentexte: Shapeshift „Choose a Creature in one of your Heroes' Support Zones and add it to your hand …"; Deepsea Castle „… add a Creature … to their hand …";
//   Deepsea Encounter „Add the Creature back to your hand and place a Creature …". Ein „Invader Token" (cardType Token, subtype Creature) ist eine Creature auf dem Brett.
// Konvention der Engine: Tokens sind keine Karten – sie gehen nie in Hand/Ablage (`_addCardToState` Z. ~48530: Token → Gelöscht-Stapel; `_enforceSupportZoneLock` Z. ~45373:
//   „echte Karten kehren in die Hand ihres Besitzers zurück, Tokens gehen ins Deleted"; Tod eines Tokens → deletedPile).
// Erwartung: Der Token verschwindet beim Tausch/Bounce (Gelöscht), es entsteht keine Handkarte „Invader Token".
// Beobachtet: `returnSupportCreatureToHand` / `atomicSwap` schreiben den Namen in die Hand (`handZugangSync(ps, cardName, { ohneInstanz: true })`) – die Hand enthält danach
//   eine Karte „Invader Token" (kein spielbares Spielobjekt; Token-Karte in der Hand).
// Ursache: `_deepsea-shared.js` `returnSupportCreatureToHand` (Z. ~275–381) und `atomicSwap` (Z. ~953–1100) kennen keine Token-Sonderbehandlung; Encounter nutzt dieselbe Funktion.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  for (const spell of ['Shapeshift', 'Deepsea Castle']) {
    R.section(spell + ' auf einen Invader Token');
    const t = await H.fresh({ hand: [[spell, H.INERT.creature], []] });
    const tok = t.put(0, 0, 0, 'Invader Token'); tok.turnPlayed = 1;
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = t.pile(0, 'hand').indexOf(H.INERT.creature); return { cardName: H.INERT.creature, handIndex: i, selectedCards: [{ cardName: H.INERT.creature, handIndex: i }] }; } });
    if (spell === 'Shapeshift') await t.play(0, 'Shapeshift', { hero: 0 });
    else { await t.play(0, 'Deepsea Castle', { hero: 0 }); t.phase(2); await t.run(() => t.engine.activateAreaEffect(0, 0, 'Deepsea Castle')); }
    R.check('Keine Handkarte „Invader Token"', !t.pile(0, 'hand').includes('Invader Token'), t.pile(0, 'hand'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Deepsea Encounter gegen Fireball auf einen Invader Token');
  {
    const t = await H.fresh({ hand: [['Deepsea Encounter', H.INERT.creature], ['Fireball']] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
    const tok = t.put(0, 0, 0, 'Invader Token'); tok.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 0 && v.slotIdx === 0).id];
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('Keine Handkarte „Invader Token"', !t.pile(0, 'hand').includes('Invader Token'), t.pile(0, 'hand'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
