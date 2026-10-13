'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-13 · Santa Klaus: ein NEGIERTER Santa bleibt durch die Hand-Sperre („cannot act with fewer than 2 cards") blockiert
//
//  Karten: Santa Klaus (`cards/effects/santa-klaus.js`, `canPlayCard`); Kontrolle: Saint Nicolas (`saint-nicolas.js:155`, `if (s.frozen || s.stunned || s.negated) return true;`)
//  Kartentext: „Whenever this Hero uses an Attack or Spell, you must add 2 cards from your hand to your opponent's hand."
//  Skriptkopf: die Spielbarkeits-Sperre (Al 14.9.) existiert, damit der „must"-Preis zahlbar ist. Engine-Regel: ein negierter Held wirkt nicht – sein Preis
//  entfällt (der Hook wird vom Verteiler stillgelegt), die Sperre müsste mit entfallen. Negation nimmt dem Helden nicht die Handlungsfähigkeit.
//  Erwartung: Negierter Santa mit nur dem Attack auf der Hand kann ihn wirken und zahlt nichts (Stufe-0-Attack: negierte Helden verlieren ihre Abilities, daher keine Schul-Zauber).
//  Beobachtung (✗): `canPlayCard` prüft den Status nicht → Attack nicht spielbar (`doPlaySpell` lehnt ab); der negierte Saint Nicolas (Kontrolle) ist frei.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/13-santa-klaus-negiert-bleibt-gesperrt.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const held of ['Saint Nicolas', 'Santa Klaus']) {
    const t = await H.fresh({ heroes: [[held, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 600, hand: [['Attack'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    t.heroStatus(0, 0, 'negated', { appliedTurn: t.gs.turn, duration: 3 });
    const r = await t.play(0, 'Attack', { hero: 0 });
    R.note(`${held} (negiert), nur Attack auf der Hand`, { r, gegnerHp: t.hp(1, 0), hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand') });
    R.check(`${held} negiert: Attack spielbar (Preis/Sperre entfallen)`, r === true && t.hp(1, 0) < 600, { r, hp: t.hp(1, 0) });
    R.check(`${held} negiert: Gegner bekommt keine Karten`, t.pile(1, 'hand').length === 0, t.pile(1, 'hand'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
