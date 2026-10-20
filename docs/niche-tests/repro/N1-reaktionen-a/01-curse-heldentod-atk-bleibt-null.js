'use strict';
// N1-01 · Curse: Stirbt der Träger, bleibt sein Attack-Wert nach der Wiederbelebung auf 0, obwohl die Karte längst in der Ablage liegt
// Kartentext: „While this card is attached to a Hero, its Attack stat is always 0. This is treated as a status effect."
// Aufbau: Sitz 0 wirkt Curse auf Held 1:0 (ATK 60, vorher gesetzt); der Held wird mit einem Angriff besiegt (Curse geht in die Ablage von Sitz 0,
//   alle Status werden gelöscht), danach per `actionReviveHero` wiederbelebt.
// Erwartet: Die Karte ist nicht mehr angelegt → der Held hat wieder seine 60 ATK (wie ohne Curse; Gegenprobe unten; ebenso nach Zerstörung der Karte durch Anti Magic).
// Beobachtet: ATK bleibt 0. `handleHeroDeathCleanup` (`_engine.js` ~Z. 50660) leert `hero.statuses` VOR dem `onCardLeaveZone` der Karte;
//   der „Last-copy safety"-Zweig in `curse.js` (`if (hero.statuses?.cursed) …`) stellt die ATK daher nie zurück, `hero._cursedAtkSuppressed` bleibt liegen.
const H = require('../../lib/h.js');
const heroPick = (s, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === s && x.heroIdx === h); return v ? [v.id] : undefined; };
(async () => {
  const R = H.runner();
  // Gegenprobe A: Curse wird per Anti Magic abgeworfen → ATK kommt zurück
  {
    const t = await H.fresh({ hand: [['Curse', 'Anti Magic'], []] });
    t.setAbilities(0, 0, [['Support Magic', 'Support Magic'], [], []]);
    t.hero(1, 0).atk = 60; t.targetFn = heroPick(1, 0);
    await t.play(0, 'Curse', { hero: 0 });
    R.check('Gegenprobe A: Curse legt ATK auf 0', t.hero(1, 0).atk === 0, t.hero(1, 0).atk);
    await t.play(0, 'Anti Magic', { hero: 0 });
    R.check('Gegenprobe A: Curse wurde durch Anti Magic abgeworfen und ATK ist wieder 60', !t.gs.players[1].supportZones[0].some(z => z.includes('Curse')) && t.hero(1, 0).atk === 60, { atk: t.hero(1, 0).atk, sup: t.gs.players[1].supportZones[0] });
  }
  // Gegenprobe B: ohne Curse bleibt die ATK über Tod und Wiederbelebung
  {
    const t = await H.fresh({ hand: [[], []] });
    t.hero(1, 0).atk = 60;
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0, controller: 0, counters: {} }, t.hero(1, 0), 900, 'attack'));
    await t.run(() => t.engine.actionReviveHero(1, 0, 300, { source: 'x' }));
    R.check('Gegenprobe B: ohne Curse ATK 60 nach Tod + Wiederbelebung', t.hero(1, 0).atk === 60, t.hero(1, 0).atk);
  }
  // Befund
  {
    const t = await H.fresh({ hand: [['Curse'], []] });
    t.hero(1, 0).atk = 60; t.targetFn = heroPick(1, 0);
    await t.play(0, 'Curse', { hero: 0 });
    R.check('Curse liegt am Helden, ATK 0', t.hero(1, 0).atk === 0 && t.gs.players[1].supportZones[0].some(z => z.includes('Curse')), { atk: t.hero(1, 0).atk });
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0, controller: 0, counters: {} }, t.hero(1, 0), 900, 'attack'));
    R.check('Held besiegt, Curse in der Ablage von Sitz 0', t.hp(1, 0) === 0 && t.pile(0, 'discardPile').includes('Curse'), { hp: t.hp(1, 0), disc: t.pile(0, 'discardPile') });
    await t.run(() => t.engine.actionReviveHero(1, 0, 300, { source: 'x' }));
    R.check('wiederbelebt: kein Curse mehr angelegt', !t.gs.players[1].supportZones[0].some(z => z.includes('Curse')), t.gs.players[1].supportZones[0]);
    R.check('wiederbelebt: ATK ist wieder 60 (Curse liegt nicht mehr an)', t.hero(1, 0).atk === 60, { atk: t.hero(1, 0).atk, versteckt: t.hero(1, 0)._cursedAtkSuppressed });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
