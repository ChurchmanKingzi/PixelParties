'use strict';
// A07-24 · Smug Mastermind Antonia: gegnerische Surprises werden mit einer ID angeboten, die der Client nicht anklicken kann
//
// Kartentext Antonia: „… when a Creature you control takes damage, you may discard a card to choose any card on the board that is not
//   a Hero and send it to the discard pile."
// Client-Vertrag (public/app-board.jsx:49785/49817): eine Surprise-Zone ist nur unter `surprise-<Seite>-<Heldenindex>` (Typ 'surprise')
//   anklickbar. `_targeting-shared.js:132-141` (v706): „Die alte `equip-…-surprise`-ID war für den Client unsichtbar" – dort ist das
//   behoben (Typ 'surprise', ID `surprise-<owner>-<heroIdx>`); Antonia hat eine eigene Kopie der Zielsammlung mit der alten ID.
// Erwartung: Das Surprise-Ziel trägt `surprise-1-0` / Typ 'surprise' (wie im geteilten Sammler und wie Skeleton Archer es tut).
// Beobachtet: Antonia bietet `equip-1-0-surprise` mit Typ 'equip' an – im echten Client nicht anklickbar (Surprises sind für Antonia
//   faktisch nie wählbar, obwohl der Text „any card on the board that is not a Hero" sagt). Headless ist die Wahl über die ID möglich.
// Vermutete Ursache: `smug-mastermind-antonia.js` `collectNonHeroBoardTargets` (lokale Kopie, Zweig `inst.zone === 'surprise'`) –
//   der geteilte Sammler `_targeting-shared.js` ist nicht benutzt.
const H = require('../../lib/h.js');
const F = H.INERT.filler;

(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Cool Rescuer Monia', F, F, F], []], deckSize: 10 });
  const ant = t.put(0, 0, 0, 'Smug Mastermind Antonia'); ant.turnPlayed = 1;
  const mine = t.put(0, 1, 0, H.INERT.big);
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);                     // Monia anlegen (Antonia wird „scharf")
  R.check('Vorbedingung: Monia liegt unter Antonia', ant.counters.attachedHero === 'Cool Rescuer Monia', ant.counters.attachedHero);
  t.putSurprise(1, 0, 'Booby Trap');
  let angeboten = null;
  t.targetFn = (v) => { angeboten = v.map(x => ({ id: x.id, type: x.type, cardName: x.cardName })); return [v.find(x => x.cardName === 'Booby Trap').id]; };
  t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
  await t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, mine, 50, 'creature');   // löst Antonia aus
  const s = (angeboten || []).find(x => x.cardName === 'Booby Trap');
  R.check('Antonia bietet die gegnerische Surprise an (Vorbedingung)', !!s, angeboten);
  R.check('Surprise-Ziel hat die Client-ID `surprise-1-0` und Typ \'surprise\'', s && s.id === 'surprise-1-0' && s.type === 'surprise', s);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
