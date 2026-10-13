'use strict';
// A01-pollution-32 · Circle-of-Hell-Replay umgeht die Sperren „nur ein Zauber pro Zug“ (Eraser Beam) und „keine weitere Area“ (Reality Crack)
// Kartentexte: Eraser Beam „This must be the only Spell you play this turn.“ · Reality Crack „You cannot play another Area for the rest of the turn afterwards.“
//   Circle of Hell „… you may immediately delete all Areas you control and **play this deleted Spell** as an additional Action.“ (Area-Zauber)
// Fall (c): The Third Circle of Hell (Deck zeigen, einen Area-Zauber als Zusatzaktion spielen „if possible“) nach Reality Crack – derselbe Befund über `performImmediateActionAnyHero`.
// Aufbau: Sitz 0: Dante (Destruction Magic 3 + Magic Arts 3), Fifth Circle of Hell auf der Hand, eine gelöschte Area (Dantes Vorbedingung).
//   (a) echter Zug: Eraser Beam (Zauberspertre `_spellLockTurn`), dann Dante: Fifth Circle aus der Hand löschen (Weg 1) → Replay-Angebot „Ja“.
//   (b) echter Zug: Reality Crack (Area-Gallery abgebrochen; setzt `_cantPlayAreaThisTurn`), danach dasselbe.
// Erwartet: in beiden Fällen kein Replay-Angebot bzw. kein Wirken – die Fifth Circle bleibt im Gelöscht-Stapel (Hand-Kontrolle: Heal ist nach Eraser Beam gesperrt).
// Beobachtet: das Angebot erscheint, nach „Ja“ liegt die Fifth Circle als Area auf dem Brett (zweiter Zauber bzw. zweite Area im Zug).
// Ursache: `_hell-circles-shared.js` `moeglicheWirker` fragt `engine.getHeroEligibleActionCards(pi, hi)`; diese Liste (und `_castSpellImmediately`) liest weder `ps._spellLockTurn` (Eraser Beam, gelesen nur in `getHeroPlayableCards`/`validateActionPlay`, `_engine.js` ~20061/~20866) noch `ps._cantPlayAreaThisTurn`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/32-circle-replay-umgeht-zauber-und-area-sperre.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const DM = { 0: { 0: [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []] } };
const DANTE = ['Dante, the Wanderer of Hell', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'];
const tgt = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
(async () => {
  const R = H.runner();
  for (const first of ['Eraser Beam', 'Reality Crack']) {
    const t = await H.fresh({ hand: [[first, 'The Fifth Circle of Hell', 'Heal'], []], heroes: [DANTE, undefined], abilities: DM });
    t.gs.players[0].deletedPile.push('Acid Rain');
    t.policy.confirm = true; t.targetFn = tgt;
    t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Reality Crack', answer: () => ({ cancelled: true }) });
    t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'The Fifth Circle of Hell' }) });
    await t.play(0, first, { hero: 0 });
    if (first === 'Eraser Beam') {
      const heal = await t.play(0, 'Heal', { hero: 0, keepActions: true });
      R.check('Kontrolle: Heal aus der Hand nach Eraser Beam gesperrt', heal === false, heal);
    }
    await t.activateHero(0, 0, {});
    await t.run(() => t.engine._runPostChainActions());
    const areas = t.gs.areaZones[0];
    R.check(`nach ${first}: Fifth Circle wird nicht als zweiter Zauber/Area gewirkt`, !areas.includes('The Fifth Circle of Hell'), { areas, gelöscht: t.pile(0, 'deletedPile') });
    R.check(`nach ${first}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  // (c) The Third Circle of Hell (Weg „aus dem Deck zeigen und spielen“) nach Reality Crack: ebenfalls eine zweite Area
  {
    const t = await H.fresh({ hand: [['Reality Crack', 'The Third Circle of Hell', 'Heal'], []],
      deck: [[H.INERT.filler, 'The Fourth Circle of Hell', 'Heal', H.INERT.filler, H.INERT.filler, H.INERT.filler, H.INERT.filler, H.INERT.filler], []], heroes: [DANTE, undefined], abilities: DM });
    t.gs.players[0].deletedPile.push('Acid Rain');
    t.policy.confirm = true; t.targetFn = tgt;
    t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Reality Crack', answer: () => ({ cancelled: true }) });
    t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'The Third Circle of Hell' }) });
    await t.play(0, 'Reality Crack', { hero: 0 });
    await t.activateHero(0, 0, {});
    await t.run(() => t.engine._runPostChainActions());
    R.check('(c) nach Reality Crack: Third Circle spielt keinen Area-Zauber aus dem Deck', !t.gs.areaZones[0].includes('The Fourth Circle of Hell'), t.gs.areaZones[0]);
    R.check('(c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
