'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-04 · Nomu unter Mummy Token: Extra-Zug ist aus, die Handlimit-Freiheit bleibt
//
//  Karten: Nomu, Wanderer of Worlds (`cards/effects/nomu-wanderer-of-worlds.js`); Mummy Token
//  Kartentext Nomu: „Up to 3 times per turn, when you draw exactly 1 card, except through this effect: Draw 1 additional card
//  from your deck. You have no hand size limit."  Mummy Token: „The effect of the corresponding Hero is replaced by this effect: …"
//  Erwartung: Ist Nomus Effekt durch den Mummy Token ersetzt, entfallen BEIDE Teile (Extra-Zug UND „no hand size limit").
//  Beobachtung (✗): `_hasActiveNomu` (_engine.js:28840) beachtet `_isHeroMummified` – der Extra-Zug entfällt; `_shouldBypassHandLimit`
//  (_engine.js:28900) prüft nur frozen/stunned/negated, nicht den Mummy Token – die Hand bleibt am Zugende bei 10 Karten.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/04-nomu-mummy-handlimit.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const T = 'Tushu, the Knowledge Keeper', Z = 'Zwei, the Lucky Thief';
(async () => {
  const R = H.runner();
  async function lauf(held0, mummy) {
    const t = await H.fresh({ heroes: [[held0, T, Z], null], hp: 400, hand: [Array(10).fill('Heal'), []], deck: [Array(30).fill('Heal'), Array(30).fill('Heal')] });
    if (mummy) t.put(0, 0, 0, 'Mummy Token');
    const vor = t.pile(0, 'hand').length;
    await t.run(() => t.engine.actionDrawCards(0, 1, { source: 'ZZ' }));
    const gezogen = t.pile(0, 'hand').length - vor;
    await t.endTurn();    // Zugende Sitz 0: Handlimit (7) wird durchgesetzt
    return { gezogen, hand: t.pile(0, 'hand').length, t };
  }
  const ohne = await lauf(T, false);
  R.note('Kontrolle ohne Nomu: Hand nach Zugende', ohne.hand);
  R.check('Kontrolle: ohne Nomu gilt das Handlimit 7', ohne.hand === 7, ohne.hand);
  const nomu = await lauf('Nomu, Wanderer of Worlds', false);
  R.check('Kontrolle: Nomu aktiv -> Extra-Zug (2 Karten) und kein Handlimit (12 bleiben)', nomu.gezogen === 2 && nomu.hand === 12, nomu);
  const mum = await lauf('Nomu, Wanderer of Worlds', true);
  R.note('Nomu + Mummy Token', { gezogen: mum.gezogen, hand: mum.hand });
  R.check('Mummy Token: kein Extra-Zug', mum.gezogen === 1, mum.gezogen);
  R.check('Mummy Token: auch kein „no hand size limit" mehr (Hand ≤ 7 nach Zugende)', mum.hand <= 7, mum.hand);
  R.check('keine Engine-Fehler', mum.t.errors.length === 0, mum.t.errors);
  R.finish();
})();
