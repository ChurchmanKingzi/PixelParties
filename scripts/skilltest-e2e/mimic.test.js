'use strict';
// Mimic (Creature, Normal, Lv0, 50 HP, Summoning Magic): „Steal 10 Gold from your opponent at the beginning of each of your turns."
// Geprueft wird der ECHTE Zugbeginn-Hook (`engine.runHooks('onTurnStart')`) mit der Mimic auf dem Brett: Deckelung auf das tatsaechliche
// Gold des Gegners (nie unter 0), KEINE Umkehrung bei Schulden, Anfangsschutz, nur im EIGENEN Zug, zwei Mimics, Sperren, Bild nur bei Beute.
//   node scripts/skilltest-e2e/mimic.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Mimic';
const DB = require('../../cards/effects/_card-db').getCardDB();

async function fresh() {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = 0; gs.firstTurnProtectedPlayer = null;
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.discardPile = []; ps.hand = [];
  }
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support');
  engine._fastMode = false; engine._delay = async () => {};   // die Sim laeuft im Fast-Mode: ohne das feuern Kreatur-Hooks/Sperren nicht
  const t = { room, host, engine, gs, p0, p1, events: [] };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  engine.promptGeneric = async () => undefined;
  return t;
}
function lege(t, seat, hi, slot, name) {
  t.gs.players[seat].supportZones[hi][slot] = [name];
  return t.engine._trackCard(name, seat, 'support', hi, slot);
}
/** Zugbeginn von `seat`: die echte Hook-Batterie. */
async function zugbeginn(t, seat) {
  t.gs.activePlayer = seat; t.events.length = 0;
  await t.engine.runHooks('onTurnStart', { turn: t.gs.turn, activePlayer: seat });
}
const bild = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'mimic_chomp');
const flug = (t) => t.events.filter(e => e.ev === 'gold_steal_burst');

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Creature, Normal, Lv0 (vorher Lv1), 50 HP, Summoning Magic', cd && cd.cardType === 'Creature' && cd.subtype === 'Normal' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: 10 Gold zu Beginn jedes eigenen Zuges', cd && /^Steal 10 Gold from your opponent at the beginning of each of your turns\.$/.test(cd.effect), cd && cd.effect);
    check('lauscht auf `onTurnStart` aus der Support Zone', s && s.hooks && typeof s.hooks.onTurnStart === 'function' && s.activeIn.includes('support'));
  }

  console.log('Der Diebstahl');
  {
    const t = await fresh();
    lege(t, 0, 0, 0, CARD);
    t.p0.gold = 3; t.p1.gold = 25;
    await zugbeginn(t, 0);
    check('Gegner 25 Gold → ich habe 13, der Gegner 15', t.p0.gold === 13 && t.p1.gold === 15, [t.p0.gold, t.p1.gold]);
    check('Bild: genau ein Kiefer-Schnappen auf der Mimic (Brett-Animation, Ursprung = Ziel)', bild(t).length === 1
      && bild(t)[0].data.zoneType === 'board' && bild(t)[0].data.originOwner === 0 && bild(t)[0].data.targets[0].zoneSlot === 0
      && bild(t)[0].data.targets[0].cardName === CARD, bild(t));
    check('…und der Muenzstrom vom Gegner zu mir', flug(t).length === 1 && flug(t)[0].data.fromPlayer === 1 && flug(t)[0].data.toPlayer === 0 && flug(t)[0].data.amount === 10, flug(t));
  }
  {
    const t = await fresh();
    lege(t, 0, 0, 0, CARD);
    t.p0.gold = 0; t.p1.gold = 4;
    await zugbeginn(t, 0);
    check('Gegner hat nur 4 Gold → nur 4 gestohlen (gedeckelt auf den Besitz), der Gegner steht bei 0', t.p0.gold === 4 && t.p1.gold === 0, [t.p0.gold, t.p1.gold]);
  }
  {
    const t = await fresh();
    lege(t, 0, 0, 0, CARD);
    t.p0.gold = 7; t.p1.gold = 0;
    await zugbeginn(t, 0);
    check('Gegner hat 0 Gold → nichts passiert, mein Gold bleibt', t.p0.gold === 7 && t.p1.gold === 0, [t.p0.gold, t.p1.gold]);
    check('…und es gibt weder Schnappen noch Muenzstrom', bild(t).length === 0 && flug(t).length === 0, [bild(t).length, flug(t).length]);
  }
  {
    const t = await fresh();
    lege(t, 0, 0, 0, CARD);
    t.p0.gold = 7; t.p1.gold = -15;
    await zugbeginn(t, 0);
    check('Gegner ist im Minus (-15) → es wird NICHTS gestohlen und NICHTS umgekehrt: ich bleibe bei 7, der Gegner bei -15', t.p0.gold === 7 && t.p1.gold === -15, [t.p0.gold, t.p1.gold]);
    check('…ohne Bild und ohne Muenzstrom', bild(t).length === 0 && flug(t).length === 0);
  }
  {
    const t = await fresh();
    lege(t, 0, 0, 0, CARD);
    t.p0.gold = 7; t.p1.gold = 25; t.gs.firstTurnProtectedPlayer = 1;
    await zugbeginn(t, 0);
    check('Anfangsschutz des Gegners (erster Zug) → Fehlschlag, nichts bewegt sich', t.p0.gold === 7 && t.p1.gold === 25 && bild(t).length === 0, [t.p0.gold, t.p1.gold, bild(t).length]);
  }

  console.log('Nur im EIGENEN Zug, jede Mimic fuer sich');
  {
    const t = await fresh();
    lege(t, 0, 0, 0, CARD);
    t.p0.gold = 0; t.p1.gold = 40;
    await zugbeginn(t, 1);
    check('Zugbeginn des GEGNERS → die Mimic schweigt', t.p0.gold === 0 && t.p1.gold === 40 && bild(t).length === 0, [t.p0.gold, t.p1.gold]);
  }
  {
    const t = await fresh();
    lege(t, 0, 0, 0, CARD); lege(t, 0, 1, 1, CARD);
    t.p0.gold = 0; t.p1.gold = 100;
    await zugbeginn(t, 0);
    check('zwei Mimics → 20 Gold (jede stiehlt fuer sich)', t.p0.gold === 20 && t.p1.gold === 80, [t.p0.gold, t.p1.gold]);
  }
  {
    const t = await fresh();
    lege(t, 0, 0, 0, CARD); lege(t, 0, 1, 1, CARD);
    t.p0.gold = 0; t.p1.gold = 14;
    await zugbeginn(t, 0);
    check('zwei Mimics, Gegner hat 14 → erste holt 10, zweite nur die uebrigen 4 (nie ueber den Besitz hinaus)', t.p0.gold === 14 && t.p1.gold === 0, [t.p0.gold, t.p1.gold]);
  }
  {
    const t = await fresh();
    const inst = lege(t, 1, 0, 0, CARD);            // die Mimic steht physisch beim Gegner (Sitz 1) …
    t.p0.gold = 50; t.p1.gold = 0;
    inst.stolenBy = 0;                               // … ist aber gestohlen (Deepsea Succubus & Co.): Sitz 0 kontrolliert sie
    await zugbeginn(t, 0);
    check('uebernommene Mimic stiehlt fuer ihren neuen Kontrolleur (Sitz 0) von DEM GEGNER DES KONTROLLEURS (Sitz 1: 0 Gold → nichts)', t.p0.gold === 50 && t.p1.gold === 0, [t.p0.gold, t.p1.gold]);
    t.p1.gold = 30; await zugbeginn(t, 0);
    check('…und mit Gold beim Sitz-1-Besitzer: 10 gehen an den Kontrolleur', t.p0.gold === 60 && t.p1.gold === 20, [t.p0.gold, t.p1.gold]);
    check('…das Bild liegt auf der PHYSISCHEN Seite der Mimic (Sitz 1)', bild(t).length === 1 && bild(t)[0].data.originOwner === 1 && bild(t)[0].data.targets[0].owner === 1, bild(t));
  }

  console.log('Sperren');
  {
    const t = await fresh();
    const inst = lege(t, 0, 0, 0, CARD);
    inst.counters.frozen = 1;
    t.p0.gold = 0; t.p1.gold = 40;
    await zugbeginn(t, 0);
    check('eine GEFRORENE Mimic stiehlt nicht', t.p0.gold === 0 && t.p1.gold === 40, [t.p0.gold, t.p1.gold]);
    delete inst.counters.frozen;
    await zugbeginn(t, 0);
    check('aufgetaut stiehlt sie wieder', t.p0.gold === 10 && t.p1.gold === 30, [t.p0.gold, t.p1.gold]);
  }

  console.log(fails ? `\n${fails} FEHLER` : '\nAlles gruen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
