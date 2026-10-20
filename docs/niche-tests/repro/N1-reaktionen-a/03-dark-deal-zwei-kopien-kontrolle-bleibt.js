'use strict';
// N1-03 · Dark Deal: Werden zwei Kopien in dieselbe Kette gelegt, bleibt die Kreatur bis Zugende unter der Kontrolle des Dark-Deal-Spielers
// Kartentext: „… You choose the target of that effect. For that moment only, the Creature is treated as being controlled by you."
// Skript (`dark-deal.js` `resolve`): setzt `inst._darkDealVorher = inst.stolenBy ?? null` und `inst.stolenBy = pi` – ohne Schutz gegen den zweiten Lauf.
//   Die zuletzt gelegte Kopie löst zuerst auf (LIFO) und setzt `stolenBy = 1`; die zuerst gelegte löst danach auf und merkt sich dieses `stolenBy = 1` als „Vorher".
//   Das Ende (`engine.beendeDarkDeal`) stellt dann `stolenBy = 1` wieder her statt es zu löschen.
// Aufbau: Sitz 0 aktiviert Burning Skeleton (wählt ein Ziel); Sitz 1 hält zwei Dark Deal (Decay Magic 1) und spielt beide in die Kette.
// Erwartet: Nach dem Effekt gehört das Skelett wieder Sitz 0 (`stolenBy` leer, Kontrolleur Sitz 0) – genau wie bei einer einzelnen Dark Deal (Gegenprobe).
// Beobachtet: `stolenBy` bleibt 1, `effektiveSeiten` meldet Kontrolleur 1 – bis zum Zugende (dort räumt der Rückgabelauf für vorübergehenden Diebstahl auf).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const n of [1, 2]) {
    const t = await H.fresh({ hand: [[], Array(n).fill('Dark Deal')] });
    t.grantFor(1, 0, 'Dark Deal');
    const sk = t.put(0, 0, 0, 'Burning Skeleton'); sk.turnPlayed = t.gs.turn - 1;
    t.put(1, 1, 0, H.INERT.creature);
    t.targetFn = (valid) => [valid[0].id];
    t.gs.currentPhase = 2; t.resetActions(0);
    const r = await t.activateCreature(0, 0, 0);
    const gespielt = t.prompts.filter(p => p.pi === 1 && p.d.title === 'Dark Deal').length;
    R.check(`${n} Kopie(n): Aktivierung lief, ${n} Dark-Deal-Frage(n) an Sitz 1`, r === true && gespielt === n, { r, gespielt });
    R.check(`${n} Kopie(n): nach dem Effekt hält Sitz 1 die Kreatur nicht mehr (stolenBy leer)`, sk.stolenBy == null, { stolenBy: sk.stolenBy });
    R.check(`${n} Kopie(n): Kontrolleur laut Engine wieder Sitz 0`, t.engine.effektiveSeiten(sk).controller === 0, t.engine.effektiveSeiten(sk));
    R.check(`${n} Kopie(n): keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
