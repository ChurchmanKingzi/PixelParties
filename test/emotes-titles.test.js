'use strict';
// Emotes (data/shop/emotes) und Titel (data/titles.json): Daten stimmig, Bilder vorhanden, Start-Emotes festgelegt.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'data', 'shop', 'emotes');
const man = JSON.parse(fs.readFileSync(path.join(dir, 'emotes.json'), 'utf8'));
const titles = JSON.parse(fs.readFileSync(path.join(root, 'data', 'titles.json'), 'utf8')).titles;

test('Emotes: Ids eindeutig, Bild vorhanden (PNG in angegebener Größe), Namen in beiden Sprachen', () => {
  const ids = man.emotes.map(e => e.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const e of man.emotes) {
    assert.match(e.id, /^[a-z0-9-]+$/);
    assert.ok(e.en && e.de, e.id + ': Namen');
    const b = fs.readFileSync(path.join(dir, e.id + '.png'));
    assert.strictEqual(b.toString('latin1', 1, 4), 'PNG', e.id);
    assert.deepStrictEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [e.w, e.h], e.id + ': Größe');
  }
});

test('Start-Emotes: smuggest, sad, cool in dieser Reihenfolge (Tasten 1–3)', () => {
  assert.deepStrictEqual(man.defaults, ['smuggest', 'sad', 'cool']);
  for (const id of man.defaults) assert.ok(man.emotes.some(e => e.id === id), id);
});

test('Titel: Ids eindeutig, je Sprache Text und Stellung (davor/dahinter)', () => {
  const ids = titles.map(t => t.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const t of titles) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    for (const l of ['en', 'de']) {
      assert.ok(t[l] && typeof t[l].t === 'string' && t[l].t.length > 0, t.id + ' ' + l);
      assert.ok(t[l].pos === 'before' || t[l].pos === 'after', t.id + ' ' + l + ': Stellung');
    }
  }
  assert.ok(titles.some(t => t.en.pos === 'before') && titles.some(t => t.en.pos === 'after'));
});

test('Titel: Heldentitel (Namensregel rückwärts) und thematische Titel sind enthalten, nichts davon ist ein Heldenname', () => {
  const byId = Object.fromEntries(titles.map(t => [t.id, t]));
  assert.deepStrictEqual(byId['bomb-berserker'].en, { t: 'Bomb Berserker', pos: 'before' });          // „Bomb Berserker Bartas“
  assert.deepStrictEqual(byId['the-nature-fairy'].en, { t: 'the Nature Fairy', pos: 'after' });        // „Maya, the Nature Fairy“
  assert.deepStrictEqual(byId['the-traveler'].en, { t: 'the Traveler', pos: 'after' });                // „Tarleinn the Traveler“
  assert.ok(byId['the-creation-fairy'] && byId['the-primordial-goddess']);                              // Crestina-Karten
  assert.ok(!byId['mary-crestmas'] && !byId['santa-klaus'], 'Wortspiel-Eigennamen haben keinen Titel');
  for (const id of ['antonia-s-apprentice', 'control-menace', 'final-boss-of-aggro', 'creature-spammer-extraordinaire']) assert.ok(byId[id], id);
  assert.ok(titles.length >= 150);
});

test('cards.json: „Bad“ ist kein Archetype', () => {
  const cards = JSON.parse(fs.readFileSync(path.join(root, 'data', 'cards.json'), 'utf8'));
  assert.ok(!cards.some(c => c.archetype === 'Bad'));
});
