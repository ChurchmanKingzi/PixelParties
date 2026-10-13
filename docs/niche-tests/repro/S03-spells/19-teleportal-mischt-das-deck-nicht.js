'use strict';
// S03-19 · Teleportal: „Search your deck" – das Deck wird danach nicht gemischt (Reihenfolge bleibt erhalten)
// Kartentext: „Search your deck for a card and place it openly in front of you. …"
// Projektkonvention (CARD_API.md ~Z. 14161 „search implies a shuffle", Z. 19611 „mit … anschließendem Mischen wie jede Suche"; Masterpiece/Pillar of Light/Ultimate Weapon Experiment/Overcharge mischen):
//   Nach einer Suche wird gemischt – sonst bliebe eine zuvor geordnete Deckoberseite (Bartas-Umordnung, Salute-Reihenfolge …) erhalten.
// Aufbau: Deck aus 8 verschiedenen Karten in bekannter Reihenfolge; Teleportal sucht „Fireball". Kontrolle: Masterpiece (mischt) mit demselben Aufbau/Seed ändert die Reihenfolge.
// Erwartet: Reihenfolge der übrigen 7 Karten ist (bei mindestens einem der Seeds) verändert.
// Beobachtet: in allen Seeds exakt die Ausgangsreihenfolge ohne Fireball (`teleportal.js` Z. 170 `takeFromPile(pi, 'deck', name, { source })` ohne `shuffle: true`, kein `shuffleDeck`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const namen = ['Rockfall', 'Meteor Crash', 'Rain of Arrows', 'Fireball', 'Slow', 'Toxic Fumes', 'Salute to the Fallen', 'Supply Chain'];
  const rest = namen.filter(n => n !== 'Fireball');
  let verschieden = 0;
  for (const seed of [1234, 5, 77]) {
    const t = await H.fresh({ seed, hand: [['Teleportal'], []], hp: 800, deck: [namen, ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']] });
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fireball' }) });
    await t.play(0, 'Teleportal', { hero: 0, noGrant: true });
    const deck = t.pile(0, 'mainDeck');
    if (JSON.stringify(deck) !== JSON.stringify(rest)) verschieden++;
    R.note(`Seed ${seed}`, JSON.stringify(deck));
  }
  // Kontrolle: Masterpiece mischt unter denselben Seeds
  let kontrolle = 0;
  for (const seed of [1234, 5, 77]) {
    const t = await H.fresh({ seed, hand: [['Masterpiece'], []], hp: 800, deck: [['Rockfall', 'Meteor Crash', 'Rain of Arrows', 'Booby Trap', 'Slow', 'Toxic Fumes', 'Salute to the Fallen', 'Supply Chain'], ['ZZ Dummy']] });
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Booby Trap' }) });
    await t.play(0, 'Masterpiece', { hero: 0, noGrant: true });
    const rest2 = ['Rockfall', 'Meteor Crash', 'Rain of Arrows', 'Slow', 'Toxic Fumes', 'Salute to the Fallen', 'Supply Chain'];
    if (JSON.stringify(t.pile(0, 'mainDeck')) !== JSON.stringify(rest2)) kontrolle++;
  }
  R.check('Kontrolle: Masterpiece mischt (Reihenfolge ändert sich in mindestens einem Seed)', kontrolle > 0, { kontrolle });
  R.check('Teleportal mischt das Deck nach der Suche (Reihenfolge ändert sich in mindestens einem Seed)', verschieden > 0, { verschieden });
  R.finish();
})();
