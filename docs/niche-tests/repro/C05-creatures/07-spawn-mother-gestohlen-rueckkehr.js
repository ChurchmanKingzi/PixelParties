'use strict';
// C05-creatures-07 · The Spawn Mother (gestohlen): „add this Creature you control to YOUR hand" landet in der Hand des BESITZERS
// Kartentext: „You may spend an Action to add this Creature you control to your hand."
// Erwartung: Der Kontrolleur (Dieb) gibt die Aktion aus, „this Creature you control" kommt in SEINE Hand („your hand"); der Besitzer wird vermerkt
//   (`_tagHandCardOrigin`), die Karte gehört beim Ablegen weiter ihm. Es gibt dafür den Weg `actionMoveCard(inst,'hand',-1,-1,{ toPlayer })` (CARD_API Z. 3955).
// Beobachtet: Die Spawn Mother geht in die Hand des BESITZERS (Sitz 1); der Dieb zahlt die Aktion und schenkt dem Gegner die Karte zurück.
// Ursache: `cards/effects/the-spawn-mother.js` `onCreatureEffect` (Z. 307): `actionMoveCard(inst, 'hand', -1, -1, { source, sourceOwner: ctrl })` ohne `toPlayer: ctrl`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const sm = t.put(1, 0, 0, 'The Spawn Mother');
  await t.engine.actionStealCreature(0, sm);                          // Sitz 0 stiehlt die Kreatur (bleibt in der Zone des Gegners)
  sm.turnPlayed = 1;
  R.check('Aufbau: Besitzer 1, Kontrolleur 0', sm.owner === 1 && sm.controller === 0, [sm.owner, sm.controller]);
  t.gs.activePlayer = 0; t.phase(3); t.resetActions(0);
  const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0, charmedOwner: 1 }));   // Aktivierung einer Kreatur in der Zone des Gegners
  R.check('Aufbau: Aktivierung vom Server behandelt', r === true && !t.find('The Spawn Mother', 'support'), r);
  R.check('Spawn Mother in der Hand des Kontrolleurs (Sitz 0)', t.pile(0, 'hand').includes('The Spawn Mother'), { hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand') });
  R.check('Spawn Mother NICHT in der Hand des Besitzers (Sitz 1)', !t.pile(1, 'hand').includes('The Spawn Mother'), t.pile(1, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
