'use strict';
// W14c · Q176 (S03-19) Teleportal mischt das Deck nach der Suche wie alle anderen Suchkarten (Al 16.10.2026: „Ja")
// Erwartet: nach der Suche (Karte kommt aus dem Deck in die offene Zone) ist die Reihenfolge der übrigen Karten in mindestens einem Seed verändert; die gesuchte Karte fehlt im Deck;
//   ein Abbruch der Galerie lässt das Deck unberührt (Karte nicht verbraucht).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const namen = ['Rockfall', 'Meteor Crash', 'Rain of Arrows', 'Fireball', 'Slow', 'Toxic Fumes', 'Salute to the Fallen', 'Supply Chain'];
  const rest = namen.filter(n => n !== 'Fireball');
  let verschieden = 0, ok = true;
  for (const seed of [1234, 5, 77]) {
    const t = await H.fresh({ seed, hand: [['Teleportal'], []], hp: 800, deck: [namen, ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']] });
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fireball' }) });
    await t.play(0, 'Teleportal', { hero: 0, noGrant: true });
    const deck = t.pile(0, 'mainDeck');
    if (JSON.stringify(deck) !== JSON.stringify(rest)) verschieden++;
    if (deck.length !== 7 || deck.includes('Fireball') || [...deck].sort().join() !== [...rest].sort().join()) ok = false;
    if (t.errors.length) ok = false;
  }
  R.check('Deck enthält nach der Suche genau die übrigen 7 Karten (nur gemischt)', ok);
  R.check('Reihenfolge ändert sich in mindestens einem Seed (gemischt)', verschieden > 0, { verschieden });
  {
    const t = await H.fresh({ seed: 1234, hand: [['Teleportal'], []], hp: 800, deck: [namen, ['ZZ Dummy']] });
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => null });
    await t.play(0, 'Teleportal', { hero: 0, noGrant: true });
    R.check('Abbruch der Galerie: Deck bleibt unverändert', JSON.stringify(t.pile(0, 'mainDeck')) === JSON.stringify(namen), t.pile(0, 'mainDeck'));
  }
  R.finish();
})();
