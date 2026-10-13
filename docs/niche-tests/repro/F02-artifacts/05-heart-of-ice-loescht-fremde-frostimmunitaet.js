'use strict';
// F02-05 · Heart of Ice überschreibt und löscht beim Abgang die angeborene Frost-Immunität eines Helden (Broghan)
// Kartentext Heart of Ice: „The equipped Hero cannot be Frozen." Broghan: „Cannot be Frozen" (angeboren).
// Aufbau: Sitz 0 hat Broghan als Held 0 (Immunität wie im Spielstart: `statuses.freeze_immune = { source: 'Broghan…', innate: true }`) und Heart of Ice auf der Hand.
// Schritte: 1. Heart of Ice an Broghan ausrüsten. 2. Heart zerstören (actionDestroyCard). 3. Direkt danach Frost auf Broghan (addHeroStatus 'frozen').
// Erwartet: Broghan bleibt durch seine eigene angeborene Immunität unfreezbar (die Karte hat ihm nichts weggenommen).
// Beobachtet: `heart-of-ice.js immunSetzen` ersetzt `statuses.freeze_immune` durch `{ source: 'Heart of Ice' }` (angeboren-Marke weg), `immunEntfernen` löscht den Eintrag beim Abgang → Broghan ist
//   bis zu seinem nächsten `onTurnStart` (Sicherheitsnetz) einfrierbar. Das Fenster reicht z. B. für „Zerstöre das Heart, dann friere den Träger ein" im selben Zug.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BROGHAN = 'Broghan, the Frozen Guardian of the North';
  const t = await H.fresh({ hand: [['Heart of Ice'], []], heroes: [[BROGHAN, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
  t.hero(0, 0).statuses.freeze_immune = { source: BROGHAN, innate: true };      // wie Broghans onGameStart
  await t.play(0, 'Heart of Ice', { hero: 0 });
  const heart = t.inst(c => c.name === 'Heart of Ice' && c.zone === 'support')[0];
  R.check('Heart liegt am Träger', !!heart, null);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, heart));
  R.check('Heart ist weg', !t.inst(c => c.name === 'Heart of Ice' && c.zone === 'support')[0], null);
  R.check('angeborene Immunität besteht weiter', !!t.hero(0, 0).statuses.freeze_immune, t.hero(0, 0).statuses.freeze_immune);
  await t.run(() => t.engine.addHeroStatus(0, 0, 'frozen', { duration: 1, appliedBy: 1 }));
  R.check('Broghan lässt sich nicht einfrieren', !t.hero(0, 0).statuses.frozen, t.hero(0, 0).statuses.frozen);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
