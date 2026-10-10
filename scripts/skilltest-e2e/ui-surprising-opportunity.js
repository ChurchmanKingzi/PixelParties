'use strict';
// UI-Test: Surprising Opportunity im ECHTEN Browser, über den echten Spielweg (Puzzle-Spiel, kein Scripting der Engine).
//   Held 0 (Destruction + Decay + Magic Arts) wirkt Burning Finger auf einen Helden mit 20 HP; Surprising Opportunity liegt auf der Hand.
//   Der Held fällt → das Fenster fragt („✨ Activate!") → das Fragezeichen springt über dem Helden auf (Pixelart-Canvas, `ping` +
//   `reveal`) → die Zielwahl listet die drei Karten in den Support Zones des Helden → zwei davon landen in MEINER Hand, die dritte
//   Ausrüstung wird danach normal in die Ablage geräumt, die Spielkarte liegt in der Ablage.
//   • Lauf A: der EIGENE Held fällt (Zielkarten auf meiner Seite).
//   • Lauf B: der Held des GEGNERS fällt (Zielkarten auf der Gegnerseite; sie landen trotzdem in meiner Hand).
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-surprising-opportunity.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

/** Ein Puzzle. `eigener` = true: der eigene Held 1 fällt; sonst fällt Held 1 des Gegners. */
async function spiele(browser, eigener) {
  const acc = await createAccount('UiSo' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 760 } });
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
    const fehler = [];
    page.on('pageerror', (e) => { fehler.push(e.message); console.log('[pageerror]', e.message); });
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME, null, { timeout: 20000 });
    await page.click('button:has-text("ATTEMPT PUZZLE")');          // die Puzzle-Bibliothek haengt den `game_state`-Hoerer ein
    await sleep(800);
    const dauern = await page.evaluate(async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const out = {};
      for (const n of ['ping', 'reveal']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    const karten = await page.evaluate((eigener) => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack/.test(n));
      const sortiert = (pred, n) => Object.values(C).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[n].name;
      const ART1 = sortiert(c => c.cardType === 'Artifact' && !c.name.includes('Race Boat') && (c.cost || 0) > 0, 0);
      const ART2 = sortiert(c => c.cardType === 'Artifact' && !c.name.includes('Race Boat') && (c.cost || 0) > 0, 3);
      const KRE = sortiert(c => c.cardType === 'Creature' && c.level === 0 && c.subtype === 'Normal', 0);
      const deck = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const leer = () => [[], [], []];
      const seite = (off, faellt, wirker) => ({
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: (i === 1 && faellt) ? 20 : 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
        abilityZones: [wirker ? [['Destruction Magic'], ['Decay Magic'], ['Magic Arts']] : leer(), leer(), leer()],
        surpriseZones: [[], [], []],
        supportZones: [leer(), faellt ? [[ART1], [KRE], [ART2]] : leer(), leer()],
        mainDeck: deck.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', {
        players: [seite(0, eigener, true), seite(3, !eigener, false)], areaZones: [[], []], doomCounters: [0, 0],
        hand: ['Burning Finger', 'Surprising Opportunity'], oppHand: [], playerDebuffs: [[], []],
      });
      return { ART1, ART2, KRE };
    }, eigener);
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    const feld = eigener ? my : 1 - my;
    try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }   // Aktionslog sichtbar machen
    await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));   // Action Phase
    await sleep(1200);
    await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Burning Finger', handIndex: 0, heroIdx: 0 }));
    // Ziel: Held 1 auf der fallenden Seite
    let gewaehlt = false;
    for (let k = 0; k < 40 && !gewaehlt; k++) {
      const ziele = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => [t.id, t.owner, t.heroIdx]));
      if (ziele && ziele.length) {
        const z = ziele.find(x => x[1] === feld && x[2] === 1);
        if (z) { await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [z[0]]); gewaehlt = true; }
        else break;
      } else await sleep(150);
    }
    // Wird das Fenster angeboten?
    let angebot = false;
    for (let k = 0; k < 40 && !angebot; k++) {
      angebot = await page.evaluate(() => { const e = window.__gs && window.__gs.effectPrompt; return !!e && e.type === 'confirm' && e.title === 'Surprising Opportunity'; });
      if (!angebot) await sleep(100);
    }
    const r = { dauern, karten, gewaehlt, angebot, my, feld, fehler };
    if (angebot) {
      // Im Fenster ist der Held schon bei 0 HP, die Karten liegen noch in seinen Support Zones.
      r.imFenster = await page.evaluate(([feld]) => {
        const p = window.__gs.players[feld];
        return { hp: p.heroes[1].hp, zonen: p.supportZones[1].map(z => z.slice()), ablage: p.discardPile.slice() };
      }, [feld]);
      await page.evaluate(() => { window.__snd.length = 0; });
      await page.click('button:has-text("Activate")');
      // Pixelart-Canvas der Animation auf der Zone von Held 1 der fallenden Seite
      let spur = null;
      for (let k = 0; k < 20 && !(spur && spur.bemalt > 0); k++) {
        await sleep(60);
        spur = await page.evaluate(([feld, my]) => {
          const cv = document.querySelector('[data-pp-px="aus"] canvas');
          if (!cv) return null;
          const q = cv.getBoundingClientRect();
          const seite = feld === my ? 'me' : 'opp';
          const zone = [...document.querySelectorAll('[data-hero-zone][data-hero-idx="1"]')].find(z => z.getAttribute('data-hero-owner') === seite);
          const zr = zone && zone.getBoundingClientRect();
          const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
          return { bemalt: n, cx: q.left + q.width / 2, zx: zr ? zr.left + zr.width / 2 : null };
        }, [feld, my]);
      }
      r.spur = spur;
      // Zielwahl: die drei Karten des fallenden Helden, bis zu zwei wählbar
      let wahl = null;
      for (let k = 0; k < 40 && !wahl; k++) {
        wahl = await page.evaluate(() => {
          const t = window.__gs && window.__gs.potionTargeting;
          if (!t || !t.isEffectPrompt || t.potionName !== 'Surprising Opportunity') return null;
          return { ziele: (t.validTargets || []).map(v => ({ id: v.id, owner: v.owner, heroIdx: v.heroIdx, slotIdx: v.slotIdx, cardName: v.cardName, ineligible: !!v.ineligible })), maxTotal: t.config && t.config.maxTotal, minRequired: t.config && t.config.minRequired };
        });
        if (!wahl) await sleep(100);
      }
      r.wahl = wahl;
      if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'surprising-opportunity-' + (eigener ? 'eigener' : 'gegner') + '.png') }); } catch { /* egal */ } }
      if (wahl) {
        const nimm = [wahl.ziele.find(z => z.cardName === karten.ART1).id, wahl.ziele.find(z => z.cardName === karten.KRE).id];
        await page.evaluate((ids) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: ids }), nimm);
      }
      await sleep(2200);
      r.klaenge = await page.evaluate(() => window.__snd.slice());
      r.weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
    }
    await sleep(2500);
    r.hand = await page.evaluate((my) => window.__gs.players[my].hand, my);
    r.meineAblage = await page.evaluate((my) => window.__gs.players[my].discardPile, my);
    r.feldAblage = await page.evaluate((feld) => window.__gs.players[feld].discardPile, feld);
    r.feldZonen = await page.evaluate((feld) => window.__gs.players[feld].supportZones[1].map(z => z.slice()), feld);
    r.feldHp = await page.evaluate((feld) => window.__gs.players[feld].heroes[1].hp, feld);
    r.log = await page.evaluate(() => [...document.querySelectorAll('.log-status')].map(e => e.textContent).filter(t => /Surprising Opportunity/.test(t)));
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const eigener of [true, false]) {
      console.log(eigener ? 'Lauf A: der EIGENE Held (20 HP) fällt durch meinen Burning Finger' : 'Lauf B: der Held des GEGNERS (20 HP) fällt');
      const a = await spiele(browser, eigener);
      const { ART1, ART2, KRE } = a.karten;
      check('Burning Finger auf den Helden 1 der fallenden Seite gewählt', a.gewaehlt);
      check('das Fenster fragt nach Surprising Opportunity (Bestätigungs-Abfrage mit dem Kartennamen)', a.angebot);
      check('im Fenster steht der Held bei 0 HP, alle drei Karten liegen noch in seinen Support Zones, die Ablage ist leer',
        !!a.imFenster && a.imFenster.hp <= 0 && [ART1, KRE, ART2].every(n => a.imFenster.zonen.flat().includes(n)) && a.imFenster.ablage.length === 0, a.imFenster);
      check('die Pixelart-Animation sitzt waagerecht mittig auf der Zone des fallenden Helden (±6 px) und ist bemalt',
        !!a.spur && a.spur.zx != null && Math.abs(a.spur.cx - a.spur.zx) <= 6 && a.spur.bemalt > 40, a.spur);
      check('die Zielwahl bietet alle drei Karten dieses Helden an, bis zu zwei wählbar (min 1, max 2)',
        !!a.wahl && a.wahl.ziele.length === 3 && a.wahl.maxTotal === 2 && a.wahl.minRequired === 1 && a.wahl.ziele.every(z => z.owner === a.feld && z.heroIdx === 1 && !z.ineligible), a.wahl);
      check('beide Klänge starten: Ping (`ping`) und Glitzern (`reveal`)', !!a.klaenge && hat(a.klaenge, a.dauern.ping) && hat(a.klaenge, a.dauern.reveal), [a.dauern, a.klaenge]);
      check('die Animation ist nach der Auswahl wieder weg', a.weg === true);
      check('die zwei gewählten Karten liegen in MEINER Hand', a.hand.includes(ART1) && a.hand.includes(KRE) && !a.hand.includes(ART2), a.hand);
      check('die gewählten Karten sind nicht in der Ablage und nicht mehr im Feld',
        !a.feldAblage.includes(ART1) && !a.feldAblage.includes(KRE) && !a.meineAblage.includes(ART1) && !a.meineAblage.includes(KRE) && !a.feldZonen.flat().includes(ART1) && !a.feldZonen.flat().includes(KRE), { feldAblage: a.feldAblage, zonen: a.feldZonen });
      check('die dritte Ausrüstung wird danach normal aufgeräumt (Ablage der fallenden Seite)', a.feldAblage.includes(ART2) && !a.feldZonen.flat().includes(ART2), { feldAblage: a.feldAblage });
      check('Surprising Opportunity liegt in meiner Ablage', a.meineAblage.includes('Surprising Opportunity') && !a.hand.includes('Surprising Opportunity'), { hand: a.hand, ablage: a.meineAblage });
      check('der Held ist besiegt', a.feldHp <= 0, a.feldHp);
      check('das Aktionslog zeigt den Zug („adds … to their hand before it is defeated")', a.log.some(t => /adds/.test(t) && /before it is defeated/.test(t)), a.log);
      check('keine JS-Fehler im Browser', a.fehler.length === 0, a.fehler);
    }
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
