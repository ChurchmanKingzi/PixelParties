'use strict';
// A03-futuretech-13 · Doomsday Bomb: „negate that Attack“ setzt nur den Schaden auf 0 – Zusatzeffekte des Angriffs wirken weiter
//
// Kartentext: „When the equipped Hero would hit 1 or more targets your opponent controls with an Attack, **negate that Attack**. If you do, all targets on
//   the board take damage equal to 50 times the combined number of "Future Tech Doomsday Bomb" cards in all discard piles. …“
// Erwartung: Der Angriff ist negiert, also ohne jede Wirkung: kein Stun (Heavy Hit), kein Blind (Trunk Sand), keine Vergiftung (Blow of the Venom Snake),
//   kein erzwungener Abwurf (Strong Ox Headbutt). Nur die Doomsday-Explosion (50 × Anzahl) trifft.
// Beobachtet: Schaden 0, aber der Gegner-Held ist gestunnt / geblendet / vergiftet bzw. wirft eine Karte ab.
// Ursache: cards/effects/future-tech-doomsday-bomb.js (`onAttackDeclare`: `ctx.setAmount(0)`, Z. 143; Kopfkommentar Z. 20-23: „löst sich auf, richtet aber nichts aus“). Der Vertrag (CARD_API.md ~7920) sagt ausdrücklich,
//   so negiere Doomsday Bomb – das Fenster kennt nur den Schaden; Nebenwirkungen der Attack-Karte laufen danach regulär weiter.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const DB_ = 'Future Tech Doomsday Bomb';
  for (const [atk, status] of [['Heavy Hit', 'stunned'], ['Trunk Sand', 'blinded_hit'], ['Blow of the Venom Snake', 'poisoned']]) {
    const t = await H.fresh({ hand: [[DB_, atk], []], discard: [[DB_], []] });
    await t.play(0, DB_, { hero: 0 });
    t.hero(0, 0).atk = 100;
    t.targetFn = (v) => [v.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 0).id];
    await t.play(0, atk, { hero: 0 });
    R.check(`${atk}: Doomsday ausgelöst (Bomb in der Ablage, 50 Schaden an alle)`, t.pile(0, 'discardPile').filter(n => n === DB_).length === 2 && t.hp(1, 0) === 750, { hp: t.hp(1, 0), ablage: t.pile(0, 'discardPile') });
    R.check(`${atk}: negierter Angriff hat keine Nebenwirkung (${status})`, !(t.hero(1, 0).statuses || {})[status], Object.keys(t.hero(1, 0).statuses || {}));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // Zusatz: Held mit ATK 0 – der Angriff trifft (Heavy Hit stunnt), die Bombe zündet aber nicht (`ctx.amount > 0`-Bedingung, Z. 131).
  R.section('ATK 0');
  const t0 = await H.fresh({ hand: [[DB_, 'Heavy Hit'], []], discard: [[DB_], []] });
  await t0.play(0, DB_, { hero: 0 });
  t0.hero(0, 0).atk = 0; t0.hero(0, 0).baseAtk = 0;
  t0.targetFn = (v) => [v.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 0).id];
  await t0.play(0, 'Heavy Hit', { hero: 0 });
  // ★ W16b: umgestellt auf die behobene Regel — auch der Angriff eines Helden mit ATK 0 „hits" seine Ziele: die Bombe zündet UND der Angriff ist negiert (kein Stun).
  R.check('Held mit ATK 0: Doomsday Bomb zündet (liegt danach in der Ablage) und der negierte Heavy Hit stunnt nicht', !(t0.hero(1, 0).statuses || {}).stunned && t0.pile(0, 'discardPile').filter(n => n === DB_).length === 2,
    { stunned: !!(t0.hero(1, 0).statuses || {}).stunned, brett: t0.zone(0, 0, 0), ablage: t0.pile(0, 'discardPile') });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
