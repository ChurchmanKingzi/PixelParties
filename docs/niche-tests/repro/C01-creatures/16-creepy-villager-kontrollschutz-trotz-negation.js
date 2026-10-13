'use strict';
// C01-creatures-16 · Creepy Villager: „Control of this Creature cannot change" gilt auch, wenn die Kreatur negiert / gefroren / betäubt ist
// Kartentext: „Control of this Creature cannot change. You may once per turn …"
// Konvention der Engine (B-querschnitt B-01…B-03, Vorbild A05-04 Time Bomblebee, CARD_API „Egg of God"): eine negierte (gefrorene, betäubte) Kreatur verliert ihre Texteffekte;
//   die Engine hat dafür EIN Prädikat, `engine.isCreatureEffectSuppressed(inst)`.
// Aufbau: Seed 1234. Sitz 0: Creepy Villager (alt) wird negiert / eingefroren / betäubt. Sitz 1 versucht `actionStealCreature(1, villager)` (und `actionTransferCreature`).
// Erwartung: Normal: Diebstahl scheitert (Kontrolle bleibt). Negiert (und gefroren/betäubt): der Schutz ruht, der Diebstahl gelingt.
// Beobachtet: In allen vier Zuständen scheitert der Diebstahl (`isCreatureEffectSuppressed` ist dabei `true`).
// Ursache: Der Vertrag `controlCannotChange` (creepy-villager.js Z. ~59) wird von `actionStealCreature`/`actionTransferCreature` (`controlLocked`) ohne Statusprüfung gelesen.
// Stufe B: dieselbe Klasse wie B-01…B-03 und A05-04 (statischer Texteffekt ignoriert die Stilllegung). Absicht ist nicht dokumentiert.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const st of ['normal', 'frozen', 'stunned', 'negated']) {
    const t = await H.fresh({});
    const e = t.engine;
    const v = t.put(0, 0, 0, 'Creepy Villager'); v.turnPlayed = 1;
    if (st === 'negated') await e.actionNegateCreature(v, 'Test');
    else if (st !== 'normal') await e.applyCreatureStatus(v, st, { sourceOwner: 1 });
    const unterdrueckt = e.isCreatureEffectSuppressed(v);
    const r = await t.run(() => e.actionStealCreature(1, v));
    R.note(st, { unterdrueckt, diebstahlGelungen: !!r, kontrolleur: v.controller });
    if (st === 'normal') R.check('normal: Diebstahl scheitert (Kontrolle kann nicht wechseln)', !r && v.controller === 0, { r, ctrl: v.controller });
    else R.check(`${st}: der Kontrollschutz ruht, der Diebstahl gelingt`, !!r && v.controller === 1, { unterdrueckt, r: !!r, ctrl: v.controller });
    R.check(`${st}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
