'use strict';
// A02-deepsea-22 · Life-Searcher: unter Such-/Hand-Sperre wird das Angebot gemacht, die Abwurfkosten werden gezahlt, die Suche entfällt
//
// Kartentext (Life-Searcher): „When this Creature is summoned by the effect of a "Cosmic" card, you may discard a card
// from your hand to search your deck for a "Cosmic Depths" card, reveal it and add it to your hand."
// Ruling (CARD_API.md ~Z. 13987, Al 15.9.): Karten mit einem Such-Angebot „sollten nicht mal ihren optionalen Effekt ANBIETEN";
// ein `confirm`, das nur fragt „möchtest du suchen?", trägt dieselbe Kennzeichnung (`searchToHand`) wie die Galerie dahinter.
// Vorbild: Deepsea Witch (`promptOptionalOnSummon(…, { searchToHand: true, searchPile: 'deck' })`).
//
// Aufbau: Argos (3 Change Counters) platziert Life-Searcher (Lv3) aus dem Deck; Hand: Fireball + ZZ Filler;
//   Deck enthält Cosmic Manipulation / Arrival. Sperre am Spieler: `searchLocked` (Cats of the Pharaoh) bzw. `handLocked`.
// Erwartung: Unter der Sperre wird das Abwurf-&-Suche-Angebot gar nicht gemacht – die Handkarte bleibt auf der Hand.
// Beobachtet: Das `confirm` von Life-Searcher hat kein `searchToHand`; es erscheint, der Spieler wirft Fireball ab, erst die
//   anschließende Galerie wird unterdrückt – Kosten bezahlt, keine Karte gesucht.
const H = require('../../lib/h.js');
const ARGOS = 'Argos, the Eye of the Cosmos';
(async () => {
  const R = H.runner();
  for (const sperre of ['none', 'searchLocked', 'handLocked']) {
    R.section('Sperre: ' + sperre);
    const t = await H.fresh({ heroes: [[ARGOS], []], hand: [['Fireball', 'ZZ Filler'], []],
      deck: [['Cosmic Manipulation', 'Arrival from the Cosmic Depths', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'Life-Searcher from the Cosmic Depths'], []] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic']]);
    t.hero(0, 0)._changeCounters = 3;
    if (sperre !== 'none') t.gs.players[0][sperre] = true;
    // Z6: der Harness beantwortet Ja/Nein-Fragen, BEVOR die Engine ihre Such-Unterdrueckung (`promptGeneric`, v1117) sieht - diese Regel
    // wendet dieselbe Engine-Pruefung an (`_suchQuelleDerAbfrage` + `_isSearchBlocked`), damit das echte Spielverhalten gemessen wird.
    t.script.unshift({ match: d => { const sp = t.engine._suchQuelleDerAbfrage(d); return !!sp && t.engine._isSearchBlocked(0, {}, sp); }, answer: () => null, once: false });
    t.script.push({ match: d => d.type === 'optionPicker' && /Argos/.test(d.title || ''), answer: (d) => ({ optionId: d.options[d.options.length - 1].id }) });
    t.script.push({ match: d => d.type === 'cardGallery' && /Argos/.test(d.title || ''), answer: () => ({ cardName: 'Life-Searcher from the Cosmic Depths' }) });
    const r = await t.activateHero(0, 0, {});
    R.check('Argos hat den Life-Searcher platziert', t.gs.players[0].supportZones[0][0][0] === 'Life-Searcher from the Cosmic Depths', { r, board: t.gs.players[0].supportZones[0].map(z => z[0] || null) });
    const hand = t.pile(0, 'hand');
    if (sperre === 'none') {
      R.check('Kontrolle ohne Sperre: Fireball abgeworfen, Karte gesucht', !hand.includes('Fireball') && hand.length === 2, hand);
    } else {
      const angeboten = t.prompts.some(p => p.d.type === 'forceDiscard' && /Life-Searcher/.test(p.d.title || ''));   // Z6: das Kosten-Prompt (nach dem unterdrueckten Angebot) darf nie erscheinen
      R.check('Das Abwurf-&-Suche-Angebot wird unter ' + sperre + ' nicht gemacht', !angeboten, t.prompts.map(p => p.d.type + ':' + (p.d.title || '')));
      R.check('Die Handkarte (Fireball) bleibt auf der Hand – keine Kosten ohne Wirkung', hand.includes('Fireball'), { hand, ablage: t.pile(0, 'discardPile') });
    }
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
