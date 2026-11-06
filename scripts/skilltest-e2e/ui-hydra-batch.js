'use strict';
// UI-Test (W74b): Cute Hydra - Abwurf als EIN Batch (handPick) + Boris fragt beim Confirm.
// Al: „Cute Hydra sollte NICHT jede Karte einzeln abwerfen, sondern diese als einen Batzen designieren und bei Confirm alle one by one abwerfen.
//   Boris soll bei diesem Confirm fragen, ob er *diesen* Discard verhindern soll, was trotzdem die Counter generiert."
// Prueft im ECHTEN Client (Puzzle, echter Server): Markieren (Karten bleiben auf der Hand), Mindestzahl 2 (Confirm gesperrt), kein Cancel-Knopf,
//   Confirm -> (Boris-Frage genau einmal) -> Abwurf bzw. Verzicht -> Head-Counter-Abzeichen X+1.
//   NODE_PATH=/tmp/claude-0/sio/node_modules:/opt/node-tools/node_modules node scripts/skilltest-e2e/ui-hydra-batch.js
process.env.PP_DB_PATH = process.env.PP_DB_PATH || require('path').join(require('os').tmpdir(), 'pp-ui-hydra-batch-' + process.pid + '.db');
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

(async () => {
  const srv = await startServer();
  const acc = await createAccount('UiHyd' + Date.now().toString(36));
  const browser = await chromium.launch({ headless: true });
  try {
    // mitBoris: null = ohne Boris; 'verzicht' = Boris-Frage bestaetigen; 'abgelehnt' = "Discard normally"
    const lauf = async (name, mitBoris) => {
      console.log('\n' + name);
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
      await page.evaluate((boris) => {
        window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
        window.__emits = []; const orig = window.socket.emit.bind(window.socket);
        window.socket.emit = (ev, ...a) => { window.__emits.push([ev, a[0]]); return orig(ev, ...a); };
        const C = window.CARDS_BY_NAME;
        const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Boris/.test(n));
        const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
        const seite = (off, mine) => {
          const sup = [0, 1, 2].map(() => [[], [], []]);
          const ab = [0, 1, 2].map(() => [[], [], []]);
          const heroes = [0, 1, 2].map(i => ({ name: helden[off + i], hp: 900, maxHp: 900, atk: 10, baseAtk: 10, statuses: {} }));
          if (mine) {
            ab[0][0] = ['Decay Magic', 'Decay Magic', 'Decay Magic']; ab[0][1] = ['Summoning Magic', 'Summoning Magic', 'Summoning Magic'];
            if (boris) heroes[1].name = 'Boris, the Guardian of Blackport';
          }
          return { heroes, abilityZones: ab, surpriseZones: [[], [], []], supportZones: sup, mainDeck: kre.slice(), potionDeck: [], sideDeck: [],
            discardPile: [], deletedPile: [], gold: 30, islandZoneCount: [0, 0, 0], permanents: [] };
        };
        const hand = ['Cute Hydra', ...kre.slice(0, 4)];
        window.__hand0 = hand.slice();
        window.socket.emit('start_puzzle', { players: [seite(0, true), seite(3, false)], areaZones: [[], []], doomCounters: [0, 0], hand, oppHand: [], playerDebuffs: [[], []] });
      }, !!mitBoris);
      await page.waitForSelector('.board-center', { timeout: 30000 });
      await sleep(2500);

      const gs = () => page.evaluate(() => { const g = window.__gs; const me = g.myIndex; const p = g.players[me]; return { hand: p.hand, abl: p.discardPile, ep: g.effectPrompt && { type: g.effectPrompt.type, title: g.effectPrompt.title, min: g.effectPrompt.minSelect, max: g.effectPrompt.maxSelect, cancellable: g.effectPrompt.cancellable, msg: g.effectPrompt.message || g.effectPrompt.description }, roomId: g.roomId }; });
      const s0 = await gs();
      check('Ausgang: Hydra + 4 Karten auf der Hand', s0.hand.length === 5 && s0.hand[0] === 'Cute Hydra', s0.hand);
      await page.evaluate((rid) => { window.socket.emit('advance_phase', { roomId: rid, targetPhase: 3 }); }, s0.roomId);   // Action Phase
      await sleep(1200);
      await page.evaluate((rid) => { window.__emits.length = 0; window.socket.emit('play_creature', { roomId: rid, cardName: 'Cute Hydra', handIndex: 0, heroIdx: 0, zoneSlot: 0 }); }, s0.roomId);
      await page.waitForFunction(() => window.__gs && window.__gs.effectPrompt && window.__gs.effectPrompt.type === 'handPick', null, { timeout: 15000 });
      await sleep(600);
      const s1 = await gs();
      check('Server fragt EINMAL als handPick: min 2, max = 4, nicht abbrechbar', s1.ep.type === 'handPick' && s1.ep.title === 'Cute Hydra' && s1.ep.min === 2 && s1.ep.max === 4 && s1.ep.cancellable === false, s1.ep);
      const panel = page.locator('.first-choice-panel');
      check('Client zeigt "Selected: 0/4 (min 2)"', /Selected:\s*0\/4\s*\(min 2\)/.test(await panel.innerText()), await panel.innerText());
      check('kein Cancel-Knopf (Pflicht-Abwurf)', (await panel.locator('button', { hasText: /^Cancel$/ }).count()) === 0);
      const confirm = panel.locator('button').first();
      check('Confirm gesperrt, solange weniger als 2 markiert sind', await confirm.isDisabled());
      const slot = (i) => page.locator(`.game-hand-me [data-hand-idx="${i}"]`).first();
      check('waehrend der Frage liegt die Hydra schon auf dem Brett: 4 Handkarten', (await gs()).hand.length === 4, (await gs()).hand);
      await slot(0).click(); await sleep(300);
      check('1 Karte markiert: "Selected: 1/4", Confirm weiter gesperrt, Karte noch auf der Hand', /Selected:\s*1\/4/.test(await panel.innerText()) && await confirm.isDisabled() && (await gs()).hand.length === 4);
      await slot(2).click(); await sleep(300);
      check('2 Karten markiert: Confirm frei, noch NICHTS abgeworfen (Hand 4, Ablage leer)', /Selected:\s*2\/4/.test(await panel.innerText()) && !(await confirm.isDisabled()) && (await gs()).hand.length === 4 && (await gs()).abl.length === 0, await gs());
      await slot(2).click(); await sleep(300);
      check('Abwahl funktioniert (Selected 1/4, Confirm wieder gesperrt)', /Selected:\s*1\/4/.test(await panel.innerText()) && await confirm.isDisabled());
      await slot(2).click(); await slot(3).click(); await sleep(300);
      check('3 Karten markiert (Selected 3/4)', /Selected:\s*3\/4/.test(await panel.innerText()), await panel.innerText());
      const markiert = (await gs()).hand;   // Handplaetze 0, 2, 3 markiert
      const namen = [markiert[0], markiert[2], markiert[3]];
      await confirm.click();

      if (mitBoris) {
        await page.waitForFunction(() => window.__gs && window.__gs.effectPrompt && window.__gs.effectPrompt.type === 'confirm', null, { timeout: 15000 });
        const sb = await gs();
        check('Boris fragt GENAU EINMAL, fuer den ganzen Stapel (3 Karten), die Hand ist noch voll', sb.ep.type === 'confirm' && /3 card/.test(sb.ep.msg || '') && /Cute Hydra/.test(sb.ep.msg || '') && sb.hand.length === 4 && sb.abl.length === 0, sb);
        await page.evaluate(() => { window.__bora = 0; });
        const btn = mitBoris === 'verzicht' ? page.locator('button', { hasText: /Skip this discard/ }) : page.locator('button', { hasText: /Discard normally/ });
        await btn.first().click();
      }
      await sleep(4500);
      const s2 = await gs();
      const hydraZahl = await page.locator('.head-counter-num').first().innerText().catch(() => null);
      if (mitBoris === 'verzicht') {
        check('Boris verzichtet: NICHTS abgeworfen (Hand 4, Ablage leer)', s2.hand.length === 4 && s2.abl.length === 0, s2);
      } else {
        check('3 markierte Karten abgeworfen (Hand 1, Ablage = die drei markierten)', s2.hand.length === 1 && s2.abl.length === 3 && namen.every(n => s2.abl.includes(n)), { s2, namen });
      }
      check('Head-Counter-Abzeichen zeigt X + 1 = ×4 (auch bei Boris-Verzicht)', /4/.test(hydraZahl || ''), hydraZahl);
      check('keine weitere offene Frage', !s2.ep, s2.ep);
      await ctx.close();
    };
    await lauf('A) ohne Boris', null);
    await lauf('B) Boris wird gefragt und verzichtet', 'verzicht');
    await lauf('C) Boris wird gefragt, Abwurf normal', 'abgelehnt');
  } finally {
    await browser.close();
    try { srv.child.kill(); } catch {}
  }
  const f = finish();
  process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
