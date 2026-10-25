'use strict';
// UI-Test (W73a): Abilities in SUPPORT Zonen (Xal) und Abilities in ABILITY Zonen mit GLEICHER Nummer duerfen sich nicht verwechseln.
// Tester-Bericht: Toughness (passiv) in Ability Zone 1, Training (aktiv) in Support Zone 1 → Toughness leuchtete limegruen, Training golden, und der Klick auf die Toughness aktivierte Training.
// Regel: jeder Abgleich nach (heroIdx, zoneIdx) gilt nur MIT der Zonenart (`zoneKind`).
//   NODE_PATH=/tmp/claude-0/sio/node_modules:/opt/node-tools/node_modules node scripts/skilltest-e2e/ui-support-ability-zone.js
// Aufbau: ein Puzzle mit Xal (Held 0). Der Zustand kommt zuerst echt vom Server; die weiteren Kombinationen werden als `game_state` eingespielt (der Client rendert nur aus dem Zustand).
process.env.PP_DB_PATH = process.env.PP_DB_PATH || require('path').join(require('os').tmpdir(), 'pp-ui-support-ability-' + process.pid + '.db');
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

(async () => {
  const srv = await startServer();
  const acc = await createAccount('UiSup' + Date.now().toString(36));
  const browser = await chromium.launch({ headless: true });
  try {
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
    await page.evaluate(() => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      window.__emits = []; const orig = window.socket.emit.bind(window.socket);
      window.socket.emit = (ev, ...a) => { window.__emits.push([ev, a[0]]); return orig(ev, ...a); };
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|^Xal/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const seite = (off, mine) => {
        const sup = [0, 1, 2].map(() => [[], [], []]);
        const ab = [0, 1, 2].map(() => [[], [], []]);
        const heroes = [0, 1, 2].map(i => ({ name: helden[off + i], hp: 900, maxHp: 900, atk: 10, baseAtk: 10, statuses: {} }));
        if (mine) { heroes[0].name = 'Xal, the Animated Armor'; ab[0][0] = ['Toughness']; sup[0][0] = ['Training']; }
        return { heroes, abilityZones: ab, surpriseZones: [[], [], []], supportZones: sup, mainDeck: kre.slice(), potionDeck: [], sideDeck: [],
          discardPile: [], deletedPile: [], gold: 30, islandZoneCount: [0, 0, 0], permanents: [] };
      };
      window.socket.emit('start_puzzle', { players: [seite(0, true), seite(3, false)], areaZones: [[], []], doomCounters: [0, 0], hand: ['Fighting', 'Wisdom'], oppHand: [], playerDebuffs: [[], []] });
    });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);

    const AB = (owner, h, z) => `[data-ability-zone][data-ability-owner="${owner}"][data-ability-hero="${h}"][data-ability-slot="${z}"]`;
    const SU = (owner, h, z) => `[data-support-zone][data-support-owner="${owner}"][data-support-hero="${h}"][data-support-slot="${z}"]`;
    const klassen = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.className : null; }, sel);
    const leuchtet = async (sel) => { const k = await klassen(sel); return { lime: /zone-ability-free-activatable/.test(k || ''), gold: /zone-ability-activatable/.test(k || ''), k }; };
    const emits = () => page.evaluate(() => window.__emits.filter(e => /^activate_|^effect_prompt_response$/.test(e[0])));
    const leeren = () => page.evaluate(() => { window.__emits.length = 0; });
    // Zustand einspielen: der Client rendert nur aus `game_state`
    const einspielen = async (aenderung) => {
      await page.evaluate((fnSrc) => {
        const g = JSON.parse(JSON.stringify(window.__gs)); const me = g.myIndex;
        g.effectPrompt = null; g.potionTargeting = null;   // die echte Aktivierung (K1) hat serverseitig Trainings Frage geoeffnet — sie soll die eingespielten Zustaende nicht sperren
        new Function('g', 'me', fnSrc)(g, me);
        window.socket.listeners('game_state').forEach(f => f(g));
      }, aenderung);
      await sleep(500);
    };

    // ── 1) echter Server-Zustand: Toughness (Ability Zone 0), Training (frei, Support Zone 0) ──
    const s0 = await page.evaluate(() => ({ act: window.__gs.activatableAbilities, free: window.__gs.freeActivatableAbilities }));
    check('K1 (Server): einziger freier Eintrag ist Training in der Support Zone 0', s0.free.length === 1 && s0.free[0].abilityName === 'Training' && s0.free[0].zoneKind === 'support' && s0.free[0].zoneIdx === 0, s0);
    let ab0 = await leuchtet(AB('me', 0, 0)), su0 = await leuchtet(SU('me', 0, 0));
    check('K1: die Toughness-Zone leuchtet NICHT (weder limegruen noch gold)', !ab0.lime && !ab0.gold, ab0);
    check('K1: die Training-Support-Zone leuchtet limegruen (frei = limegruen, wie in den Ability Zonen)', su0.lime && !su0.gold, su0);
    await leeren();
    await page.locator(AB('me', 0, 0)).click(); await sleep(500);
    check('K1: Klick auf die Toughness-Zone sendet KEINE Aktivierung', (await emits()).length === 0, await emits());
    await page.locator(SU('me', 0, 0)).click(); await sleep(500);
    const e1 = await emits();
    check('K1: Klick auf die Support-Zone sendet activate_free_ability mit zoneKind support, zoneIdx 0', e1.length === 1 && e1[0][0] === 'activate_free_ability' && e1[0][1].zoneKind === 'support' && e1[0][1].zoneIdx === 0 && e1[0][1].heroIdx === 0, e1);
    await sleep(1500);   // der Server oeffnet Trainings Frage und schickt den Zustand — danach nur noch eingespielte Zustaende

    // ── 2) Gegenvariante: Training in der Ability Zone 0, Toughness in der Support Zone 0 ──
    await einspielen(`
      const p = g.players[me]; p.abilityZones[0][0] = ['Training']; p.supportZones[0][0] = ['Toughness'];
      g.activatableAbilities = []; g.freeActivatableAbilities = [{ heroIdx: 0, zoneIdx: 0, abilityName: 'Training', level: 1, canActivate: true, exhausted: false, handLockBlocked: false, zoneKind: 'ability' }];`);
    ab0 = await leuchtet(AB('me', 0, 0)); su0 = await leuchtet(SU('me', 0, 0));
    check('K2: die Training-Ability-Zone leuchtet limegruen', ab0.lime, ab0);
    check('K2: die Toughness-Support-Zone leuchtet NICHT', !su0.lime && !su0.gold, su0);
    await leeren();
    await page.locator(SU('me', 0, 0)).click(); await sleep(500);
    check('K2: Klick auf die Toughness-Support-Zone sendet nichts', (await emits()).length === 0, await emits());
    await page.locator(AB('me', 0, 0)).click(); await sleep(500);
    const e2 = await emits();
    check('K2: Klick auf die Ability Zone sendet activate_free_ability fuer zoneIdx 0 (Zonenart ability)', e2.length === 1 && e2[0][0] === 'activate_free_ability' && e2[0][1].zoneKind === 'ability' && e2[0][1].zoneIdx === 0, e2);

    // ── 3) zwei AKTIVE Abilities mit gleicher Nummer: Aktion (Adventurousness) in der Zone, frei (Training) im Support ──
    await einspielen(`
      const p = g.players[me]; p.abilityZones[0][0] = ['Adventurousness']; p.supportZones[0][0] = ['Training'];
      g.activatableAbilities = [{ heroIdx: 0, zoneIdx: 0, abilityName: 'Adventurousness', level: 1, zoneKind: 'ability' }];
      g.freeActivatableAbilities = [{ heroIdx: 0, zoneIdx: 0, abilityName: 'Training', level: 1, canActivate: true, exhausted: false, handLockBlocked: false, zoneKind: 'support' }];`);
    ab0 = await leuchtet(AB('me', 0, 0)); su0 = await leuchtet(SU('me', 0, 0));
    check('K3: Ability Zone (Aktion) golden, Support Zone (frei) limegruen — jede mit ihrem eigenen Rahmen', ab0.gold && !ab0.lime && su0.lime && !su0.gold, { ab0, su0 });
    await leeren();
    await page.locator(SU('me', 0, 0)).click(); await sleep(500);
    const e3 = await emits();
    check('K3: Klick auf die Support Zone aktiviert Training (support), nicht Adventurousness', e3.length === 1 && e3[0][0] === 'activate_free_ability' && e3[0][1].zoneKind === 'support', e3);

    // ── 4) Aktions-Ability im Support (Adventurousness), Toughness in der Zone ──
    await einspielen(`
      const p = g.players[me]; p.abilityZones[0][0] = ['Toughness']; p.supportZones[0][0] = ['Adventurousness'];
      g.activatableAbilities = [{ heroIdx: 0, zoneIdx: 0, abilityName: 'Adventurousness', level: 1, zoneKind: 'support' }]; g.freeActivatableAbilities = [];`);
    ab0 = await leuchtet(AB('me', 0, 0)); su0 = await leuchtet(SU('me', 0, 0));
    check('K4: Support Zone (Aktion) golden, Toughness-Zone dunkel', su0.gold && !su0.lime && !ab0.gold && !ab0.lime, { ab0, su0 });
    await leeren();
    await page.locator(AB('me', 0, 0)).click(); await sleep(500);
    check('K4: Klick auf die Toughness-Zone sendet nichts und oeffnet keine Bestaetigung', (await emits()).length === 0 && (await page.locator('text=Activate Ability').count()) === 0, await emits());
    await page.locator(SU('me', 0, 0)).click(); await sleep(500);
    check('K4: Klick auf die Support Zone oeffnet erst die Rueckfrage „Activate Ability?" (wie die Ability Zonen), sendet noch nichts', (await emits()).length === 0 && (await page.locator('text=Activate Ability').count()) >= 1, await emits());
    await page.locator('button:has-text("Yes!")').click(); await sleep(500);
    const e4 = await emits();
    check('K4: nach „Yes!" geht activate_ability mit zoneKind support raus', e4.length === 1 && e4[0][0] === 'activate_ability' && e4[0][1].zoneKind === 'support' && e4[0][1].zoneIdx === 0, e4);

    // ── 5) Zusatzaktion (heroAction-Prompt) bietet die Support-Ability an: Toughness in der Ability Zone 0 darf nicht mitleuchten, der Klick traegt die Zonenart ──
    await einspielen(`
      const p = g.players[me]; p.abilityZones[0][0] = ['Toughness']; p.supportZones[0][0] = ['Adventurousness'];
      g.activatableAbilities = []; g.freeActivatableAbilities = [];
      g.effectPrompt = { type: 'heroAction', promptId: 'w73a-test', ownerIdx: me, heroIdx: 0, heroName: p.heroes[0].name, eligibleCards: [], activatableHeroEffects: [], title: 'Immediate Action', description: 'x', cancellable: true,
        activatableAbilities: [{ heroIdx: 0, zoneIdx: 0, abilityName: 'Adventurousness', level: 1, zoneKind: 'support' }] };`);
    ab0 = await leuchtet(AB('me', 0, 0)); su0 = await leuchtet(SU('me', 0, 0));
    check('K5 (Zusatzaktion): die Toughness-Zone leuchtet nicht, die Support Zone mit Adventurousness schon', !ab0.gold && !ab0.lime && su0.gold, { ab0, su0 });
    await leeren();
    await page.locator(AB('me', 0, 0)).click({ force: true }); await sleep(500);
    check('K5: Klick auf die Toughness-Zone sendet nichts / oeffnet keine Bestaetigung', (await emits()).length === 0 && (await page.locator('text=Activate Ability').count()) === 0, await emits());
    await page.locator(SU('me', 0, 0)).click({ force: true }); await sleep(500);
    check('K5: Klick auf die Support Zone oeffnet erst die Rueckfrage „Activate Ability?" (wie die Ability Zonen)', (await emits()).length === 0 && (await page.locator('text=Activate Ability').count()) >= 1, await emits());
    await page.locator('button:has-text("Yes!")').click(); await sleep(500);
    const e5 = await emits();
    check('K5: nach „Yes!" antwortet der Client dem Prompt mit abilityActivation + zoneKind support', e5.length === 1 && e5[0][0] === 'effect_prompt_response'
      && e5[0][1].response && e5[0][1].response.abilityActivation === true && e5[0][1].response.zoneKind === 'support' && e5[0][1].response.zoneIdx === 0 && e5[0][1].response.heroIdx === 0, e5);

    // ── 6) Gegenprobe zu 5: Aktion in der ABILITY Zone, Toughness im Support — Antwort ohne zoneKind support ──
    await einspielen(`
      const p = g.players[me]; p.abilityZones[0][0] = ['Adventurousness']; p.supportZones[0][0] = ['Toughness'];
      g.effectPrompt = { type: 'heroAction', promptId: 'w73a-test-2', ownerIdx: me, heroIdx: 0, heroName: p.heroes[0].name, eligibleCards: [], activatableHeroEffects: [], title: 'Immediate Action', description: 'x', cancellable: true,
        activatableAbilities: [{ heroIdx: 0, zoneIdx: 0, abilityName: 'Adventurousness', level: 1, zoneKind: 'ability' }] };`);
    ab0 = await leuchtet(AB('me', 0, 0)); su0 = await leuchtet(SU('me', 0, 0));
    check('K6 (Zusatzaktion): Ability Zone golden, Toughness-Support-Zone dunkel', ab0.gold && !su0.gold && !su0.lime, { ab0, su0 });

    // ── 7) Gegnerseite: eine kontrollierte (charmedOwner) Support-Ability des Gegners leuchtet in IHRER Support Zone, nicht in der gleichnummerierten Ability Zone ──
    await einspielen(`
      g.effectPrompt = null;
      const opp = 1 - me; const o = g.players[opp];
      o.heroes[0].name = 'Xal, the Animated Armor'; o.heroes[0].charmedBy = me;
      o.abilityZones[0][0] = ['Toughness']; o.supportZones[0][0] = ['Training'];
      g.activatableAbilities = []; g.freeActivatableAbilities = [{ heroIdx: 0, zoneIdx: 0, abilityName: 'Training', level: 1, canActivate: true, exhausted: false, handLockBlocked: false, zoneKind: 'support', charmedOwner: opp }];`);
    const oppSeite = await page.evaluate(() => window.__gs.myIndex === 0 ? 'opp' : 'opp');
    const oab = await leuchtet(AB(oppSeite, 0, 0)), osu = await leuchtet(SU(oppSeite, 0, 0));
    check('K7 (Gegner-Held, Charme): die Support Zone leuchtet, die gleichnummerierte Ability Zone nicht', osu.lime && !oab.lime && !oab.gold, { oab, osu });
  } finally {
    await browser.close(); srv.child.kill();
    try { fs.unlinkSync(process.env.PP_DB_PATH); } catch { /* weg */ }
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
