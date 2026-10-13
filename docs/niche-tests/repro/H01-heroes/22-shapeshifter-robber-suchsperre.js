'use strict';
// H01-heroes-22 · Shapeshifter / Throne Robber: Held aus Deck/Ablage anlegen trotz Such-Sperre (`searchLocked`) und Handsperre
//
// Kartentext Shapeshifter: „… equip a Hero with a different name … from your hand, deck or discard pile to this Hero." Throne Robber: „Ascend … to an Ascended
//   Hero … from your hand or deck." Regel (CARD_API.md Cats of the Pharaoh v1068): `searchLocked` sperrt „Deck-Suche und Adds", `searchLockedIncludesDiscard` zusätzlich
//   die Ablage; `handLocked` sperrt Suchen und Adds ebenfalls.
// Aufbau: Sitz 0 mit Shapeshifter (bzw. Throne Robber), die Wunschgestalt liegt NUR im Deck (bzw. nur in der Ablage); `ps.searchLocked` / `ps.handLocked` gesetzt.
// Erwartet (Lesart „Suche"): die Gestalt aus dem gesperrten Stapel wird nicht angeboten bzw. nicht entnommen.
// Beobachtet: Galerie bietet sie an, Verwandlung/Aufstieg gelingt, Karte verlässt Deck bzw. Ablage.
// Ursache: `the-shapeshifter.js` `waehlbareGestalten` (~Z. 135 ff.) / `the-throne-robber.js` (~Z. 120 `sammle(ps.mainDeck, 'deck')`) fragen `engine._isSearchBlocked` nicht;
//   `takeFromPile` prüft nur die Stapel-Ausgangssperre (Knight of Kings [B]), nicht `searchLocked`.
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter', ROBBER = '???, the Throne Robber', F = 'Archibald, the Archmage', DAJAN = 'Dajan, Conqueror of the Treasure Cave';
(async () => {
  const R = H.runner();
  async function shape(setup, imDeck) {
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], deck: [imDeck ? [F, ...Array(19).fill(H.INERT.creature)] : Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)], hand: [[], []] });
    if (!imDeck) t.setDiscard(0, [F]);
    setup(t.gs.players[0]);
    let angeboten = false;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: (d) => { angeboten = d.cards.some(c => c.name === F); return angeboten ? { cardName: F, source: d.cards.find(c => c.name === F).source } : null; } });
    await t.activateHero(0, 0, {});
    return { t, angeboten, name: t.hero(0, 0).name };
  }
  const k = await shape(() => {}, true);
  R.check('Kontrolle ohne Sperre: Shapeshifter nimmt Archibald aus dem Deck', k.name === F, k.name);
  for (const [lbl, fn] of [['searchLocked', p => { p.searchLocked = true; }], ['handLocked', p => { p.handLocked = true; }]]) {
    const x = await shape(fn, true);
    R.check(`Shapeshifter, Archibald nur im Deck, ${lbl}: nicht anlegbar`, x.name !== F, { angeboten: x.angeboten, name: x.name });
  }
  const d = await shape(p => { p.searchLocked = true; p.searchLockedIncludesDiscard = true; }, false);
  R.check('Shapeshifter, Archibald nur in der Ablage, searchLocked+Ablage: nicht anlegbar', d.name !== F, { angeboten: d.angeboten, name: d.name });

  async function robber(sperre) {
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[ROBBER], []], deck: [[DAJAN, ...Array(19).fill(H.INERT.creature)], Array(20).fill(H.INERT.creature)] });
    t.hero(0, 0)._shapeshiftUsed = ['Archibald, the Archmage', 'Alex, Trainer of Heroes', 'Bill, the Angry Auctioneer'];
    t.gs.activePlayer = 0; t.resetActions(0); t.phase(2);
    await t.run(() => t.engine.performAscension(0, 0, ROBBER, 0, {}));
    if (sperre) t.gs.players[0][sperre] = true;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === ROBBER, answer: (d) => { const c = d.cards.find(x => x.name === DAJAN); return c ? { cardName: DAJAN, source: c.source } : null; }, once: true });
    t.resetActions(0); t.gs.hoptUsed = {};
    await t.activateHero(0, 0, {});
    return t.hero(0, 0).name;
  }
  R.check('Kontrolle: Throne Robber steigt zu Dajan aus dem Deck auf', (await robber(null)) === DAJAN);
  R.check('Throne Robber, Dajan nur im Deck, searchLocked: kein Aufstieg', (await robber('searchLocked')) !== DAJAN);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
