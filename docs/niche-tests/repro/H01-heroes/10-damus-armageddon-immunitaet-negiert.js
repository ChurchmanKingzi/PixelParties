'use strict';
// H01-heroes-10 · Damus negiert/gefroren/betäubt: „unaffected by Armageddon" gilt trotzdem (Ifrit-Schutz und Level-Senkung ruhen dagegen korrekt)
//
// Kartentext: „… «Ifrit» Creatures you control take no damage from your opponent's cards or effects. The levels of «Armageddon» Spells in your
//   hand are reduced by the number of «Ifrit» Creatures you control. While you control at least 1 «Ifrit» Creature, this Hero is unaffected
//   by «Armageddon»."
// Konvention: Heldenpassive ruhen bei Frozen/Stunned/Negated (`_isHeroEffectSilenced`). Damus' eigene Level-Senkung und der Ifrit-Schadensschutz
//   prüfen das (Kontrolle unten: Ifrit nimmt dann Schaden), die Armageddon-Immunität des Helden selbst nicht.
// Erwartet: Damus mit Ifrit, aber negiert/gefroren/betäubt, nimmt Armageddon-Schaden (Gegenprobe gesund: 0 Schaden).
// Beobachtet: bleibt in allen drei Zuständen bei 800 HP.
// Ursache: `damus-the-prophet-of-apocalypse.js` `immuneToSourceCondition` (~Z. 113) zählt nur `ifritsOf(...)` und fragt `_isHeroEffectSilenced`
//   nicht; Engine-Leser `_engine.js` ~8746 (`immuneToSourceNames` am Helden) ruft nur die Bedingung.
const H = require('../../lib/h.js');
const DAMUS = 'Damus, the Prophet of Apocalypse';
(async () => {
  const R = H.runner();
  async function lauf(status) {
    const t = await H.fresh({ heroes: [[DAMUS, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    const ifrit = t.put(0, 1, 0, 'Ifrit'); ifrit.turnPlayed = 1;
    if (status) t.heroStatus(0, 0, status);
    const vor = ifrit.counters.currentHp;
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, ifrit, 50, 'creature', { sourceOwner: 1 }));
    const ifritVerlor = (vor ?? ifrit.counters.maxHp ?? 0) !== ifrit.counters.currentHp;
    const hp0 = t.hp(0, 0);
    await t.run(() => t.engine.actionDealDamage({ name: 'Armageddon', owner: 1, heroIdx: 0 }, t.hero(0, 0), 100, 'spell'));
    return { t, ifritHp: ifrit.counters.currentHp, damusVerlust: hp0 - t.hp(0, 0) };
  }
  const g = await lauf(null);
  R.check('gesund: Damus nimmt keinen Armageddon-Schaden, Ifrit bleibt unversehrt', g.damusVerlust === 0 && g.ifritHp === 80, [g.damusVerlust, g.ifritHp]);
  for (const st of ['negated', 'frozen', 'stunned']) {
    const x = await lauf(st);
    R.note(st + ': Ifrit-HP nach 50 Kreaturenschaden (Schutz ruht korrekt, wenn < 80)', x.ifritHp);
    R.check(st + ': Damus nimmt Armageddon-Schaden (Passiv ruht)', x.damusVerlust === 100, x.damusVerlust);
    R.check(st + ': keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
