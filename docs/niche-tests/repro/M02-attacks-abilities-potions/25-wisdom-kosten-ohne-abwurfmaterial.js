'use strict';
// M02-25 · Wisdom: der Server lässt einen Zauber über der eigenen Stufe zu, obwohl kein Abwurfmaterial da ist (Zauber wirkt gratis)
// Kartentext Wisdom Lv1: „This Hero can use Spells 1 level higher than it normally could. If this Hero uses a Spell it would not be able to use without this effect, discard as many cards as the Spell's level is too high."
// Ruling (CARD_API.md ~Z. 17916/18115, v1279/v1288): Wisdom-Abwurf braucht Material (`handFodderFor`): die Spielbarkeitslisten (`getHeroPlayableCards`, _engine.js ~19713/20083/20274) lassen die Karte ohne Material nicht zu.
// Erwartung: Held mit Destruction Magic 1 + Wisdom 1 und NUR dem Fireball (Lv2) auf der Hand ⇒ nicht spielbar (Kosten 1, Material 0).
// Beobachtet: `doPlaySpell` akzeptiert, Fireball wirkt (150 Schaden), `forceDiscard` findet kein Material, die Kosten entfallen. Der Client graut die Karte aus (Liste), `validateActionPlay` (_engine.js:20598) kennt die Prüfung nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [label, extra, soll] of [['mit 1 Füllkarte (Kontrolle)', ['ZZ Filler'], true], ['ohne Füllkarte', [], false]]) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(0, 0, [['Destruction Magic'], ['Wisdom'], []]);
    t.setHand(0, ['Fireball', ...extra]);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    const gewirkt = t.hp(1, 0) < 800;
    R.check(`Wisdom Lv1, Fireball Lv2, ${label}: ${soll ? 'wirkt, Füllkarte abgeworfen' : 'nicht spielbar'}`, soll ? (gewirkt && t.pile(0, 'discardPile').includes('ZZ Filler')) : (!gewirkt && r === false), { r, gewirkt, disc: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
  }
  R.finish();
})();
