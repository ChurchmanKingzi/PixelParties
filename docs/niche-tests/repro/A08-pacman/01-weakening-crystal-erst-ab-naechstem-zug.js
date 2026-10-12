// A08-01 · Weakening Crystal negiert die Helden erst ab dem NÄCHSTEN eigenen Zugbeginn
//
// Kartentext (Weakening Crystal): „When you draw or add this card to your hand, you must immediately reveal it.
//   While this card is in your hand, the effects of all your Heroes are negated. This counts as a negative status effect."
// Ruling (CARD_API.md „★ Weakening Crystal: HEILBAR, ABER WIEDERKEHREND (v1103)" und Kopf von `_crystals-shared.js`):
//   „angelegt nur an drei Zeitpunkten (reapply: true): Eintritt in die Hand, Rundenbeginn des Betroffenen, Laden eines Spielstands."
//
// Erwartung: Sobald die Karte auf der Hand liegt (hier: im Ressourcen-Schritt gezogen), sind die Heldeneffekte des Ziehenden
//   negiert – der Held trägt `negated` und seine aktiven Effekte sind gesperrt.
// Beobachtet: Der einzige Aufruf mit `reapply: true` steht beim Zugbeginn (`_engine.js:22560`), und zwar VOR dem Ziehen; `sync()` räumt nur
//   auf (`_engine.js:48969`). Eine gezogene/geschenkte/gesuchte Karte negiert deshalb erst zu Beginn des nächsten EIGENEN Zuges –
//   der Ziehende kann im Zug, in dem er sie zieht, alle Heldeneffekte normal benutzen. Der Eintritts-Zeitpunkt aus dem Ruling fehlt.
//
// Aufruf: node docs/niche-tests/repro/A08-pacman/01-weakening-crystal-erst-ab-naechstem-zug.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const WAFLAV = 'Waflav, the Metamorphing Monstrosity';
  const t = await H.fresh({
    heroes: [[WAFLAV, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null],
    hand: [[], []],
    deck: [[F, 'Weakening Crystal', F, F, F, F, F, F], [F, F, F, F, F, F, F, F]],
  });
  t.hero(0, 0)._evolutionCounters = 1;
  await t.endTurn();                                   // Zug 6 (Sitz 1)
  await t.endTurn();                                   // Zug 7 (Sitz 0 zieht F) – der Kristall ist die nächste Karte
  await t.endTurn(); await t.endTurn();                // Zug 9: Sitz 0 zieht im Ressourcen-Schritt den Weakening Crystal
  R.check('Aufbau: Weakening Crystal liegt auf der Hand von Sitz 0', t.pile(0, 'hand').includes('Weakening Crystal'), t.pile(0, 'hand'));
  R.check('Aufbau: Sitz 0 ist am Zug', t.gs.activePlayer === 0, t.gs.activePlayer);
  R.check('Held 0 trägt „negated", solange der Kristall auf der Hand liegt', !!t.hero(0, 0).statuses.negated, Object.keys(t.hero(0, 0).statuses));
  t.reset();
  t.script.push({ match: d => d && d.type === 'optionPicker', once: true, answer: () => ({ optionId: 'draw' }) });
  const handVorher = t.pile(0, 'hand').length;
  await t.activateHero(0, 0, {});
  const gezogen = t.pile(0, 'hand').length - handVorher;
  R.check('Heldeneffekt (Waflav: 3 Karten ziehen) ist gesperrt (0 Karten gezogen)', gezogen === 0, { gezogen });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
