'use strict';
// Ziehen und Mulligan im Skill Test: Zufallskarten „von außerhalb des Spiels“ (skilltest/engine-ext.js installDraws).
//   node scripts/skilltest-e2e/draws.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 61 });
  console.log = oL; console.error = oE;
  const { room, gs, engine } = out;
  const pool = room.skillTest.pool;
  const cards = engine._getCardDB();
  const seat = 0, ps = gs.players[seat];
  const everyone = () => new Set(gs.players.flatMap(p => [...(p.hand || []), ...(p.discardPile || [])]));

  console.log('Ziehen aus dem Deck (Hauptdeck)');
  const before = { hand: ps.hand.length, pool: pool.remaining() };
  const inGame = everyone();
  const drawn = await engine.actionDrawCards(seat, 3, { source: 'Haste' });
  check('3 Karten gezogen', drawn.length === 3 && ps.hand.length === before.hand + 3, { drawn: drawn.length });
  const names = drawn.map(i => i.name);
  check('keine Heroes, keine Potions', names.every(n => cards[n].cardType !== 'Hero' && cards[n].cardType !== 'Potion'), names);
  check('neue Karten: vorher in keiner Hand und in keiner Ablage', names.every(n => !inGame.has(n)), names);
  check('Pool ist um genau 3 kleiner', pool.remaining() === before.pool - 3, { vorher: before.pool, nachher: pool.remaining() });
  check('Deck liegt danach leer', ps.mainDeck.length === 0 && ps.potionDeck.length === 0, { main: ps.mainDeck.length, potion: ps.potionDeck.length });

  console.log('Potion Deck');
  const pd = await engine.actionDrawFromPotionDeck(seat, 2);
  check('2 Potions gezogen', pd.length === 2 && pd.every(n => cards[n].cardType === 'Potion'), pd);
  check('Potion Deck danach leer', ps.potionDeck.length === 0);

  console.log('Mulligan');
  const back = ps.hand.slice(0, 3);
  const idx = [0, 1, 2];
  const poolBefore = pool.remaining();
  await engine.actionMulliganCards(seat, back, idx);
  check('die 3 Karten sind aus der Hand', ps.hand.length === before.hand + 3 + 2 - 3, { hand: ps.hand.length });
  check('zurückgemischte Karten liegen wieder im Pool (3 Zufallskarten ersetzen sie im Deck)', pool.remaining() === poolBefore, { vorher: poolBefore, nachher: pool.remaining() });
  const mainToDraw = ps.mainDeck.length + ps.potionDeck.length;
  check('im Deck liegen jetzt 3 neue Karten', mainToDraw === 3, { main: ps.mainDeck.length, potion: ps.potionDeck.length });
  const h0 = ps.hand.length;
  await engine.actionDrawCards(seat, ps.mainDeck.length);
  for (const n of ps.potionDeck.splice(0)) engine.handZugangSync(ps, n, { von: 'rueckgabe', ohneInstanz: true });
  check('nachgezogen: die Hand ist wieder so groß wie vor dem Mulligan', ps.hand.length === before.hand + 3 + 2, { hand: ps.hand.length });
  check('Decks wieder leer', ps.mainDeck.length === 0 && ps.potionDeck.length === 0);

  console.log('Spell-School-Abilities');
  const heroSch = (cards[ps.heroes.find(h => h && h.name).name] || {});
  const myAbs = new Set([heroSch.startingAbility1, heroSch.startingAbility2].filter(Boolean));
  const schools = ['Magic Arts', 'Decay Magic', 'Support Magic', 'Destruction Magic', 'Summoning Magic'];
  const have = schools.filter(s => ps.heroes.some(h => h && h.name && [cards[h.name].startingAbility1, cards[h.name].startingAbility2].includes(s)));
  let bad = 0, abilities = 0;
  for (let i = 0; i < 25; i++) {
    const d = await engine.actionDrawCards(seat, 12);
    for (const inst of d) { const c = cards[inst.name]; if (c.cardType === 'Ability') { abilities++; if (have.includes(inst.name)) bad++; } }
    for (const n of ps.hand.splice(0, ps.hand.length - 4)) { const b = require('../../skilltest/pool').bucketOf(cards[n]); if (b) pool.give(b, n); }
  }
  check(`Spell-School-Abilities, die der Spieler schon hat (${have.join(', ') || '–'}), werden nicht gezogen`, bad === 0, { bad, abilities });
  check('andere Abilities kommen vor', abilities > 0, abilities);

  console.log('Lookahead verändert den Pool nicht');
  const rem = pool.remaining();
  engine._inMctsSim = true;
  const d2 = await engine.actionDrawCards(seat, 5);
  engine._inMctsSim = false;
  check('Karten gezogen, Pool unverändert', d2.length === 5 && pool.remaining() === rem, { drawn: d2.length, rem, now: pool.remaining() });

  console.log('Pool leer: nichts zu ziehen');
  const savedBuckets = JSON.parse(JSON.stringify(pool.buckets));
  for (const b of Object.keys(pool.buckets)) pool.buckets[b] = [];
  const none = await engine.actionDrawCards(seat, 2);
  check('keine Karte, kein Absturz, keine Niederlage durch „Deck out“', none.length === 0 && !gs.result, { n: none.length, res: gs.result });
  pool.buckets = savedBuckets;

  console.log('Normalspiel unberührt');
  check('ohne Skill Test gibt es die Funktion deckLeer weiter', typeof engine.deckLeer === 'function');

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Zieh-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
