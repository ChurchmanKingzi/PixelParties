// H02-heroes-24 · Krates (dauerhaft übernommen): die Such-Umleitung hängt an der Spalte, nicht am Kontrolleur
//
// Kartentext Krates: „Whenever an effect would allow your opponent to search their deck for a card and add it to their hand, they must search for up to 3 appropriate cards with different names instead, … You pick one of them to add to your hand, then pick one to add to their hand. The remaining card is deleted."
// Regel (CARD_API.md Z. 6046 / Styx 28.9.): ein dauerhaft übernommener Held gehört dem Kontrolleur („you" = Kontrolleur) – wie die Befunde H01-03/-04/-15/-16 (Spalte statt Kontrolleur).
// Aufbau: Krates auf Sitz 0, Held 0; Sitz 1 übernimmt ihn dauerhaft (`actionTakeHeroPermanently(1, 0, 0)`). Beide Decks mit 5 Zaubern + Dummys.
// Erwartung: (b) Sitz 1 (Kontrolleur) sucht per Brilliant Idea selbst → KEINE Umleitung; (c) Sitz 0 (Alt-Besitzer) sucht → Sitz 1 greift als Krates-Spieler ein (3 Karten, wählt).
// Beobachtung: (b) die Suche von Sitz 1 wird von SITZ 0 umgeleitet (Sitz 0 nimmt eine Karte auf seine Hand), (c) die Suche von Sitz 0 läuft ungestört.
// Aufruf: node docs/niche-tests/repro/H02-heroes/24-krates-uebernommen-spalte-statt-kontrolleur.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const KR = 'Krates, the Smartass';
const DECK = ['Fireball', 'Explosion', 'Pyroblast', 'Burning Finger', 'Rockfall', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'];
function antworten(t) {
  t.script.push({ match: d => d.type === 'cardGallery' && !(d.role || '').startsWith('krates') && d.title !== KR, answer: () => ({ cardName: 'Fireball' }) });
  t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.role === 'krates-search', answer: (d) => ({ selectedCards: d.cards.slice(0, d.selectCount).map(c => c.name) }) });
  t.script.push({ match: d => (d.role || '').startsWith('krates'), answer: (d) => ({ cardName: d.cards[0].name }) });
}
const kratesPrompts = (t) => t.prompts.filter(p => (p.d.role || '').startsWith('krates')).map(p => `Sitz ${p.pi}:${p.d.role}`);
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ heroes: [[KR, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[], ['Brilliant Idea']], deck: [DECK.slice(), DECK.slice()], active: 1 });
    await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 0)); antworten(t);
    const r = await t.play(1, 'Brilliant Idea', { hero: 0 });
    R.check('(b) Sitz 1 (Kontrolleur von Krates) sucht selbst: keine Krates-Umleitung', r === true && kratesPrompts(t).length === 0, { r, kratesPrompts: kratesPrompts(t), hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand') }); }
  { const t = await H.fresh({ heroes: [[KR, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Brilliant Idea'], []], deck: [DECK.slice(), DECK.slice()], active: 0 });
    await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 0)); antworten(t);
    const r = await t.play(0, 'Brilliant Idea', { hero: 1 });
    R.check('(c) Sitz 0 (Alt-Besitzer) sucht: Krates des Sitzes 1 leitet um', r === true && kratesPrompts(t).length > 0, { r, kratesPrompts: kratesPrompts(t), hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand') }); }
  R.finish();
})();
