'use strict';
// Booster-Pack-Entwürfe (public/boosters): Manifest vollständig, alle Dateien da, Pflichtmotive vorhanden.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'boosters');
const man = JSON.parse(fs.readFileSync(path.join(dir, 'boosters.json'), 'utf8'));

test('neun Packs mit je höchstens acht Varianten', () => {
  assert.deepStrictEqual(man.packs.map(p => p.id),
    ['ability', 'hero', 'clash', 'monia', 'future', 'world1', 'world2', 'community', 'trials']);
  for (const p of man.packs) {
    assert.ok(p.variants.length >= 1 && p.variants.length <= 8, p.id + ': Variantenzahl');
    assert.strictEqual(p.tagline, '9 Rarity Skins for your Collection!');
  }
});

test('jede Variante hat Pack-Bild und Schimmer-Streifen in der angegebenen Größe', () => {
  const png = f => { const b = fs.readFileSync(path.join(dir, f)); assert.strictEqual(b.toString('latin1', 1, 4), 'PNG', f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const p of man.packs) for (const v of p.variants) {
    assert.deepStrictEqual(png(v.base), man.size, v.base);
    assert.deepStrictEqual(png(v.shimmer), [man.size[0] * man.frames, man.size[1]], v.shimmer);
  }
});

test('Rise of Monia hat eine Variante mit Cool Rescuer Monia, Hero Pack genau einen Helden je Cover', () => {
  const monia = man.packs.find(p => p.id === 'monia');
  assert.ok(monia.variants.some(v => v.motifs.includes('Cool Rescuer Monia')));
  const hero = man.packs.find(p => p.id === 'hero');
  for (const v of hero.variants) assert.strictEqual(v.motifs.length, 1, v.id);
});
