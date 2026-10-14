// H02-heroes-16 · Ghuanjun – „Attacks deal damage equal to this Hero's base Attack stat": die Korrektur zieht nur die Differenz ab und trifft die falschen Karten
//
// Kartentext Ghuanjun: „This Hero's Attacks deal damage equal to this Hero's base Attack stat." (Grund-ATK 80; mit Fighting 1 steht der aktuelle ATK bei 90.)
// Skript (`ghuanjun-the-undead-martial-artist.js` beforeDamage/beforeCreatureDamageBatch): bei `source.usesHeroAtk` wird (atk − baseAtk) flach vom Betrag abgezogen.
// Erwartung: jede Attack richtet den Schaden an, den ihre Formel mit atk := baseAtk (80) ergäbe.
//   Attack 80 · Blow of the Venom Snake / Ferocious Tiger Kick / Strong Ox Headbutt („base Attack stat" – 80) · Critical Strike (2× → 160) · Surefire Shot 80 · Massacre (80 + 50 × Kreaturen) · Shattering Strike (Kreatur) 80.
// Beobachtung (Ghuanjun mit Fighting 1, ATK 90): Venom Snake/Tiger Kick/Ox Headbutt 70 (die drei Karten setzen `usesHeroAtk` trotz Formel „base ATK" → die Differenz wird doppelt abgezogen; mit ATK-Bonus ≥ 80 sogar 0),
//   Critical Strike 170 (nur 1× Differenz abgezogen, Formel verdoppelt sie), Surefire Shot 90 („cannot be reduced" lässt den Abzug leerlaufen), Massacre 140 (kein `usesHeroAtk`), Shattering Strike auf Kreatur 90.
// Aufruf: node docs/niche-tests/repro/H02-heroes/16-ghuanjun-basis-atk-korrektur.js   (✗ = Fehler tritt auf)
// ★ W5b-B7 (Al, Welle 5): "Base Attack ist ein eigener Stat. Critical Strike und Co aendern *nicht* die base atk, also kein hoeherer Schaden." => PAUSCHAL: jede Attack genau die aktuelle Grund-ATK
//   (Critical Strike 80 statt 160, Massacre 80 statt 130) - Erwartungswerte unten entsprechend umgestellt.
const H = require('../../lib/h.js');
const GU = 'Ghuanjun, the Undead Martial Artist';
(async () => {
  const R = H.runner();
  // [Karte, erwarteter Schaden mit ATK := baseAtk (80), Ziel: 'hero' | 'creature']
  const CASES = [['Attack', 80, 'hero'], ['Blow of the Venom Snake', 80, 'hero'], ['Ferocious Tiger Kick', 80, 'hero'], ['Strong Ox Headbutt', 80, 'hero'],
    ['Critical Strike', 80, 'hero'], ['Surefire Shot', 80, 'hero'], ['Massacre', 80, 'hero'], ['Shattering Strike', 80, 'creature']];
  for (const [card, erwartet, ziel] of CASES) {
    const t = await H.fresh({ heroes: [[GU, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fighting'], []], hp: 1000 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const big = t.put(1, 0, 0, H.INERT.big);
    await t.play(0, 'Fighting', { hero: 0, phase: 2 });                    // Fighting echt anlegen: ATK 80 → 90
    t.setHand(0, [card]); t.grantFor(0, 0, card);
    t.targetFn = (valid) => { const v = valid.find(x => ziel === 'creature' ? (x.type === 'equip' && x.owner === 1) : (x.type === 'hero' && x.owner === 1 && x.heroIdx === 0)); return [(v || valid[0]).id]; };
    t.policy.confirm = false;                                                // keine Combo
    const atk = [t.hero(0, 0).atk, t.hero(0, 0).baseAtk];
    const r = await t.play(0, card, { hero: 0, noGrant: true, phase: 3 });
    const schaden = ziel === 'creature' ? 1000 - (big.counters.currentHp ?? 1000) : 1000 - t.hp(1, 0);
    R.check(`${card}: Schaden ${erwartet} (base ATK ${atk[1]}, aktueller ATK ${atk[0]})`, r === true && schaden === erwartet, { gespielt: r, schaden });
    R.check('  keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
