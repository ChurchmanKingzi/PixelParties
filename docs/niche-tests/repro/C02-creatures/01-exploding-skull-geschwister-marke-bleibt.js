'use strict';
// C02-creatures-01 · Exploding Skull: die „Geschwister-Sperre" `_explodingSkullSuppressed` verfällt nie
// Kartentext (Exploding Skull): „When this Creature is defeated, deal 80 damage to all targets your opponent controls. You can only activate this effect once per turn."
// Aufbau: Seite 0 hat zwei Exploding Skulls (A, B), Seite 1 hat einen Dummy. Skull A wird in Zug 5 besiegt (80 Schaden ✓). Skull B bleibt liegen.
//   Zwei echte Zugwechsel später (Zug 7, wieder Sitz 0 am Zug, neues „einmal pro Zug") wird auch Skull B besiegt.
// Erwartung: Skull B löst im neuen Zug aus (80 Schaden auf alle Ziele des Gegners) – das Einmal-pro-Zug gilt je Zug.
// Beobachtet: Skull B explodiert nie. Beim Tod von A wird `counters._explodingSkullSuppressed = true` auf B gestempelt und nie gelöscht.
// Ursache: cards/effects/exploding-skull.js ~Z. 112/138 – die Marke ist als „gleicher Batch" gedacht, hat aber weder Zug- noch Ereignis-Bindung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const mk = (slot) => { const i = t.put(0, 0, slot, 'Exploding Skull'); i.turnPlayed = 1; return i; };
  const a = mk(0), b = mk(1);
  t.put(1, 0, 0, H.INERT.big);
  const hp0 = t.hp(1, 0);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, a));
  R.check('Skull A (Zug 5): 80 Schaden auf Held 1/0', t.hp(1, 0) === hp0 - 80, [hp0, t.hp(1, 0)]);
  R.note('Marke auf Skull B nach dem Tod von A', b.counters);
  await t.endTurn(); await t.endTurn();                    // Zug 6 (Sitz 1), Zug 7 (Sitz 0)
  R.note('Zug / aktiver Sitz', t.gs.turn + ' / ' + t.gs.activePlayer);
  const hp1 = t.hp(1, 0);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, b));
  R.check('Skull B (Zug 7, neuer Zug): 80 Schaden auf Held 1/0', t.hp(1, 0) === hp1 - 80, [hp1, t.hp(1, 0)]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
