'use strict';
// R02-13 · Rioting Village: der Rückstoß eines GELIEHENEN Helden trifft den gleichindizierten Helden des Kontrolleurs statt den Angreifer
// Kartentext: „… when a Hero deals damage with an Attack, it takes half the damage dealt as recoil (rounded up). This recoil damage cannot be reduced or negated."
// Aufbau: Rioting Village liegt. Held 1 von Sitz 1 ist von Sitz 0 gecharmt (`charmedBy = 0`); Sitz 0 spielt „Attack" mit diesem Helden (`charmedOwner: 1`) auf Held 0 von Sitz 1.
// Erwartet: Der angreifende (geliehene) Held 1 von Sitz 1 (ATK 80) trifft mit 80 und erhält 40 Rückstoß (760 HP); alle anderen Helden bleiben unversehrt.
// Beobachtet: Das Ziel verliert 80, der Angreifer (Sitz 1, Held 1) bleibt bei 800 HP; stattdessen verliert Held 1 von SITZ 0 (der gleiche Heldenindex auf der Seite des Kontrolleurs) 40 HP.
// Ursache: `rioting-village.js` `afterDamage` liest `pi = src.controller ?? src.owner` und `hi = src.heroIdx` und schlägt `gs.players[pi].heroes[hi]` auf; `heroIdx` ist aber ein Index in die Heldenreihe des BESITZERS (`src.heroOwner`) –
//   bei einem geliehenen Helden zeigt das auf die falsche Seite. Muster: `heroOwner` (Brettseite des Helden) statt `controller` verwenden (vgl. spike-trap.js / mountain-tear-river.js `sourceInfo.owner/heroIdx`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Attack'], []], hp: 800 });
  t.putArea(0, 'Rioting Village');
  await t.engine.syncAlleAtkAuren?.();
  t.hero(1, 1).charmedBy = 0;
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid[0]).id];
  t.policy.confirm = true;
  const atk = t.gs.players[1].heroes[1].atk;
  const hp = () => ({ s0: [0, 1, 2].map(h => t.hp(0, h)), s1: [0, 1, 2].map(h => t.hp(1, h)) });
  const r = await t.play(0, 'Attack', { hero: 1, charmedOwner: 1 });
  const nach = hp();
  R.check('Aufbau – geliehener Held (Sitz 1, Held 1) hat verdoppelte ATK 80', atk === 80, atk);
  R.check('Ziel (Sitz 1, Held 0) verliert 80', nach.s1[0] === 720, { r, nach });
  R.check('der Angreifer (Sitz 1, Held 1) erleidet 40 Rückstoß', nach.s1[1] === 760, nach);
  R.check('die Helden von Sitz 0 bleiben unversehrt', nach.s0.every(x => x === 800), nach);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
