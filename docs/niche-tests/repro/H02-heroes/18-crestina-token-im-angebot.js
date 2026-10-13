// H02-heroes-18 · Crestina: Tokens stehen im Angebot „von außerhalb des Spiels" und landen als tote Karte auf der Hand
//
// Kartentext Crestina: „During your Resource Phase, you may skip drawing a card to choose 3 cards with different names from outside the game. Your opponent chooses 1 of those cards and adds it to your hand."
// Konvention (A05-02/A05-12, CARD_API „Tokens … überall verboten"): Tokens sind keine Karten – sie kommen nie in Hand/Deck/Ablage.
// Erwartung: kein Token im Angebot / kein Token auf der Hand. Beobachtung: Biomancy-/Invader-/Mummy-/Pollution Token werden angeboten; ein gewählter Mummy Token liegt auf der Hand
//   und ist dort unspielbar (doPlayCreature lehnt ab) – eine tote Handkarte (Wahl des Gegners, wenn er sie wählt).
// Aufruf: node docs/niche-tests/repro/H02-heroes/18-crestina-token-im-angebot.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const CR = 'Fairy Queen Crestina, the Creation Fairy';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[CR, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], active: 1, hand: [[], []] });
  let offered = [];
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => { offered = d.cards.map(c => c.name); return { selectedCards: ['Mummy Token', 'Pollution Token', 'Biomancy Token'] }; }, once: true });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === CR, answer: () => ({ cardName: 'Mummy Token' }), once: true });
  await t.endTurn();   // Zugbeginn Sitz 0 (Crestina), Resource Phase
  R.check('Angebot enthält keine Tokens', !offered.some(n => /Token$/.test(n)), offered.filter(n => /Token$/.test(n)));
  R.check('kein Token auf der Hand', !t.pile(0, 'hand').some(n => /Token$/.test(n)), t.pile(0, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
