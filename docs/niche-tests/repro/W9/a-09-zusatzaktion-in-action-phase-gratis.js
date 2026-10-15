'use strict';
// W9a · Q15 (A02-deepsea-36) · Al, 15.10.2026: „Ja, soll sie! Das gilt generell für verfügbare Zusatzaktionen während der Action Phase.“
// Erwartet: Eine Zusatzaktion (kein Second-Action-Grant), die in der Action Phase bei noch freier Hauptaktion benutzt wird, verbraucht die Hauptaktion nicht
//   und beendet die Action Phase nicht. (1) Deepsea Primordium → Werewolf als Zusatzaktion → Fireball (Hauptaktion) danach noch spielbar, Phase danach Main 2.
//   (2) Wolflesia (Zusatz-Zauberaktion der Kreatur) VOR der Hauptaktion: Phase bleibt 3, der Held kann danach seine Hauptaktion nutzen.
const H = require('../../lib/h.js');
const D = H.INERT.creature;
(async () => {
  const R = H.runner();
  // (1) Primordium
  {
    const t = await H.fresh({ hand: [['Deepsea Primordium', 'Deepsea Werewolf', 'Fireball'], []] });
    t.put(0, 0, 0, 'Deepsea Bats').turnPlayed = 1;
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], ['Destruction Magic']]);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
    await t.play(0, 'Deepsea Primordium', { hero: 0, slot: 0, noGrant: true, keepActions: true });
    await t.play(0, 'Deepsea Werewolf', { hero: 0, slot: 1, keepActions: true });
    R.check('(1) Werewolf per Primordium-Zusatzaktion gespielt, Phase bleibt 3', t.zone(0, 0, 1) === 'Deepsea Werewolf' && t.gs.currentPhase === 3, { phase: t.gs.currentPhase });
    R.check('(1) Hauptaktion unverbraucht (kein Held gehandelt)', (t.gs.players[0].heroesActedThisTurn || []).length === 0, t.gs.players[0].heroesActedThisTurn);
    const r = await t.play(0, 'Fireball', { hero: 0, keepActions: true });
    R.check('(1) Fireball danach als Hauptaktion spielbar', r === true && t.hp(1, 0) < 800 && (t.gs.players[0].heroesActedThisTurn || []).length === 1, { r, hp: t.hp(1, 0) });
    R.check('(1) danach Main Phase 2', t.gs.currentPhase === 4, t.gs.currentPhase);
    R.check('(1) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (2) Wolflesia: Zusatz-Zauber der Kreatur in der Action Phase VOR der Hauptaktion
  {
    const t = await H.fresh({ hand: [['Rafflesia, the Poison Princess', 'Brilliant Idea', 'Brilliant Idea', 'Brilliant Idea'], []], deck: [['Fireball', ...Array(10).fill(D)], []], deckSize: 20 });
    const w = t.put(0, 0, 0, 'Wolflesia, the Canine Flower'); w.turnPlayed = 1;
    t.gs.activePlayer = 0; t.phase(2); await t.activateCreature(0, 0, 0);   // Rafflesia anlegen ⇒ Grant
    t.script.push({ match: d => d && d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
    t.gs.activePlayer = 0; t.phase(3); t.resetActions(0);
    const hi = t.pile(0, 'hand').indexOf('Brilliant Idea');
    const r1 = await t.run(() => t.host.doPlaySpell(t.room, 0, { cardName: 'Brilliant Idea', handIndex: hi, heroIdx: 0, viaCreatureInstId: w.id }));
    R.check('(2) Wolflesia-Zusatzzauber gespielt', r1 === true, r1);
    R.check('(2) Action Phase bleibt offen, Hauptaktion unverbraucht', t.gs.currentPhase === 3 && (t.gs.players[0].heroesActedThisTurn || []).length === 0, { phase: t.gs.currentPhase, acted: t.gs.players[0].heroesActedThisTurn });
    const r2 = await t.play(0, 'Brilliant Idea', { hero: 0, keepActions: true });
    R.check('(2) danach normale Hauptaktion spielbar', r2 === true && (t.gs.players[0].heroesActedThisTurn || []).length === 1, { r2 });
    R.check('(2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
