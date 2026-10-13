'use strict';
// H01-heroes-11 · Alex, Trainer of Heroes: die Deck-Suche ignoriert die Such-Sperre (`searchLocked`) und die Handsperre (`handLocked`)
//
// Kartentext: „Up to 2 times per turn, when you attach an Ability to this Hero: You may **search your deck** for an Ability and attach it to one
//   of your other Heroes as an additional attachment."
// Regel (CARD_API.md „Cats of the Pharaoh" v1068): `searchLocked` sperrt „Deck-Suche und Adds"; der Riegel sitzt in `engine._isSearchBlocked`
//   („gemeinsam mit jedem anderen Draw/Search/Tutor-Weg").
// Erwartet: unter `searchLocked` / `handLocked` bietet Alex keine Deck-Suche an (keine Galerie, kein Deckverlust, keine Ability am anderen Helden).
// Beobachtet: die Galerie erscheint, die Ability wird aus dem Deck gezogen und angehängt – in beiden Sperr-Zuständen.
// Ursache: `alex-trainer-of-heroes.js` (~Z. 252/281/346) liest `ps.mainDeck` direkt und ruft `engine._isSearchBlocked` / `searchDeckForNamedCard` nie auf.
const H = require('../../lib/h.js');
const ALEX = 'Alex, Trainer of Heroes';
(async () => {
  const R = H.runner();
  const DECK = ['Fighting', 'Fighting', 'Wealth', 'Toughness', 'Leadership', 'Resistance'].concat(Array(14).fill(H.INERT.creature));
  async function lauf(sperre) {
    const t = await H.fresh({ heroes: [[ALEX, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], deck: [DECK, []], hand: [['Luck'], []] });
    t.setAbilities(0, 0, [[], [], []]);
    if (sperre) t.gs.players[0][sperre] = true;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === ALEX, answer: (d) => ({ cardName: d.cards[0].name, source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: (d) => ({ heroIdx: d.eligibleHeroIdxs[0], zoneSlot: -1 }) });
    const r = await t.play(0, 'Luck', { hero: 0, zoneSlot: 0 });
    const galerie = t.prompts.filter(p => p.d.type === 'cardGallery' && p.d.title === ALEX).length;
    const angehaengt = t.gs.players[0].abilityZones.slice(1).flat(2).length;
    return { t, r, galerie, angehaengt, deck: t.gs.players[0].mainDeck.length };
  }
  const g = await lauf(null);
  R.check('Kontrolle ohne Sperre: Luck gespielt, Tutor läuft (Galerie, 1 Ability am anderen Helden)', g.r === true && g.galerie === 1 && g.angehaengt === 1 && g.deck === 19, [g.r, g.galerie, g.angehaengt, g.deck]);
  for (const s of ['searchLocked', 'handLocked']) {
    const x = await lauf(s);
    R.check(`${s}: keine Deck-Suche (keine Galerie)`, x.galerie === 0, [x.r, x.galerie]);
    R.check(`${s}: Deck unverändert (20) und keine Ability am anderen Helden`, x.deck === 20 && x.angehaengt === 0, [x.deck, x.angehaengt]);
    R.check(`${s}: keine Engine-Fehler`, x.t.errors.length === 0, x.t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
