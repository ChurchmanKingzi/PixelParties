'use strict';
// H01-heroes-05 · Alice, the Puppeteer Girl zählt eine (zeitweise) gestohlene Kreatur, die ICH kontrolliere, nicht mit
//
// Kartentext: „… deal 50 damage to it times the number of Creatures you control that were not summoned this turn."
// Erwartung: Eine Kreatur, die ich durch einen zeitweisen Diebstahl (`actionStealCreature`, z. B. Deepsea Succubus, Cute Conversion)
//   kontrolliere und die nicht in DIESEM Zug beschworen wurde, zählt. Eigene alte Kreatur + gestohlene alte Kreatur = 2 × 50 = 100 Schaden.
// Beobachtet: nur 50 – die gestohlene Kreatur fällt heraus.
// Ursache: cards/effects/alice-the-puppeteer-girl.js `_qualifies`: `if (inst.stolenBy != null) return false;` (Z. 29). Der Kommentar daneben
//   will Kreaturen ausschließen, die dem GEGNER gestohlen wurden – das erledigt bereits die Zeile davor (`controller !== pi`);
//   die Zeile mit `stolenBy` trifft stattdessen die Kreaturen, die der Spieler SELBST gestohlen hat.
const H = require('../../lib/h.js');
const AL = 'Alice, the Puppeteer Girl';
const D = H.INERT.creature;
(async () => {
  const R = H.runner();
  async function lauf(klaue) {
    const t = await H.fresh({ heroes: [[AL, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.put(0, 1, 0, D).turnPlayed = 1;                                      // eigene, nicht frische Kreatur
    const fremd = t.put(1, 1, 0, D); fremd.turnPlayed = 1;                 // Kreatur des Gegners, alt
    if (klaue) { t.engine.actionStealCreature(0, fremd); }
    const r = await t.activateHero(0, 0, {});
    return { t, r, schaden: 800 - t.hp(1, 0), fremd };
  }
  R.section('Kontrolle: nur die eigene alte Kreatur');
  const a = await lauf(false);
  R.check('50 Schaden', a.schaden === 50, a.schaden);
  R.section('Zusätzlich eine alte Kreatur des Gegners zeitweise gestohlen (Kontrolle bei mir)');
  const b = await lauf(true);
  R.check('Vorprobe: Kreatur wird von Sitz 0 kontrolliert', b.fremd.controller === 0 && b.fremd.stolenBy === 0, { c: b.fremd.controller, s: b.fremd.stolenBy });
  R.check('100 Schaden (2 Kreaturen, die ich kontrolliere und die nicht frisch sind)', b.schaden === 100, b.schaden);
  R.check('keine Engine-Fehler', a.t.errors.length === 0 && b.t.errors.length === 0, [a.t.errors, b.t.errors]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
