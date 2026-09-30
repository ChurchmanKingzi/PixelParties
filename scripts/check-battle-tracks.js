// Prueft die Freischalt-Logik der wählbaren Battle-Tracks (battle-tracks.js).
// Aufruf: node scripts/check-battle-tracks.js
'use strict';
const assert = require('assert');
const path = require('path');
const { UNLOCK_WINS, listGenericTracks, listThemeTracks, loadTrackNames, buildCpuIndex, winsPerSlug, crossedUnlock, createBattleTracks } = require('../battle-tracks');

const musicDir = path.join(__dirname, '..', 'public', 'music');
const generic = listGenericTracks(musicDir);
assert(generic.includes('battle1'), 'battle1 fehlt');
assert.deepStrictEqual(generic, [...generic].sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6))), 'nicht numerisch sortiert');
assert(!generic.includes('battle'), 'der Standard-Track "battle" ist kein wählbarer Eintrag');

// Archetyp-Themes: jeder Eintrag der JSON hat Titel + Archetyp, IDs sind eindeutig und dateitauglich,
// Archetypen existieren in cards.json; gelistet wird nur, was als Datei da ist.
const names = loadTrackNames();
const cards = require('../data/cards.json');
const archetypes = new Set(cards.flatMap(c => (c.archetype || '').split(',').map(x => x.trim()).filter(Boolean)));
const ids = new Set();
for (const t of names.themes) {
  assert(/^theme_[a-z0-9]+$/.test(t.id), 'ungueltige ID ' + t.id);
  assert(t.name && t.archetype, 'Titel/Archetyp fehlt: ' + t.id);
  assert(!ids.has(t.id), 'doppelte ID ' + t.id); ids.add(t.id);
  assert(archetypes.has(t.archetype), 'Archetyp unbekannt: ' + t.archetype);
}
const present = listThemeTracks(musicDir);
assert(present.every(t => ids.has(t.id)));
for (const g of Object.keys(names.generic)) assert(generic.includes(g), 'benannter Track ohne Datei: ' + g);
console.log('themes: ' + names.themes.length + ' benannt, ' + present.length + ' mit Datei');

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
  // progressFor: Fortschritt zum Track der gespielten CPU (alle Decks der Figur zusammen)
  rows = [{ opponent_deck_id: 'sample-A', wins: 3 }, { opponent_deck_id: 'sample-A2', wins: 4 }];
  assert.deepStrictEqual(await bt.progressFor('u', 'sample-A'), { id: 'null', name: 'Null, the Mage Slayer', wins: 7, need: 10 });
  assert.strictEqual(await bt.progressFor('u', 'sample-B'), null);

  // cpu-unlocks: Quellen melden Eintraege; Fehler einer Quelle blockieren die anderen nicht
  const { registerCpuUnlockSource, collectCpuUnlocks } = require('../cpu-unlocks');
  registerCpuUnlockSource(async (ctx) => ({ kind: 'music', id: 'x', name: 'Test Theme ' + ctx.wins }));
  registerCpuUnlockSource(async () => { throw new Error('kaputte Quelle'); });
  registerCpuUnlockSource(async () => [{ kind: 'sleeve', name: 'Sleeve A', image: '/a.png' }, { name: '' }, null]);
  const origErr = console.error; console.error = () => {};
  const got = await collectCpuUnlocks({ userId: 'u', wins: 10 });
  console.error = origErr;
  assert.deepStrictEqual(got.map(g => g.kind + ':' + g.name), ['music:Test Theme 10', 'sleeve:Sleeve A']);
  assert.strictEqual(got[1].image, '/a.png');
  console.log('battle-tracks: OK (' + generic.length + ' allgemeine Tracks)');
})().catch(e => { console.error(e); process.exit(1); });
