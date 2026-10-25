'use strict';
// UI-Test (W62a): Die Beschwörung einer weiteren Kopie in eine GETEILTE Zone (Alice, the Transfer Student) lässt die Zone nie leer wirken.
//   Befund (Al): „Aktiviert ein Infinitely Reproducing Slime seinen Effekt und beschwört eine Kopie von sich in dieselbe Zone, wird die Zone für die Dauer der Beschwörung
//   visuell leer (die vorhandenen Slimes verschwinden kurz)." Ursache: `onPileTransfer` (app-board.jsx) verbarg bei JEDEM Flug in eine Support Zone die GANZE Zone
//   (`bounceOutgoingHidden`, 720 ms, gedacht für den Deepsea-Tausch). Jetzt: liegt dort schon eine GLEICHNAMIGE Karte, bleiben die vorhandenen Karten sichtbar und nur die NEUE
//   Kopie wird bis zur Landung verborgen (`bounceBehalten`); das Zähl-Abzeichen „×N" zählt währenddessen nur die schon liegenden.
//   Szene A (geteilt): Alice = Held 0, Zone A = 2 Slimes, alle anderen Zonen voll; jeder Slime holt am Rundenbeginn einen weiteren aus der Hand. Erwartung: in KEINEM Bild ist die Zone
//     leer, `data-bounce-hiding` wird nie gesetzt, das Abzeichen wächst nur (×2 → ×3 → ×4).
//   Szene B (Gegenprobe, freie Zone): ein Slime, Zone B frei: die neue Kopie landet in der FREIEN Zone — dort bleibt das alte Verhalten (Platz bis zur Landung verborgen).
//   Szene C (Ziehen): eine Hand-Kreatur wird über eine geteilte Zone gezogen (2 Cute Bunnys, Alice): die Vorschau der Karte ERSETZTE bisher den ganzen Stapel (halbtransparente Einzelkarte,
//     kein Abzeichen) — jetzt bleibt der Stapel samt Abzeichen stehen; nach dem Loslassen wächst er auf ×3, und die Zone ist in keinem Bild leer.
//   Bauform: wie die übrigen ui-*-Tests; die feste Szene löst `ui-shared-zone-summon.preload.js` im Serverprozess aus (Datei `W62_GO`), die Abfragen beantwortet der Test über die Oberfläche.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-shared-zone-summon.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const ROOT = path.join(__dirname, '..', '..');

async function szene(browser, name) {
  const go = path.join(os.tmpdir(), 'w62-go-' + process.pid + '-' + name);
  try { fs.unlinkSync(go); } catch { /* neu */ }
  const srv = await startServer({ NODE_OPTIONS: '--require=' + path.join(__dirname, 'ui-shared-zone-summon.preload.js'), PP_ROOT: ROOT, W62_GO: go });
  try {
    const acc = await createAccount('UiSz' + name + Date.now().toString(36));
    const ctx = await browser.newContext({ viewport: { width: 1652, height: 900 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME, null, { timeout: 20000 });
    await page.click('button:has-text("ATTEMPT PUZZLE")');
    await sleep(800);
    await page.evaluate((szene) => {
      const C = window.CARDS_BY_NAME, SL = szene === 'ziehen' ? 'Cute Bunny' : 'Infinitely Reproducing Slime';
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Alice, the Transfer|Pinta/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal' && n !== SL).slice(0, 12);
      const seite = (mine) => {
        const names = mine ? ['Alice, the Transfer Student', helden[1], helden[2]] : [helden[3], helden[4], helden[5]];
        const sup = [0, 1, 2].map(h => [0, 1, 2].map(z => [kre[(h * 3 + z) % kre.length]]));
        if (mine) {
          if (szene === 'geteilt' || szene === 'ziehen') sup[0][0] = [SL, SL];
          else { sup[0][0] = [SL]; sup[0][1] = []; }   // Gegenprobe: eine freie Zone (Slot 1)
        }
        return { heroes: names.map(n => ({ name: n, hp: 900, maxHp: 900, atk: 10, baseAtk: 10, statuses: {} })),
          abilityZones: [[[], [], []], [[], [], []], [[], [], []]], surpriseZones: [[], [], []], supportZones: sup,
          mainDeck: mine ? [SL, SL, SL, SL, SL, ...kre] : kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 30, islandZoneCount: [0, 0, 0], permanents: [] };
      };
      window.socket.emit('start_puzzle', { players: [seite(true), seite(false)], areaZones: [[], []], doomCounters: [0, 0], hand: szene === 'ziehen' ? [SL] : [SL, SL, SL], oppHand: [], playerDebuffs: [[], []] });
    }, name);
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(800);
    // Sampler: Zone A (Held 0, Slot 0) und Zone B (Held 0, Slot 1) alle 20 ms
    await page.evaluate(() => {
      window.__proben = [];
      const t0 = performance.now();
      const zone = (s) => document.querySelector(`[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="${s}"]`);
      const probe = (z) => {
        if (!z) return null;
        const imgs = [...z.querySelectorAll('img')];
        const sichtbar = imgs.filter(i => i.checkVisibility({ visibilityProperty: true, opacityProperty: true })).length;
        const badge = [...z.querySelectorAll('.head-counter-num')].map(e => e.textContent.trim()).join(',');
        return { imgs: imgs.length, sichtbar, hiding: z.getAttribute('data-bounce-hiding') === 'true', badge };
      };
      window.__t = setInterval(() => window.__proben.push({ t: Math.round(performance.now() - t0), a: probe(zone(0)), b: probe(zone(1)) }), 20);
    });
    let ziehen = null;
    if (name === 'ziehen') {
      // Das Puzzle beginnt am Rundenbeginn des Spielers 0; Phase 3 (Action) ansteuern, dann die Handkarte über die Zone ziehen.
      await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs && window.__gs.roomId, targetPhase: 3 }));
      await sleep(1500);
      await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs && window.__gs.roomId, targetPhase: 3 }));
      await sleep(1500);
      const hand = page.locator('.game-hand-me [data-hand-idx="0"]').first();
      const hb = await hand.boundingBox();
      const zb = await page.locator('[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="0"]').boundingBox();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(hb.x + hb.width / 2, hb.y - 80, { steps: 6 });
      await page.mouse.move(zb.x + zb.width / 2, zb.y + zb.height / 2, { steps: 12 });
      await sleep(500);
      const messen = () => page.evaluate(() => {
        const z = document.querySelector('[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="0"]');
        const imgs = [...z.querySelectorAll('img')];
        const op = imgs.map(i => { let e = i, o = 1; while (e && e !== z) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; } return Math.round(o * 100) / 100; });
        return { imgs: imgs.length, opac: op, badge: [...z.querySelectorAll('.head-counter-num')].map(e => e.textContent.trim()).join(',') };
      });
      const hover = await messen();
      await page.mouse.up();
      await sleep(2500);
      ziehen = { hover, danach: await messen() };
    } else {
    fs.writeFileSync(go, '1');
    // Abfragen des Slime-Effekts (Karte wählen) über die Oberfläche beantworten, bis der Rundenbeginn durch ist
    const t0 = Date.now();
    while (!/\[W62\] (ende|FEHLER)/.test(srv.log()) && Date.now() - t0 < 40000) {
      await page.evaluate((name) => {
        const el = document.querySelector('.deck-viewer-modal [style*="cursor: pointer"]'); if (el) el.click();
        // Zonenwahl (Szene B: freie UND geteilte Zone im Angebot): die freie Zone B anklicken
        if (name === 'frei') { const z = document.querySelector('[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="1"]'); if (z) z.click(); }
      }, name);
      await sleep(250);
    }
    }
    await sleep(1500);
    const proben = await page.evaluate(() => { clearInterval(window.__t); return window.__proben; });
    await ctx.close();
    return { proben, log: srv.log(), ziehen };
  } finally {
    srv.child.kill();
    await sleep(600);
    try { fs.unlinkSync(go); } catch { /* weg */ }
  }
}

const zahl = (b) => { const m = /(\d+)/.exec(b || ''); return m ? Number(m[1]) : 0; };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    console.log('Szene A: geteilte Zone (Alice), 2 Slimes in Zone A, Brett voll');
    const A = await szene(browser, 'geteilt');
    check('Rundenbeginn des Slime-Effekts lief durch', /\[W62\] ende/.test(A.log) && !/\[W62\] FEHLER/.test(A.log), A.log.split('\n').filter(l => /W62/.test(l)));
    const a = A.proben.map(p => p.a).filter(Boolean);
    check('Zone A war im DOM (Proben vorhanden)', a.length > 50, a.length);
    const flug = a.filter(p => p.badge && zahl(p.badge) > 0);
    check('es wurde wirklich eine Kopie dazugelegt (Abzeichen wächst über ×2)', Math.max(...a.map(p => zahl(p.badge))) >= 3, [...new Set(a.map(p => p.badge))]);
    check('in KEINEM Bild ist die Zone leer (immer mindestens eine sichtbare Karte)', a.every(p => p.sichtbar >= 1), a.filter(p => p.sichtbar < 1).slice(0, 3));
    check('`data-bounce-hiding` wird für die geteilte Zone nie gesetzt', a.every(p => !p.hiding), a.filter(p => p.hiding).slice(0, 3));
    let rueck = null, hoechst = 0;
    for (const p of a) { const z = zahl(p.badge); if (z && z < hoechst && !rueck) rueck = p; if (z) hoechst = Math.max(hoechst, z); }
    check('das Zähl-Abzeichen wächst nur (kein Rückfall auf eine kleinere Zahl)', !rueck, rueck);
    check('am Ende zeigt das Abzeichen die volle Stapelhöhe', zahl(a[a.length - 1].badge) >= 3, a[a.length - 1]);

    console.log('Szene B (Gegenprobe): freie Zone — die neue Kopie landet in der FREIEN Zone B, alter Verbergen-Weg unverändert');
    const B = await szene(browser, 'frei');
    check('Rundenbeginn lief durch', /\[W62\] ende/.test(B.log) && !/\[W62\] FEHLER/.test(B.log), B.log.split('\n').filter(l => /W62/.test(l)));
    const b = B.proben.map(p => p.b).filter(Boolean);
    check('freie Zone B: bis zur Landung verborgen (alter Weg, `data-bounce-hiding` gesetzt)', b.some(p => p.hiding), b.slice(0, 2));
    check('Zone A (ein Slime) bleibt die ganze Zeit sichtbar', B.proben.map(p => p.a).filter(Boolean).every(p => p.sichtbar >= 1), null);
    check('am Ende steht in Zone B eine sichtbare Karte', b[b.length - 1].sichtbar >= 1, b[b.length - 1]);

    console.log('Szene C: eine Hand-Kreatur über die geteilte Zone ziehen (Vorschau darf den Stapel nicht ersetzen)');
    const Cc = await szene(browser, 'ziehen');
    const c = Cc.proben.map(p => p.a).filter(Boolean);
    check('beim Ziehen über der Zone bleibt der Stapel stehen (volle Deckkraft, Abzeichen ×2, keine halbtransparente Einzelkarte)', Cc.ziehen && Cc.ziehen.hover.opac.every(o => o >= 0.99) && zahl(Cc.ziehen.hover.badge) === 2, Cc.ziehen && Cc.ziehen.hover);
    check('nach dem Loslassen wächst der Stapel auf ×3', Cc.ziehen && zahl(Cc.ziehen.danach.badge) === 3, Cc.ziehen && Cc.ziehen.danach);
    check('die Zone ist in keinem Bild leer', c.length > 50 && c.every(p => p.sichtbar >= 1), c.filter(p => p.sichtbar < 1).slice(0, 3));
  } finally {
    await browser.close();
  }
  process.exit(finish() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
