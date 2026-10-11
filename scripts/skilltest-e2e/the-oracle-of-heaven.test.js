'use strict';
// The Oracle of Heaven (Creature, Normal, Lv0, 50 HP, Summoning Magic): „You may once per turn declare a card name and reveal the top card of your deck. If it is a
// card with the declared name, add it to your hand and draw 2 cards. Otherwise, send it and the top 2 cards below it from your deck to your discard pile."
// Geprüft wird der ECHTE Aktivierungsweg (`host.doActivateCreatureEffect`) mit gescripteten Antworten auf die Namenswahl.
//   node scripts/skilltest-e2e/the-oracle-of-heaven.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const OR = 'The Oracle of Heaven';
const DB = require('../../cards/effects/_card-db').getCardDB();
const [A, B, C, D, E] = Object.values(DB).filter(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level <= 1 && !/Token/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 5).map(c => c.name);

async function fresh(deck) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = 2; gs.firstTurnProtectedPlayer = null;
  gs.skillTest = null;                                           // die Sim läuft als Skill Test: dessen Ziehen füllt/leert das Deck selbst — hier zählt das echte Deck
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = [];
  }
  // Codumbus (einer der Sim-Helden) greift in JEDES Ziehen ein (eigene Deklarier-/Mill-Regel) — hier negiert, damit nur das Orakel das Deck bewegt.
  for (const ps of [p0, p1]) for (const h of ps.heroes) if (/Codumbus/.test(h.name || '')) h.statuses = { negated: 1 };
  p0.mainDeck = [...(deck || [A, B, C, D, E])];
  engine._fastMode = false; engine._delay = async () => {};      // kein Fast-Mode: Hooks laufen wie im Spiel
  const t = { room, host, engine, gs, p0, p1, events: [], prompts: [], antwort: null, logs: [] };
  const origPg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => {
    t.prompts.push({ pi, d });
    if (t.antwort) { const a = t.antwort(pi, d); if (a !== undefined) return a; }
    return origPg(pi, d, ...r);
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data, opts: r[0] }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, d) => { t.logs.push({ type, d }); return origLog(type, d); };
  return t;
}
let t;
function legeOR(slot = 0, heroIdx = 0) {
  const inst = t.engine._trackCard(OR, 0, 'support', heroIdx, slot);
  t.p0.supportZones[heroIdx][slot] = [OR];
  inst.turnPlayed = 1;
  return inst;
}
const aktivieren = (slot = 0) => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: slot });
// Die Sim-Helden (Codumbus …) fragen beim Ziehen nach: abgelehnt, damit nur der Effekt des Orakels das Deck bewegt.
const sage = (name) => (pi, d) => (d.type === 'cardNamePicker' && d.title === OR) ? { cardName: name } : (d.type === 'confirm' && d.title !== OR ? { confirmed: false } : undefined);
const log = (typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const anims = (typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === typ).map(e => e.data);
const reveals = () => t.events.filter(e => e.ev === 'mill_center_reveal').map(e => e.data);

(async () => {
  console.log('Karte und Skript');
  {
    const cd = DB[OR], s = loadCardEffect(OR);
    check('Creature, Normal, Lv0 (vorher höher), 50 HP, Summoning Magic', cd && cd.cardType === 'Creature' && cd.subtype === 'Normal' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: neuer Wortlaut („and“ statt des Tippfehlers „end“)', cd && /^You may once per turn declare a card name and reveal the top card of your deck\. If it is a card with the declared name, add it to your hand and draw 2 cards\. Otherwise, send it and the top 2 cards below it from your deck to your discard pile\.$/.test(cd.effect), cd && cd.effect);
    check('Skript: Kreatureneffekt mit Deck-Gate und CPU-Antwort', s && s.creatureEffect === true && typeof s.canActivateCreatureEffect === 'function' && typeof s.cpuResponse === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst im Index und als Datei', idx[OR] && idx[OR].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[OR].id + '.png')));
  }

  console.log('Treffer: auf die Hand, 2 Karten ziehen');
  {
    t = await fresh([A, B, C, D, E]);
    legeOR();
    t.antwort = sage(A);
    const r = await aktivieren();
    check('die Aktivierung läuft', r !== false, r);
    const np = t.prompts.filter(p => p.d.type === 'cardNamePicker' && p.d.title === OR);
    check('die Ansage ist ein Namenspicker über alle Karten (ohne Token) und abbrechbar', np.length === 1 && np[0].d.cancellable === true && np[0].d.cardNames.includes(A) && np[0].d.cardNames.every(n => DB[n] && DB[n].cardType !== 'Token'), np.length && { n: np[0].d.cardNames.length });
    check('die aufgedeckte Karte (A) kam auf die Hand, danach wurden zwei gezogen (B, C)', t.p0.hand.join() === [A, B, C].join(), t.p0.hand);
    check('das Deck hat die drei Karten verloren, Rest D, E; die Ablage bleibt leer', t.p0.mainDeck.join() === [D, E].join() && t.p0.discardPile.length === 0, { deck: t.p0.mainDeck, abl: t.p0.discardPile });
    const rv = reveals();
    check('Aufdecken: die oberste Karte fliegt in die Bildmitte und von dort in die HAND (`mill_center_reveal`, `dest: hand`)', rv.length === 1 && rv[0].cardNames[0] === A && rv[0].dest === 'hand' && rv[0].owner === 0, rv);
    const ce = t.events.filter(e => e.ev === 'card_reveal');
    check('die Ansage wird dem GEGNER als Kartenbild gezeigt (`card_reveal` nur an Seite 1)', ce.length === 1 && ce[0].data.cardName === A && ce[0].opts && Array.isArray(ce[0].opts.toPlayers) && ce[0].opts.toPlayers.join() === '1', ce.map(e => ({ d: e.data, o: e.opts })));
    const a = anims('oracle_vision');
    check('Animation `oracle_vision` läuft auf dem DECK (Ursprung `originDeck`, Ziel `deck: true`), nicht auf der Creature', a.length === 1 && a[0].zoneType === 'board' && a[0].originDeck === true && a[0].originOwner === 0 && a[0].targets.length === 1 && a[0].targets[0].deck === true && a[0].targets[0].owner === 0 && a[0].originHeroIdx === undefined && a[0].targets[0].zoneSlot === undefined, a);
    check('Logs: Ansage, Aufdecken (Treffer), Gesamtergebnis', log('oracle_declare').some(l => l.declared === A) && log('oracle_reveal').some(l => l.revealed === A && l.hit === true) && log('oracle_of_heaven').some(l => l.hit === true && l.revealed === A), t.logs.map(l => l.type));
    const r2 = await aktivieren();
    check('einmal pro Zug: ein zweiter Einsatz DESSELBEN Orakels ist gesperrt', r2 === false || t.p0.hand.length === 3, { r2, hand: t.p0.hand });
  }

  console.log('Fehlschlag: die Karte und die zwei darunter in die Ablage');
  {
    t = await fresh([A, B, C, D, E]);
    legeOR();
    t.antwort = sage(E);                                       // falsch: oben liegt A
    await aktivieren();
    check('die oberste Karte und die zwei darunter (A, B, C) liegen in der ABLAGE, Reihenfolge von oben nach unten', t.p0.discardPile.join() === [A, B, C].join(), t.p0.discardPile);
    check('das Deck behält D, E; die Hand ist unverändert (nichts gezogen)', t.p0.mainDeck.join() === [D, E].join() && t.p0.hand.length === 0, { deck: t.p0.mainDeck, hand: t.p0.hand });
    const rv = reveals();
    check('Aufdecken: drei Karten NACHEINANDER in der Mitte, jede fliegt dann in die ABLAGE (`dest` nicht Hand/Deck)', rv.length >= 1 && rv.flatMap(r => r.cardNames).join() === [A, B, C].join() && rv.every(r => r.dest !== 'hand'), rv);
    check('Logs: Treffer = nein, drei Karten gemillt', log('oracle_reveal').some(l => l.revealed === A && l.hit === false) && log('oracle_of_heaven').some(l => l.hit === false && (l.milled || []).length === 3), log('oracle_of_heaven'));
    check('kein Abwurf: `onDiscard` feuerte nicht (die Karten wurden GESENDET)', !log('card_discarded').length && !t.events.some(e => e.ev === 'discard_hand_card'), t.logs.map(l => l.type));
  }
  {
    t = await fresh([A, B]);
    legeOR();
    t.antwort = sage(E);
    await aktivieren();
    check('nur zwei Karten im Deck: es geht, was da ist (A, B)', t.p0.discardPile.join() === [A, B].join() && t.p0.mainDeck.length === 0, { abl: t.p0.discardPile, deck: t.p0.mainDeck });
    t = await fresh([A]);
    legeOR();
    t.antwort = sage(E);
    await aktivieren();
    check('nur eine Karte im Deck: sie geht allein in die Ablage', t.p0.discardPile.join() === A && t.p0.mainDeck.length === 0, { abl: t.p0.discardPile });
    t = await fresh([A, B, C]);
    legeOR();
    t.antwort = sage(A);
    await aktivieren();
    check('Treffer mit knappem Deck: A auf die Hand, B und C gezogen, Deck leer', t.p0.hand.join() === [A, B, C].join() && t.p0.mainDeck.length === 0, { hand: t.p0.hand, deck: t.p0.mainDeck });
  }
  {
    // Treffer erkennt den Namen auch dann, wenn die zweite Karte (nicht die oberste) passt — nur die OBERSTE zählt
    t = await fresh([A, B, C]);
    legeOR();
    t.antwort = sage(B);
    await aktivieren();
    check('„B“ angesagt, A liegt oben: nur die oberste zählt → Fehlschlag, alle drei in der Ablage', t.p0.discardPile.join() === [A, B, C].join() && t.p0.hand.length === 0, { abl: t.p0.discardPile, hand: t.p0.hand });
  }

  console.log('Abbruch und Sperren');
  {
    t = await fresh([A, B, C]);
    legeOR();
    t.antwort = (pi, d) => (d.type === 'cardNamePicker' && d.title === OR) ? { cancelled: true } : undefined;
    const r = await aktivieren();
    check('Abbruch der Ansage: nichts passiert, nichts verbraucht (kein Aufdecken, Deck und Hand unverändert, keine Animation)', t.p0.mainDeck.join() === [A, B, C].join() && t.p0.hand.length === 0 && !anims('oracle_vision').length && !reveals().length, { r, deck: t.p0.mainDeck });
    check('…und die Rundensperre ist NICHT gestempelt: ein zweiter Versuch geht', !(t.gs.hoptUsed && Object.keys(t.gs.hoptUsed).some(k => k.startsWith('creature-effect:') && t.gs.hoptUsed[k] === t.gs.turn)), t.gs.hoptUsed);
    t.antwort = sage(A);
    await aktivieren();
    check('zweiter Versuch: A auf die Hand', t.p0.hand.includes(A), t.p0.hand);
  }
  {
    t = await fresh([]);
    legeOR();
    await aktivieren();
    check('leeres Deck: nicht aktivierbar, keine Frage', t.prompts.length === 0 && !log('oracle_declare').length);
  }

  console.log('CPU-Antwort');
  {
    const s = loadCardEffect(OR);
    t = await fresh([A, B, B, C]);
    t.engine._cpuPlayerIdx = 0;
    const r = s.cpuResponse(t.engine, 'generic', { type: 'cardNamePicker', title: OR });
    check('die CPU sagt die häufigste Karte ihres Decks an (B, zwei Kopien)', r && r.cardName === B, r);
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'cardNamePicker', title: 'Anderes' }) === undefined);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ The-Oracle-of-Heaven-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
