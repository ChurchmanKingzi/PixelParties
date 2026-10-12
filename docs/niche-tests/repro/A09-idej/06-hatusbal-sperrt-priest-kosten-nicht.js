'use strict';
// A09-06 · Hatusbal: „Your opponent cannot shuffle cards back into their deck with card effects." – Priest of Luna/Tempeste mischen ihre Kosten trotzdem zurück
// Kartentext Priest of Luna/Tempeste: „You may shuffle 5 Creatures with different names from your discard pile back into your deck to summon this Creature as an additional Action. …
//   … you may shuffle 2 Creatures with different names from your discard pile back into your deck to …"
// Hatusbal-Skript: „sperrt ALLE Quellen" (Ruling 16.8.). Die Sperre ist aber nur an Hand-Rückmischern (Mulligan/Leadership) und Staff of Illusions verdrahtet; actionRecycleCards (Ablage -> Deck) fragt sie nicht.
// Aufbau: Seed 1234. Seite 0: Held 0 mit Summoning Magic 1, Hand [Priest of Luna], Ablage 6 verschiedene Kreaturen. Seite 1: Held 1 = Hatusbal (lebend).
// Schritte: Main Phase 1: Priest of Luna über den Zusatzweg (5 Kreaturen mischen) beschwören.
// Erwartet: Mit Hatusbal gesperrt: Die Kosten können nicht bezahlt werden -> keine Beschwörung, Ablage/Deck unverändert.
// Beobachtet: Beschwörung gelingt, 5 Kreaturen wandern ins Deck. Gleiches Bild bei Renewable Energy (ausserhalb der Gruppe).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const sechs = ['Archer', 'Pet Snake', 'Elven Archer', 'Dirty Smuggler', 'Doctor Fester', 'Elven Leader'];
  R.section('Priest of Luna');
  {
    const t = await H.fresh({ hand: [['Priest of Luna'], []], gold: [100, 100], discard: [sechs, []] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    t.setHero(1, 1, 'Hatusbal, the Leader of Tusca', 500);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Priest of Luna', answer: (d) => ({ cardName: d.cards[0].name }) });
    const deck0 = t.pile(0, 'mainDeck').length;
    await t.play(0, 'Priest of Luna', { hero: 0, phase: 2 });
    R.check('Priest of Luna: Kosten (5 Kreaturen ins Deck mischen) sind unter Hatusbal nicht zahlbar', t.pile(0, 'mainDeck').length === deck0 && !t.find('Priest of Luna', 'support'),
      { deckZuwachs: t.pile(0, 'mainDeck').length - deck0, aufBrett: !!t.find('Priest of Luna', 'support') });
  }
  R.section('Kontrolle: Renewable Energy (nicht in der Gruppe)');
  {
    const t = await H.fresh({ hand: [['Renewable Energy'], []], gold: [100, 100], discard: [['Archer', 'Pet Snake'], []] });
    t.setHero(1, 1, 'Hatusbal, the Leader of Tusca', 500);
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.slice(0, 2).map(c => c.name) }) });
    const deck0 = t.pile(0, 'mainDeck').length;
    await t.play(0, 'Renewable Energy', {});
    R.check('Renewable Energy mischt unter Hatusbal nichts zurück', t.pile(0, 'mainDeck').length === deck0, { deckZuwachs: t.pile(0, 'mainDeck').length - deck0 });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
