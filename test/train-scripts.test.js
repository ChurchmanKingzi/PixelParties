'use strict';
// Hilfen der Sammel-Skripte: zeilenweises Lesen großer/gepackter Dateien, wiederholbares Ausdünnen ohne Raster, Netz-Schalter (an/aus/Ausnahmeliste).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const IO = require('../scripts/train-io');
const N = require('../scripts/train-net');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pp-train-'));

test('forEachLine: Zeilen über Blockgrenzen und Mehrbyte-Zeichen, ohne Leerzeilen, mit und ohne Schlusszeilenumbruch, auch .gz', () => {
  const d = tmp();
  const zeilen = [];
  for (let i = 0; i < 40; i++) zeilen.push(JSON.stringify({ i, text: 'Größe ★ 🔥 ' + 'ä'.repeat(200000 + i * 17) }));   // ~8 MB, Blockgrenze (8 MB) fällt mitten in eine Zeile
  const roh = zeilen.join('\n\n') + '\n';
  for (const [name, inhalt] of [['a.jsonl', roh], ['b.jsonl', roh.trimEnd()], ['c.jsonl.gz', zlib.gzipSync(roh)]]) {
    const f = path.join(d, name); fs.writeFileSync(f, inhalt);
    const got = []; IO.forEachLine(f, l => got.push(l));
    assert.equal(got.length, zeilen.length, name);
    assert.deepEqual(got, zeilen, name);
    assert.equal(IO.countLines(f), zeilen.length);
  }
  assert.equal(IO.countLines(path.join(d, 'fehlt.jsonl')), 0, 'fehlende Datei zählt als leer');
});

test('forEachLine: andere Lesefehler werden nicht verschluckt', () => {
  const d = tmp();
  assert.throws(() => IO.forEachLine(d, () => {}), /EISDIR/, 'ein Ordner ist keine Datei');
});

test('Segmentordner: Reihenfolge, .gz zählt mit, expandInput', () => {
  const d = tmp();
  for (const n of ['seg-0001.jsonl.gz', 'seg-0000.jsonl', 'seg-0002.jsonl', 'andere.txt', 'seg-0000.jsonl.crash.json']) fs.writeFileSync(path.join(d, n), '');
  assert.deepEqual(IO.segmentFiles(d).map(f => path.basename(f)), ['seg-0000.jsonl', 'seg-0001.jsonl.gz', 'seg-0002.jsonl']);
  assert.deepEqual(IO.expandInput(d).map(f => path.basename(f)), ['seg-0000.jsonl', 'seg-0001.jsonl.gz', 'seg-0002.jsonl']);
  const einzel = path.join(d, 'x.jsonl'); fs.writeFileSync(einzel, '');
  assert.deepEqual(IO.expandInput(einzel), [einzel]);
});

test('thinMask: genau max Positionen, wiederholbar, ohne Raster (Sitz und Gegner-Rotation bleiben ausgewogen)', () => {
  assert.equal(IO.thinMask(100, 100), null);
  assert.equal(IO.thinMask(100, 0), null, '0 = nicht ausdünnen');
  const total = 40000, max = 8000;
  const m1 = IO.thinMask(total, max), m2 = IO.thinMask(total, max);
  let n = 0; for (let i = 0; i < total; i++) n += m1[i];
  assert.equal(n, max);
  assert.deepEqual(m1, m2);
  // Rotation: Sitz = i % 2, Gegner = i % 40 — jeder der 80 Zellen kommt vor, ungefähr gleich oft
  const zellen = new Array(80).fill(0);
  for (let i = 0; i < total; i++) if (m1[i]) zellen[(i % 40) * 2 + (i % 2)]++;
  const nichtLeer = zellen.filter(Boolean).length;
  assert.ok(nichtLeer >= 40 && Math.max(...zellen) < 2.5 * (max / 40), `Zellen belegt: ${nichtLeer}, größte ${Math.max(...zellen)}`);
  const sitz0 = [...m1].reduce((a, v, i) => a + (v && i % 2 === 0 ? 1 : 0), 0);
  assert.ok(Math.abs(sitz0 - max / 2) < 300, `Sitz 0: ${sitz0} von ${max}`);
});

test('Netz-Schalter: Standard an, --net 0 und PP_TRAIN_NET=0 aus, Ausnahmeliste je Deck, --net 1 erzwingt, eigene PP_VALUE_NET bleibt', () => {
  const dir = tmp();
  const leer = N.netFuer('Structure Deck Lightning Caller', { dir, env: {} });
  assert.equal(leer.on, false, 'ohne Gewichte kein Netz'); assert.match(leer.reason, /keine Gewichte/);
  fs.writeFileSync(path.join(dir, 'net.json'), '{}'); fs.writeFileSync(path.join(dir, 'net.f32'), '');
  const an = N.netFuer('Structure Deck Lightning Caller', { dir, env: {} });
  assert.equal(an.on, true);
  assert.deepEqual(an.env, { PP_VALUE_NET: 'leaf', PP_VALUE_LEAF_HORIZON: '0', PP_VALUE_LEAF_PULLS: '12' });
  assert.equal(N.netFuer('X', { dir, env: {}, flag: '0' }).on, false);
  assert.equal(N.netFuer('X', { dir, env: { PP_TRAIN_NET: '0' } }).on, false);
  assert.equal(N.netFuer('X', { dir, env: { PP_TRAIN_NET: '0' }, flag: '1' }).on, true, 'die Kommandozeile gewinnt gegen die Umgebung');
  // Ausnahmeliste
  fs.writeFileSync(path.join(dir, 'net-aus.json'), JSON.stringify({ decks: ['Lightning Caller'] }));
  const aus = N.netFuer('Structure Deck Lightning Caller', { dir, env: {} });
  assert.equal(aus.on, false); assert.match(aus.reason, /net-aus\.json/); assert.deepEqual(aus.env, {});
  assert.equal(N.netFuer('Structure Deck Pew-Pew', { dir, env: {} }).on, true, 'andere Decks bleiben an');
  assert.equal(N.netFuer('Structure Deck Lightning Caller', { dir, env: {}, flag: '1' }).on, true, '--net 1 ignoriert die Liste');
  // kaputte Liste = keine Ausnahmen
  fs.writeFileSync(path.join(dir, 'net-aus.json'), '{kaputt');
  assert.equal(N.netFuer('Structure Deck Lightning Caller', { dir, env: {} }).on, true);
  // eigene Einstellungen bleiben
  assert.equal(N.netFuer('X', { dir, env: { PP_VALUE_NET: 'log' } }).on, false);
  const eigen = N.netFuer('X', { dir, env: { PP_VALUE_LEAF_PULLS: '48' } });
  assert.deepEqual(eigen.env, { PP_VALUE_NET: 'leaf', PP_VALUE_LEAF_HORIZON: '0' }, 'selbst gesetzte Rollout-Zahl bleibt');
});

test('Die ausgelieferte Ausnahmeliste ist gültig (leer oder Decknamen) und die Gewichte sind da', () => {
  assert.equal(N.gewichteDa(), true);
  const j = JSON.parse(fs.readFileSync(path.join(N.DIR, 'net-aus.json'), { encoding: 'utf-8' }));
  assert.ok(Array.isArray(j.decks));
});
