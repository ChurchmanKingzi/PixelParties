'use strict';
// W16b · A03-futuretech-13 (Erweiterung) · Doomsday Bomb: „negate that Attack" — auch gegen eine KREATUR ohne Zusatzeffekt, und eine zweite Attacke danach ist nicht betroffen
// (a) Heavy Hit auf eine gegnerische Kreatur: negiert, die Kreatur ist nicht betäubt (Bombe zündet).
// (b) Nach der Explosion ist die Bombe verbraucht: ein zweiter Heavy Hit in der Zusatzaktion wirkt normal (Ziel gestunnt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const DB_ = 'Future Tech Doomsday Bomb';

  R.section('(a) Kreaturenziel');
  {
    const t = await H.fresh({ hand: [[DB_, 'Heavy Hit'], []], discard: [[DB_], []] });
    await t.play(0, DB_, { hero: 0 });
    t.hero(0, 0).atk = 100;
    const k = t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === 1).id];
    await t.play(0, 'Heavy Hit', { hero: 0 });
    R.check('Bombe gezündet (2 in der Ablage)', t.pile(0, 'discardPile').filter(n => n === DB_).length === 2, t.pile(0, 'discardPile'));
    R.check('Kreatur nicht betäubt (Angriff negiert)', !k.counters.stunned, k.counters);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b) späterer Angriff unberührt');
  {
    const t = await H.fresh({ hand: [[DB_, 'Heavy Hit', 'Heavy Hit'], []], discard: [[DB_], []] });
    await t.play(0, DB_, { hero: 0 });
    t.hero(0, 0).atk = 100;
    t.targetFn = (v) => [v.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 0).id];
    await t.play(0, 'Heavy Hit', { hero: 0 });                          // negiert
    t.targetFn = (v) => [v.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 1).id];
    await t.play(0, 'Heavy Hit', { hero: 0 });                          // normal
    R.check('zweiter Heavy Hit wirkt: Held 1 betäubt', !!(t.hero(1, 1).statuses || {}).stunned, Object.keys(t.hero(1, 1).statuses || {}));
    R.check('zweiter Heavy Hit richtet 100 Schaden an (nach den 50 der Explosion: 650)', t.hp(1, 1) === 650, t.hp(1, 1));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
