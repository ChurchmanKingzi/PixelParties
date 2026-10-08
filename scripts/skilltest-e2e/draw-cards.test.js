'use strict';
// Die wieder zugelassenen Zieh- und Mulligan-Karten funktionieren im Skill Test: Bots spielen reine Draw-Karten fehlerfrei; Leadership, Horn in a Bottle und
// Staff of the Teleporter tauschen Karten gegen NEUE Zufallskarten (Hand bleibt gleich groß, die Alten gehen in den Pool zurück).
//   node scripts/skilltest-e2e/draw-cards.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const errors = [];
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = (...a) => errors.push(a.join(' ').slice(0, 200));

  // 1) Bots mit reinen Draw-Karten
  const DRAW = ['Haste', 'Wheels', 'Supply Chain', 'Elixir of Quickness', 'Heart of the Mountain', 'Ice Sculpture Garden', 'Wanted Poster', 'Bluff', "The Brewer's Blade", 'Alchemy'];
  const GameEngine = require('../../cards/effects/_engine');
  const E = GameEngine.GameEngine || GameEngine;
  const orig = E.prototype.log;
  const logs = { draw: 0, potion_draw: 0, played: {} };
  E.prototype.log = function (n, d) {
    if (n === 'draw') logs.draw++; else if (n === 'potion_draw') logs.potion_draw++;
    else if (n === 'card_played' && d && DRAW.includes(d.card)) logs.played[d.card] = (logs.played[d.card] || 0) + 1;
    return orig.apply(this, arguments);
  };
  let finished = 0; const G = 10;
  for (let g = 0; g < G; g++) {
    const r = await runGame({ seats: 3, seed: 700 + g, noProfileSeats: [0, 1, 2],
      mutatePrep: (prep) => { prep.players.forEach(p => { for (const n of DRAW) p.hand.push(n); }); } });
    if (r.winnerIdx != null) finished++;
  }
  E.prototype.log = orig;
  console.log = oL;
  check(`alle ${G} Partien enden mit einem Sieger`, finished === G, finished);
  check('es wurde gezogen (Karten aus dem Pool, auch Potions)', logs.draw > 0, logs);
  check('mindestens eine der Draw-Karten wurde gespielt', Object.keys(logs.played).length > 0, logs.played);
  const bad = errors.filter(e => !/heap-guard|deck-profile/.test(e));
  check('keine Fehlermeldungen im Lauf', bad.length === 0, bad.slice(0, 3));
  console.error = oE;

  // 2) Mulligan-Karten mit einem „Menschen“ (feste Antworten)
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 77,
    mutatePrep: (prep) => {
      const p = prep.players[0];
      p.abilityZones[0][0] = { n: 'Leadership', c: 3 };               // Zonen-Format siehe skilltest-rules (Stapel)
      p.hand.push('Horn in a Bottle', 'Staff of the Teleporter');
    } });
  console.log = oL; console.error = oE;
  const { room, gs, engine } = out;
  const pool = room.skillTest.pool, ps = gs.players[0], cards = engine._getCardDB();
  const sizeBefore = ps.hand.length;
  const lead = engine.cardInstances.find(c => c.name === 'Leadership' && c.zone === 'ability' && c.owner === 0);
  check('Leadership liegt als Ability auf dem Hero', !!lead, engine.cardInstances.filter(c => c.zone === 'ability' && c.owner === 0).map(c => c.name));
  if (lead) {
    const script = loadCardEffect('Leadership');
    const take = ps.hand.filter(n => cards[n].cardType !== 'Hero').slice(0, 3);
    const pg = engine.promptGeneric.bind(engine);
    engine.promptGeneric = async (pi, cfg) => (cfg && cfg.type === 'handPick')
      ? { selectedCards: take.map(n => ({ cardName: n, handIndex: ps.hand.indexOf(n) })) } : pg(pi, cfg);
    engine.isCpuPlayer = (pi) => pi !== 0;
    const remBefore = pool.remaining();
    const ctx = engine._createContext(lead, {});
    const ok = await script.onFreeActivate(ctx, 3);
    check('Leadership Lv3 lief durch', ok === true, ok);
    check('Hand: 3 raus, 3 + 1 Bonus neu rein', ps.hand.length === sizeBefore + 1, { vorher: sizeBefore, nachher: ps.hand.length });
    check('Decks danach leer', ps.mainDeck.length === 0 && ps.potionDeck.length === 0);
    check('der Pool hat 1 Karte weniger (das Bonus-Ziehen), die 3 anderen sind getauscht', pool.remaining() === remBefore - 1, { remBefore, nach: pool.remaining() });
  }

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Zieh-Karten-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
