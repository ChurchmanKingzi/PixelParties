'use strict';
// A01-pollution-30 · Pollution Spewer: das „einmal pro Zug“ hängt an (Besitzer, Held, Slot) statt an der Karte
// Kartentext: „Once per turn, when a Pollution Token is removed from your side of the board, you may choose a target and deal 80 damage to it.“ (Skript: „HOPT is tracked per-instance“)
// Schlüssel im Skript: `pollution_spewer:${ctx.cardOriginalOwner}:${ctx.cardHeroIdx}:${ctx.card?.zoneSlot}`.
// Fall (a): Spewer feuert, wird zerstört, ein ZWEITES Exemplar wird in denselben Slot gelegt → es ist eine andere Karte, darf in diesem Zug noch einmal feuern.
// Fall (b): zwei Spewer mit demselben Besitzer (1), einer auf Sitz 1s Brett, einer von Sitz 0 gestohlen und auf Sitz 0s Brett – gleicher Held-/Slotindex → teilen sich den Schlüssel;
//   der gestohlene feuert für Sitz 0, danach darf der eigene Spewer von Sitz 1 im selben Zug nicht mehr feuern (und umgekehrt).
// Erwartet: (a) 2 Schüsse, (b) 2 Schüsse.   Beobachtet: je nur 1 Schuss.
// Ursache: cards/effects/pollution-spewer.js, `hoptKey` (Position + Besitzer statt `ctx.card.id`).
// Aufruf: node docs/niche-tests/repro/A01-pollution/30-pollution-spewer-hopt-schluessel-nach-position.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const { removePollutionTokens } = require(H.ROOT + '/cards/effects/_pollution-shared');
const shoot = (t, seat, n) => t.run(() => removePollutionTokens(t.engine, seat, n, 'Test', {}));
(async () => {
  const R = H.runner();
  // (a)
  let t = await H.fresh({});
  const sp = t.put(0, 0, 0, 'Pollution Spewer');
  for (let i = 0; i < 4; i++) t.put(0, 1, i % 3, 'Pollution Token', { counters: { placedOnTurn: 1 } });
  let n = 0; t.targetFn = (v) => { n++; return [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id]; };
  await shoot(t, 0, 1);
  R.check('(a) erster Spewer feuert', n === 1, n);
  await t.run(() => t.engine.actionDestroyCard('Test', sp));
  t.put(0, 0, 0, 'Pollution Spewer');
  await shoot(t, 0, 1);
  R.check('(a) zweites Exemplar im selben Slot feuert im selben Zug noch einmal', n === 2, { schuesse: n, hp: t.hp(1, 0) });
  // (b)
  t = await H.fresh({});
  const b = t.put(1, 0, 0, 'Pollution Spewer');
  await t.run(() => t.engine.actionStealCreature(0, b));
  t.put(1, b.heroIdx, b.zoneSlot, 'Pollution Spewer');
  t.put(0, 2, 0, 'Pollution Token', { counters: { placedOnTurn: 1 } }); t.put(1, 2, 0, 'Pollution Token', { counters: { placedOnTurn: 1 } });
  n = 0; t.targetFn = (v) => { n++; return [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id]; };
  await shoot(t, 0, 1);
  R.check('(b) gestohlener Spewer feuert für Sitz 0', n === 1, n);
  await shoot(t, 1, 1);
  R.check('(b) eigener Spewer von Sitz 1 feuert im selben Zug für Sitz 1', n === 2, { schuesse: n });
  // Gegenprobe: derselbe Seite-1-Spewer ohne den gestohlenen feuert
  t = await H.fresh({});
  t.put(1, 0, 0, 'Pollution Spewer'); t.put(1, 2, 0, 'Pollution Token', { counters: { placedOnTurn: 1 } });
  n = 0; t.targetFn = (v) => { n++; return [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id]; };
  await shoot(t, 1, 1);
  R.check('Gegenprobe: eigener Spewer allein feuert (Aufbau trägt)', n === 1, n);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
