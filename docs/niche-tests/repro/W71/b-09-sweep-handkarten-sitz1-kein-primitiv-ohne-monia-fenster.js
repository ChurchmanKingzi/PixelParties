'use strict';
// W71b-09 · Sweep über ALLE spielbaren Handkarten (Sitz 1 hält Monia): KEINE Kreaturen-Primitive ohne Monia-Fenster (Al, 25.10.2026)
//
// Je Karte (Spell, Attack, Creature, Artifact, Potion, Ability — alle 1188) × Wirker (der Gegner von Monia | Monias Besitzer) × zwei Bretter (Dummy-Kreaturen | acht zufällige echte Kreaturen beider Seiten),
// über den echten Spielweg (`doPlaySpell` & Co.), danach zwei Zugwechsel (verzögerte Effekte wie Hand of Death). Der Wächter (lib/monia-waechter.js) meldet jeden Schreibzugriff auf eine bestehende Kreatur
// (Zähler, Status, Buffs, Zone, Kontrolle, Platz, Abgang vom Brett), für den in der laufenden Auflösung kein Fenster `beforeCreatureAffected`/`beforeCreatureDamageBatch` für DIESE Kreatur offen war.
// Erwartung: keine Meldung außer den dokumentierten Ausnahmen (lib/monia-sweeps.js `AUSNAHMEN`, jede mit Begründung: Tearing Mountain, Auren, Opfer/Tribut als Kosten, Selbst-Effekte …).
// Auf dem Stand vor W71b: viele Meldungen (Dark Gear, Racket Arrow, Anti Magic Zone, Guard Change, Cloud Pillow …) — das Skript ist dort rot.
// Aufruf: node docs/niche-tests/repro/W71/b-09-….js   (Exit 0 = korrekt)
const Z = require('../../lib/monia-sweeps.js');
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });
(async () => {
  const R = H.runner();
  
  const b = await Z.handkarten(R, { m: 1, echteBretter: true });
  Z.pruefe(R, 'Sitz 1 · Handkarten', b, { mindestFenster: 300 });
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
