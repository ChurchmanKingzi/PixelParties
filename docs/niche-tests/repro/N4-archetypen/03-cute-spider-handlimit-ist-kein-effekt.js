'use strict';
// N4-archetypen-03 · Cute Spider: der Regel-Abwurf des Handlimits löst „discard … through an effect" aus
// Kartentext (Cute Spider): „Once per turn, when you discard a Surprise one of your Heroes can use through an effect, you may immediately activate and resolve that Surprise as if any
//   target of your choice met its activation condition. Delete the Surprise afterwards."
// Ruling (CARD_API.md Z. 20443, Welle 12 Q93, Al zu Glass of Marbles „… by an effect"): „NUR Karteneffekte, nicht das Hand-Size-Limit." Der Regel-Abwurf ruft `onDiscard` mit `_handLimitRegel: true`.
// Erwartung: Wirft Sitz 0 am Zugende wegen des Handlimits eine Surprise ab, bietet Cute Spider KEINE Aktivierung an (kein Karteneffekt). Wirft ein Effekt dieselbe Surprise ab → Angebot (Gegenprobe).
// Beobachtet: cute-spider.js prüft `ctx._handLimitRegel` nicht → Angebot „Activate the discarded Spider Avalanche for free?" beim Handlimit-Abwurf, Surprise wird aktiviert und gelöscht.
const H = require('../../lib/h.js');
async function szene() {
  const t = await H.fresh({ hand: [['Spider Avalanche', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: 0 });
  t.setAbilities(0, 0, [['Summoning Magic'], ['Destruction Magic'], []]);
  const cs = t.put(0, 0, 0, 'Cute Spider'); cs.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  return t;
}
const angebote = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === 'Cute Spider').length;
(async () => {
  const R = H.runner();
  // Gegenprobe: Karteneffekt wirft die Surprise ab
  let t = await szene();
  t.gs.activePlayer = 0; t.phase(3);
  await t.run(() => t.engine.actionDiscardHandCard(0, 'Spider Avalanche', 0, { source: 'Test-Effekt', selfInflicted: true }));
  R.check('Gegenprobe: Abwurf durch einen Effekt → Cute Spider bietet die Aktivierung an', angebote(t) === 1, angebote(t));
  // Handlimit
  t = await szene();
  t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ handIndex: 0, selectedCards: [{ handIndex: 0, cardName: 'Spider Avalanche' }], cardName: 'Spider Avalanche' }), once: true });
  t.gs.activePlayer = 0; t.phase(4);
  t.reset();
  await t.endTurn();
  R.check('Aufbau: die Surprise wurde per Handlimit abgeworfen', t.logs.some(l => l.type === 'hand_limit_discard'), t.logs.map(l => l.type));
  R.check('Handlimit-Abwurf ist kein Karteneffekt → Cute Spider bietet nichts an', angebote(t) === 0, angebote(t));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
