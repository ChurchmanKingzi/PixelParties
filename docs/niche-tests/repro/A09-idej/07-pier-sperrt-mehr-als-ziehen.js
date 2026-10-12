'use strict';
// A09-07 · Smuggler's Pier: „… they cannot draw cards for the rest of the turn afterwards." – das Skript setzt aber die VOLLE Handsperre (handLocked), die auch Suchen/Karten-Hinzufügen verbietet
// Kartentext Pier: „If a player draws cards through this effect, they cannot draw cards for the rest of the turn afterwards."
// Gleiche Formulierung, andere Umsetzung: Sacred Jewel („you cannot draw any cards …") und Prayer („you cannot draw cards for the rest of the turn afterwards") setzen `ps.drawLocked` („reiner Zieh-Lock").
// Wo Karten Suchen UND Ziehen sperren wollen, steht es im Text („cannot draw or add cards": Kazena, Jenny). Engine-Kommentar (_engine.js ~10873): „Der volle handLocked blockiert zusätzlich Searches/Tutoren/Adds."
// Aufbau: Seed 1234. Seite 0: Smuggler's Pier im Feld, 100 Gold, Elven Archer (Held 0, Slot 0), Hand [Elven Rider], Deck mit Elven Leader.
// Schritte: 1. Pier aktivieren (5 Gold -> 1 Karte). 2. Elven Archer wird besiegt -> Elven Rider (Reaktion) ja -> Rider-Suche nach einer Elven-Kreatur.
// Erwartet: Nach dem Pier-Zug darf man weiter SUCHEN (Elven Leader landet auf der Hand); gesperrt ist nur das Ziehen.
// Beobachtet: ps.handLocked = true; die Rider-Suche wird still übersprungen („elven_rider_tutor_handlocked"), nichts kommt auf die Hand.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Elven Rider'], []], gold: [100, 100], deck: [[H.INERT.creature, H.INERT.creature, 'Elven Leader', 'Archer', ...Array(10).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  t.putArea(0, "Smuggler's Pier");
  const archer = t.put(0, 0, 0, 'Elven Archer');
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === "Smuggler's Pier", answer: () => ({ optionId: 'pay-1' }) });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Elven Rider', answer: (d) => ({ cardName: 'Elven Leader' }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.run(() => t.engine.activateAreaEffect(0, 0, "Smuggler's Pier"));
  const ps = t.gs.players[0];
  R.note('Sperrflags nach Pier-Zug', { handLocked: !!ps.handLocked, drawLocked: !!ps.drawLocked });
  R.check('Pier setzt die reine Zieh-Sperre (drawLocked), nicht die volle handLocked', !!ps.drawLocked && !ps.handLocked, { handLocked: ps.handLocked, drawLocked: ps.drawLocked });
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, archer));
  R.check('Elven Rider wurde in Archers Zone beschworen', !!t.find('Elven Rider', 'support'), t.pile(0, 'hand'));
  R.check('Rider-Suche (kein Ziehen) funktioniert nach dem Pier-Zug: Elven Leader auf der Hand', t.pile(0, 'hand').includes('Elven Leader'), { hand: t.pile(0, 'hand'), deckHatLeader: t.pile(0, 'mainDeck').includes('Elven Leader') });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
