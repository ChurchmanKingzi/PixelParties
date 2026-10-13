// H02-heroes-33 · Garius: „search your deck for a Creature" läuft unter Such-/Handsperre durch (Regelfrage, Klasse H01-11 / S01-27)
//
// Kartentext Garius: „You may once per turn sacrifice a Creature you control that was not summoned this turn to search your deck for a Creature with the same or a lower level and a different name and place it into the same Support Zone."
// Kartentext Cats of the Pharaoh: „you cannot search or add cards to your hand for the rest of the turn"; CARD_API.md: `searchLocked` sperrt „Deck-Suche und Adds", `handLocked` sperrt Suchen/Adds.
// Garius (`_buildReplacementGallery`, `onHeroEffect`) fragt `engine._isSearchBlocked` / `ps.searchLocked` nicht; die Karte geht per `summonCreatureWithHooks` aufs Brett, nicht auf die Hand. Ob eine Deck-Suche, die aufs Brett führt, „search" im Sinn der Sperre ist, ist offen (S01-27: Create Illusion & Co. laufen ebenso durch).
// Aufbau: Garius (Held 0), eigene Kreatur „Bird" (turnPlayed 1) auf dem Brett, Deck [Cheering Rabbit, …]; `ps.searchLocked = true`. Heldeneffekt in Main Phase 2.
// Lesart A (Sperre gilt): kein Angebot, Bird bleibt. Lesart B (gilt nur für Hand-Suchen): wie bisher (Rabbit ersetzt Bird, Deck −1). Beobachtung: Lesart B.
// Aufruf: node docs/niche-tests/repro/H02-heroes/33-garius-suchsperre.js   (✗ = Lesart A wird nicht erfüllt)
const H = require('../../lib/h.js');
const GA = 'Garius, the Great Reformer';
(async () => {
  const R = H.runner();
  for (const sperre of ['searchLocked', 'handLocked']) {
    const t = await H.fresh({ heroes: [[GA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], deck: [['Cheering Rabbit', 'ZZ Filler', 'ZZ Filler'], []] });
    const c = t.put(0, 0, 0, 'Bird'); c.turnPlayed = 1;
    t.gs.players[0][sperre] = true;
    t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === 0).id];
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === GA, answer: (d) => ({ cardName: d.cards[0].name }) });
    const d0 = t.pile(0, 'mainDeck').length;
    await t.activateHero(0, 0, { effect: GA, phase: 2 });
    const brett = t.inst(x => x.zone === 'support' && x.owner === 0).map(x => x.name);
    R.check(`unter ${sperre}: keine Deck-Suche (Bird bleibt, Deck unverändert)`, brett.join() === 'Bird' && t.pile(0, 'mainDeck').length === d0, { brett, deckDiff: t.pile(0, 'mainDeck').length - d0 });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
