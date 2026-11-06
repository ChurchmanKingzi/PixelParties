'use strict';
// UI-Test: Aufdeck-Flug einer Creature in eine SUPPORT ZONE (`mill_center_reveal` mit `dest: 'support'` — Surprise Party, Pinta, Slave Trader, Open Invitation …).
//   W49b (Al, 22.10.2026): „Wenn eine Creature ‚gefunden' wird und in eine Support Zone fliegt, ist sie aktuell noch für kurze Zeit deutlich kleiner als die Zone."
//   Gemessen wird die Größe (`getBoundingClientRect`) der fliegenden Karte (`.kassaran-flip-card`) gegenüber der Zielzone (`[data-support-zone]`) über die Flugdauer:
//   1. Ankunft: Mitte der Flugkopie auf der Zonenmitte (±3 px), Breite = Breite der Karte IN der Zone (besetzte Zone: die echte Karte; leere Zone: Zone × 64/68).
//   2. Die Kopie hält diese Größe auch beim Liegenbleiben am Platz (nach Flugende, `forwards`) — kein „kleines" Fenster, bis die echte Karte steht.
//   3. Nahe am Ziel (< 20 px) ist die Kopie nie kleiner als die Karte (kein Schrumpfen/Kleinbleiben beim Ankommen).
//   Aufruf: NODE_PATH=/tmp/claude-0/sio/node_modules:/opt/node22/lib/node_modules ST_PORT=3961 node scripts/skilltest-e2e/ui-support-flug.js [/pfad/fuer/screenshots]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const shotDir = process.argv[2] || null;

async function neueSeite(browser, viewport) {
  const acc = await createAccount('UiFlug' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport });
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
  return { ctx, page };
}

async function starteBrett(page) {
  await page.evaluate(() => {
    const C = window.CARDS_BY_NAME;
    const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl/.test(n));
    const kreaturen = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
    const seite = (off) => {
      const hs = [0, 1, 2].map(i => { const n = helden[off + i]; return { name: n, hp: C[n].hp || 400, maxHp: C[n].hp || 400, atk: C[n].atk || 0, baseAtk: C[n].atk || 0, statuses: {} }; });
      const sup = [0, 1, 2].map(() => [[], [], []]);
      sup.forEach((z, hi) => { z[0] = [kreaturen[hi]]; });
      return { heroes: hs, abilityZones: [[[], [], []], [[], [], []], [[], [], []]], surpriseZones: [[], [], []], supportZones: sup,
        mainDeck: kreaturen.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [] };
    };
    window.socket.emit('start_puzzle', { players: [seite(0), seite(3)], areaZones: [[], []], doomCounters: [0, 0],
      hand: kreaturen.slice(0, 5), oppHand: kreaturen.slice(5, 9), playerDebuffs: [[], []] });
  });
  await page.waitForSelector('.board-center', { timeout: 30000 });
  await sleep(3000);
}

/**
 * Löst den Aufdeck-Flug an der Client-Schnittstelle aus und tastet die Flugkopie ab. Die Bildrate des Headless-Browsers (Software-3D) ist niedrig und
 * schwankend; deshalb wird die CSS-Animation der Flugkopie ANGEHALTEN und Schritt für Schritt (Web Animations API, `currentTime`) durchgefahren — die Messung
 * hängt so nicht an der Bildrate. Schritte über die Flugdauer 0…100 % und das Halten am Platz (`forwards`, = Zustand bei 100 %).
 */
async function messeFlug(page, ev) {
  return page.evaluate(async (ev) => {
    const zoneSel = `[data-support-zone][data-support-owner="${ev.ow}"][data-support-hero="${ev.destHeroIdx}"][data-support-slot="${ev.destSlotIdx}"]`;
    const zoneEl = document.querySelector(zoneSel);
    if (!zoneEl) return { fehler: 'Zone nicht gefunden ' + zoneSel };
    const rd = (e) => { const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height }; };
    const zone = rd(zoneEl);
    const karteInZone = zoneEl.querySelector('.board-card');
    const karte = karteInZone ? rd(karteInZone) : null;
    // Für den Screenshot darf die Flugkopie nicht nach `revealMs + 220` ms (Aufräum-Timer der App) verschwinden, solange sie am Ziel angehalten steht: dieser eine Timer wird verlängert.
    const setTimeoutOrig = window.setTimeout;
    if (ev.halten) window.setTimeout = (fn, d, ...a) => setTimeoutOrig(fn, d === ev.revealMs + 220 ? 60000 : d, ...a);
    window.socket.listeners('mill_center_reveal').forEach(f => f({ owner: ev.owner, cardNames: [ev.cardName], revealMs: ev.revealMs, dest: 'support', destHeroIdx: ev.destHeroIdx, destSlotIdx: ev.destSlotIdx }));
    let k = null;
    for (let i = 0; i < 100 && !k; i++) { await new Promise(r => setTimeout(r, 20)); k = document.querySelector('.kassaran-flip-card'); }
    window.setTimeout = setTimeoutOrig;
    if (!k) return { fehler: 'keine Flugkopie' };
    const anim = k.getAnimations().find(a => a.animationName === 'kassaran-flight');
    if (!anim) return { fehler: 'keine kassaran-flight-Animation', anims: k.getAnimations().map(a => a.animationName) };
    anim.pause();
    const dauer = anim.effect.getComputedTiming().duration;
    const proben = [];
    for (let f = 0; f <= 20; f++) {
      anim.currentTime = dauer * f / 20;
      proben.push({ f: f / 20, ...rd(k) });   // getBoundingClientRect erzwingt die Stilberechnung, kein Warten auf ein Bild nötig
    }
    anim.currentTime = dauer;   // Halten am Platz
    proben.push({ f: 1, halten: true, ...rd(k) });
    // das Umdrehen der Karte (innere Animation) auf Endstand, damit der Screenshot die aufgedeckte Karte zeigt
    if (ev.halten) { k.style.outline = '2px solid #ff2bd6'; k.style.background = 'rgba(255,43,214,.25)'; }   // nur für den Screenshot: Umriss der Flugkopie (das Kartenbild lädt im Testlauf nicht immer)
    k.getAnimations({ subtree: true }).forEach(a => { if (a !== anim) { a.pause(); a.currentTime = a.effect.getComputedTiming().duration; } });
    return { zone, karte, proben, dauer };
  }, ev);
}

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch();
  try {
    const { ctx, page } = await neueSeite(browser, { width: 1600, height: 900 });
    await starteBrett(page);
    if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
    const meIdx = 0;   // Puzzle: der Spieler sitzt auf Sitz 0
    // Slot 0 ist besetzt (Messlatte: die echte Karte in der Zone), Slot 1/2 sind leer (Messlatte: Zone × 64/68, wie `kartenMassInZone`).
    for (const slot of [1, 0, 2]) {
      const ev = { owner: meIdx, ow: 'me', cardName: 'Cannon Tower', revealMs: 900, destHeroIdx: 0, destSlotIdx: slot, halten: !!shotDir };
      const r = await messeFlug(page, ev);
      if (r.fehler) { check('Messung möglich (Slot ' + slot + ')', false, r); continue; }
      const { zone, karte, proben } = r;
      const soll = karte ? karte.w : zone.w * 64 / 68;
      const sollH = karte ? karte.h : zone.h * 64 / 68;
      const ende = proben[proben.length - 1], vorEnde = proben[proben.length - 2];
      console.log(`  Slot ${slot}${karte ? ' (besetzt)' : ' (leer)'}: Zone ${zone.w.toFixed(1)}×${zone.h.toFixed(1)} · Sollbreite ${soll.toFixed(1)} · Sollhöhe ${sollH.toFixed(1)} · Flugkopie bei 100 %: ${ende.w.toFixed(1)}×${ende.h.toFixed(1)} · Mitte Δ (${(ende.x - zone.x).toFixed(1)}, ${(ende.y - zone.y).toFixed(1)}) · Dauer ${r.dauer} ms`);
      console.log('    Breite über den Flug: ' + proben.map(p => p.w.toFixed(0)).join(' '));
      check(`Slot ${slot}: am Ziel (100 % und Halten) liegt die Mitte der Kopie auf der Zonenmitte (±3 px)`, Math.hypot(ende.x - zone.x, ende.y - zone.y) < 3 && Math.hypot(vorEnde.x - zone.x, vorEnde.y - zone.y) < 3, { zone, ende });
      check(`Slot ${slot}: … und sie ist so breit wie die Karte in der Zone (±2 px)`, Math.abs(ende.w - soll) <= 2 && Math.abs(vorEnde.w - soll) <= 2, { soll, ende: ende.w });
      check(`Slot ${slot}: … und so hoch wie die Karte in der Zone (±3 px; die geneigte Brettebene staucht die Höhe) und ragt nicht aus der Zone`, Math.abs(ende.h - sollH) <= 3 && ende.h <= zone.h + 1, { sollH, ende: ende.h, zoneH: zone.h });
      // Je näher am Ziel (< 20 px), desto weniger darf die Kopie kleiner als die Karte sein: nie deutlich kleiner (−2 px).
      const nah = proben.filter(p => Math.hypot(p.x - zone.x, p.y - zone.y) < 20);
      check(`Slot ${slot}: nahe am Ziel (< 20 px) ist die Kopie nie kleiner als die Karte (−2 px)`, nah.length > 0 && nah.every(p => p.w >= soll - 2), { soll, kleinste: nah.length ? Math.min(...nah.map(p => p.w)) : null });
      if (shotDir) {
        // Screenshot im Zustand „gelandet": Animation steht bei 100 %, die Kopie liegt am Platz.
        await page.screenshot({ path: path.join(shotDir, `flug-slot${slot}-landung.png`), clip: { x: Math.max(0, zone.x - 140), y: Math.max(0, zone.y - 120), width: 320, height: 240 } });
      }
      await sleep(300);
      await page.evaluate(() => document.querySelectorAll('.kassaran-flip-card').forEach(e => e.remove()));
    }
    await ctx.close();
  } finally {
    await browser.close();
    srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
