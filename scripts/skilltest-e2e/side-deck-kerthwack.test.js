'use strict';
// Seitenwechsel (Bo3) mit Kerthwack, the Reality Breaker — die Server-Haelfte der Deckbau-Erlaubnis (`side_deck_swap`, `side_deck_move`):
//   • mit Kerthwack im Team darf JEDE Karte ins Potion Deck (Tausch und Verschieben), je Name hoechstens 2 Kopien;
//   • verlaesst Kerthwack das Team, duerfen im Potion Deck nur noch Karten liegen, die dann hineindurfen (Potions) — sonst Ablehnung;
//   • ohne Kerthwack lehnt der Server Nicht-Potions fuers Potion Deck still ab; kommt er zurueck, geht es wieder.
// Echter Server, zwei echte Konten, ein Bo3-Raum: der Gastgeber gibt das erste Spiel auf, dann beginnt der Seitenwechsel.
//   NODE_PATH=/tmp/st-tools/node_modules node scripts/skilltest-e2e/side-deck-kerthwack.test.js
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const { io } = require('socket.io-client');
const db = require('../../db');
const { v4: uuidv4 } = require('uuid');
const { getCardDB } = require('../../cards/effects/_card-db');

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

async function spieler(label, deck) {
  const acc = await createAccount('Sd' + label + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const row = await db.get('SELECT id FROM users WHERE username = ?', [acc.username]);
  const deckId = uuidv4();
  await db.run('INSERT INTO decks (id, user_id, name, main_deck, heroes, potion_deck, side_deck, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [deckId, row.id, 'Test', JSON.stringify(deck.main), JSON.stringify(deck.heroes.map(heroRow)), JSON.stringify(deck.potion), JSON.stringify(deck.side), Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]);
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: acc.username, password: acc.password }) });
  const { token } = await res.json();
  const socket = io(BASE, { transports: ['websocket'] });
  const events = [];
  socket.onAny((ev, ...args) => events.push({ ev, args }));
  await new Promise((r) => socket.on('connect', r));
  socket.emit('auth', token);
  await new Promise((r) => socket.once('auth_ok', r));
  const warte = (ev, ms = 12000) => new Promise((resolve, reject) => {
    const hit = events.find(e => e.ev === ev);
    if (hit) return resolve(hit.args[0]);
    const t = setTimeout(() => reject(new Error('Timeout: ' + ev + ' (' + label + ')')), ms);
    socket.once(ev, (d) => { clearTimeout(t); resolve(d); });
  });
  return { label, socket, events, deckId, warte };
}

/** Sendet ein Seitenwechsel-Ereignis und wartet kurz auf die Antwort des Servers (Update, Ablehnung oder — bei stiller Ablehnung — nichts). */
async function tu(sp, ereignis, daten, ms = 1300) {
  const von = sp.events.length;
  sp.socket.emit(ereignis, daten);
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    const neu = sp.events.slice(von).filter(e => e.ev === 'side_deck_update' || e.ev === 'side_deck_rejected');
    if (neu.length) { const l = neu[neu.length - 1]; return l.ev === 'side_deck_update' ? { update: l.args[0].currentDeck } : { rejected: l.args[0].reason }; }
    await sleep(40);
  }
  return {};
}

(async () => {
  const srv = await startServer();
  try {
    const a = await spieler('A', {
      heroes: [KERTH, heroes[0], heroes[1]], main: main60,
      potion: [C1, C1, P1, P2, P3],
      side: [C1, heroes[2], P4, P5, C2, C1],
    });
    const b = await spieler('B', { heroes: heroes.slice(0, 3), main: main60, potion: [], side: [] });
    a.socket.emit('create_room', { type: 'unranked', deckId: a.deckId, format: 3 });
    const raum = await a.warte('room_joined');
    b.socket.emit('join_room', { roomId: raum.id, deckId: b.deckId });
    await b.warte('room_joined');
    a.socket.emit('start_game', { roomId: raum.id });
    await a.warte('game_state');
    await sleep(500);
    a.socket.emit('surrender_game', { roomId: raum.id });
    const phase = await a.warte('side_deck_phase', 20000);
    const R = raum.id;
    const swap = (von, vi, nach, ni) => tu(a, 'side_deck_swap', { roomId: R, from: von, fromIdx: vi, to: nach, toIdx: ni });
    const move = (von, vi, nach) => tu(a, 'side_deck_move', { roomId: R, from: von, fromIdx: vi, to: nach });
    let deck = phase.currentDeck;
    const merke = (r) => { if (r.update) deck = r.update; return r; };
    const idx = (pool, name, nth = 0) => { let k = -1; for (let i = 0; i < pool.length; i++) if (pool[i] === name && ++k === nth) return i; return -1; };

    console.log('Der Seitenwechsel beginnt');
    check('Phase gestartet, Kerthwack im Team, Potion Deck hat Creatures und Potions', phase.currentDeck.heroes[0].hero === KERTH && phase.currentDeck.potionDeck.filter(n => DB[n].cardType === 'Creature').length === 2, phase.currentDeck.potionDeck);
    check('Potion Deck & Side Deck wie gebaut', JSON.stringify(deck.potionDeck) === JSON.stringify([C1, C1, P1, P2, P3]) && deck.sideDeck.length === 6, [deck.potionDeck, deck.sideDeck]);

    console.log('Mit Kerthwack: jede Karte ins Potion Deck, je Name höchstens 2');
    let r = merke(await swap('side', idx(deck.sideDeck, C2), 'potion', idx(deck.potionDeck, P1)));
    check('eine Creature (Nicht-Potion) tauscht gegen eine Potion ins Potion Deck', !!r.update && r.update.potionDeck.includes(C2) && !r.update.potionDeck.includes(P1), r);
    r = await swap('side', idx(deck.sideDeck, C1), 'potion', idx(deck.potionDeck, C2));
    check('die DRITTE Kopie von C1 wird abgelehnt (höchstens 2 je Name)', /at most 2 copies/.test(r.rejected || ''), r);
    r = await swap('side', idx(deck.sideDeck, C1), 'potion', idx(deck.potionDeck, P2));
    check('…auch gegen eine Potion getauscht', /at most 2 copies/.test(r.rejected || ''), r);
    r = merke(await swap('side', idx(deck.sideDeck, P4), 'potion', idx(deck.potionDeck, P2)));
    check('eine Potion tauschen bleibt möglich (Erlaubnis, kein Verbot)', !!r.update && r.update.potionDeck.includes(P4) && !r.update.potionDeck.includes(P2), r);
    r = merke(await swap('side', idx(deck.sideDeck, P2), 'potion', idx(deck.potionDeck, P4)));
    check('…und wieder zurück', !!r.update && r.update.potionDeck.includes(P2) && !r.update.potionDeck.includes(P4), r);

    console.log('Kerthwack raus, solange Nicht-Potions im Potion Deck liegen');
    r = await swap('hero', 0, 'side', idx(deck.sideDeck, heroes[2]));
    check('gesperrt, mit klarer Meldung („Take the non-Potion cards out …")', /Take the non-Potion cards out of your Potion Deck first: without Kerthwack/.test(r.rejected || ''), r);

    console.log('Nicht-Potions heraustauschen, dann darf Kerthwack gehen');
    for (const nichtPotion of [C1, C1, C2]) {
      const pot = deck.sideDeck.find(n => DB[n].cardType === 'Potion');
      const vorher = deck.potionDeck.filter(n => n === nichtPotion).length;
      r = merke(await swap('side', idx(deck.sideDeck, pot), 'potion', idx(deck.potionDeck, nichtPotion)));
      check(`eine Kopie von ${nichtPotion} geht gegen die Potion ${pot} aus dem Potion Deck (ins Side Deck)`, !!r.update && r.update.potionDeck.filter(n => n === nichtPotion).length === vorher - 1 && r.update.potionDeck.includes(pot), r);
    }
    check('das Potion Deck besteht jetzt nur noch aus Potions', deck.potionDeck.every(n => DB[n].cardType === 'Potion'), deck.potionDeck);
    r = merke(await swap('hero', 0, 'side', idx(deck.sideDeck, heroes[2])));
    check('Kerthwack tauscht gegen einen Helden aus dem Side Deck', !!r.update && r.update.heroes[0].hero === heroes[2] && r.update.sideDeck.includes(KERTH), r.update && r.update.heroes.map(h => h.hero));

    console.log('Ohne Kerthwack: Nicht-Potions bleiben draußen');
    r = await swap('side', idx(deck.sideDeck, C1), 'potion', 0);
    check('eine Creature gegen eine Potion tauschen: still abgelehnt (kein Update)', !r.update, r);
    r = await move('side', idx(deck.sideDeck, C1), 'potion');
    check('…auch das Verschieben', !r.update, r);

    console.log('Kerthwack kommt zurück');
    r = merke(await swap('hero', 0, 'side', idx(deck.sideDeck, KERTH)));
    check('Held-Tausch zurück: erlaubt (das Potion Deck besteht nur aus Potions)', !!r.update && r.update.heroes[0].hero === KERTH, r);
    r = merke(await move('side', idx(deck.sideDeck, C1), 'potion'));
    check('Verschieben einer Creature ins Potion Deck geht wieder', !!r.update && r.update.potionDeck.includes(C1), r);
    r = merke(await move('side', idx(deck.sideDeck, C1), 'potion'));
    check('die zweite Kopie auch', !!r.update && r.update.potionDeck.filter(n => n === C1).length === 2, r);
    r = await move('side', idx(deck.sideDeck, C1), 'potion');
    check('die dritte Kopie wird beim Verschieben abgelehnt (höchstens 2 je Name)', /at most 2 copies/.test(r.rejected || ''), r);
    a.socket.close(); b.socket.close();
  } catch (e) {
    check('Testlauf ohne Ausnahme', false, String(e && e.message || e));
  } finally {
    srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})();
