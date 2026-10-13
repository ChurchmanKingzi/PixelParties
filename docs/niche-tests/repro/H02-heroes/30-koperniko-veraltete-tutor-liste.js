// H02-heroes-30 · Koperniko: eine alte Deck-Add-Buchung (Kreatur/Held) löst später beim nächsten Zauber/Artefakt die Zusatzsuche aus
//
// Kartentext Koperniko: „Once per turn, when an Artifact or Spell allows you to add exactly 1 card from your deck to your hand, you may search your deck for an additional card with a different name and the same specifications, reveal it and also add it to your hand."
// Mechanik: `engine.noteDeckTutor` (`_engine.js` ~25289) führt eine Strichliste `engine._deckAddTally` {pi, source, names}; Koperniko liest sie in `afterSpellResolved`/`afterArtifactUsed` (`koperniko-the-stargazer.js` `pruefeUndBiete`) und leert sie nur selbst. Sie wird nie am Zugende/Kartenanfang zurückgesetzt, und es wird nicht geprüft, dass die Buchung vom gerade aufgelösten Zauber/Artefakt stammt (nur `tally.source !== CARD_NAME`).
// Aufbau: Koperniko als Held 0; Hell Fox (Kreatur: „When this Creature is defeated … search your deck for any card … add it to your hand") stirbt, Suche gewählt. Danach spielt Sitz 0 Fireball (fügt keine Karte hinzu).
// Erwartung: Fireball löst Kopernikos Zusatzsuche nicht aus (kein Prompt, Hand unverändert). Beobachtung: die Galerie „Koperniko" öffnet sich, eine zweite Karte (Burning Finger) wird hinzugefügt, die Einmal-pro-Zug-Sperre verbraucht.
// Aufruf: node docs/niche-tests/repro/H02-heroes/30-koperniko-veraltete-tutor-liste.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const KO = 'Koperniko, the Stargazer';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[KO, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []], deck: [['Fireball', 'Explosion', 'Pyroblast', 'Brilliant Idea', 'Rockfall', 'Burning Finger'], []] });
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
  const kop = () => t.prompts.filter(p => p.d.title === KO).length;
  const fox = t.put(0, 1, 0, 'Hell Fox');
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, fox));
  R.check('Vorbedingung: Hell Fox hat eine Karte geholt (kein Koperniko-Prompt)', kop() === 0 && t.pile(0, 'hand').length === 2, { hand: t.pile(0, 'hand'), kop: kop() });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1).id];
  const vor = t.pile(0, 'hand').length;
  const r = await t.play(0, 'Fireball', { hero: 0, handIndex: t.pile(0, 'hand').indexOf('Fireball') });
  R.check('Fireball gespielt', r === true, r);
  R.check('Fireball fügt keine Karte hinzu: Koperniko bietet keine Zusatzsuche an', kop() === 0, { kopernikoPrompts: kop(), hand: t.pile(0, 'hand'), handVor: vor });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
