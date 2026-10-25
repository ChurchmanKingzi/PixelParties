'use strict';
// W71b-11 · Sweep über ALLE Aktivierungen und Passive (Sitz 1 hält Monia): KEINE Kreaturen-Primitive ohne Monia-Fenster (Al, 25.10.2026)
//
// (1) Aktivierungen: Heldeneffekte, Area-Effekte, Kreatur-Effekte, Ausrüstungseffekte, freie und aktive Abilities, Permanents, Ablage-Effekte (269) × Wirker, über die echten do*-Handler.
// (2) Passive und Auslöser: jede Kreatur, jeder Held, jede Ability, jede Ausrüstung, jeder Anhang, jede Area-Spell (859) im Spiel, dann Zugwechsel und Zerstören/Schaden/Beschwören/Fireball/Attack
//     (beide Sitze) — Triggerhaken wie `onTurnStart`, `onCreatureDeath`, `onCardEnterZone` feuern so mit.
// Erwartung: kein Schreibzugriff auf eine bestehende Kreatur ohne offenes Monia-Fenster (Ausnahmen: lib/monia-sweeps.js `AUSNAHMEN`).
// Aufruf: node docs/niche-tests/repro/W71/b-11-….js   (Exit 0 = korrekt)
const Z = require('../../lib/monia-sweeps.js');
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });
(async () => {
  const R = H.runner();
  Z.pruefe(R, 'Sitz 1 · Aktivierungen', await Z.aktivierungen(R, { m: 1 }), { mindestFenster: 100 });
  Z.pruefe(R, 'Sitz 1 · Passive und Auslöser', await Z.passive(R, { m: 1 }), { mindestFenster: 1000 });
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
