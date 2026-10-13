'use strict';
// M02-03 · Thieving Strike: Das Thieving des NEGIERTEN Helden senkt weiterhin die Stufe der Karte auf 0
// Kartentext Thieving Strike: „… If the user has the Thieving Ability, this Attack's level becomes 0."
// Regel (Engine, `heroMeetsLevelReq`, _engine.js ~43690): „‚Hard' Negation blanks ability zones: only Lv0 cards without a school requirement
//   remain playable." Ein negierter Held hat also KEINE wirksamen Abilities mehr (Kontrolle: Quick Attack Lv1 mit Fighting 1 ist für ihn nicht spielbar).
// Erwartung: ein negierter Held mit Thieving (aber ohne Fighting) kann das Lv2-Thieving Strike NICHT spielen (seine Thieving-Ability ist negiert).
// Beobachtet: er kann – `thieving-strike.js:_heroHasThieving()` liest die Ability-Zonen direkt (ohne Negation/Status) und `canBypassLevelReq`
//   wird in `_testLevelReqForZones` (Z. ~43807) nach dem Schul-Check unabhängig von den „blanken" Zonen ausgewertet.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const heroT = (seat, hi) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === seat && x.heroIdx === hi); return v ? [v.id] : null; };
  async function spiele(karte, zonen, status) {
    const t = await H.fresh({ hand: [[], ['ZZ Filler', 'ZZ Filler']], hp: 800 });
    t.setAbilities(0, 1, zonen);
    if (status) t.heroStatus(0, 1, status);
    t.targetFn = heroT(1, 0);
    t.setHand(0, [karte]);
    const r = await t.play(0, karte, { hero: 1, noGrant: true });
    return { r, hp: t.hp(1, 0), errors: t.errors };
  }
  const a = await spiele('Thieving Strike', [['Thieving'], [], []], null);
  R.check('Kontrolle: Held mit Thieving (nicht negiert) spielt Thieving Strike als Lv0', a.r === true && a.hp < 800, a);
  const b = await spiele('Quick Attack', [['Fighting'], [], []], 'negated');
  R.check('Kontrolle: negierter Held mit Fighting 1 kann Quick Attack (Lv1) nicht spielen', b.r === false && b.hp === 800, b);
  const c = await spiele('Thieving Strike', [[], [], []], 'negated');
  R.check('Kontrolle: negierter Held ohne Thieving kann Thieving Strike nicht spielen', c.r === false && c.hp === 800, c);
  const d = await spiele('Thieving Strike', [['Thieving'], [], []], 'negated');
  R.check('FEHLER?: negierter Held MIT Thieving kann Thieving Strike NICHT spielen (Thieving ist negiert)', d.r === false && d.hp === 800, d);
  R.finish();
})();
