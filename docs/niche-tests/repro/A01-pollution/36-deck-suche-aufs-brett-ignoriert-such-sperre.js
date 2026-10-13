'use strict';
// A01-pollution-36 · Deck-Suchen, deren Ergebnis aufs Brett statt in die Hand geht (Doom Prophecy, Living Illusion, Soul Shard Ka), laufen unter der Such-Sperre – Regelfrage
// Cats of the Pharaoh: „… you cannot search or add cards to your hand for the rest of the turn afterwards (but you can still draw).“ (setzt `ps.searchLocked`)
// Kartentexte: Doom Prophecy „Search your deck for a „Doom Clock“ and place it into your Area Zone …“; Living Illusion „Search your deck for a level 3 or lower Creature and place it …“;
//   Soul Shard Ka „… search your deck for any level 0/1/2 or lower Creature and immediately summon it …“
// Such-Template (`_search-shared.js`, Al 15.9.): „alle Such-Effekte“ – Bauform ① „nur Suchen/Suche ist Schritt 1“ → `blockedBySearchLock: true` (unspielbar), Bauform ③ „Suche als eine von mehreren Optionen“ → nur die Option fällt weg.
// Aufbau: je Karte `ps.searchLocked = true` (wie Cats), Karte spielen / Thep→Ka.
// Erwartet (Lesart „cannot search“): keine Deck-Suche – Doom Prophecy / Living Illusion unspielbar, Ka bietet keine Suche an.
// Beobachtet: alle drei durchsuchen das Deck trotz Sperre (Uhr in der Area, Corgi auf dem Brett, Ka beschwört die gewählte Kreatur).
// Ursache: der Lader erkennt nur Hand-Add-Muster (`DECK_SEARCH_PATTERNS`), keine Suche→Brett; die Skripte rufen `searchBlocked(...)` nicht auf. Zum Vergleich prüfen Masterpiece (unspielbar), Deepsea Witch und Snake Race Boat die Sperre selbst; Soul Shard Ren streicht nur die Hand-Option (Bauform ③).
// Aufruf: node docs/niche-tests/repro/A01-pollution/36-deck-suche-aufs-brett-ignoriert-such-sperre.js   (✗ = Suche läuft unter der Sperre)
const H = require('../../lib/h.js');
const DEC = { 0: { 0: [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []] } };
const SM3 = { 0: { 0: [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []] } };
(async () => {
  const R = H.runner();
  const gallery = (t) => t.script.push({ match: d => d && d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
  const zones = (t) => t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  // Doom Prophecy
  let t = await H.fresh({ hand: [['Doom Prophecy'], []], deck: [['Doom Clock', 'Royal Corgi', 'Royal Corgi'], []], abilities: DEC });
  t.gs.players[0].searchLocked = true; t.policy.confirm = true;
  t.script.push({ match: d => d && d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }) });
  await t.play(0, 'Doom Prophecy', { hero: 0 });
  R.check('Doom Prophecy: keine Uhr aus dem Deck unter der Such-Sperre', t.gs.areaZones[0].length === 0, t.gs.areaZones[0]);
  // Living Illusion
  t = await H.fresh({ hand: [['Living Illusion'], []], deck: [['Royal Corgi', 'Royal Corgi', 'Fireball'], []], abilities: SM3 });
  t.gs.players[0].searchLocked = true; t.policy.confirm = true; gallery(t); zones(t);
  await t.play(0, 'Living Illusion', { hero: 0 });
  R.check('Living Illusion: keine Kreatur aus dem Deck unter der Such-Sperre', !t.find('Royal Corgi', 'support'), t.gs.players[0].supportZones[0]);
  // Soul Shard Ka (über Thep)
  const thep = ['Thep, the Court Scribe', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'];
  t = await H.fresh({ discard: [['Soul Shard Ka'], []], deck: [['Royal Corgi', H.INERT.creature, H.INERT.creature, H.INERT.creature], []], heroes: [thep, undefined], abilities: SM3 });
  t.gs.players[0]._discardNamesAtTurnStart = new Set(['Soul Shard Ka']);
  t.gs.players[0].searchLocked = true; t.policy.confirm = true; zones(t);
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Thep, the Court Scribe', answer: () => ({ cardName: 'Soul Shard Ka' }) });
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Soul Shard Ka', answer: () => ({ cardName: 'Royal Corgi' }) });
  await t.activateHero(0, 0, {});
  R.check('Soul Shard Ka: keine Deck-Suche unter der Such-Sperre', !t.find('Royal Corgi', 'support'), t.gs.players[0].supportZones[0]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
