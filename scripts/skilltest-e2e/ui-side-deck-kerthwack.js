'use strict';
// UI-Test: Seitenwechsel (Bo3) im ECHTEN Browser mit Kerthwack, the Reality Breaker — der Client-Spiegel der Server-Pruefungen
// (`canSwap` in app-board.jsx). Der Server-Teil steht in `side-deck-kerthwack.test.js`. Hier zaehlt, was der Klick ausloest:
//   • erlaubter Tausch → der Client sendet `side_deck_swap`, der Server antwortet mit `side_deck_update`;
//   • verbotener Tausch (dritte Kopie, Kerthwack raus mit Nicht-Potions im Potion Deck) → der Client SENDET GAR NICHTS
//     (kein Update, auch keine Server-Ablehnung — die kaeme, wenn der Spiegel die Regel nicht kennte).
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-side-deck-kerthwack.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const { io } = require('socket.io-client');
const db = require('../../db');
const { v4: uuidv4 } = require('uuid');
const { getCardDB } = require('../../cards/effects/_card-db');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

const DB = getCardDB();
const KERTH = 'Kerthwack, the Reality Breaker';
const KLAUSEL = /Chaos-Diamond|Pinta|Kerthwack|Nicolas|Zhigao|Quetzahuitl/;
const names = (pred, n) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name)).slice(0, n).map(c => c.name);
const heroes = names(c => c.cardType === 'Hero' && !KLAUSEL.test(c.name) && c.startingAbility1 && c.startingAbility2 && !/cannot be one of your starting heroes/i.test(c.effect || ''), 5);
const creatures = names(c => c.cardType === 'Creature' && c.level === 0 && c.subtype === 'Normal' && c.maxCopies == null, 25);
const potions = names(c => c.cardType === 'Potion', 6);
const [C1, C2] = creatures, [P1, P2, P3, P4, P5] = potions;
const heroRow = (n) => ({ hero: n, ability1: DB[n].startingAbility1 || null, ability2: DB[n].startingAbility2 || null });
const main60 = creatures.slice(3, 18).flatMap(n => [n, n, n, n]);

async function konto(label, deck) {
  const acc = await createAccount('Ui' + label + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const row = await db.get('SELECT id FROM users WHERE username = ?', [acc.username]);
  const deckId = uuidv4();
  await db.run('INSERT INTO decks (id, user_id, name, main_deck, heroes, potion_deck, side_deck, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [deckId, row.id, 'Test', JSON.stringify(deck.main), JSON.stringify(deck.heroes.map(heroRow)), JSON.stringify(deck.potion), JSON.stringify(deck.side), Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]);
  return { acc, deckId };
}

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const a = await konto('A', { heroes: [KERTH, heroes[0], heroes[1]], main: main60, potion: [C1, C1, P1, P2, P3], side: [C1, heroes[2], P4, P5, C2, C1] });
    const b = await konto('B', { heroes: heroes.slice(0, 3), main: main60, potion: [], side: [] });

    // B: Node-Socket
    const resB = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: b.acc.username, password: b.acc.password }) });
    const { token } = await resB.json();
    const sockB = io(BASE, { transports: ['websocket'] });
    const evB = [];
    sockB.onAny((ev, ...args) => evB.push({ ev, args }));
    await new Promise((r) => sockB.on('connect', r));
    sockB.emit('auth', token);
    await new Promise((r) => sockB.once('auth_ok', r));

    // A: Browser
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: a.acc.username, password: a.acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    const jsFehler = [];
    page.on('pageerror', (e) => { jsFehler.push(e.message); console.log('[pageerror]', e.message); });
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME, null, { timeout: 20000 });
    await page.evaluate(() => {
      window.__sd = [];
      window.socket.onAny((ev, ...args) => { if (ev === 'side_deck_update' || ev === 'side_deck_rejected' || ev === 'side_deck_phase' || ev === 'room_joined') window.__sd.push({ ev, a: args[0] }); });
    });
    await page.click('text=PLAY ONLINE');                 // der Gefechtsbildschirm haengt am Bildschirm „play" der Anwendung
    await sleep(800);
    await page.evaluate(([deckId]) => window.socket.emit('create_room', { type: 'unranked', deckId, format: 3 }), [a.deckId]);
    await page.waitForFunction(() => window.__sd.some(e => e.ev === 'room_joined'), null, { timeout: 15000 });
    const roomId = await page.evaluate(() => window.__sd.find(e => e.ev === 'room_joined').a.id);
    sockB.emit('join_room', { roomId, deckId: b.deckId });
    await sleep(800);
    await page.evaluate(([rid]) => window.socket.emit('start_game', { roomId: rid }), [roomId]);
    await sleep(2500);
    await page.evaluate(([rid]) => window.socket.emit('surrender_game', { roomId: rid }), [roomId]);
    try { await page.waitForSelector('text=SIDE DECKING', { timeout: 25000 }); }
    catch (e) {
      console.log('[debug] __sd:', JSON.stringify(await page.evaluate(() => window.__sd.map(x => x.ev))));
      console.log('[debug] Text:', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 400));
      await page.screenshot({ path: process.env.PP_DEBUG_SHOT || '/tmp/sd-debug.png' });
      throw e;
    }
    await sleep(500);

    const zaehler = () => page.evaluate(() => window.__sd.filter(e => e.ev === 'side_deck_update' || e.ev === 'side_deck_rejected').length);
    const letztes = () => page.evaluate(() => { const l = window.__sd.filter(e => e.ev === 'side_deck_update' || e.ev === 'side_deck_rejected').pop(); return l ? { ev: l.ev, deck: l.a.currentDeck, reason: l.a.reason } : null; });
    const klick = (abschnitt, i) => page.evaluate(([lab, idx]) => {
      const L = [...document.querySelectorAll('div')].find(d => d.children.length === 0 && new RegExp('^' + lab).test(d.textContent.trim()));
      const box = L.nextElementSibling; box.children[idx].click();
    }, [abschnitt, i]);
    /** Zwei Klicks (erst die Quelle, dann das Ziel); true, wenn der Server daraufhin ein Update schickte. */
    const tausch = async (von, vi, nach, ni) => {
      const vorher = await zaehler();
      await klick(von, vi); await sleep(150); await klick(nach, ni); await sleep(900);
      return { gesendet: (await zaehler()) > vorher, l: await letztes() };
    };
    const SIDE = 'SIDE DECK \\(', POTION = 'POTION DECK \\(', HELDEN = 'HEROES$';
    const abwaehlen = async () => { await page.evaluate(() => document.body.click()); };

    console.log('Der Seitenwechsel-Bildschirm');
    check('Seitenwechsel-Bildschirm mit Kerthwack im Team', await page.evaluate(() => /HEROES/.test(document.body.innerText) && /POTION DECK \(5\)/.test(document.body.innerText) && /SIDE DECK \(6\)/.test(document.body.innerText)));

    console.log('Erlaubte Tausche gehen durch (der Client sendet, der Server bestätigt)');
    let r = await tausch(SIDE, 4, POTION, 2);            // C2 (Creature) gegen P1 (Potion)
    check('Creature aus dem Side Deck gegen eine Potion im Potion Deck', r.gesendet && r.l.ev === 'side_deck_update' && r.l.deck.potionDeck.includes(C2), r.l);

    console.log('Verbotene Tausche bleiben auf dem Client hängen (nichts wird gesendet)');
    r = await tausch(SIDE, 0, POTION, 2);               // dritte Kopie von C1 ins Potion Deck (an die Stelle von C2)
    check('dritte Kopie einer Karte im Potion Deck: der Client sendet nichts', !r.gesendet, r.l && r.l.reason);
    await abwaehlen();
    r = await tausch(HELDEN, 0, HELDEN, 1);                       // Held 0 gegen Held 1: kein gueltiger Tausch (Pool hero ↔ hero)
    check('(Gegenprobe) Held gegen Held ist ohnehin kein Tausch', !r.gesendet);
    await abwaehlen();
    r = await tausch(HELDEN, 0, SIDE, 1);                    // Kerthwack gegen den Helden im Side Deck, Nicht-Potions im Potion Deck
    check('Kerthwack gegen den Side-Deck-Helden, solange Nicht-Potions im Potion Deck liegen: der Client sendet nichts', !r.gesendet, r.l && r.l.reason);

    console.log('Nicht-Potions herauswechseln, dann darf Kerthwack gehen');
    await abwaehlen();
    // Potion Deck jetzt: [C1, C1, C2, P2, P3]; Side Deck: [C1, H, P4, P5, P1, C1]
    r = await tausch(SIDE, 2, POTION, 0);               // P4 rein, C1 raus
    check('C1 gegen P4', r.gesendet && r.l.deck.potionDeck.includes(P4), r.l);
    r = await tausch(SIDE, 3, POTION, 1);               // P5 rein, C1 raus
    check('zweites C1 gegen P5', r.gesendet && r.l.deck.potionDeck.includes(P5), r.l);
    r = await tausch(SIDE, 4, POTION, 2);               // P1 rein, C2 raus
    check('C2 gegen P1 — das Potion Deck besteht nur noch aus Potions', r.gesendet && r.l.deck.potionDeck.every(n => DB[n].cardType === 'Potion'), r.l);
    r = await tausch(HELDEN, 0, SIDE, 1);
    check('Kerthwack gegen den Helden im Side Deck: jetzt erlaubt', r.gesendet && r.l.ev === 'side_deck_update' && r.l.deck.heroes[0].hero === heroes[2], r.l);

    console.log('Ohne Kerthwack: Nicht-Potions bleiben auf dem Client draußen');
    await abwaehlen();
    const sd = await letztes();
    const c1Seite = sd.deck.sideDeck.indexOf(C1);
    r = await tausch(SIDE, c1Seite, POTION, 0);
    check('Creature gegen eine Potion im Potion Deck: kein Update (der Server lehnt Typverstöße still ab — hier trennt der Test Client und Server nicht)', !r.gesendet, r.l && r.l.reason);
    check('über den ganzen Lauf kam keine Server-Ablehnung an (der Client-Spiegel kennt die Regeln: dritte Kopie, Kerthwack raus)', await page.evaluate(() => !window.__sd.some(e => e.ev === 'side_deck_rejected')));
    check('keine JS-Fehler im Browser', jsFehler.length === 0, jsFehler);
    sockB.close(); await ctx.close();
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
