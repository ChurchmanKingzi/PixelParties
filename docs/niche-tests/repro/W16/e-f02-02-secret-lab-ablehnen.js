'use strict';
// W16e · F02-02 Gegenprobe: Lehnt der Spieler die Zusatznutzung der Secret Lab Entrance ab ("Nein"), bleibt es bei einer Nutzung und der Lab-Stempel frei:
// im nächsten eigenen Zug wird sie wieder angeboten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], []], abilities: { 0: { 0: [['Inventing'], [], []] } } });
  t.put(0, 0, 0, 'Secret Lab Entrance');
  t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'ZZ Filler', handIndex: 0 }) });
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Secret Lab Entrance', answer: () => null, once: true });   // echtes "Nein"
  t.gs.activePlayer = 0; t.phase(2);
  const a1 = await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
  R.check('Aktivierung ok, nach "Nein" nur ein Abwurf', a1 === true && t.pile(0, 'discardPile').length === 1, t.pile(0, 'discardPile'));
  await t.endTurn(); await t.endTurn();
  t.setHand(0, ['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']);
  t.script.length = 0;
  t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'ZZ Filler', handIndex: 0 }) });
  const dis0 = t.pile(0, 'discardPile').length;
  const a2 = await t.run(() => { t.gs.activePlayer = 0; t.phase(2); return t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }); });
  R.check('nächster Zug: Zusatznutzung wird angeboten und angenommen (zwei Abwürfe)', a2 === true && t.pile(0, 'discardPile').length === dis0 + 2, { a2, ablage: t.pile(0, 'discardPile').length - dis0 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
