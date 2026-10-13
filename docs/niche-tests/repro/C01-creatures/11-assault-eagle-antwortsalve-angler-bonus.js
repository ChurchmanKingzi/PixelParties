'use strict';
// C01-creatures-11 · Assault Eagle + Angler Angel: die Antwort-Salve des Gegners („Then, your opponent may …") bekommt den Angler-Bonus ebenfalls
// Kartentext Assault Eagle: „… deal 100 damage to them. Then, your opponent may choose up to the same number of targets on the board and deal 50 damage to them."
// Ruling 20.8. (angler-angel.js Kopf): „Angler erhoeht nur die erste Schadens-Instanz jeder Creature." (Elven Leader / 3-Headed Giant: nur der erste Schlag +50)
// Aufbau: Seed 1234. Sitz 0: Assault Eagle + Angler Angel. Sitz 1 (oder 0) hat zwei Kreaturen; Salve 1 trifft eine Gegner-Kreatur (100 + 50), Antwort trifft EINE Kreatur von Sitz 0 (50).
// Erwartung (Lesart: zwei getrennte Schadensinstanzen derselben Kreatur): Salve 1 = 150, Antwort = 50 (kein zweiter Bonus).
// Beobachtet: Salve 1 = 150, Antwort = 100 – beide Salven teilen EIN Quell-Literal (`const source` in `onCreatureEffect`), Angler erkennt die zweite Salve als „weiteren Treffer derselben gleichzeitigen Instanz".
// Ursache: cards/effects/assault-eagle.js `const source = { name, owner: pi, heroIdx }` (Z. ~122) wird in `schlagen()` für BEIDE Salven benutzt; angler-angel.js `darfErhoehen` (`quelle._anglerInstanz === turn`).
// Stufe C: ob die Antwort-Salve (vom Gegner gewählt, nach Pause) noch zur „gleichen" Schadensinstanz zählt, ist Auslegungssache.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const gs = t.gs;
  t.put(0, 0, 0, 'Assault Eagle').turnPlayed = 1; t.put(0, 1, 0, 'Angler Angel').turnPlayed = 1;
  const feind = t.put(1, 0, 0, H.INERT.big);
  const meine = t.put(0, 2, 0, H.INERT.big);
  let calls = 0;
  t.targetFn = (valid) => { calls++; return calls === 1 ? [valid.find(v => v.owner === 1 && v.type !== 'hero').id] : [valid.find(v => v.owner === 0 && v.cardName === H.INERT.big).id]; };
  gs.currentPhase = 2;
  await t.activateCreature(0, 0, 0);
  const salve1 = 1000 - feind.counters.currentHp, antwort = 1000 - meine.counters.currentHp;
  R.note('Schaden', { salve1, antwort });
  R.check('Salve 1 = 150 (100 + Angler 50)', salve1 === 150, salve1);
  R.check('Antwort-Salve = 50 (nur die erste Schadensinstanz wird erhöht)', antwort === 50, antwort);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
