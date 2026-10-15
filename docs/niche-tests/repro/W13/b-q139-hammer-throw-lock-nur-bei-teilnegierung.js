'use strict';
// W13 / Q139 (M01-17) · Hammer Throw: der Item Lock bleibt, wenn NUR der Schaden verhindert wird; entfällt, wenn die Karte insgesamt negiert wird.
// Al: „Wenn NUR der Schaden verhindert wird, ja. Wenn die Karte insgesamt negiert wird, nein." (Z7b: `negatesWholeCard`)
// Erwartung: Escape (Schaden weg) → Lock gesetzt; Frost Rune / Invisibility Cloak (ganz negiert) → kein Lock; ohne Reaktion → Lock. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const aim = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  async function lauf(setup) {
    const t = await H.fresh({ hand: [['Hammer Throw'], []], hp: 800, gold: [100, 100], abilities: { 1: { 0: [['Fighting', 'Fighting'], [], []] } } });
    await setup(t);
    t.targetFn = aim;
    const r = await t.play(0, 'Hammer Throw', { hero: 0 });
    return { r, hp: t.hp(1, 0), locked: !!t.gs.players[1].itemLocked, errors: t.errors };
  }
  let x = await lauf(async () => {});
  R.check('ohne Reaktion: Schaden + Lock', x.r && x.hp === 760 && x.locked, x);
  x = await lauf(async t => { t.setHand(1, ['Escape', 'ZZ Filler']); t.hero(1, 0).hp = 30; });
  R.check('Escape (nur Schaden verhindert): Held unversehrt, Lock gesetzt', x.r && x.hp === 30 && x.locked, x);
  x = await lauf(async t => { t.grantFor(1, 0, 'Frost Rune'); t.putSurprise(1, 0, 'Frost Rune'); });
  R.check('Frost Rune (Karte ganz negiert): kein Schaden, kein Lock', x.r && x.hp === 800 && !x.locked, x);
  x = await lauf(async t => { t.setHand(1, ['Invisibility Cloak']); });
  R.check('Invisibility Cloak (Karte ganz negiert): kein Schaden, kein Lock', x.r && x.hp === 800 && !x.locked, x);
  R.check('keine Engine-Fehler', x.errors.length === 0, x.errors);
  R.finish();
})();
