'use strict';
// Karten ohne Atlas-Kunst, für die es aber eine fertige Bilddatei in ./cards gibt (ältere Karten wie „Piggyfied Hero“),
// müssen als BILD erscheinen — wie im Spiel — und nicht als Text.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const renderer = require('../lib/card-renderer');
const { member, guild, message, setup } = require('./helpers');

async function withCardsDir(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-cards-'));
  for (const [name, color] of Object.entries(files)) {
    const cv = createCanvas(750, 1050), g = cv.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 750, 1050);
    fs.writeFileSync(path.join(dir, name), cv.toBuffer('image/png'));
  }
  renderer.setCardsDir(dir);
  await renderer.reload();
  try { await fn(dir); } finally { renderer.setCardsDir(path.join(__dirname, '..', '..', 'cards')); await renderer.reload(); fs.rmSync(dir, { recursive: true, force: true }); }
}
const pixel = async buf => { const img = await loadImage(buf); const cv = createCanvas(img.width, img.height); const g = cv.getContext('2d'); g.drawImage(img, 0, 0); return [...g.getImageData(375, 525, 1, 1).data]; };

test('ohne Bilddatei: kein Bild (Text-Rückfall bleibt); mit Bilddatei: canRender und echtes PNG, Atlas-Kunst hat Vorrang', async () => {
  await renderer.init();
  assert.equal(renderer.hasArt('Piggyfied Hero'), false, 'Testvoraussetzung: keine Atlas-Kunst');
  assert.equal(renderer.canRender('Piggyfied Hero'), false);
  assert.equal(await renderer.renderCardPng('Piggyfied Hero'), null);

  await withCardsDir({ 'Piggyfied Hero.png': '#ff0000', 'Acid Rain.png': '#00ff00' }, async () => {
    assert.equal(renderer.canRender('Piggyfied Hero'), true);
    const png = await renderer.renderCardPng('Piggyfied Hero');
    assert.deepEqual((await pixel(png)).slice(0, 3), [255, 0, 0], 'die fertige Datei wird gezeigt');
    // Acid Rain hat Atlas-Kunst → wird zusammengesetzt, NICHT die grüne Datei genommen
    const acid = await renderer.renderCardPng('Acid Rain');
    assert.notDeepEqual((await pixel(acid)).slice(0, 3), [0, 255, 0]);
    assert.equal(renderer.canRender('Piggyfication'), false, 'weiter ohne Bild, wenn es keine Datei gibt');
  });
});

test('Dateien mit Satzzeichen im Kartennamen werden wie im Spiel zugeordnet (Name ohne Sonderzeichen, Farbvariante .1)', async () => {
  const cards = renderer.allCards();
  const noArt = cards.filter(c => !renderer.hasArt(c.name));
  const withPunct = noArt.find(c => /[^A-Za-z0-9 ]/.test(c.name) && !/\[(B|W)\]$/.test(c.name));
  assert.ok(withPunct, 'Testdaten: Karte ohne Kunst, mit Satzzeichen');
  const file = withPunct.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim() + '.png';
  await withCardsDir({ [file]: '#0000ff' }, async () => {
    assert.equal(renderer.canRender(withPunct.name), true, file);
    assert.deepEqual((await pixel(await renderer.renderCardPng(withPunct.name))).slice(0, 3), [0, 0, 255]);
  });
});

test('!show zeigt Piggyfied Hero als Bild, wenn die Datei da ist; ohne Datei weiter als Text', async () => {
  const { ctx } = await setup();
  const g = guild();
  const say = async (id, content) => { const m = member({ id }); const msg = message({ guild: g, member: m, content }); await ctx.handleMessage(msg); return msg.replies[0]; };

  let r = await say('100000000000000001', '!show piggyfied hero');
  assert.ok(r.embeds && !r.files, 'ohne Datei: Text-Rückfall');
  assert.equal(r.embeds[0].data.title, 'Piggyfied Hero');

  await withCardsDir({ 'Piggyfied Hero.png': '#ff00ff' }, async () => {
    await ctx.cardsReload();
    await new Promise(res => setTimeout(res, 3100));            // Abkühlzeit
    r = await say('100000000000000001', '!show piggyfied hero');
    assert.ok(r.files && r.files.length === 1 && !r.embeds, JSON.stringify(Object.keys(r)));
    assert.match(r.files[0].name, /^Piggyfied_Hero\.png$/);
  });
  await ctx.cardsReload();
});

test('Daily-Bild: Helden ohne Atlas-Kunst fehlen nicht (drei Karten nebeneinander)', async () => {
  await renderer.init();
  const noArtHero = renderer.allCards().find(c => c.cardType === 'Hero' && !renderer.hasArt(c.name));
  assert.ok(noArtHero, 'Testdaten: Hero ohne Atlas-Kunst');
  const heroes = ['Teocuilatl, the Embodiment of Gods', noArtHero.name, 'Alice, the Transfer Student'];
  const file = noArtHero.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim() + '.png';
  const before = await loadImage(await renderer.renderCardsRow(heroes, { scale: 0.5 }));
  await withCardsDir({ [file]: '#123456' }, async () => {
    const after = await loadImage(await renderer.renderCardsRow(heroes, { scale: 0.5 }));
    assert.ok(after.width > before.width * 1.3, `vorher ${before.width}px (2 Karten), jetzt ${after.width}px (3 Karten)`);
    assert.ok(Math.abs(after.width - (3 * 375 + 2 * 24)) < 4);
  });
});
