'use strict';
// N4-archetypen-04 · Alleria zieht auch, wenn Cute Spider eine aus der Hand abgeworfene Surprise aktiviert (die nie in ihrer Surprise Zone lag)
// Kartentext (Alleria, the Queen of Spiders): „When a Surprise in this Hero's Surprise Zone activates, draw 1 card."
// Kartentext (Cute Spider): „… when you discard a Surprise one of your Heroes can use through an effect, you may immediately activate and resolve that Surprise as if any target of your
//   choice met its activation condition. Delete the Surprise afterwards."
// Erwartung: Die Surprise kommt aus der Hand/Ablage, nicht aus einer Surprise Zone → kein Alleria-Zug. (Ohne Alleria: Handgröße −1 durch den Abwurf.)
// Beobachtet: `onSurpriseActivated` in alleria-the-queen-of-spiders.js prüft nur Held-Index/Seite des AKTIVIERENDEN Helden (ctx.heroIdx === ctx.cardHeroIdx), nicht, ob die Karte in der Zone lag →
//   Alleria zieht 1 (Log `alleria_surprise_draw`).
const H = require('../../lib/h.js');
async function lauf(mitAlleria) {
  const heroes = [[mitAlleria ? 'Alleria, the Queen of Spiders' : H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
  const t = await H.fresh({ heroes, hand: [['Spider Avalanche', 'ZZ Filler', 'ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: 0 });
  t.setAbilities(0, 0, [['Summoning Magic'], ['Destruction Magic'], []]);
  const cs = t.put(0, 0, 0, 'Cute Spider'); cs.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.gs.activePlayer = 0; t.phase(3);
  const h0 = t.pile(0, 'hand').length;
  await t.run(() => t.engine.actionDiscardHandCard(0, 'Spider Avalanche', 0, { source: 'Test-Effekt', selfInflicted: true }));
  return { t, delta: t.pile(0, 'hand').length - h0, aktiviert: t.logs.some(l => l.type === 'cute_spider_force_activate'), zug: t.logs.some(l => l.type === 'alleria_surprise_draw') };
}
(async () => {
  const R = H.runner();
  const k = await lauf(false);
  R.check('Gegenprobe (ohne Alleria): Surprise aktiviert, Hand −1 (nur der Abwurf)', k.aktiviert && k.delta === -1, k);
  const a = await lauf(true);
  R.check('Aufbau: Cute Spider hat die Surprise aktiviert', a.aktiviert, a.aktiviert);
  R.check('Alleria zieht NICHT (Surprise lag nicht in ihrer Surprise Zone)', !a.zug && a.delta === -1, { delta: a.delta, zug: a.zug });
  R.check('keine Engine-Fehler', a.t.errors.length === 0, a.t.errors);
  R.finish();
})();
