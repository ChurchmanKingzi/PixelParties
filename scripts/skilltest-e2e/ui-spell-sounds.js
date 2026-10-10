'use strict';
// UI-Test: Zauber mit EIGENEM Socket-Kanal spielen im ECHTEN Browser ihren Klang (Als Befund 10.10.: „bei Burning Finger fehlt
// der Slash-Sound, bei Heal der Laser-Sound"). Mitgeschrieben wird, welche Audio-Puffer der Browser WIRKLICH startet
// (`AudioBufferSourceNode.start`); erkannt werden sie an der Dauer der Klangdatei (`/sounds/<name>.ogg`).
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-spell-sounds.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

/** Ein Puzzle mit einem Zauber auf der Hand; der Zauber wird auf ein Ziel gespielt, danach die gestarteten Klänge zurück. */
async function spiele(browser, zauber, eigenesZiel) {
  const acc = await createAccount('UiSnd' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 700 } });
  try {
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__snd = [];
      const ABSN = window.AudioBufferSourceNode;
      const orig = ABSN.prototype.start;
      ABSN.prototype.start = function (...a) {
        try { window.__snd.push({ t: Math.round(performance.now()), dur: this.buffer ? +this.buffer.duration.toFixed(3) : 0 }); } catch { /* egal */ }
        return orig.apply(this, a);
      };
    });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME, null, { timeout: 20000 });
    await page.click('button:has-text("ATTEMPT PUZZLE")');          // die Puzzle-Bibliothek haengt den `game_state`-Hoerer ein
    await sleep(800);
    // Dauer der beiden Klangdateien (so erkennt man ihre Puffer)
    const dauern = await page.evaluate(async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const out = {};
      for (const n of ['slash', 'laser']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    await page.evaluate((hand) => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const seite = (off) => ({
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 800, atk: 10, baseAtk: 10, statuses: {} })),
        abilityZones: [[['Destruction Magic'], ['Destruction Magic'], []], [['Support Magic'], ['Support Magic'], []], [[], [], []]],
        surpriseZones: [[], [], []], supportZones: [0, 1, 2].map(() => [[], [], []]), mainDeck: kre.slice(), potionDeck: [], sideDeck: [],
        discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', { players: [seite(0), seite(3)], areaZones: [[], []], doomCounters: [0, 0], hand, oppHand: [], playerDebuffs: [[], []] });
    }, [zauber]);
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
    await sleep(1200);
    await page.evaluate(() => { window.__snd.length = 0; });
    const heroIdx = zauber === 'Heal' ? 1 : 0;
    await page.evaluate(([n, he]) => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: n, handIndex: 0, heroIdx: he }), [zauber, heroIdx]);
    let gewaehlt = false;
    for (let k = 0; k < 40 && !gewaehlt; k++) {
      const ziele = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => [t.id, t.owner]));
      if (ziele && ziele.length) {
        const z = eigenesZiel ? (ziele.find(x => x[1] === my) || ziele[0]) : (ziele.find(x => x[1] !== my) || ziele[0]);
        await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [z[0]]);
        gewaehlt = true;
      } else await sleep(150);
    }
    await sleep(3500);
    const klaenge = await page.evaluate(() => window.__snd.slice());
    return { dauern, klaenge, gewaehlt };
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Burning Finger');
    const bf = await spiele(browser, 'Burning Finger', false);
    check('Ziel gewählt, Zauber lief', bf.gewaehlt);
    check('der Browser startet den SLASH-Klang beim diagonalen Feuerschnitt', hat(bf.klaenge, bf.dauern.slash), [bf.dauern.slash, bf.klaenge.map(k => k.dur)]);

    console.log('Heal');
    const he = await spiele(browser, 'Heal', true);
    check('Ziel gewählt, Zauber lief', he.gewaehlt);
    check('der Browser startet den LASER-Klang, wenn der Strahl von oben herunterkommt', hat(he.klaenge, he.dauern.laser), [he.dauern.laser, he.klaenge.map(k => k.dur)]);
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
