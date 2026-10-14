'use strict';
// W5b-B7 (zu H02-16) · Ghuanjun: „This Hero's Attacks deal damage equal to this Hero's base Attack stat." – Entscheidung Al (Welle 5):
//   „Die aktuelle Grund-ATK, nicht unbedingt 80; bei Curse zB 0."
// Nachtrag Al: „Base Attack ist ein eigener Stat. Critical Strike und Co ändern *nicht* die base atk, also kein höherer Schaden." => PAUSCHAL:
//   jede Attack verursacht GENAU die aktuelle Grund-ATK (baseAtk: Fighting/Ausrüstung zählen nicht; unter Curse 0; nach Veränderung der Basis, hier baseAtk 100, entsprechend).
//   Die Formel der Attack (Critical Strike 2×, Massacre +50 je Kreatur) entfällt.
const H = require('../../lib/h.js');
const GU = 'Ghuanjun, the Undead Martial Artist';
async function lauf(card, ziel, zustand) {
  const t = await H.fresh({ heroes: [[GU, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fighting'], []], hp: 1000 });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  const big = t.put(1, 0, 0, H.INERT.big); t.put(1, 1, 0, H.INERT.big); t.put(0, 1, 0, H.INERT.big);   // 3 Kreaturen auf dem Brett (Massacre)
  await t.play(0, 'Fighting', { hero: 0, phase: 2 });                    // ATK 80 -> 90
  const hero = t.hero(0, 0);
  if (zustand === 'curse') {                                              // wie curse.js: ATK sichern, auf 0 setzen, Status `cursed`
    hero._cursedAtkSuppressed = hero.atk; hero.atk = 0;
    await t.run(() => t.engine.addHeroStatus(0, 0, 'cursed', { appliedBy: 1, source: 'Curse' }));
  } else if (zustand === 'basis100') {                                    // die Basis selbst ändert sich (z. B. Verdopplung/Wechsel): +20 auf beide Felder
    hero.baseAtk += 20; hero.atk += 20;
  }
  t.setHand(0, [card]); t.grantFor(0, 0, card);
  t.targetFn = (valid) => { const v = valid.find(x => ziel === 'creature' ? (x.type === 'equip' && x.owner === 1) : (x.type === 'hero' && x.owner === 1 && x.heroIdx === 0)); return [(v || valid[0]).id]; };
  t.policy.confirm = false;
  const atk = [hero.atk, hero.baseAtk];
  const r = await t.play(0, card, { hero: 0, noGrant: true, phase: 3 });
  const schaden = ziel === 'creature' ? 1000 - (big.counters.currentHp ?? 1000) : 1000 - t.hp(1, 0);
  return { r, schaden, atk, fehler: t.errors, audit: t.audit() };
}
(async () => {
  const R = H.runner();
  // [Karte, Ziel, Erwartung mit Grund-ATK 80, mit Grund-ATK 100, unter Curse]
  const FAELLE = [
    ['Attack', 'hero', 80, 100, 0],
    ['Quick Attack', 'hero', 80, 100, 0],
    ['Blow of the Venom Snake', 'hero', 80, 100, 0],
    ['Ferocious Tiger Kick', 'hero', 80, 100, 0],
    ['Strong Ox Headbutt', 'hero', 80, 100, 0],
    ['Critical Strike', 'hero', 80, 100, 0],
    ['Surefire Shot', 'hero', 80, 100, 0],
    ['Massacre', 'hero', 80, 100, 0],
    ['Shattering Strike', 'creature', 80, 100, 0],
  ];
  for (const [card, ziel, e80, e100, eCurse] of FAELLE) {
    for (const [zustand, erwartet] of [['normal', e80], ['basis100', e100], ['curse', eCurse]]) {
      const o = await lauf(card, ziel, zustand);
      R.check(`${card} (${zustand}; ATK ${o.atk[0]}, Grund-ATK ${o.atk[1]}): Schaden ${erwartet}`, o.r === true && o.schaden === erwartet && o.fehler.length === 0 && o.audit.length === 0, { r: o.r, schaden: o.schaden, fehler: o.fehler, audit: o.audit });
    }
  }
  {   // Flächenattacke: Whirlwind Strike – jedes Ziel (2 Helden + ihre Kreaturen) erhält die Grund-ATK, nicht ATK (90)
    const t = await H.fresh({ heroes: [[GU, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fighting'], []], hp: 1000 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const k = t.put(1, 0, 0, H.INERT.big);
    await t.play(0, 'Fighting', { hero: 0, phase: 2 });
    t.setHand(0, ['Whirlwind Strike']); t.grantFor(0, 0, 'Whirlwind Strike');
    t.targetFn = (valid) => valid.filter(v => v.type === 'hero' && v.owner === 1).slice(0, 2).map(v => v.id);
    t.policy.confirm = false;
    const r = await t.play(0, 'Whirlwind Strike', { hero: 0, noGrant: true, phase: 3 });
    R.check('Whirlwind Strike: Held 0 und Held 1 des Gegners verlieren je 80 (nicht 90)', r === true && 1000 - t.hp(1, 0) === 80 && 1000 - t.hp(1, 1) === 80, { r, h: [t.hp(1, 0), t.hp(1, 1)] });
    R.check('Whirlwind Strike: Kreatur in der Zone erhält 80', 1000 - (k.counters.currentHp ?? 1000) === 80, k.counters.currentHp);
    R.check('Whirlwind Strike: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
