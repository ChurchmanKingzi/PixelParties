'use strict';
// W12 / Q108 (H01-heroes-06) · Alice, the Puppeteer Girl: „treated as … a Destruction Magic Spell" (Al: „Ja, Alices Effekt soll blockbar sein und als lv 0 gelten!")
// Kartentext: „… deal 50 damage to it times the number of Creatures you control that were not summoned this turn. This is treated as this Hero hitting the target with a Destruction Magic Spell."
// Erwartung: (a) Anti Magic (magic_immune Stufe 1/2/3) blockt Alices Schaden (Stufe 0 ≤ Stufe); (b) ohne Anti Magic kommt der Schaden an;
//   (c) Alices Schaden an einer KREATUR (Anti Magic schützt nur Helden) kommt an; (d) ein echter Anti Magic (Spell) auf dem Ziel blockt ebenfalls;
//   (e) die gewöhnlichen Treffer eines Helden namens Alice (andere Schadensart) werden nicht als Spell behandelt (Engine: `_spellLevelAlsQuelle`).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const AL = 'Alice, the Puppeteer Girl';
const D = H.INERT.creature;
function pickHero(owner, hi) { return (valid) => [valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi).id]; }
(async () => {
  const R = H.runner();
  for (const lv of [1, 2, 3]) {   // (a)
    const t = await H.fresh({ heroes: [[AL, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    t.targetFn = pickHero(1, 0);
    t.put(0, 1, 0, D).turnPlayed = 1;
    await t.engine.actionAddBuff(t.hero(1, 0), 1, 0, 'magic_immune', { level: lv });
    await t.activateHero(0, 0, {});
    R.check(`(a) Anti Magic Stufe ${lv} blockt Alice (Stufe-0-Spell)`, t.hp(1, 0) === 800, t.hp(1, 0));
    R.check(`(a${lv}) keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  {   // (b)
    const t = await H.fresh({ heroes: [[AL, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    t.targetFn = pickHero(1, 0);
    t.put(0, 1, 0, D).turnPlayed = 1;
    await t.activateHero(0, 0, {});
    R.check('(b) ohne Anti Magic: 50 Schaden', t.hp(1, 0) === 750, t.hp(1, 0));
  }
  {   // (c)
    const t = await H.fresh({ heroes: [[AL, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    t.put(0, 1, 0, D).turnPlayed = 1;
    const ziel = t.put(1, 0, 0, H.INERT.big);
    await t.engine.actionAddBuff(t.hero(1, 0), 1, 0, 'magic_immune', { level: 3 });
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    await t.activateHero(0, 0, {});
    const hp = ziel.counters?.currentHp ?? 1000;
    R.check('(c) Kreatur trotz Anti Magic am Helden getroffen (50)', hp === 950, hp);
  }
  {   // (d) echter Anti Magic als Spell
    const t = await H.fresh({ heroes: [[AL, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[], ['Anti Magic']] });
    t.put(0, 1, 0, D).turnPlayed = 1;
    t.targetFn = pickHero(1, 0);
    t.gs.activePlayer = 1;
    const r = await t.play(1, 'Anti Magic', { hero: 0, targetOwner: 1 });
    t.gs.activePlayer = 0;
    const hatBuff = !!t.hero(1, 0).buffs?.magic_immune;
    if (!hatBuff) { R.note('(d) Anti Magic nicht angelegt – Aufbau prüfen', { r, buffs: t.hero(1, 0).buffs }); }
    else {
      await t.activateHero(0, 0, {});
      R.check('(d) echter Anti Magic blockt Alice', t.hp(1, 0) === 800, t.hp(1, 0));
    }
    R.check('(d) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (e) Engine-Helfer: Spell-Karte → Kartenstufe; Alice nur bei Spell-Schadensart; sonst nichts
    const t = await H.fresh({});
    const e = t.engine;
    R.check('(e) Fireball → Stufe 2', e._spellLevelAlsQuelle('Fireball') === 2, e._spellLevelAlsQuelle('Fireball'));
    R.check('(e) Alice (destruction_spell) → Stufe 0', e._spellLevelAlsQuelle(AL, 'destruction_spell') === 0, e._spellLevelAlsQuelle(AL, 'destruction_spell'));
    R.check('(e) Alice (attack) → kein Spell', e._spellLevelAlsQuelle(AL, 'attack') === null, e._spellLevelAlsQuelle(AL, 'attack'));
    R.check('(e) Kreatur → kein Spell', e._spellLevelAlsQuelle(D) === null, e._spellLevelAlsQuelle(D));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
