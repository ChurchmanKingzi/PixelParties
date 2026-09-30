// Prueft die Freischalt-Logik der wählbaren Battle-Tracks (battle-tracks.js).
// Aufruf: node scripts/check-battle-tracks.js
'use strict';
const assert = require('assert');
const path = require('path');
const { UNLOCK_WINS, listGenericTracks, buildCpuIndex, winsPerSlug, crossedUnlock, createBattleTracks } = require('../battle-tracks');

const musicDir = path.join(__dirname, '..', 'public', 'music');
const generic = listGenericTracks(musicDir);
assert(generic.includes('battle1'), 'battle1 fehlt');
assert.deepStrictEqual(generic, [...generic].sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6))), 'nicht numerisch sortiert');
assert(!generic.includes('battle'), 'der Standard-Track "battle" ist kein wählbarer Eintrag');

// Schwelle: genau der 10. Sieg schaltet frei, nie doppelt.
assert.strictEqual(UNLOCK_WINS, 10);
assert(!crossedUnlock(8, true));
assert(crossedUnlock(9, true));
assert(!crossedUnlock(10, true));
assert(!crossedUnlock(9, false), 'Niederlage schaltet nichts frei');

const decks = [
  { id: 'sample-A', heroes: [{}, { hero: 'Null, the Mage Slayer' }, {}] },
  { id: 'sample-A2', heroes: [{}, { hero: 'Null, the Mage Slayer' }, {}] },   // Variante derselben Figur
  { id: 'sample-B', heroes: [{}, { hero: 'Ohne Datei' }, {}] },
];
const slugForHero = (h) => (h.startsWith('Null') ? 'null' : null);
const { byDeck, bySlug } = buildCpuIndex(decks, slugForHero);
assert.strictEqual(byDeck.get('sample-A'), 'null');
assert(!byDeck.has('sample-B'), 'Held ohne Theme-Datei hat keinen Track');
assert.strictEqual(bySlug.get('null').deckIds.length, 2);
assert.strictEqual(winsPerSlug([{ opponent_deck_id: 'sample-A', wins: 6 }, { opponent_deck_id: 'sample-A2', wins: 4 }, { opponent_deck_id: 'x', wins: 99 }], byDeck).get('null'), 10);

(async () => {
  let rows = [{ opponent_deck_id: 'sample-A', wins: 9 }];
  const db = { all: async () => rows };
  const bt = createBattleTracks({ db, loadSampleDecks: () => decks, bgmSlugForHero: slugForHero, musicDir });

  let list = await bt.listFor('u');
  assert.deepStrictEqual(list.cpu, [{ id: 'null', name: 'Null, the Mage Slayer', wins: 9, unlocked: false }]);
  assert(!(await bt.isSelectable('u', 'null')), '9 Siege reichen nicht');
  assert(await bt.isSelectable('u', 'battle1'), 'allgemeine Tracks sind offen');
  assert(await bt.isSelectable('u', null), 'Standard ist immer wählbar');
  assert(!(await bt.isSelectable('u', 'gibtsnicht')));
  assert(!(await bt.isSelectable('u', '../etc/passwd')));
  assert.strictEqual(await bt.resolveForBattle('u', 'null'), null, 'gesperrte Wahl wird im Kampf ignoriert');

  rows = [{ opponent_deck_id: 'sample-A', wins: 10 }];               // Stand NACH dem zehnten Sieg
  assert.deepStrictEqual(await bt.unlockedByWin('u', 'sample-A'), { id: 'null', name: 'Null, the Mage Slayer' });
  assert(await bt.isSelectable('u', 'NULL'), 'Gross-/Kleinschreibung egal');
  assert.strictEqual(await bt.resolveForBattle('u', 'null'), 'null');
  rows = [{ opponent_deck_id: 'sample-A', wins: 11 }];
  assert.strictEqual(await bt.unlockedByWin('u', 'sample-A'), null, 'nur der zehnte Sieg meldet');
  assert.strictEqual(await bt.unlockedByWin('u', 'sample-B'), null);
  console.log('battle-tracks: OK (' + generic.length + ' allgemeine Tracks)');
})().catch(e => { console.error(e); process.exit(1); });
