'use strict';
// A09-03 · Bomb Arrow / Racket Arrow bieten den gegnerischen Bonded Companion als Ziel an (und treffen ihn)
// Kartentext Bonded Companion Humby (alle vier): „This Creature is unaffected by cards and effects that can't affect Heroes."
// Kartentext Bomb Arrow: „… you may choose a Creature your opponent controls and deal 100 damage to it."  Racket Arrow: „Choose a Creature your opponent controls and return it to its original owner's hand."
// Beides sind Effekte, die NUR Kreaturen treffen können -> der Companion müsste unwählbar sein (Engine: promptEffectTarget filtert über config.types ohne 'hero', _engine.js ~28040).
// Aufbau: Seed 1234. Seite 1: Held 0 mit "Bonded Companion Humby" (Slot 0), Held 1 mit ZZ Dummy. Seite 0: Held 0 mit Fighting 1, Hand [<Pfeil>, Attack].
// Schritte: 1. Attack spielen, Pfeil ketten, im Pfeil-Zielfenster den Companion wählen (falls angeboten).
// Erwartet: Der Companion wird nicht angeboten (nur ZZ Dummy); Bomb Arrow: Held 1/0 verliert nur den Angriffsschaden (50).
// Beobachtet: Companion steht in der Zielliste; Bomb Arrow: 100 Zusatzschaden am Helden (geteilter HP-Pool); Racket Arrow: Companion wandert auf die Hand und der Held ist besiegt.
// Ursache: bomb-arrow.js / racket-arrow.js rufen engine.promptEffectTarget(…) ohne `types: ['creature']`/'equip' auf.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const arrow of ['Bomb Arrow', 'Racket Arrow']) {
    R.section(arrow);
    const t = await H.fresh({ hand: [[arrow, 'Attack'], []], gold: [100, 100] });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    t.put(1, 0, 0, 'Bonded Companion Humby');
    t.put(1, 1, 0, H.INERT.creature);
    let angeboten = null;
    t.targetFn = (valid) => {
      const eq = valid.filter(v => v.type === 'equip');
      if (eq.length && angeboten === null) angeboten = eq.map(v => v.cardName);
      const c = eq.find(v => v.cardName === 'Bonded Companion Humby');
      const pick = c || eq[0] || valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1) || valid[0];
      return pick ? [pick.id] : null;
    };
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check(arrow + ': Companion wird nicht als Ziel angeboten', angeboten && !angeboten.includes('Bonded Companion Humby'), angeboten);
    R.check(arrow + ': Held des Companions nimmt keinen Zusatzschaden / ist nicht besiegt', t.hp(1, 0) > 0 && hp0 - t.hp(1, 0) <= 50, { hpVerlust: hp0 - t.hp(1, 0) });
    R.check(arrow + ': Companion noch auf dem Brett', !!t.zone(1, 0, 0), t.zone(1, 0, 0));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
