'use strict';
// H01-heroes-06 · Alice, the Puppeteer Girl: „treated as … a Destruction Magic Spell" – Anti Magic (Spell-Immunität) greift nicht
//
// Kartentext: „… This is treated as this Hero hitting the target with a Destruction Magic Spell."
// Anti Magic (Spell, Attachment): „The Hero this Spell is attached to becomes immune to all other Spells up to level 1/2/3 …"
// Frage (Stufe C): Soll Alice' Effekt als Spell (welche Stufe? das Skript bildet sie als Lv 0 nach) von Anti Magic geblockt werden?
// Beobachtet: Ziel mit `magic_immune`-Buff (Stufe 1, so legt Anti Magic ihn an) nimmt die vollen 50 Schaden. Die Engine-Prüfung
//   `_isHeroSpellProtected` verlangt, dass die QUELLE eine Spell-KARTE ist (`cardType === 'Spell'`); Alice' Quelle ist ein Held.
//   Sichtbar wird der Unterschied nur, weil das Skript ausdrücklich `damageType: 'destruction_spell'` und ein Lv-0-Destruction-Spell-Objekt
//   für `afterSpellResolved` benutzt (Bartas/Beato/Reiza behandeln sie als Spell).
const H = require('../../lib/h.js');
const AL = 'Alice, the Puppeteer Girl';
const D = H.INERT.creature;
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[AL, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.put(0, 1, 0, D).turnPlayed = 1;
  await t.engine.actionAddBuff(t.hero(1, 0), 1, 0, 'magic_immune', { level: 1 });   // wie Anti Magic Lv 1
  await t.activateHero(0, 0, {});
  R.note('Schaden am Anti-Magic-Helden', 800 - t.hp(1, 0));
  R.check('Alice\' „Destruction-Spell“-Schaden wird von Anti Magic Lv 1 geblockt (Stufe-0-Spell)', t.hp(1, 0) === 800, t.hp(1, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
