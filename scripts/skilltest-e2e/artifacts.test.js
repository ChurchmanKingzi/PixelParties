'use strict';
// Bot spielt Normal-Artifacts (doUseArtifactEffect), Area-/Attachment-Zauber; Schleifenschutz für abbrechbare Prompts (headless).
//   node scripts/skilltest-e2e/artifacts.test.js
const { runGame } = require('../../skilltest/sim');
const policy = require('../../skilltest/policy');
const bot = require('../../skilltest/bot');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  console.log('Normal-Artifacts über doUseArtifactEffect');
  const names = ['Book of Doom', 'Capture Net', 'Cool Presents', 'Cloud Pillow'];
  let played = 0;
  for (const name of names) {
    const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2] });
    const { room, host, gs } = out;
    const seat = gs.activePlayer, ps = gs.players[seat];
    ps.gold = 60; ps.hand.push(name);
    const free = policy.freeActions(room, seat, host).filter(a => a.key === 'free:' + name);
    check(`${name}: erscheint in den freien Aktionen des Bots`, free.length === 1, free.length);
    if (!free.length) continue;
    const ok = await free[0].run();
    if (ok) played++;
    check(`${name}: Ausführung ${ok ? 'gelingt, Karte verlässt die Hand' : 'scheitert (Spielbedingung)'}`, !ok || !ps.hand.includes(name), ps.hand.includes(name));
  }
  check('Mindestens drei der vier Karten sind tatsächlich spielbar', played >= 3, played);

  console.log('Zauber-Untertypen Area / Attachment');
  const out2 = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2] });
  const { room: r2, host: h2, gs: g2, engine } = out2;
  const seat2 = g2.activePlayer, ps2 = g2.players[seat2];
  const cards = require('../../cards/effects/_card-db').getCardDB();
  const alive = ps2.heroes.map((h, hi) => (h && h.hp > 0 ? hi : -1)).filter(hi => hi >= 0);
  const castable = (c) => alive.some(hi => { try { return engine.heroMeetsLevelReq(seat2, hi, c); } catch { return false; } });
  const area = Object.values(cards).find(c => c.skilltestLegal && c.cardType === 'Spell' && c.subtype === 'Area' && castable(c));
  const attach = Object.values(cards).find(c => c.skilltestLegal && c.cardType === 'Spell' && c.subtype === 'Attachment' && castable(c));
  for (const [label, c] of [['Area-Zauber', area], ['Anhänger-Zauber', attach]]) {
    if (!c) { console.log('  (kein wirkbarer ' + label + ' für dieses Brett)'); continue; }
    ps2.hand.push(c.name);
    const acts = policy.rankActions(r2, seat2, h2).filter(a => a.kind === 'spell' && a.card === c.name);
    check(`${label} (${c.name}) steht in den Aktionen des Bots`, acts.length >= 1, acts.length);
  }

  console.log('Schleifenschutz abbrechbarer Prompts');
  const fakeEngine = { _stPromptCounts: {}, gs: { skillTest: {} } };
  const prompt = { type: 'cardGallery', title: 'Difficulty Lever', cancellable: true, cards: [{ name: 'X' }] };
  let cancelledAt = null;
  for (let i = 1; i <= 60; i++) { const r = bot.shapeReaction(fakeEngine, 0, prompt, { cardName: 'X' }, null); if (r === null && cancelledAt == null) cancelledAt = i; }
  check('Nach mehr als 40 gleichen Prompts einer Aktion bricht der Bot ab', cancelledAt === 41, cancelledAt);
  const notCancellable = { type: 'cardGallery', title: 'Pflicht', cancellable: false, cards: [{ name: 'X' }] };
  let always = true; for (let i = 0; i < 60; i++) if (bot.shapeReaction(fakeEngine, 0, notCancellable, { cardName: 'X' }, null) === null) always = false;
  check('Nicht abbrechbare Prompts werden nie abgebrochen', always);
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Artifact-Tests grün');
  process.exit(fails ? 1 : 0);
})();
