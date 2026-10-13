'use strict';
// H01-heroes-20 · Card Game Player Inya NEGIERT: ihr Zauber wird trotzdem zum Fantasy Buddy
//
// Kartentext: „Whenever this Hero uses a Spell during your turn, you may summon that Spell into one of this Hero's free Support Zones as a Fantasy
//   Buddy Token with 10 HP after it has resolved instead of sending it to the discard pile. While you control at least 1 Fantasy Buddy Token, this Hero
//   takes no damage."
// Konvention: negierte Helden verlieren ihre Effekte. Das Skript setzt `bypassStatusFilter: true` ausdrücklich nur, damit der SCHADENSSCHILD („passive protection
//   isn't an effect she activates") bei Frost/Betäubung/Negation hält; Beato (gleiches Muster) fügt dem `afterSpellResolved` eine eigene Status-Sperre hinzu.
// Aufbau: Sitz 0: Inya auf Held 0 (negiert), Lv-0-Zauber „ZZ Filler" auf der Hand (ein negierter Held darf nur Zauber ohne Schulanforderung wirken).
// Erwartet: negiert wird nichts zum Buddy – der Zauber geht in die Ablage, keine Rückfrage.
// Beobachtet: die Rückfrage „Summon … as a Fantasy Buddy Token?" erscheint, der Zauber liegt als Buddy (10 HP) im Support, der Schadensschild wird scharf.
// Ursache: `card-game-player-inya.js` `afterSpellResolved` (~Z. 111 ff.) prüft `hero.statuses.negated` nicht (anders als `beato-the-butterfly-witch.js` Z. 136 f.).
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya';
(async () => {
  const R = H.runner();
  async function lauf(status) {
    const t = await H.fresh({ heroes: [[IN, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[H.INERT.filler], []] });
    if (status) t.heroStatus(0, 0, status);
    const r = await t.play(0, H.INERT.filler, { hero: 0 });
    return { t, r, fragen: t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === IN).length, buddy: t.gs.players[0].supportZones[0].flat().length, ablage: t.pile(0, 'discardPile').length };
  }
  const g = await lauf(null);
  R.check('Kontrolle gesund: Rückfrage, Buddy im Support, Ablage leer', g.r === true && g.fragen === 1 && g.buddy === 1 && g.ablage === 0, g);
  const n = await lauf('negated');
  R.check('negiert: Zauber gespielt', n.r === true, n.r);
  R.check('negiert: KEINE Buddy-Rückfrage', n.fragen === 0, n.fragen);
  R.check('negiert: Zauber landet in der Ablage, kein Buddy', n.buddy === 0 && n.ablage === 1, { buddy: n.buddy, ablage: n.ablage });
  R.check('keine Engine-Fehler', n.t.errors.length === 0, n.t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
