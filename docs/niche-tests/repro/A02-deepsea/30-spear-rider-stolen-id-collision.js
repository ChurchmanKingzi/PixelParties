'use strict';
// A02-deepsea-30 · Aquatic Spear (Ablage-Zusatz): eine geliehene Gegnerkreatur bekommt die ID MEINES Platzes – der Treffer geht auf meine eigene Kreatur
//
// Kartentext (Aquatic Spear): „When this card is sent from your side of the board to the discard pile by an effect, deal 80 damage to any target on the board."
// Aufbau: Seat 0: Surprise Aquatic Spear (Held 0), eigene Kreatur (1000 HP) in Held 1 / Slot 0. Seat 1: Kreatur (1000 HP) in Held 1 / Slot 0,
//   von Seat 0 geliehen (z. B. durch Deepsea Succubus: Kontrolle bei mir, Brett beim Gegner). Der Gegner schickt die Spear per Effekt in die Ablage.
// Erwartung: Wähle ich die geliehene Kreatur, nimmt SIE die 80 Schaden. Zielliste ohne doppelte IDs.
// Beobachtet: `allBoardTargets` baut die ID aus `inst.controller ?? inst.owner`, also `equip-0-1-0` für BEIDE Kreaturen; `pool.find(t => t.id === id)`
//   liefert die erste (meine eigene) – sie nimmt die 80 Schaden, die geliehene Kreatur bleibt unverletzt.
// Ursache: `aquatic-spear.js` `allBoardTargets` (Z. ~48) – Brettseite (`engine.physicalSide(inst)`) statt Kontrolle (vgl. `aquatic-arrows.js`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []] });
  const sp = t.putSurprise(0, 0, 'Aquatic Spear');
  const mine = t.put(0, 1, 0, H.INERT.big); mine.turnPlayed = 1;
  const theirs = t.put(1, 1, 0, H.INERT.big); theirs.turnPlayed = 1;
  await t.run(() => t.engine.actionStealCreature(0, theirs, { sourceName: 'Deepsea Succubus' }));
  let pool = null;
  t.targetFn = (valid) => {
    pool = valid.filter(v => v.type === 'equip').map(v => v.id);
    const v = valid.find(v => v.type === 'equip' && v.cardInstance && v.cardInstance.id === theirs.id);
    return [v.id];
  };
  await t.run(() => t.engine.actionDestroyCard({ name: 'Src', owner: 1 }, sp));
  const hpMine = mine.counters.currentHp ?? 1000, hpTheirs = theirs.counters.currentHp ?? 1000;
  R.check('Zielliste ohne doppelte IDs', pool && new Set(pool).size === pool.length, pool);
  R.check('gewählte (geliehene) Kreatur nimmt die 80 Schaden', hpTheirs === 920, { hpMine, hpTheirs });
  R.check('meine eigene Kreatur bleibt unverletzt', hpMine === 1000, { hpMine, hpTheirs });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
