'use strict';
// W71b-12 · Sweep über ALLE Reaktionen und Surprises (Monia auf Sitz 0 und auf Sitz 1): KEINE Kreaturen-Primitive ohne Monia-Fenster (Al, 25.10.2026)
//
// Jede Reaktionskarte (Hand) und jede Surprise (verdeckt in der Surprise-Zone), gehalten von Sitz 0 und Sitz 1, gegen acht Auslöser: Attack auf Kreatur / Held des Halters, Fireball auf Kreatur / Held,
// eigene Attack auf Kreatur / Held des Gegners, Beschwörung des Gegners, eigener Fireball auf eine Kreatur. Was die Harness (CPU-Modus) auslöst, wird mit dem Wächter geprüft (Racket Arrow, Golden Wings,
// Cactus Creature, Barrier of Undying …); alle übrigen Reaktions-/Surprise-Skripte rufen ausschließlich Primitive mit Fenster (Inventur der direkten Schreiber: docs/niche-tests/FIXES-WELLE-71b.md).
// Aufruf: node docs/niche-tests/repro/W71/b-12-….js   (Exit 0 = korrekt)
const Z = require('../../lib/monia-sweeps.js');
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });
(async () => {
  const R = H.runner();
  for (const m of [0, 1]) {
    const b = await Z.reaktionen(R, { m });
    Z.pruefe(R, `Monia Sitz ${m} · Reaktionen und Surprises`, b, { mindestFenster: 100 });
    R.check(`Monia Sitz ${m}: mindestens Racket Arrow und Golden Wings wurden ausgelöst`, ['Racket Arrow', 'Golden Wings'].every(n => b.ausgeloest.has(n)), [...b.ausgeloest].slice(0, 30));
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
