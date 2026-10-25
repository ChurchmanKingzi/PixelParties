'use strict';
// W72a · Control Monitors — Quelle ABLAGE (nicht nur Deck) und „1 or more cards" = EIN Fenster je Effekt (BEIDE Sitze).
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand …"
// Erwartet: Shooting Star / Boomerang / Gate to the Armory (Ablage bzw. Deck oder Ablage): ein Angebot, die Karte aus der Ablage wird geloescht;
//   Elixir of Mana (3 Spells aus der Ablage), Divine Gift of Creation (2 Karten aus dem Deck): EIN Fenster fuer alle Karten, Preis = so viele Handkarten wie Karten hinzugefuegt wurden.
// Aufruf: node docs/niche-tests/repro/W72/a-14-….js   (Exit 0 = korrekt)
const L = require('../../lib/monitors.js');
const { H, F, MC } = L;
const SPELLS = ['Fireball', 'Burning Finger', 'Frost Rune'].filter(n => H.DB[n]);

const waehle = (n, namen) => (d) => {
  const idx = namen.map(x => d.cards.findIndex(c => c.name === x)).filter(i => i >= 0).slice(0, n);
  return { selectedCards: idx.map(i => d.cards[i].name), selectedIndices: idx };
};

(async () => {
  const R = H.runner();
  for (const M of [0, 1]) {
    const A = 1 - M;
    const lauf = async (titel, karte, o, erwartetN, geloeschtErwartet, extra) => {
      R.section(`Sitz ${M} haelt Monitors · ${titel}`);
      const t = await L.szene(M, { handM: [MC, ...Array(erwartetN + 1).fill(F)], ...o });
      if (extra) extra(t);
      await t.play(A, karte); await t.drain();
      R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
      R.check('genau EIN Angebot fuer den ganzen Effekt', L.fenster(t).length === 1, t.prompts.map(p => p.pi + p.d.type));
      R.check(`Preiswahl: ${erwartetN} Karte(n)`, L.preisWahl(t).length === 1 && L.preisWahl(t)[0].d.minSelect === erwartetN, L.preisWahl(t).map(p => p.d.minSelect));
      R.check(`alle ${geloeschtErwartet.length} hinzugefuegten Karten geloescht, keine mehr auf der Hand`, geloeschtErwartet.every(n => t.pile(A, 'deletedPile').includes(n)) && geloeschtErwartet.every(n => !t.pile(A, 'hand').includes(n) || n === karte), { g: t.pile(A, 'deletedPile'), h: t.pile(A, 'hand') });
      R.check(`Reaktionsspieler: Control Monitors + ${erwartetN} Preis-Karte(n) in der Ablage`, t.pile(M, 'discardPile').length === erwartetN + 1 && t.pile(M, 'discardPile').includes(MC), t.pile(M, 'discardPile'));
      R.check('genau eine Loeschung gemeldet', t.lg('control_monitors').length === 1, t.lg('control_monitors').length);
      R.check('keine Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
      return t;
    };
    await lauf('Shooting Star: 1 Karte aus der Ablage', 'Shooting Star', { discardA: ['Fireball', F] }, 1, ['Fireball']);
    await lauf('Gate to the Armory: Artefakt aus der Ablage', 'Gate to the Armory', { discardA: ['Magnetic Glove'], deckA: [F, F] }, 1, ['Magnetic Glove'],
      (t) => t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Gate to the Armory', answer: (d) => ({ cardName: 'Magnetic Glove', source: (d.cards.find(c => c.name === 'Magnetic Glove') || {}).source }) }));
    await lauf('Elixir of Mana: 3 Spells aus der Ablage = EIN Fenster, Preis 3', 'Elixir of Mana', { discardA: [...SPELLS, F] }, SPELLS.length, SPELLS,
      (t) => t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Elixir of Mana', answer: waehle(3, SPELLS) }));
    await lauf('Divine Gift of Creation: 2 Karten aus dem Deck = EIN Fenster, Preis 2', 'Divine Gift of Creation', { deckA: ['Fireball', 'Cute Cat', F, F] }, 2, ['Fireball', 'Cute Cat'],
      (t) => t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Divine Gift of Creation', answer: waehle(2, ['Fireball', 'Cute Cat']) }));
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
