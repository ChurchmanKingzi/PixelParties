// H02-heroes-14 · Friedhelm – die Deck-Galerie bietet Reaction-Spells, Surprises und Karten mit Helden-Gate an; die Wahl verbrennt Karte UND Aktion ohne Wirkung
//
// Kartentext Friedhelm: „You may spend your Action to use an Attack or Spell from your deck with this Hero as if you played it from your hand."
// Skriptkopf (friedhelm-the-misled-avenger.js): „Ohne [die Prüfung] bietet die Karte Zuege an, die `validateActionPlay` danach ablehnt – und die Karte waere aus dem Deck heraus und die Aktion weg."
// Aus der Hand sind in der Action Phase NICHT spielbar: Reaction-Spells (`validateActionPlay`: „Reaction subtype: not proactively playable"), Surprises (`doPlaySurprise`: nur Main Phase),
//   Karten mit `canPlayWithHero`, das der Held nicht erfüllt (Breaking Strike/Knife Throw/Weapon Storm/Weapon Unleashing brauchen eine Waffe).
// Beobachtung: `spielbareDeckkarten` filtert nur über `getBlockedSpells` (Einmal-pro-Spiel, Sperren, spellPlayCondition, Pflichtziel) und `heroMeetsLevelReq`; Reaction (67 Karten bei Vollbestand),
//   Surprise (23) und `canPlayWithHero` bleiben in der Galerie. Wahl einer Reaction/Surprise: die Karte geht ohne Wirkung in die Ablage, die Aktion ist weg (`_actionsThisTurn` = 1).
//   Die `canPlayWithHero`-Karten fizzeln dagegen folgenlos (Karte bleibt im Deck, Aktion nicht verbraucht) – toter Eintrag.
// Aufruf: node docs/niche-tests/repro/H02-heroes/14-friedhelm-bietet-unspielbare-karten-an.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const FR = 'Friedhelm, the Misled Avenger';
(async () => {
  const R = H.runner();
  const CARDS = [['Anti Magic Shield', 'Reaction-Spell'], ['Frost Rune', 'Surprise-Spell'], ['Breaking Strike', 'Attack mit canPlayWithHero (Waffe nötig)']];
  for (const [card, art] of CARDS) {
    // Kontrolle: derselbe Held spielt die Karte aus der HAND in der Action Phase nicht.
    const c = await H.fresh({ heroes: [[FR, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[card], []] });
    await c.run(() => c.engine.runHooks('onGameStart', {}));
    c.grantFor(0, 0, card);
    const hr = await c.play(0, card, { hero: 0, phase: 3 });
    R.check(`Kontrolle: ${card} (${art}) aus der Hand in der Action Phase nicht gespielt`, hr === false || (c.pile(0, 'hand').includes(card) && !c.pile(0, 'discardPile').includes(card)), { hr, hand: c.pile(0, 'hand') });
    // Friedhelm: Deck
    const t = await H.fresh({ heroes: [[FR, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], deck: [[card, 'ZZ Dummy', 'ZZ Dummy'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.grantFor(0, 0, card);
    let angeboten = false;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === FR, answer: (d) => { angeboten = d.cards.some(x => x.name === card); return angeboten ? { cardName: card } : null; }, once: true });
    const r = await t.activateHero(0, 0, { effect: FR, phase: 3 });
    const verbrannt = t.pile(0, 'discardPile').includes(card);
    R.check(`Friedhelm bietet ${card} (${art}) NICHT an`, !angeboten, { angeboten, r, verbrannt, aktionen: t.hero(0, 0)._actionsThisTurn });
    if (angeboten) R.note(`  → nach der Wahl`, { inAblage: verbrannt, imDeck: t.pile(0, 'mainDeck').includes(card), aktionVerbraucht: t.hero(0, 0)._actionsThisTurn === 1 });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
