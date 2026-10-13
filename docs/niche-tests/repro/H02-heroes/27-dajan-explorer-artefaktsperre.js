// H02-heroes-27 · Legendary Explorer Dajan: das Deck-Spielen ignoriert die Artefakt-Sperre („You cannot play any Artifacts for the rest of this turn")
//
// Kartentext Boomerang: „Choose an Artifact from your discard pile and add it to your hand. You cannot play any Artifacts for the rest of this turn."  (Skript: `ps._artifactLockTurn = gs.turn`)
// Kartentext Dajan: „… spend your Action to choose an Artifact from your deck and play it immediately."
// Der Handweg (`doPlayArtifact`/`doUseArtifactEffect`, server.js ~7468/12057) und `_free-artifact-shared.js:64` (Dajan, Conqueror) prüfen die Sperre, Dajans `onHeroEffect` nicht.
// Aufbau: Dajan auf Held 0, 100 Gold, Deck mit Diver Helmet (Cost 4), Ablage mit einem Artefakt, Boomerang auf der Hand. Boomerang in der Main Phase 1, danach in der Action Phase Dajans Effekt.
// Erwartung: nach Boomerang kann Dajan keinen Artefakt spielen. Beobachtung: Diver Helmet wird aus dem Deck ausgerüstet.
// Aufruf: node docs/niche-tests/repro/H02-heroes/27-dajan-explorer-artefaktsperre.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const DJ = 'Legendary Explorer Dajan';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[DJ, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], gold: 100, hand: [['Boomerang'], []], deck: [['Diver Helmet', 'ZZ Dummy', 'ZZ Dummy'], []], discard: [[H.INERT.artifact], []] });
  t.script.push({ match: d => d.type === 'cardGallery' && /Boomerang/.test(d.title || ''), answer: (d) => ({ cardName: d.cards[0].name }) });
  const rb = await t.play(0, 'Boomerang', {});
  R.check('Boomerang gespielt, Sperre gesetzt', rb === true && t.gs.players[0]._artifactLockTurn === t.gs.turn, { rb, lock: t.gs.players[0]._artifactLockTurn, turn: t.gs.turn });
  // Kontrolle: der Handweg ist gesperrt
  t.addHand(0, 'Diver Helmet');
  const rh = await t.play(0, 'Diver Helmet', { hero: 0, handIndex: t.pile(0, 'hand').length - 1 });
  R.check('Kontrolle: Diver Helmet aus der Hand gesperrt', rh === false, rh);
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.heroIdx === 0).id];
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === DJ, answer: () => ({ cardName: 'Diver Helmet' }) });
  t.resetActions(0);
  await t.activateHero(0, 0, { effect: DJ, phase: 3 });
  const helm = t.inst(c => c.name === 'Diver Helmet' && c.zone === 'support').length;
  R.check('Dajan: kein Artefakt aus dem Deck unter der Artefakt-Sperre', helm === 0, { helm, gold: t.gs.players[0].gold });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
