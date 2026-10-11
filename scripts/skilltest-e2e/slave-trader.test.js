'use strict';
// Slave Trader (Creature, Normal, Lv0, 50 HP, Summoning Magic): „You may discard a level 3 Creature from your hand to summon this Creature as an
// additional Action. You may once per turn reveal the top card of your deck. If it is a Creature, immediately summon it as an additional Action with any
// of your Heroes, if possible. Otherwise, put it on top or bottom of your deck (your choice)."
// Geprüft wird der ECHTE Spielweg (`host.doPlayCreature`, `host.doActivateCreatureEffect`) mit gescripteten Antworten.
//   node scripts/skilltest-e2e/slave-trader.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const ST = 'Slave Trader';
const DB = require('../../cards/effects/_card-db').getCardDB();
const LV3 = Object.values(DB).filter(c => c.cardType === 'Creature' && c.level === 3 && c.subtype === 'Normal' && !/Token|Race Boat/.test(c.name) && c.spellSchool1 === 'Summoning Magic').sort((a, b) => a.name.localeCompare(b.name))[0].name;
const LV2 = Object.values(DB).filter(c => c.cardType === 'Creature' && c.level === 2 && c.subtype === 'Normal' && !/Token|Race Boat/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name))[0].name;
const LV3_SPELL = Object.values(DB).filter(c => c.cardType === 'Spell' && c.level === 3 && c.subtype === 'Normal').sort((a, b) => a.name.localeCompare(b.name))[0].name;
const SPELL = Object.values(DB).filter(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level <= 1).sort((a, b) => a.name.localeCompare(b.name))[0].name;
const KEG = 'Powder Keg';

async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = [];
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
  }
  p0.mainDeck = [...(opts.deck || [SPELL, SPELL, SPELL])];
  const t = { room, host, engine, gs, p0, p1, events: [], prompts: [], antwort: null, logs: [] };
  const origPg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => {
    t.prompts.push({ pi, d });
    if (t.antwort) { const a = t.antwort(pi, d); if (a !== undefined) return a; }
    return origPg(pi, d, ...r);
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, d) => { t.logs.push({ type, d }); return origLog(type, d); };
  return t;
}
let t;
function setzeHand(names) { t.p0.hand = [...names]; for (const n of names) t.engine._trackCard(n, 0, 'hand'); }
const spiele = (handIndex = 0, zoneSlot = 0) => t.host.doPlayCreature(t.room, 0, { cardName: ST, handIndex, heroIdx: 0, zoneSlot });
const aufBrett = (name = ST) => t.engine.cardInstances.some(c => c.name === name && c.zone === 'support');
const kostenPrompt = () => t.prompts.filter(p => p.d.type === 'forceDiscardCancellable' && p.d.title === ST);
const zahle = (name) => (pi, d) => (d.type === 'forceDiscardCancellable' && d.title === ST) ? { cardName: name, handIndex: d.eligibleIndices.find(ix => t.p0.hand[ix] === name) } : undefined;
const log = (typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const anims = (typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === typ).map(e => e.data);
const reveal = () => t.events.filter(e => e.ev === 'mill_center_reveal').map(e => e.data);
const aktivieren = (slot = 0) => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: slot });
function legeST(slot = 0, heroIdx = 0) {
  const inst = t.engine._trackCard(ST, 0, 'support', heroIdx, slot);
  t.p0.supportZones[heroIdx][slot] = [ST];
  inst.turnPlayed = 1;
  return inst;
}
const topBottom = (oben) => (pi, d) => (d.type === 'confirm' && d.title === ST && d._topOrBottom) ? (oben ? true : false) : undefined;
const karteAuf = (name, hi, slot) => t.engine.cardInstances.find(c => c.name === name && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === slot);
/** Eine Lv0-Creature, die der Held ohne Fähigkeiten tatsächlich beschwören darf — die erste, die die Engine akzeptiert. */
function findeBeschwoerbare() {
  const s = loadCardEffect(ST);
  const kand = Object.values(DB).filter(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0).sort((a, b) => a.name.localeCompare(b.name));
  for (const c of kand) if (s._test.moeglicheZonen(t.engine, 0, c.name).length > 0) return c.name;
  return null;
}

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[ST], s = loadCardEffect(ST);
    check('Creature, Normal, Lv0, Summoning Magic, 50 HP', cd && cd.cardType === 'Creature' && cd.subtype === 'Normal' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: Lv-3-Creature abwerfen → Zusatzaktion; 1×/Zug aufdecken, Creature sofort beschwören', cd && /^You may discard a level 3 Creature from your hand to summon this Creature as an additional Action\. You may once per turn reveal the top card of your deck\. If it is a Creature, immediately summon it as an additional Action with any of your Heroes, if possible\. Otherwise, put it on top or bottom of your deck \(your choice\)\.$/.test(cd.effect), cd && cd.effect);
    check('Skript: `inherentAction` (Funktion), `beforeSummon`, Kreatureneffekt', typeof s.inherentAction === 'function' && typeof s.beforeSummon === 'function' && s.creatureEffect === true && typeof s.canActivateCreatureEffect === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst nativ 76×51 im Index und als Datei', idx[ST] && idx[ST].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[ST].id + '.png')));
  }
  console.log(`(Testkarten: Lv3-Creature ${LV3}, Lv2-Creature ${LV2}, Lv3-Spell ${LV3_SPELL}, Spell ${SPELL})`);

  console.log('inherentAction je Lage');
  {
    const s = loadCardEffect(ST);
    t = await fresh({ phase: 2 });
    const ia = () => s.inherentAction(t.gs, 0, 0, t.engine);
    check('Main Phase, nichts Passendes auf der Hand: nein', ia() === false);
    t.p0.hand = [LV2, LV3_SPELL, SPELL];
    check('Main Phase, nur Lv-2-Creature / Lv-3-SPELL / Spell: nein (es muss eine Lv-3-CREATURE sein)', ia() === false);
    t.p0.hand = [LV3];
    check('Main Phase, Lv-3-Creature auf der Hand: ja', ia() === true);
    t.p0.hand = []; t.p0.discardPile = [LV3];
    check('die Creature muss auf der HAND liegen (Ablage zählt nicht)', ia() === false);
    t.p0.hand = [LV3]; t.gs.currentPhase = 3;
    check('Action Phase mit freier Aktion: nein (beide Wege möglich — `beforeSummon` fragt)', ia() === false);
    t.p0.heroesActedThisTurn = [0];
    check('Action Phase, Aktion schon verbraucht: ja (die Zusatzaktion ist der einzige Weg)', ia() === true);
  }

  console.log('Beschwörung mit Abwurf');
  {
    t = await fresh({ phase: 2 });
    setzeHand([ST, LV3, LV2]);
    t.antwort = zahle(LV3);
    const r = await spiele();
    const p = kostenPrompt()[0];
    check('Main Phase: die Beschwörung läuft, der Händler liegt auf dem Brett', r !== false && aufBrett(), r);
    check('die Abfrage markiert NUR die Lv-3-Creature (nicht die Lv-2-Creature, nicht den Händler)', !!p && p.d.eligibleIndices.length === 1 && [ST, LV3, LV2][p.d.eligibleIndices[0]] === LV3, p && p.d.eligibleIndices);
    check('die Lv-3-Creature liegt in der ABLAGE, die Lv-2-Creature bleibt auf der Hand, der Held gilt nicht als gehandelt', t.p0.discardPile.includes(LV3) && t.p0.hand.includes(LV2) && !t.p0.hand.includes(LV3) && t.p0.heroesActedThisTurn.length === 0, { abl: t.p0.discardPile, hand: t.p0.hand, acted: t.p0.heroesActedThisTurn });
  }
  {
    t = await fresh({ phase: 2 });
    setzeHand([ST, LV3]);
    t.antwort = (pi, d) => (d.type === 'forceDiscardCancellable' && d.title === ST) ? { cancelled: true } : undefined;
    await spiele();
    check('Abbruch: keine Beschwörung, alles bleibt auf der Hand', !aufBrett() && t.p0.hand.includes(ST) && t.p0.hand.includes(LV3) && t.p0.discardPile.length === 0, { hand: t.p0.hand });
    t = await fresh({ phase: 2 });
    setzeHand([ST, LV2]);
    const r = await spiele();
    check('Main Phase ohne Lv-3-Creature: nicht spielbar', r === false && !aufBrett(), r);
  }
  {
    t = await fresh({ phase: 3 });
    setzeHand([ST, LV3]);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === ST) ? true : zahle(LV3)(pi, d);
    await spiele();
    check('Action Phase, „Special“: abgeworfen, Händler auf dem Brett, die Aktion ist ZURÜCK', aufBrett() && t.p0.discardPile.includes(LV3) && t.p0.heroesActedThisTurn.length === 0 && t.gs.currentPhase === 3, { abl: t.p0.discardPile, acted: t.p0.heroesActedThisTurn });
    check('die Frage nannte beide Wege und war nicht gerrymander-fähig', t.prompts.some(p => p.d.type === 'confirm' && p.d.title === ST && /Special/.test(p.d.confirmLabel) && /Normal/.test(p.d.cancelLabel) && p.d.gerrymanderEligible === false && p.d.equalButtons === true));
    t = await fresh({ phase: 3 });
    setzeHand([ST, LV3]);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === ST) ? false : undefined;
    await spiele();
    check('Action Phase, „Normal“: kein Abwurf, die Aktion des Helden ist VERBRAUCHT', aufBrett() && t.p0.discardPile.length === 0 && t.p0.hand.includes(LV3) && t.p0.heroesActedThisTurn.length === 1, { acted: t.p0.heroesActedThisTurn });
    t = await fresh({ phase: 3 });
    setzeHand([ST, LV3]);
    t.p0.heroesActedThisTurn = [0];
    t.antwort = zahle(LV3);
    await spiele();
    check('Aktion schon verbraucht: KEINE Zweiwegefrage, die Lv-3-Creature wird verlangt (Pflicht)', aufBrett() && t.p0.discardPile.includes(LV3) && !t.prompts.some(p => p.d.type === 'confirm' && p.d.title === ST), { abl: t.p0.discardPile });
  }

  console.log('Einmal pro Zug: oberste Karte aufdecken, Creature sofort beschwören');
  {
    t = await fresh({ phase: 2 });
    const KRE = findeBeschwoerbare();
    check(`Testkreatur gefunden (${KRE})`, !!KRE);
    t.p0.mainDeck = [KRE, SPELL, SPELL, SPELL];
    // alle Zonen außer einer besetzen → genau EINE Zone → direkt
    legeST(0, 0);
    for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) if (!(h === 0 && z === 0) && !(h === 1 && z === 1)) t.p0.supportZones[h][z] = ['Platzhalter'];
    t.p0.supportZones[0][0] = [ST];
    const r = await aktivieren();
    check('die Aktivierung läuft', r !== false, r);
    const inst = karteAuf(KRE, 1, 1);
    check('die aufgedeckte Creature steht in der EINZIGEN freien Zone (Held 1, Platz 1) — ohne Zonenwahl', !!inst && !t.prompts.some(p => p.d.type === 'zonePick'), inst && { h: inst.heroIdx, z: inst.zoneSlot });
    check('sie kam vom Deck (nächste Karte oben, Deck um eins kürzer), das Deck wurde NICHT gemischt', t.p0.mainDeck.join() === [SPELL, SPELL, SPELL].join(), t.p0.mainDeck);
    check('es war eine Zusatzaktion: der Held gilt nicht als gehandelt', t.p0.heroesActedThisTurn.length === 0, t.p0.heroesActedThisTurn);
    const rv = reveal();
    check('Aufdecken: Flug Deck → Mitte → auf den Brettplatz (`dest: support`, Held 1, Platz 1)', rv.length === 1 && rv[0].cardNames[0] === KRE && rv[0].dest === 'support' && rv[0].destHeroIdx === 1 && rv[0].destSlotIdx === 1, rv);
    const a = anims('slave_chains');
    check('Animation `slave_chains` als Brett-Animation mit dem Händler als Ursprung UND Ziel', a.length === 1 && a[0].zoneType === 'board' && a[0].originHeroIdx === 0 && a[0].originZoneSlot === 0 && a[0].targets[0].zoneSlot === 0, a);
    check('Log `slave_trader`: beschworen', log('slave_trader').some(l => l.card === KRE && l.summoned === true), log('slave_trader'));
    check('keine „oben oder unten“-Frage, wenn beschworen wurde', !t.prompts.some(p => p.d._topOrBottom));
    const r2 = await aktivieren();
    check('ein zweiter Einsatz DESSELBEN Händlers im selben Zug ist gesperrt', r2 === false || t.p0.mainDeck.length === 3, { r2, deck: t.p0.mainDeck });
  }
  {
    t = await fresh({ phase: 2 });
    const KRE = findeBeschwoerbare();
    t.p0.mainDeck = [KRE, SPELL];
    legeST(0, 0);
    t.engine._fastMode = false; t.engine._delay = async () => {};     // die Sim steht auf Fast-Mode: dort gibt es keine Stapelflüge (`_pileFlight`)
    t.antwort = (pi, d) => d.type === 'zonePick' && d.title === ST ? { heroIdx: 2, slotIdx: 1 } : undefined;
    await aktivieren();
    const zp = t.prompts.filter(p => p.d.type === 'zonePick' && p.d.title === ST);
    check('mehrere mögliche Zonen: der Spieler wählt NACH dem Aufdecken (Zonenwahl mit Kartenvorschau, nicht abbrechbar)', zp.length === 1 && zp[0].d.previewCardName === KRE && zp[0].d.cancellable === false && zp[0].d.zones.length > 3, zp.map(p => ({ prev: p.d.previewCardName, n: p.d.zones.length })));
    check('die Creature steht in der gewählten Zone (Held 2, Platz 1)', !!karteAuf(KRE, 2, 1), t.engine.cardInstances.filter(c => c.name === KRE).map(c => [c.zone, c.heroIdx, c.zoneSlot]));
    check('der Aufdeck-Flug ging zurück ins Deck (`dest: deck`), danach flog sie aus dem Deck an ihren Platz', reveal().length === 1 && reveal()[0].dest === 'deck' && t.events.some(e => e.ev === 'play_pile_transfer' && e.data.cardName === KRE && e.data.from === 'deck' && e.data.to === 'support'), reveal());
  }
  {
    // „if possible" scheitert: Lv-3-Creature, aber kein Held hat die Schule → oben/unten
    t = await fresh({ phase: 2, deck: [LV3, SPELL, SPELL] });
    legeST(0, 0);
    t.antwort = topBottom(false);
    await aktivieren();
    check('unbeschwörbare Creature (kein Held erfüllt Lv3): nicht beschworen, die Frage „oben oder unten?“ folgt', !aufBrett(LV3) && t.prompts.filter(p => p.d._topOrBottom).length === 1, t.prompts.map(p => p.d.type));
    check('„Bottom“: die Karte liegt unten im Deck', t.p0.mainDeck.join() === [SPELL, SPELL, LV3].join(), t.p0.mainDeck);
    check('Log: nicht beschworen, unten', log('slave_trader').some(l => l.card === LV3 && l.summoned === false && l.placed === 'bottom'), log('slave_trader'));
  }
  {
    t = await fresh({ phase: 2, deck: [KEG, SPELL] });
    legeST(0, 0);
    t.antwort = topBottom(true);
    await aktivieren();
    check('Artifact Creature (Powder Keg) wird nicht von fremden Effekten platziert: nicht beschworen, „Top“ lässt sie oben', !aufBrett(KEG) && t.p0.mainDeck[0] === KEG && t.prompts.some(p => p.d._topOrBottom), t.p0.mainDeck);
  }
  {
    t = await fresh({ phase: 2, deck: [SPELL, LV3] });
    legeST(0, 0);
    t.antwort = topBottom(false);
    await aktivieren();
    check('kein Creature oben (Spell): keine Beschwörung, „oben oder unten?“ — „Bottom“', t.p0.mainDeck.join() === [LV3, SPELL].join() && !t.prompts.some(p => p.d.type === 'zonePick'), t.p0.mainDeck);
  }
  {
    t = await fresh({ phase: 2 });
    const KRE = findeBeschwoerbare();
    t.p0.mainDeck = [KRE, SPELL];
    legeST(0, 0);
    for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) if (!(h === 0 && z === 0)) t.p0.supportZones[h][z] = ['Platzhalter'];
    t.antwort = topBottom(true);
    await aktivieren();
    check('alle Zonen belegt: nicht beschwörbar („if possible“), „oben oder unten?“ — die Karte bleibt oben', t.p0.mainDeck[0] === KRE && !aufBrett(KRE) && t.prompts.some(p => p.d._topOrBottom), t.p0.mainDeck);
  }
  {
    t = await fresh({ phase: 2 });
    const KRE = findeBeschwoerbare();
    t.p0.mainDeck = [KRE, SPELL];
    legeST(0, 0);
    t.p0.summonLocked = true;
    t.antwort = topBottom(true);
    await aktivieren();
    check('Beschwörungssperre: nicht beschwörbar — nur „oben oder unten?“', !aufBrett(KRE) && t.prompts.some(p => p.d._topOrBottom), t.prompts.map(p => p.d.type));
  }
  {
    t = await fresh({ phase: 2, deck: [] });
    legeST();
    await aktivieren();
    check('leeres Deck: nicht aktivierbar, keine Frage', t.prompts.length === 0 && !log('slave_trader').length);
  }

  console.log('CPU-Antworten');
  {
    const s = loadCardEffect(ST);
    t = await fresh();
    check('wählt „Special“ statt „Normal“', (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: ST, message: `Choose how to summon ${ST}:` }) || {}).confirmed === true);
    t.engine._cpuPlayerIdx = 0;
    t.p0.mainDeck = [SPELL, LV3, LV2];
    t.engine._cpuEstimateHandValue = (pi, n) => (n === LV3 ? 10 : n === LV2 ? 8 : 1);
    check('legt eine schwache Karte nach UNTEN, eine gute OBEN', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: ST, message: 'x', _topOrBottom: true, showCard: SPELL }) === null && (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: ST, message: 'x', _topOrBottom: true, showCard: LV3 }) || {}).confirmed === true);
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: 'Anderes', message: 'x' }) === undefined);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Slave-Trader-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
