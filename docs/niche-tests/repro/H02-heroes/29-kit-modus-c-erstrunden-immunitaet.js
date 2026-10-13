// H02-heroes-29 · Kit: Modus „Opp Discards Random" umgeht die Erst-Runden-Immunität (und das Handinteraktions-Fenster)
//
// Kartentext Kit: „Whenever an Ability is attached to this Hero, you may reveal a Creature from your deck and choose one of these effects: … - Your opponent must discard a random card from their hand. …"
// Regel (CARD_API.md „Turn-1 Immunity"): „during turn 1, every card belonging to the non-turn player is completely immune to anything the turn player can do." `actionDiscardHandCard` schützt, wenn der Aufrufer `opts.sourceOwner` nennt (`_engine.js` ~14082).
// Kit ruft `engine.actionDiscardHandCard(oppPi, name, idx, { source: CARD_NAME })` OHNE `sourceOwner` (kit-the-shark-researcher.js `_runModeC`, Z. ~435).
// Aufbau: Kit als Held 0, Hand [Fighting], Deck mit ZZ Dummy; Sitz 1 hat 3 Handkarten und ist erstrundengeschützt (`gs.firstTurnProtectedPlayer = 1`). Sitz 0 legt Fighting an Kit an, wählt ZZ Dummy und Modus C.
// Erwartung: der geschützte Spieler wirft nichts ab (Hand 3). Kontrolle: derselbe Abwurf mit `sourceOwner` wird geblockt; Modus B (50 Schaden) wird geblockt.
// Beobachtung: Modus C wirft eine Karte ab (Hand 2).
// Aufruf: node docs/niche-tests/repro/H02-heroes/29-kit-modus-c-erstrunden-immunitaet.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const KT = 'Kit, the Shark Researcher';
async function lauf(mode) {
  const t = await H.fresh({ heroes: [[KT, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fighting'], ['Fireball', 'Fireball', 'Fireball']], deck: [[H.INERT.creature, 'Fireball', 'Fireball'], []] });
  t.gs.firstTurnProtectedPlayer = 1;
  t.targetFn = (v) => v.filter(x => x.owner === 1).slice(0, 2).map(x => x.id);
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === KT, answer: () => ({ cardName: H.INERT.creature }) });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === KT, answer: () => ({ optionId: mode }) });
  t.script.push({ match: d => d.type === 'deckSearchReveal', answer: () => ({}) });
  const r = await t.play(0, 'Fighting', { hero: 0 });
  return { t, r };
}
(async () => {
  const R = H.runner();
  { const { t } = await H.fresh({ hand: [[], ['Fireball', 'Fireball', 'Fireball']] }).then(t => ({ t }));
    t.gs.firstTurnProtectedPlayer = 1;
    const ok = await t.run(() => t.engine.actionDiscardHandCard(1, 'Fireball', 0, { source: 'Kontrolle', sourceOwner: 0 }));
    R.check('Kontrolle: Fremd-Abwurf mit sourceOwner gegen den Geschützten wird geblockt', t.pile(1, 'hand').length === 3, { ok, hand: t.pile(1, 'hand').length }); }
  { const { t, r } = await lauf('B');
    R.check('Modus B: geschützte Helden bleiben unverletzt', r === true && [0, 1, 2].every(i => t.hp(1, i) === 800), { r, hp: [0, 1, 2].map(i => t.hp(1, i)) }); }
  { const { t, r } = await lauf('C');
    R.check('Modus C: der Erstrunden-geschützte Spieler wirft nichts ab', r === true && t.pile(1, 'hand').length === 3, { r, hand: t.pile(1, 'hand').length });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
