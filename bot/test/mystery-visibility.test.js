'use strict';
// Bildausschnitte dürfen nie Stellen zeigen, die auf der FERTIGEN Karte verdeckt sind (Textfelder von Vollbild-Karten, Symbole).
// Geprüft wird unabhängig von der Maskenlogik: Die Karte wird wirklich gerendert und Pixel für Pixel mit der Kunst verglichen —
// nur wo die Karte die Kunst unverändert zeigt, ist der Ausschnitt erlaubt.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas } = require('@napi-rs/canvas');
const renderer = require('../lib/card-renderer');
const mystery = require('../lib/mystery');

const FULL = ['superhero', 'fullartHero'];

/** Pro Karte EINMAL: gerenderte Karte und gestreckte Kunst als Pixeldaten (spart Speicher und Zeit gegenüber Neurendern je Rechteck). */
async function prepare(name) {
  const card = renderer.allCards().find(c => c.name === name);
  const art = await renderer._test.artOf(name);
  const vis = await renderer.visibilityOf(name);
  const box = vis.full ? [0, 0, 750, 1050] : [70, 170, 610, 400];
  const cardCv = await renderer._test.cardCanvas(card, {});
  const cardPx = cardCv.getContext('2d').getImageData(0, 0, 750, 1050).data;
  // Kunst allein, gestreckt in ihr Bildfeld (nearest neighbour wie im Spiel)
  const artCv = createCanvas(750, 1050), ag = artCv.getContext('2d');
  ag.imageSmoothingEnabled = false;
  ag.drawImage(art.src, art.sx, art.sy, art.sw, art.sh, box[0], box[1], box[2], box[3]);
  const artPx = ag.getImageData(0, 0, 750, 1050).data;
  return { art, box, cardPx, artPx };
}

/** Anteil der Pixel im Rechteck (Kunst-Koordinaten), in denen die gerenderte Karte NICHT die unveränderte Kunst zeigt. */
function coveredShare(P, rect) {
  const { art, box, cardPx: a, artPx: b } = P;
  const x0 = Math.round(box[0] + rect.x / art.sw * box[2]), x1 = Math.round(box[0] + (rect.x + rect.w) / art.sw * box[2]);
  const y0 = Math.round(box[1] + rect.y / art.sh * box[3]), y1 = Math.round(box[1] + (rect.y + rect.h) / art.sh * box[3]);
  let diff = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * 750 + x) * 4;
    n++;
    if (Math.abs(a[i] - b[i]) > 3 || Math.abs(a[i + 1] - b[i + 1]) > 3 || Math.abs(a[i + 2] - b[i + 2]) > 3) diff++;
  }
  return diff / n;
}

test('Vergleichsmethode erkennt Verdecktes: ein Rechteck im Textfeld einer Vollbild-Karte weicht deutlich vom Bild ab', async () => {
  await renderer.init();
  const name = renderer.allCards().find(c => c.cardType === 'Ascended Hero' && renderer.hasArt(c.name)).name;
  const vis = await renderer.visibilityOf(name);
  assert.ok(FULL.includes(vis.type), vis.type);
  // Mitte des Regeltextfelds (Kartenmitte unten), in Kunst-Koordinaten
  const rect = { x: Math.round(vis.art.w * 0.35), y: Math.round(vis.art.h * 0.78), w: Math.round(vis.art.w * 0.2), h: Math.round(vis.art.h * 0.08) };
  assert.equal(vis.visible(rect), false, 'meine Logik sagt: verdeckt');
  assert.ok(coveredShare(await prepare(name), rect) > 0.3, 'und die echte Karte bestätigt es');
});

test('alle Vollbild-Karten: Start-Ausschnitt UND jede Wachstumsstufe liegen nur auf sichtbarer Kunst (gegen die echte Karte geprüft)', async () => {
  await renderer.init();
  const fulls = [];
  for (const c of renderer.allCards()) {
    if (!renderer.hasArt(c.name)) continue;
    const vis = await renderer.visibilityOf(c.name);
    if (vis && FULL.includes(vis.type)) fulls.push(c.name);
  }
  assert.ok(fulls.length >= 30, `Vollbild-Karten gefunden: ${fulls.length}`);
  let checked = 0;
  for (const name of fulls) {
    const P = await prepare(name);
    for (let k = 0; k < 3; k++) {
      const start = await renderer.pickArtCrop(name);
      if (!start) continue;                                         // eine Karte ohne passende Stelle wäre kein Rätsel — erlaubt, aber unten gezählt
      const center = { x: start.x + start.w / 2, y: start.y + start.h / 2 };
      for (const wrong of [0, 1, 3, 6, 10, 20, 40, 60]) {
        const art = await renderer.visibilityOf(name);
        const rect = await renderer.visibleCropRect(name, center, mystery.cropSize(art.art.w, art.art.h, wrong));
        assert.ok(rect, `${name}: Rechteck bei ${wrong} falschen Tipps`);
        const share = coveredShare(P, rect);
        assert.ok(share < 0.01, `${name}: bei ${wrong} falschen Tipps sind ${(share * 100).toFixed(1)} % des Ausschnitts auf der Karte verdeckt (${JSON.stringify(rect)})`);
        checked++;
      }
    }
  }
  assert.ok(checked > 500, 'genug Fälle geprüft: ' + checked);
}, { timeout: 180000 });

test('normale Karten: Ausschnitte unter Symbolen/Maskenrändern werden ebenfalls vermieden (Stichprobe über alle Typen)', async () => {
  await renderer.init();
  const names = renderer.allCards().filter(c => renderer.hasArt(c.name)).map(c => c.name).filter((_, i) => i % 9 === 0);
  let checked = 0;
  for (const name of names) {
    const start = await renderer.pickArtCrop(name);
    assert.ok(start, name);
    const center = { x: start.x + start.w / 2, y: start.y + start.h / 2 };
    const vis = await renderer.visibilityOf(name);
    const P = await prepare(name);
    for (const wrong of [0, 5, 15, 40]) {
      const rect = await renderer.visibleCropRect(name, center, mystery.cropSize(vis.art.w, vis.art.h, wrong));
      const share = coveredShare(P, rect);
      assert.ok(share < 0.01, `${name} (${vis.type}) bei ${wrong}: ${(share * 100).toFixed(1)} % verdeckt`);
      checked++;
    }
  }
  assert.ok(checked > 100, 'geprüft: ' + checked);
}, { timeout: 180000 });

test('Vollbild-Karten: der Ausschnitt wächst nur bis zum Rand des sichtbaren Bildes und hat vorher genug Platz', async () => {
  await renderer.init();
  const name = renderer.allCards().find(c => c.cardType === 'Ascended Hero' && renderer.hasArt(c.name)).name;
  const vis = await renderer.visibilityOf(name);
  const start = await renderer.pickArtCrop(name);
  const center = { x: start.x + start.w / 2, y: start.y + start.h / 2 };
  const sizes = [];
  for (let wrong = 0; wrong <= 60; wrong++) sizes.push((await renderer.visibleCropRect(name, center, mystery.cropSize(vis.art.w, vis.art.h, wrong))).w);
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] >= sizes[i - 1], 'nie kleiner werdend');
  assert.ok(sizes[12] > sizes[0], 'wächst zu Beginn wirklich: ' + sizes.slice(0, 14).join(','));
});
