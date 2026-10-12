'use strict';
// C03-creatures-04 · Monster Nest (geliehen/gestohlen): nach dem Zugende steht die Karte ZWEIMAL auf dem Brett (Geister-Name ohne Instanz, Kartenbilanz +1)
// Kartentext: „You may once per turn choose a level 3 or lower Creature from your deck and place it on top of this card. … At the end of your turn, remove any Creature
//   placed on top of this one and delete it." – Lovely Teddy: „You may use that Creature's active effects as if you controlled it for the rest of the turn."
// Aufbau (echter Spielweg): Sitz 0 hat Lovely Teddy; Sitz 1 hat Monster Nest (Held 1 / Slot 1). Sitz 0 borgt das Nest per Teddy, aktiviert es (Kreatur aus dem
//   eigenen Deck), beendet den Zug (t.endTurn).
// Erwartung: Die Kreatur liegt auf dem Nest (also auf Brettseite 1), wird zum Zugende gelöscht, das Nest ist wieder normal da und gehört wieder Sitz 1.
//   Karten-Bilanz: unverändert (die gelegte Kreatur kam aus dem Deck → gelöscht). Audit sauber.
// Beobachtet: Die Kreatur wird auf die Seite des Borgenden gelegt (Sitz 0), das Nest bleibt als verdeckter Name in Zone 1/1 stehen. Zum Zugende „taucht" das Nest
//   (Kontrolleur = Sitz 0) in der Zone von Sitz 0 auf; der Name in Sitz 1 Zone 1/1 bleibt ohne Instanz zurück ⇒ Karte doppelt (+1 Monster Nest), Audit meldet Geister-Zone.
// Ursache: cards/effects/monster-nest.js onCreatureEffect: `summonCreatureWithHooks(chosen, pi = ctx.cardOwner (Kontrolleur), heroIdx, zoneSlot)` legt auf die Kontroll-Seite statt auf die
//   Brettseite des Nests; cards/effects/_nest-shared.js surface()/slotOf()/nestedUnder() arbeiten mit `inst.controller ?? inst.owner` statt mit engine.physicalSide(inst).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deck: [Array(20).fill(H.INERT.frail), Array(20).fill(H.INERT.creature)] });
  const teddy = t.put(0, 0, 0, 'Lovely Teddy'); teddy.turnPlayed = 1;
  const nest = t.put(1, 1, 1, 'Monster Nest'); nest.turnPlayed = 1;
  const c0 = t.census();
  t.gs.activePlayer = 0; t.phase(2);
  t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Monster Nest'); return v ? [v.id] : [valid[0].id]; };
  const r1 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
  R.check('Teddy borgt das Nest', r1 === true && nest.controller === 0 && nest.stolenBy === 0, [r1, nest.controller, nest.stolenBy]);
  t.targetFn = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Monster Nest', answer: (d) => ({ cardName: d.cards[0].name }) });
  const r2 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 1, zoneSlot: 1, charmedOwner: 1 }));
  R.note('Nest aktiviert', r2);
  R.note('Brett Sitz 0', t.gs.players[0].supportZones.map(h => h.map(z => z.join('|'))));
  R.note('Brett Sitz 1', t.gs.players[1].supportZones.map(h => h.map(z => z.join('|'))));
  R.check('Kreatur liegt AUF dem Nest (Brettseite 1, Held 1, Slot 1), nicht auf der Seite des Borgenden',
    t.gs.players[1].supportZones[1][1][0] === H.INERT.frail && !t.gs.players[0].supportZones.some(h => h.some(z => z[0] === H.INERT.frail)), [t.gs.players[0].supportZones[1], t.gs.players[1].supportZones[1]]);
  await t.endTurn();
  R.note('Brett Sitz 0 nach Zugende', t.gs.players[0].supportZones.map(h => h.map(z => z.join('|'))));
  R.note('Brett Sitz 1 nach Zugende', t.gs.players[1].supportZones.map(h => h.map(z => z.join('|'))));
  const bilanz = t.censusDiff(c0, t.census());
  R.check('Kartenbilanz: kein zusätzliches Monster Nest', !bilanz.includes('Monster Nest: +1'), bilanz);
  R.check('Zustand sauber (Zone ↔ Instanz)', t.audit().length === 0, t.audit());
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
