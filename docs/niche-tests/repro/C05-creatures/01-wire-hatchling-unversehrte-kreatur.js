'use strict';
// C05-creatures-01 · Wire Hatchling richtet gegen eine UNVERSEHRTE Kreatur keinen Schaden an
// Kartentext (Wire Hatchling): „When you summon this Creature, choose any target on the board and deal damage to it equal to half its
//   current HP (rounded up)."
// Erwartung: Ziel = unversehrte Kreatur mit 200 HP („ZZ Dummy", echt gespielt) -> aktuelle HP = 200 -> 100 Schaden -> 100 HP übrig.
//   (Kontrolle: gegen einen HELDEN und gegen eine VORBESCHÄDIGTE Kreatur funktioniert die Karte.)
// Beobachtet: Es passiert NICHTS (die Kreatur hat danach weiter volle HP), kein Fehler. Die Engine legt `counters.currentHp` erst beim
//   ersten Schaden an (`_engine.js` ~46382: `if (!e.inst.counters.currentHp) e.inst.counters.currentHp = maxHp`); eine frisch beschworene
//   Kreatur hat `counters = {}`.
// Ursache: wire-hatchling.js `const hp = inst?.counters?.currentHp ?? 0; if (!inst || hp <= 0) return;` – Rückfall auf 0 statt auf die
//   gedruckten HP (so wie `_engine.js` ~45522: `inst.counters.currentHp ?? (cd.hp || 0)`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Wire Hatchling'], [H.INERT.creature]] });
  await t.play(1, H.INERT.creature, { hero: 0 });                        // Gegner beschwört eine echte, unversehrte Kreatur
  const ziel = t.find(H.INERT.creature, 'support');
  R.check('Aufbau: Ziel ist unversehrt (kein currentHp-Zähler)', ziel && ziel.counters.currentHp === undefined, ziel && ziel.counters);
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === H.INERT.creature).id];
  const r = await t.play(0, 'Wire Hatchling', { hero: 0 });
  const hp = ziel.counters.currentHp ?? 200;
  R.check('Hatchling gespielt', r === true, r);
  R.check('Ziel (200 HP) verliert die Hälfte -> 100 HP', hp === 100, { currentHp: ziel.counters.currentHp, hp });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  // Gegenprobe mit ECHTEN Kreaturen (nicht nur dem Dummy): Mr. Jiggles (90 HP), Populated Island Turtle (400 HP)
  for (const [name, hp] of [['Mr. Jiggles', 90], ['Populated Island Turtle', 400]]) {
    const t2 = await H.fresh({ hand: [['Wire Hatchling'], [name]] });
    await t2.play(1, name, { hero: 0 });
    const z = t2.find(name, 'support');
    t2.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === name).id];
    await t2.play(0, 'Wire Hatchling', { hero: 0 });
    const rest = z.counters.currentHp ?? hp;
    R.check(name + ' (' + hp + ' HP) verliert die Hälfte -> ' + (hp - Math.ceil(hp / 2)) + ' HP', rest === hp - Math.ceil(hp / 2), { currentHp: z.counters.currentHp, rest });
  }
  R.finish();
})();
