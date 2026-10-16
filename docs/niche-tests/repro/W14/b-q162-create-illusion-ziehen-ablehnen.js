'use strict';
// W14b · Q162 (S01-16, Create Illusion) · Al, 16.10.2026: „Ja, soll er ablehnen können"
// Kartentext: „… At the end of your opponent's next turn, shuffle the Creature … back into your deck, and if you do, your opponent may draw as many cards as the Creature's level."
// Erwartet: (a) der Gegner wird (Ja/Nein) gefragt; Ja → zieht Level-viele Karten; (b) Nein → zieht nicht, kein Deck-Out bei leerem Deck; (c) die CPU-Antwort (Skript-cpuResponse):
//   annehmen, außer es droht ein Deck-Out (weniger Karten im Deck als zu ziehen); (d) Illusion kehrt in jedem Fall ins Deck zurück.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const C = 'Elven Archer';
  async function szene(antwort, deckGegner) {
    const t = await H.fresh({ hand: [['Create Illusion'], []], deck: [[C, 'Fireball', 'Fireball'], deckGegner], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
    let frage = null;
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Create Illusion', answer: (d) => { frage = d; return antwort; } });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Create Illusion', answer: () => ({ cardName: C }) });
    await t.play(0, 'Create Illusion', { hero: 0, noGrant: true });
    await t.endTurn();                                  // Gegnerzug beginnt (zieht 1)
    return { t, frage: () => frage };
  }

  R.section('(a) Ja → zieht Level-viele Karten');
  {
    const { t, frage } = await szene({ confirmed: true }, ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']);
    const handVor = t.pile(1, 'hand').length;
    await t.endTurn();
    R.check('der Gegner wurde gefragt (Titel Create Illusion, 1 Karte)', !!frage() && frage().illusionDraw?.count === 1, frage());
    R.check('Ja: der Gegner zog 1 Karte', t.pile(1, 'hand').length === handVor + 1, { vor: handVor, nach: t.pile(1, 'hand').length });
    R.check('die Illusion ist zurück im Deck', t.pile(0, 'mainDeck').includes(C), t.pile(0, 'mainDeck'));
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.section('(b) Nein → keine Karte, kein Deck-Out');
  {
    const { t } = await szene(null, ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']);
    t.gs.players[1].mainDeck.length = 0;
    const handVor = t.pile(1, 'hand').length;
    await t.endTurn();
    R.check('Nein: Hand unverändert', t.pile(1, 'hand').length === handVor, { vor: handVor, nach: t.pile(1, 'hand').length });
    R.check('Nein: kein Deck-Out (Spiel läuft)', !(t.engine.over && t.engine.over.called), t.engine.over);
    R.check('die Illusion ist trotzdem zurück im Deck', t.pile(0, 'mainDeck').includes(C), t.pile(0, 'mainDeck'));
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.section('(c) CPU-Entscheidung');
  {
    const t = await H.fresh({ hand: [[], []] });
    const mk = (count, deckSize) => ({ type: 'confirm', title: 'Create Illusion', illusionDraw: { count, deckSize }, cancellable: true });
    const a = t.engine._getCpuGenericResponse(mk(2, 10), 1), b = t.engine._getCpuGenericResponse(mk(2, 2), 1), c = t.engine._getCpuGenericResponse(mk(2, 1), 1), d0 = t.engine._getCpuGenericResponse(mk(1, 0), 1);
    R.check('genug Karten im Deck: annehmen', a && a.confirmed === true, a);
    R.check('genau so viele Karten wie zu ziehen: annehmen (kein Deck-Out)', b && b.confirmed === true, b);
    R.check('zu wenig Karten (Deck-Out droht): ablehnen', c && c.confirmed === false, c);
    R.check('leeres Deck: ablehnen', d0 && d0.confirmed === false, d0);
  }
  R.finish();
})();
