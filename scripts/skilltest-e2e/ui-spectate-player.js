'use strict';
// UI-Test: Hauptmenü -> Who's Online -> Klick auf einen Spieler im Duell -> „Spectate … duel?“ (Yes/No) -> Yes bringt als Zuschauer in den Raum.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-spectate-player.js /pfad/ordner
const { chromium } = require('playwright');
const { io } = require('socket.io-client');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

async function sockLogin(name, pw) {
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: name, password: pw }) });
  const { token, user } = await res.json();
  const socket = io(BASE, { transports: ['websocket'] });
  const events = [];
  socket.onAny((ev, ...args) => events.push({ ev, args }));
  await new Promise(r => socket.on('connect', r));
  socket.emit('auth', token);
  await new Promise(r => socket.once('auth_ok', r));
  const waitFor = (ev, ms = 20000) => new Promise((resolve, reject) => {
    if (events.some(e => e.ev === ev)) return resolve();
    const t = setTimeout(() => reject(new Error('Timeout ' + ev)), ms);
    socket.once(ev, () => { clearTimeout(t); resolve(); });
  });
  return { socket, user, waitFor };
}

(async () => {
  const outDir = process.argv[2] || '/tmp';
  const sfx = Date.now().toString(36).slice(-5);
  const nA = 'UsA' + sfx, nB = 'UsB' + sfx, nC = 'UsC' + sfx;
  for (const n of [nA, nB, nC]) await createAccount(n);
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const A = await sockLogin(nA, 'test1234'), B = await sockLogin(nB, 'test1234');
    await sleep(500);
    const ch = await new Promise(r => A.socket.emit('challenge_send', { to: B.user.id, ranked: false }, r));
    await new Promise(r => B.socket.emit('challenge_respond', { id: ch.message.id, accept: true }, r));
    await A.waitFor('game_state');
    await sleep(800);

    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: nC, password: 'test1234' } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react', 'umd', 'react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom', 'umd', 'react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 30000 });
    const row = page.locator('.social-row', { hasText: nA });
    await row.first().waitFor({ timeout: 15000 });
    check('A erscheint im Hauptmenü als „in game“ (rotes Lämpchen)', await row.first().locator('.social-lamp--ingame').count() === 1);

    console.log('NO');
    await row.first().click();
    await page.waitForSelector('.social-invite:has-text("Spectate")', { timeout: 8000 });
    check('Abfrage nennt den Spieler', (await page.locator('.social-invite').innerText()).includes(nA));
    await page.screenshot({ path: path.join(outDir, 'spectate-prompt.png') });
    await page.click('.social-invite button:has-text("NO")');
    await sleep(300);
    check('NO schließt die Abfrage', await page.locator('.social-invite').count() === 0);
    check('NO bleibt im Hauptmenü (kein Chat, kein Raum)', (await page.locator('text=PLAY ONLINE').count()) > 0);

    console.log('YES');
    await row.first().click();
    await page.waitForSelector('.social-invite:has-text("Spectate")');
    await page.click('.social-invite button:has-text("YES")');
    // Zuschauer-Ansicht: der Spielstand wird gezeigt, wir sind als Zuschauer im Raum
    await page.waitForFunction(() => document.body.innerText.includes('Spectating') || document.querySelector('.board, .board-zone-hero, .game-board, [class*="board"]'), null, { timeout: 20000 });
    await sleep(1500);
    await page.screenshot({ path: path.join(outDir, 'spectate-joined.png') });
    const txt = await page.evaluate(() => document.body.innerText);
    check('Kein Menü mehr (PLAY ONLINE verschwunden)', !txt.includes('PLAY ONLINE'));
    check('keine Seitenfehler', errors.length === 0, errors);
    A.socket.close(); B.socket.close();
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
