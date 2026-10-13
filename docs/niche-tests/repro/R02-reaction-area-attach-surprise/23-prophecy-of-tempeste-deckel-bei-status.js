'use strict';
// R02-23 · Prophecy of Tempeste: der 100-Schadensdeckel entfällt, sobald der Wirt gefroren/betäubt/negiert ist (andere Anhängsel wirken unter CC weiter)
// Kartentext: „Damage this Hero would take cannot exceed 100. Damage this Hero takes cannot be reduced or negated by other cards or effects." (statische Regel, kein „you may")
// Vergleich: Light Ball / Siege / Royal Treasury / Petrification Break (Anhängsel in der Support Zone) wirken unter Frost/Betäubung/Negation des Wirts weiter (Light-Ball-Kopf: „Support-Zone Attachments aren't silenced by hero CC").
// Aufbau: Sitz 0 legt Prophecy of Tempeste an Held 0; (a) Wirt ohne Status, (b) gefroren, (c) betäubt, (d) negiert. Sitz 1 trifft Held 0 direkt mit 300 (`actionDealDamage`, Typ normal).
// Erwartet (Lesart „statische Regel gilt, solange die Karte liegt"): jeweils 100 Schaden.
// Beobachtet: (a) 100; (b)(c)(d) 300 – der Deckel (und die Umleitung) sind unter CC ausgeschaltet (`prophecy-of-tempeste.js` Z. 210 und Z. 324: `if (host.statuses?.frozen || stunned || negated) return;`).
// Gegenlesart: Die Karte ist ein Heldeneffekt des Wirts und ruht unter CC (die Umleitung ist ein „you may"). Frage an Al s. Bericht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const st of [null, 'frozen', 'stunned', 'negated']) {
    const t = await H.fresh({ hand: [['Prophecy of Tempeste'], []], hp: 800 });
    t.grantFor(0, 0, 'Prophecy of Tempeste');
    t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0) || valid[0]).id];
    await t.play(0, 'Prophecy of Tempeste', { hero: 0, noGrant: true });
    if (st) t.heroStatus(0, 0, st);
    await t.engine.actionDealDamage({ name: 'T', owner: 1 }, t.hero(0, 0), 300, 'normal');
    R.check(`Wirt ${st || 'ohne Status'}: 300 Schaden werden auf 100 gedeckelt`, 800 - t.hp(0, 0) === 100, 800 - t.hp(0, 0));
    R.check(`Wirt ${st || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
