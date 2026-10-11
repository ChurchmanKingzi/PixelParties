'use strict';
// UI-Test (echter Browser) für den Batch vom 11.10.: Secret Spell Book, Amazing Finding, Breakthrough, Create Secret Room, Disarm.
//   • Lauf A (Client): die fünf Pixelart-Animationen (`disarm_snap`, `breakthrough_shatter`, `finding_glint`, `secret_room_open`, `spellbook_pages`) werden wie Server-Ereignisse eingespeist —
//     Canvas bemalt, an der richtigen Stelle (Brettplatz, SURPRISE ZONE, AREA ZONE, Deck), Klänge starten, nach ~1,4 s weg, keine JS-Fehler.
//   • Lauf B (echter Spielweg): Disarm — Zielwahl der Artefakte (mindestens 1), beide werden gelöscht, Animation, Deleted Pile.
//   • Lauf C (echter Spielweg): Breakthrough — verdeckte Surprise des Gegners wählen und ablegen.
//   • Lauf D (echter Spielweg): Amazing Finding — Artefakte auf die Hand, das erste Nicht-Artefakt wird ins Deck gemischt.
//   • Lauf E (echter Spielweg): Create Secret Room — Kartenwahl aus dem Deck, die Karte liegt verdeckt in der Surprise Zone, Tür-Animation.
//   • Lauf F (echter Spielweg): Secret Spell Book — ohne Betroffene zieht das Buch 1 Karte (Animation über dem Deck).
//   • Lauf G (echter Spielweg): Secret Spell Book — ein dauerhaft gestohlener eigener Held kommt zurück (Kontrollmarken weg, kein Ziehen).
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-secret-batch.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];
const EQ1 = 'Anti-Magnetic Armor', EQ2 = 'Bow of the Hunt Goddess';
const ART1 = 'Alchemic Journal', ART2 = 'Angry Cheese';

async function seite(browser, bauen) {
  const acc = await createAccount('UiSr' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 900 } });
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
  await page.click('button:has-text("ATTEMPT PUZZLE")');
  await sleep(800);
  await page.evaluate(bauen.fn, bauen.arg);
  await page.waitForSelector('.board-center', { timeout: 30000 });
  await sleep(2500);
  return { ctx, page, fehler };
}

const L = () => [[], [], []];
const zonen = (karten) => { const z = [L(), L(), L()]; for (const [k, n] of Object.entries(karten)) { const [h, s] = k.split(':').map(Number); z[h][s] = [n]; } return z; };
/** Aufbau: Sitz 0 (ich) mit Fähigkeiten `eigeneAbilities` (Held 0), Gegnerzonen/Surprises frei wählbar. */
const AUFBAU = (extra) => ({
  fn: ({ extra }) => {
    window.__gs = null; window.__anims = []; window.__events = [];
    window.socket.on('game_state', (g) => { window.__gs = g; });
    window.socket.on('play_zone_animation', (e) => { window.__anims.push(e && e.type); });
    for (const ev of ['mill_center_reveal', 'mill_center_release', 'play_pile_transfer', 'card_reveal']) window.socket.on(ev, (d) => { window.__events.push({ ev, d }); });
    const C = window.CARDS_BY_NAME;
    const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris|Codumbus|Bakhm/.test(n));
    const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal' && !/Token|Race Boat|Spearman|Super Fan|Oracle|Creepy|Slave Trader|Aggressive T/.test(n));
    const L = () => [[], [], []];
    const mk = (off, eigene) => ({
      heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {}, ...((eigene && extra.heldenFelder && extra.heldenFelder[i]) || {}) })),
      abilityZones: eigene ? [[extra.ab || [], [], []], L(), L()] : [L(), L(), L()],
      surpriseZones: eigene ? [[], [], []] : (extra.gegnerSurprises || [[], [], []]),
      supportZones: (eigene ? extra.eigeneZonen : extra.gegnerZonen) || [L(), L(), L()],
      mainDeck: eigene ? extra.deck.slice() : kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [],
      gold: eigene ? (extra.gold ?? 10) : 10, islandZoneCount: [0, 0, 0], permanents: [],
    });
    window.socket.emit('start_puzzle', {
      players: [mk(0, true), mk(3, false)], areaZones: [[], []], doomCounters: [0, 0],
      hand: extra.hand || [], oppHand: [], playerDebuffs: [[], []],
    });
  },
  arg: { extra },
});

async function messen(page, grenze = 400) {
  let spur = null, maximum = 0;
  for (let k = 0; k < 40; k++) {
    await sleep(60);
    const m = await page.evaluate(() => {
      const cv = document.querySelector('[data-pp-px="aus"] canvas');
      if (!cv) return null;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      const q = cv.getBoundingClientRect();
      return { bemalt: n, w: Math.round(q.width), h: Math.round(q.height), cx: Math.round(q.left + q.width / 2), cy: Math.round(q.top + q.height / 2), l: Math.round(q.left), t: Math.round(q.top), r: Math.round(q.right), b: Math.round(q.bottom) };
    });
    if (m) { spur = spur || m; maximum = Math.max(maximum, m.bemalt); }
    if (maximum > grenze && k > 8) break;
  }
  if (spur) spur.bemalt = maximum;
  return spur;
}
const mitteVon = (sel) => `(() => { const e = document.querySelector('${sel}'); if (!e) return null; const q = e.getBoundingClientRect(); return { cx: Math.round(q.left + q.width / 2), cy: Math.round(q.top + q.height / 2), l: Math.round(q.left), r: Math.round(q.right), t: Math.round(q.top), b: Math.round(q.bottom) }; })()`;
const warteAufPrompt = async (page, typ) => {
  let ep = null;
  for (let k = 0; k < 60 && !ep; k++) {
    ep = await page.evaluate(({ typ }) => {
      const e = window.__gs && window.__gs.effectPrompt;
      return e && e.type === typ ? { id: e.promptId, titel: e.title, karten: (e.cards || []).map(c => c.name), zonen: (e.zones || []).length } : null;
    }, { typ });
    if (!ep) await sleep(100);
  }
  return ep;
};
const warteAufZiele = async (page) => {
  let z = null;
  for (let k = 0; k < 40 && !(z && z.length); k++) {
    z = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => ({ id: t.id, owner: t.owner, type: t.type, heroIdx: t.heroIdx, slotIdx: t.slotIdx, cardName: t.cardName, ineligible: !!t.ineligible })));
    if (!z || !z.length) await sleep(100);
  }
  return z;
};
const bestaetige = (page, ids) => page.evaluate((ids) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: ids }), ids);
const logZeilen = (page, muster) => page.evaluate((m) => [...document.querySelectorAll('.log-status, .log-info, [class*="log"]')].map(e => e.textContent).filter(t => new RegExp(m).test(t)), muster);
const oeffneLog = async (page) => { try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ } };
const spielerZustand = (page) => page.evaluate(() => { const my = window.__gs.myIndex; const p = window.__gs.players[my], o = window.__gs.players[1 - my]; return { my, hand: p.hand.slice(), abl: p.discardPile.slice(), deck: p.deckCount, oppAbl: o.discardPile.slice(), oppGel: (o.deletedPile || []).slice(), oppSupport: o.supportZones.map(h => h.map(z => (z || [])[0] || null)), eigSurprise: (p.surpriseZones || []).map(z => (z || [])[0] || null), oppSurprise: (o.surpriseZones || []).map(z => (z || [])[0] || null), gold: p.gold }; });

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: die fünf Pixelart-Animationen im Client');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball'], eigeneZonen: zonen({ '1:0': 'Fireball' }), gegnerZonen: zonen({ '1:0': EQ1, '1:1': EQ2 }), gegnerSurprises: [[], ['Booby Trap'], []] }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        const opp = 1 - my;
        const bretter = {
          disarm_snap: { ev: { type: 'disarm_snap', zoneType: 'board', owner: opp, heroIdx: -1, zoneSlot: -1, duration: 1100, targets: [{ owner: opp, heroIdx: 1, zoneSlot: 0 }, { owner: opp, heroIdx: 1, zoneSlot: 1 }], originOwner: my, originHeroIdx: 0, originZoneSlot: -1 }, ziele: ['[data-support-zone][data-support-owner="opp"][data-support-hero="1"][data-support-slot="0"]', '[data-support-zone][data-support-owner="opp"][data-support-hero="1"][data-support-slot="1"]'] },
          breakthrough_shatter: { ev: { type: 'breakthrough_shatter', zoneType: 'board', owner: opp, heroIdx: -1, zoneSlot: -1, duration: 1100, targets: [{ owner: opp, heroIdx: 1, zoneType: 'surprise' }], originOwner: my, originHeroIdx: 0, originZoneSlot: -1 }, ziele: ['[data-surprise-zone][data-surprise-owner="opp"][data-surprise-hero="1"]'] },
          finding_glint: { ev: { type: 'finding_glint', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1300, targets: [{ owner: my, deck: true }], originOwner: my, originDeck: true }, ziele: ['[data-my-deck]'] },
          secret_room_open: { ev: { type: 'secret_room_open', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1000, targets: [{ owner: my, heroIdx: 0, zoneType: 'surprise' }], originOwner: my, originHeroIdx: 0, originZoneSlot: -1 }, ziele: ['[data-surprise-zone][data-surprise-owner="me"][data-surprise-hero="0"]'] },
          spellbook_pages_deck: { ev: { type: 'spellbook_pages', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1100, targets: [{ owner: my, deck: true }], originOwner: my, originDeck: true }, ziele: ['[data-my-deck]'] },
        };
        for (const [typ, b] of Object.entries(bretter)) {
          await page.evaluate(() => { window.__snd.length = 0; });
          await page.evaluate((ev) => { window.socket.listeners('play_zone_animation').forEach(f => f(ev)); }, b.ev);
          const spur = await messen(page, 150);
          if (outDir) { try { await sleep(250); await page.screenshot({ path: path.join(outDir, `secret-${typ}.png`) }); } catch { /* egal */ } }
          await sleep(1800);
          const klaenge = await page.evaluate(() => window.__snd.length);
          const weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
          const zielMitten = [];
          for (const sel of b.ziele) zielMitten.push(await page.evaluate(`${mitteVon(sel)}`));
          check(`${typ}: der Pixelart-Canvas ist bemalt`, !!spur && spur.bemalt > 60, spur);
          check(`${typ}: …und deckt ${b.ziele.length > 1 ? 'ALLE Ziele' : 'das Ziel'} ab (Deck bzw. Brettplatz bzw. Surprise Zone)`, !!spur && zielMitten.every(z => z && z.cx >= spur.l && z.cx <= spur.r && z.cy >= spur.t && z.cy <= spur.b), { spur, zielMitten });
          check(`${typ}: Klänge starten (mindestens drei)`, klaenge >= 3, klaenge);
          check(`${typ}: nach ~1,4 s ist die Animation weg`, weg === true);
        }
        // spellbook_pages mit zwei Zielen auf der Gegnerseite und einer Area-Zone
        await page.evaluate(() => { window.__snd.length = 0; });
        await page.evaluate(({ my, opp }) => {
          const ev = { type: 'spellbook_pages', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1100, targets: [{ owner: opp, heroIdx: 1, zoneSlot: 0 }, { owner: opp, heroIdx: 1, zoneSlot: 1 }, { owner: opp, heroIdx: -1, zoneType: 'area' }], originOwner: my, originHeroIdx: 0, originZoneSlot: -1 };
          window.socket.listeners('play_zone_animation').forEach(f => f(ev));
        }, { my, opp });
        const sp = await messen(page, 150);
        if (outDir) { try { await sleep(350); await page.screenshot({ path: path.join(outDir, 'secret-spellbook_pages.png') }); } catch { /* egal */ } }
        const ziel1 = await page.evaluate(`${mitteVon('[data-support-zone][data-support-owner="opp"][data-support-hero="1"][data-support-slot="0"]')}`);
        const urspr = await page.evaluate(`${mitteVon('[data-hero-zone][data-hero-owner="me"][data-hero-idx="0"]')}`);
        await sleep(1800);
        const kl = await page.evaluate(() => window.__snd.length);
        check('spellbook_pages: bemalt, der Canvas überspannt die Zielkarten UND den Ursprung (eigener Held)', !!sp && sp.bemalt > 60 && !!ziel1 && !!urspr && sp.l <= Math.min(ziel1.cx, urspr.cx) && sp.r >= Math.max(ziel1.cx, urspr.cx) && sp.t <= Math.min(ziel1.cy, urspr.cy) && sp.b >= Math.max(ziel1.cy, urspr.cy), { sp, ziel1, urspr });
        check('spellbook_pages: Klänge starten (mindestens drei) und danach ist alles weg', kl >= 3 && (await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'))), kl);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf B: Disarm — echter Spielweg');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball'], hand: ['Disarm'], ab: ['Decay Magic'], gegnerZonen: zonen({ '1:0': EQ1, '1:1': EQ2 }) }));
      try {
        const { page } = s;
        await oeffneLog(page);
        await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
        await sleep(1200);
        const vorher = await spielerZustand(page);
        await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Disarm', handIndex: 0, heroIdx: 0 }));
        const ziele = await warteAufZiele(page);
        check('die Artefaktwahl bietet genau die zwei Artefakte des Gegner-Helden an', !!ziele && ziele.filter(z => z.type === 'equip' && !z.ineligible).length === 2 && ziele.every(z => z.owner === 1 - vorher.my), ziele);
        await page.evaluate(() => { window.__snd.length = 0; window.__anims.length = 0; });
        if (ziele) await bestaetige(page, ziele.filter(z => !z.ineligible).map(z => z.id));
        const spur = await messen(page, 200);
        if (outDir && spur) { await sleep(250); try { await page.screenshot({ path: path.join(outDir, 'disarm-echt.png') }); } catch { /* egal */ } }
        await sleep(3000);
        const nach = await spielerZustand(page);
        check('Animation `disarm_snap` vom Server, Pixelart-Canvas bemalt', spur && spur.bemalt > 100 && (await page.evaluate(() => window.__anims.includes('disarm_snap'))), spur);
        check('beide Artefakte sind vom Brett und im Deleted Pile des Gegners', nach.oppSupport[1].every(z => !z) && nach.oppGel.includes(EQ1) && nach.oppGel.includes(EQ2), { sup: nach.oppSupport, gel: nach.oppGel });
        check('Disarm liegt in der Ablage, und die Aktion blieb frei (zusätzliche Aktion: Held nicht „acted“)', nach.abl.includes('Disarm') && !nach.hand.includes('Disarm'), nach);
        const log = await logZeilen(page, 'Disarm');
        check('das Log nennt Disarm und die gelöschten Karten', log.some(t => /deleted/.test(t) && t.includes(EQ1)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf C: Breakthrough — echter Spielweg');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball'], hand: ['Breakthrough'], gegnerSurprises: [[], ['Booby Trap'], []] }));
      try {
        const { page } = s;
        await oeffneLog(page);
        await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
        await sleep(1200);
        await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Breakthrough', handIndex: 0, heroIdx: 0 }));
        const ziele = await warteAufZiele(page);
        check('die Wahl bietet die verdeckte Gegner-Surprise (Typ surprise, Name verborgen)', !!ziele && ziele.length === 1 && ziele[0].type === 'surprise' && ziele[0].heroIdx === 1 && !ziele[0].cardName, ziele);
        await page.evaluate(() => { window.__snd.length = 0; window.__anims.length = 0; });
        if (ziele) await bestaetige(page, [ziele[0].id]);
        const spur = await messen(page, 150);
        if (outDir && spur) { await sleep(250); try { await page.screenshot({ path: path.join(outDir, 'breakthrough-echt.png') }); } catch { /* egal */ } }
        const sz = await page.evaluate(`${mitteVon('[data-surprise-zone][data-surprise-owner="opp"][data-surprise-hero="1"]')}`);
        await sleep(3000);
        const nach = await spielerZustand(page);
        check('Animation `breakthrough_shatter` auf der gegnerischen Surprise Zone (Canvas bemalt, mittig auf der Zone)', spur && spur.bemalt > 80 && sz && spur.l <= sz.cx && spur.r >= sz.cx && (await page.evaluate(() => window.__anims.includes('breakthrough_shatter'))), { spur, sz });
        check('die Surprise liegt in der Ablage des Gegners, seine Zone ist leer', nach.oppAbl.includes('Booby Trap') && !nach.oppSurprise[1], nach);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf D: Amazing Finding — echter Spielweg');
    {
      const s = await seite(browser, AUFBAU({ deck: [ART1, ART2, 'Fireball', 'Fireball', 'Fireball'], hand: ['Amazing Finding'], ab: ['Fighting'] }));
      try {
        const { page } = s;
        await oeffneLog(page);
        await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
        await sleep(1200);
        const vorher = await spielerZustand(page);
        await page.evaluate(() => { window.__snd.length = 0; window.__anims.length = 0; window.__events.length = 0; });
        await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Amazing Finding', handIndex: 0, heroIdx: 0 }));
        const spur = await messen(page, 100);
        if (outDir && spur) { await sleep(150); try { await page.screenshot({ path: path.join(outDir, 'amazing-finding-echt.png') }); } catch { /* egal */ } }
        await sleep(6000);
        const nach = await spielerZustand(page);
        const rv = await page.evaluate(() => window.__events.filter(e => e.ev === 'mill_center_reveal').map(e => ({ n: e.d.cardNames[0], dest: e.d.dest })));
        check('Animation `finding_glint` vom Server (Canvas bemalt)', spur && spur.bemalt > 40 && (await page.evaluate(() => window.__anims.includes('finding_glint'))), spur);
        check('drei Aufdeckungen: zwei Artefakte → Hand, das Nicht-Artefakt → zurück ins Deck', rv.length === 3 && rv[0].n === ART1 && rv[0].dest === 'hand' && rv[1].n === ART2 && rv[1].dest === 'hand' && rv[2].dest === 'deck', rv);
        check('beide Artefakte sind auf der Hand, Fireball NICHT (ins Deck gemischt, das Deck nur 2 kleiner)', nach.hand.includes(ART1) && nach.hand.includes(ART2) && !nach.hand.includes('Fireball') && nach.deck === vorher.deck - 2, { hand: nach.hand, deck: nach.deck, vorher: vorher.deck });
        const log = await logZeilen(page, 'Amazing Finding');
        check('das Log nennt die Artefakte und die gemischte Karte', log.some(t => t.includes(ART1) && /shuffled/.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf E: Create Secret Room — echter Spielweg');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Booby Trap', 'Fireball', 'Fireball'], hand: ['Create Secret Room'], ab: ['Magic Arts'] }));
      try {
        const { page } = s;
        await oeffneLog(page);
        await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
        await sleep(1200);
        await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Create Secret Room', handIndex: 0, heroIdx: 0 }));
        const gal = await warteAufPrompt(page, 'cardGallery');
        check('die Galerie zeigt die verschiedenen Karten des Decks (Surprise UND Nicht-Surprise)', !!gal && gal.titel === 'Create Secret Room' && gal.karten.includes('Booby Trap') && gal.karten.includes('Fireball'), gal);
        if (outDir && gal) { try { await page.screenshot({ path: path.join(outDir, 'secret-room-galerie.png') }); } catch { /* egal */ } }
        await page.evaluate(() => { window.__snd.length = 0; window.__anims.length = 0; window.__events.length = 0; });
        if (gal) await page.evaluate(([id]) => window.socket.emit('effect_prompt_response', { roomId: window.__gs.roomId, response: { cardName: 'Booby Trap' }, promptId: id }), [gal.id]);
        const spur = await messen(page, 100);
        if (outDir && spur) { await sleep(150); try { await page.screenshot({ path: path.join(outDir, 'secret-room-echt.png') }); } catch { /* egal */ } }
        await sleep(3500);
        const nach = await spielerZustand(page);
        check('Animation `secret_room_open` vom Server (Canvas bemalt)', spur && spur.bemalt > 100 && (await page.evaluate(() => window.__anims.includes('secret_room_open'))), spur);
        const reveals = await page.evaluate(() => window.__events.filter(e => e.ev === 'card_reveal').length);
        check('KEIN Reveal: kein `card_reveal` und keine Kartenansicht des Gegners (der Gegner wird nicht gefragt)', reveals === 0, reveals);
        check('die Karte liegt in der Surprise Zone von Held 0 (für mich sichtbar), Create Secret Room in der Ablage', nach.eigSurprise[0] === 'Booby Trap' && nach.abl.includes('Create Secret Room'), nach);
        const log = await logZeilen(page, 'secret room|Secret Room');
        check('das Log meldet das Verstecken', log.some(t => /hid a card/.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf F: Secret Spell Book — ohne Betroffene wird gezogen');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball', 'Fireball'], hand: ['Secret Spell Book'], gold: 10 }));
      try {
        const { page } = s;
        await oeffneLog(page);
        const vorher = await spielerZustand(page);
        await page.evaluate(() => { window.__snd.length = 0; window.__anims.length = 0; });
        await page.evaluate(() => window.socket.emit('use_artifact_effect', { roomId: window.__gs.roomId, cardName: 'Secret Spell Book', handIndex: 0 }));
        const spur = await messen(page, 100);
        if (outDir && spur) { await sleep(200); try { await page.screenshot({ path: path.join(outDir, 'spellbook-echt.png') }); } catch { /* egal */ } }
        await sleep(3500);
        const nach = await spielerZustand(page);
        check('Animation `spellbook_pages` über dem Deck (Canvas bemalt)', spur && spur.bemalt > 60 && (await page.evaluate(() => window.__anims.includes('spellbook_pages'))), spur);
        check('1 Karte gezogen, 2 Gold bezahlt, das Buch liegt in der Ablage', nach.hand.length === 1 && nach.hand[0] === 'Fireball' && nach.gold === vorher.gold - 2 && nach.abl.includes('Secret Spell Book'), { nach, vorher });
        const log = await logZeilen(page, 'Secret Spell Book');
        check('das Log meldet das Ziehen', log.some(t => /drew 1 card/.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf G: Secret Spell Book — ein dauerhaft gestohlener Held kommt zurück');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball', 'Fireball'], hand: ['Secret Spell Book'], gold: 10,
        heldenFelder: { 1: { permaControlBy: 1, permaControlFrom: 0, permaControlHeroIdx: 1 } } }));
      try {
        const { page } = s;
        await oeffneLog(page);
        const vorher = await page.evaluate(() => { const my = window.__gs.myIndex; const h = window.__gs.players[my].heroes[1]; return { name: h.name, pcb: h.permaControlBy }; });
        check('Aufbau: der Gegner kontrolliert meinen Helden 1 (dauerhaft)', vorher.pcb === 1, vorher);
        await page.evaluate(() => { window.__snd.length = 0; window.__anims.length = 0; });
        await page.evaluate(() => window.socket.emit('use_artifact_effect', { roomId: window.__gs.roomId, cardName: 'Secret Spell Book', handIndex: 0 }));
        const spur = await messen(page, 100);
        if (outDir && spur) { await sleep(200); try { await page.screenshot({ path: path.join(outDir, 'spellbook-held.png') }); } catch { /* egal */ } }
        await sleep(3500);
        const nach = await page.evaluate(() => { const my = window.__gs.myIndex; const p = window.__gs.players[my]; const h = p.heroes[1]; return { pcb: h.permaControlBy, hand: p.hand.slice(), abl: p.discardPile.slice() }; });
        check('Animation `spellbook_pages` mit dem Helden als Ziel (Canvas bemalt)', spur && spur.bemalt > 60 && (await page.evaluate(() => window.__anims.includes('spellbook_pages'))), spur);
        check('der Held gehört wieder mir (keine Kontrollmarken), und es wurde NICHT gezogen', nach.pcb == null && nach.hand.length === 0 && nach.abl.includes('Secret Spell Book'), nach);
        const log = await logZeilen(page, 'Secret Spell Book');
        check('das Log meldet die Übernahme des Helden', log.some(t => /took permanent control of/.test(t) && t.includes(vorher.name)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
  } finally {
    await browser.close();
    srv.child.kill();
  }
  finish();
})().catch(e => { console.error(e); process.exit(2); });
