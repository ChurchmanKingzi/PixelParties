'use strict';
// F01-artifacts-18 · Diver Helmet wird von „The Seventh Circle of Hell" und „Dark Ocean" ignoriert
// Kartentext Diver Helmet: „The equipped Hero and all cards in its Support Zones are unaffected by Areas."
// CARD_API.md Z. 4976 („Areas — respect Diver Helmet, MANDATORY for every Area"): Areas, die einen Helden/eine Kreatur direkt treffen – Schaden, Status, … „being chosen/targeted by the Area's own optional action"
//   – müssen jeden geschützten Helden/jede geschützte Kreatur auslassen (`_diver-helmet-shared.js`, engine `_isDiverHelmetProtectedTarget`).
// (a) Seventh Circle of Hell: „At the end of each turn, the turn player must choose a target they control and deal 100 damage to it."
//     Aufbau: Sitz 0 trägt den Helm an Held 0 und hat eine Kreatur in dessen Zone; Seventh Circle liegt bei Sitz 1; Sitz 0 beendet seinen Zug.
//     Erwartung: Held 0 und seine Kreatur werden gar nicht zur Wahl angeboten. Beobachtet: beide stehen in der Zielliste, die Wahl auf Held 0 → 100 Schaden.
// (b) Dark Ocean: „Creatures take no damage, except from Attacks and Spells."
//     Aufbau: Dark Ocean liegt; eine Kreatur am Helm-Helden und eine am Helden ohne Helm erleiden je 50 Schaden vom Typ `creature`.
//     Erwartung: Die Helm-Kreatur nimmt den Schaden (die Area betrifft sie nicht), die andere nicht. Beobachtet: beide bleiben unverletzt.
// Ursache: (a) `the-seventh-circle-of-hell.js` Z. ~60–105 sammelt die Ziele ohne `_diver-helmet-shared`; (b) `_engine.js` Z. 46292 ff. (Dark-Ocean-Schadensblock in der Kreaturen-Schadenssammlung) filtert nach Schadenstyp,
//   ruft aber `_isDiverHelmetProtectedTarget` nicht auf.
// (In derselben Messreihe – 44 Areas × Platz bei Sitz 0/1, Differenzprobe mit/ohne Area bei Schaden + 2 Zugwechseln – sind alle übrigen Areas unauffällig.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {   // (a)
    const t = await H.fresh({ hand: [[], []], gold: [100, 100] });
    t.put(0, 0, 0, 'Diver Helmet');
    const cr = t.put(0, 0, 1, H.INERT.creature);
    t.putArea(1, 'The Seventh Circle of Hell');
    let angeboten = null;
    t.targetFn = (valid) => { angeboten = valid.map(v => v.type + ':' + v.owner + '/' + v.heroIdx + '/' + (v.slotIdx ?? '-')); const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return [(h || valid[0]).id]; };
    await t.endTurn();
    const geschuetzt = (angeboten || []).filter(s => s === 'hero:0/0/-' || s === 'equip:0/0/1');
    R.check('(a) Seventh Circle bietet den Helm-Helden und seine Kreatur nicht als Ziel an', geschuetzt.length === 0, { angeboten, hp: [0, 1, 2].map(i => t.hp(0, i)) });
    R.check('(a) Helm-Held nimmt keinen Schaden', t.hp(0, 0) === 800, t.hp(0, 0));
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (b)
    const t = await H.fresh({ hand: [[], []], gold: [100, 100] });
    t.put(0, 0, 0, 'Diver Helmet');
    const mitHelm = t.put(0, 0, 1, H.INERT.creature);
    const ohneHelm = t.put(0, 1, 0, H.INERT.creature);
    t.putArea(1, 'Dark Ocean');
    await t.engine.actionDealCreatureDamage({ name: 'Quelle', owner: 1 }, mitHelm, 50, 'creature');
    await t.engine.actionDealCreatureDamage({ name: 'Quelle', owner: 1 }, ohneHelm, 50, 'creature');
    const schaden = (i) => 200 - (i.counters.currentHp ?? 200);
    R.check('(b) Dark Ocean: Kreatur am Helm-Helden nimmt Schaden (unaffected by Areas)', schaden(mitHelm) === 50, { mitHelm: schaden(mitHelm), ohneHelm: schaden(ohneHelm) });
    R.check('(b) Gegenprobe: Kreatur ohne Helm bleibt unverletzt (Dark Ocean wirkt)', schaden(ohneHelm) === 0, schaden(ohneHelm));
    R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
