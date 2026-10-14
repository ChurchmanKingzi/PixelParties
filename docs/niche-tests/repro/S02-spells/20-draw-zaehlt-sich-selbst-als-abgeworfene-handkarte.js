'use strict';
// S02-20 · Draw: die gerade gespielte Draw-Karte zählt als „abgeworfene Handkarte" (Cute-Bunny-Schwelle, Archibald-Nachwurf) – Boris-Zählung dagegen ohne Draw
// Draw: „Both players discard their entire hands. Then, you draw 4/5/6 cards and your opponent draws 5/4/3 cards."
// Cute Bunny: „Whenever you discard or delete 2 or more cards from your hand through an effect, draw 1 card." (Bunny auf dem Brett)
// Archibald: „Once per turn, during your turn, when you discard a Normal Spell from your hand, you may immediately use that Spell as an additional Action …"
// Skriptkopf draw.js: „The played Draw Spell is the caster's resolving card — discarding it as part of 'your entire hand' is safe" (bewusst), aber gleichzeitig
//   `_meineHand = hand.length - 1   // Draw selbst liegt noch drin` für die Boris-Frage (dort ohne Draw gezählt).
// Aufbau (a): Cute Bunny in Support, Hand = [Draw, 1 weitere Karte], Gegner ohne Karten. (b): Held 0 = Archibald mit Decay Magic 2, Hand = [Draw, 2 weitere], Gegner 2 Karten.
// Erwartet (Lesart „die gespielte Karte ist nicht mehr in der Hand"): (a) nur EINE Karte wird abgeworfen -> kein Bunny-Zug (Hand danach = 4); (b) Archibald bietet Draw nicht an.
// Beobachtet: (a) `countByPlayer` = 2 -> Bunny zieht 1 (Hand 5); (b) Archibald fragt „Draw was just discarded — cast it as an additional Action?"; bei Ja wird Draw verschachtelt
//   ein zweites Mal gewirkt (Hand 10 statt 5, Gegner 8 statt 4).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Draw', 'ZZ Filler'], []], deckSize: 30 });
    t.put(0, 0, 0, 'Cute Bunny');
    t.setAbilities(0, 0, [['Decay Magic'], [], []]);
    t.script.push({ match: d => /Bunny/.test((d.title || '') + (d.message || '')), answer: () => null });
    await t.play(0, 'Draw', { hero: 0, noGrant: true });
    R.check('(a) Draw + 1 weitere Karte: Cute Bunny (≥ 2 abgeworfen) zieht NICHT', t.pile(0, 'hand').length === 4, `Hand ${t.pile(0, 'hand').length} (4 ohne Bunny, 5 mit)`);
  }
  {
    const t0 = await H.fresh({ hand: [[], []] });
    const t = await H.fresh({ heroes: [['Archibald, the Archmage', t0.gs.players[0].heroes[1].name, t0.gs.players[0].heroes[2].name], t0.gs.players[1].heroes.map(h => h.name)],
      hand: [['Draw', 'ZZ Filler', 'ZZ Filler'], ['Fireball', 'Heal']], deckSize: 40 });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    const angebote = [];
    t.script.push({ match: d => /Archibald/.test((d.title || '') + (d.message || '') + (d.description || '')), answer: (d) => { angebote.push((d.message || d.description || '').slice(0, 90)); return { confirmed: true }; } });
    await t.play(0, 'Draw', { hero: 0, noGrant: true });
    R.note('Archibald', `Angebote ${JSON.stringify(angebote)}; Hand ${t.pile(0, 'hand').length}, Gegner ${t.pile(1, 'hand').length}`);
    R.check('(b) Archibald bietet die gerade gespielte Draw nicht zum Nachwurf an (W5b-B10: Filler als echte Abwurfkarte darf angeboten werden)', !angebote.some(a => /^Draw/.test(a)), angebote);
  }
  R.finish();
})();
