'use strict';
// A09-14 · Tuscan Mystic ersetzt einen Mehrfach-Zug aus dem Potion Deck komplett durch EINE Aufdeck-Auflösung – die übrigen Karten gehen verloren
// Kartentext Tuscan Mystic: „Whenever you would draw A card from your Potion Deck, you may reveal the top 2 cards of your Potion Deck and immediately resolve one of them instead. Delete both revealed cards afterwards."
// Vergleich (gleiche Formulierung, ausdrückliches Ruling): Philosopher's Stone („Play this card immediately when you would draw a card from your Potion Deck … instead") – dort ersetzt jede gespielte Kopie genau EINEN Zug, „der Rest wird normal gezogen" (philosopher-s-stone.js Kopf).
// Potion of Greed: „Draw 2 cards from your Potion Deck." Skript tuscan-mystic.js: `beforeDrawBatch` → ... → `ctx.setAmount(0)` (Z. 153): der GANZE Batch entfällt.
// Aufbau: Seed 1234. Sitz 0: Tuscan Mystic im Support (Held 0, Slot 0), Hand [Potion of Greed], Potion Deck 6 Karten (Healing Potion, Life Serum, Poison Vial, … ).
// Schritte: Potion of Greed spielen; Mystic: Ja, Karte aus den 2 aufgedeckten wählen.
// Erwartet: Zwei Züge → der erste wird ersetzt; der zweite wird entweder ebenfalls ersetzt (zweite Mystic-Abfrage) oder normal gezogen (1 Karte auf der Hand).
// Beobachtet: Eine einzige Abfrage; beide Züge sind weg (Hand leer), 2 Potion-Karten aufgedeckt+gelöscht, 4 bleiben im Potion Deck.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (mitMystic) => {
    const t = await H.fresh({ hand: [['Potion of Greed'], []], gold: [100, 100], potionDeck: [['Healing Potion', 'Life Serum', 'Poison Vial', 'Healing Potion', 'Life Serum', 'Poison Vial'], []] });
    if (mitMystic) t.put(0, 0, 0, 'Tuscan Mystic');
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Tuscan Mystic', answer: (d) => ({ cardName: d.cards[0].name }) });
    await t.play(0, 'Potion of Greed', { hero: 0 });
    return { hand: t.pile(0, 'hand'), potionDeck: t.pile(0, 'potionDeck').length, mysticFragen: t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === 'Tuscan Mystic').length, errors: t.errors };
  };
  R.section('Kontrolle ohne Mystic');
  const k = await lauf(false);
  R.check('Greed zieht 2 Karten', k.hand.length === 2, k);
  R.section('Mit Tuscan Mystic');
  const m = await lauf(true);
  R.check('Mystic wurde gefragt (Voraussetzung)', m.mysticFragen >= 1, m);
  R.check('der zweite Zug geht nicht verloren: zweite Mystic-Abfrage ODER normal gezogene Karte auf der Hand', m.mysticFragen >= 2 || m.hand.length === 1, m);
  R.check('keine Engine-Fehler', m.errors.length === 0, m.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
