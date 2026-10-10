'use strict';
// UI-Test: der SWEEP stummer Effekte (Als Vorgabe 10.10.). Jede Animation und jedes Karten-Bild, das der Sweep mit einem Klang versehen hat
// (Block „SWEEP STUMMER EFFEKTE" + `ev_…`-Eintraege in `ZONE_ANIM_SFX`), muss im ECHTEN Browser tatsaechlich einen Audio-Puffer starten.
// Ausgeloest wird wie im Spiel: das `play_zone_animation`-Ereignis an die Handler des Bretts (bzw. `playSFXForZoneAnim('ev_…')` fuer die
// Socket-Handler), danach zaehlt `AudioBufferSourceNode.start`.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-sweep-sounds.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

// Schluessel aus dem Sweep-Block der Klangtabelle
const shared = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'app-shared.jsx'), 'utf8');
const a = shared.indexOf('SWEEP STUMMER EFFEKTE');
const b = shared.indexOf("ev_catapult_fire: [", a);
const block = shared.slice(a, shared.indexOf('  ],\n', b) + 5);
const schluessel = [...block.matchAll(/^ {2}([a-z_0-9]+):\s*(?:\{|\[)/gm)].map(m => m[1]);
const animationen = schluessel.filter(k => !k.startsWith('ev_'));
const ereignisse = schluessel.filter(k => k.startsWith('ev_'));

(async () => {
  console.log(`Sweep-Klänge: ${animationen.length} Animationen, ${ereignisse.length} Socket-Handler`);
  const acc = await createAccount('UiSwp' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1652, height: 700 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__snd = [];
      const ABSN = window.AudioBufferSourceNode, orig = ABSN.prototype.start;
      ABSN.prototype.start = function (...x) { try { window.__snd.push(Math.round(performance.now())); } catch { /* egal */ } return orig.apply(this, x); };
    });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME, null, { timeout: 20000 });
    await page.click('button:has-text("ATTEMPT PUZZLE")');
    await sleep(800);
    await page.evaluate(() => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const seite = (off) => ({
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 900, maxHp: 900, atk: 10, baseAtk: 10, statuses: {} })),
        abilityZones: [[[], [], []], [[], [], []], [[], [], []]], surpriseZones: [[], [], []], supportZones: [0, 1, 2].map(() => [[], [], []]),
        mainDeck: kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', { players: [seite(0), seite(3)], areaZones: [[], []], doomCounters: [0, 0], hand: [], oppHand: [], playerDebuffs: [[], []] });
    });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    const stumm = [];
    for (const typ of animationen) {
      await page.evaluate(() => { window.__snd.length = 0; });
      await page.evaluate(([t, o]) => { window.socket.listeners('play_zone_animation').forEach(f => { try { f({ type: t, owner: o, heroIdx: 0, zoneSlot: -1 }); } catch { /* egal */ } }); }, [typ, my]);
      await sleep(1950);
      if ((await page.evaluate(() => window.__snd.length)) === 0) stumm.push(typ);
    }
    check(`alle ${animationen.length} Sweep-Animationen starten im Browser einen Klang`, stumm.length === 0, stumm);
    const stummE = [];
    for (const k of ereignisse) {
      await page.evaluate(() => { window.__snd.length = 0; });
      await page.evaluate((key) => window.playSFXForZoneAnim(key), k);
      await sleep(1500);
      if ((await page.evaluate(() => window.__snd.length)) === 0) stummE.push(k);
    }
    check(`alle ${ereignisse.length} Socket-Handler-Einträge starten einen Klang`, stummE.length === 0, stummE);
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
