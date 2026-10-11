'use strict';
// Breakthrough (Attack, Fighting Lv0): „Send a Surprise from your opponent's side of the board to the discard pile. This counts as an additional Action."
// Ausdruecklich legal: auch OFFENE Surprises, inklusive Surprise-Creatures. Geprueft wird der ECHTE Spielweg (`host.doPlaySpell`) mit gescripteter Zielwahl.
//   node scripts/skilltest-e2e/breakthrough.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Breakthrough';
const DB = require('../../cards/effects/_card-db').getCardDB();
const alle = (pred) => Object.values(DB).filter(pred).map(c => c.name).sort();
const SURP_SPELL = alle(c => c.cardType === 'Spell' && c.subtype === 'Surprise' && !Object.keys(loadCardEffect(c.name)?.hooks || {}).some(h => /Discard|Leave/i.test(h)))[0];
const SURP_KRE = alle(c => c.cardType === 'Creature' && c.subtype === 'Surprise' && c.name !== 'Bakhm, the Desert Digger')[0];
const KRE = alle(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0)[0];
const stapel = (name, n) => Array.from({ length: n }, () => name);

async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = null; gs.skillTest = null;
  const [p0, p1] = gs.players;
  p0.abilityZones = p0.abilityZones.map((_, hi) => [stapel('Fighting', hi === 0 ? (opts.fighting ?? 1) : 0), [], []]);
  p1.abilityZones = p1.abilityZones.map(() => [[], [], []]);
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.discardPile = []; ps.deletedPile = []; ps.hand = []; ps.heroesActedThisTurn = [];
  }
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support' && c.zone !== 'surprise');
  p0.hand = [CARD];
  const t = { room, host, engine, gs, p0, p1, geboten: [], configs: [], events: [], wahl: opts.wahl || ((valid) => [valid[0]]), cancel: false };
  engine._getCpuTargetResponse = (valid, config) => {
    const frei = valid.filter(v => !v.ineligible);
    t.geboten.push(frei.map(v => `${v.owner}:${v.type}:${v.cardName}`)); t.configs.push(config);
    if (t.cancel) return [];
    const w = t.wahl(frei, config);
    return (Array.isArray(w) ? w : (w ? [w] : [])).filter(Boolean).map(x => x.id);
  };
  engine.promptGeneric = async () => undefined;
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  t.logs = [];
  const origLog = engine.log.bind(engine);
  engine.log = (type, data) => { t.logs.push({ type, data }); return origLog(type, data); };
  return t;
}
function legeSupport(t, seat, hi, slot, name, o = {}) {
  t.gs.players[seat].supportZones[hi][slot] = [name];
  const inst = t.engine._trackCard(name, seat, 'support', hi, slot);
  if (o.faceDown) inst.faceDown = true;
  return inst;
}
function legeSurprise(t, seat, hi, name) {
  t.gs.players[seat].surpriseZones[hi] = [name];
  const inst = t.engine._trackCard(name, seat, 'surprise', hi, 0);
  inst.faceDown = true;
  return inst;
}
const spiele = (t, heroIdx = 0) => t.host.doPlaySpell(t.room, 0, { cardName: CARD, handIndex: 0, heroIdx });
const anim = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'breakthrough_shatter');

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Attack, Normal, Lv0, Fighting', cd && cd.cardType === 'Attack' && cd.subtype === 'Normal' && cd.level === 0 && cd.spellSchool1 === 'Fighting', cd);
    check('Kartentext: Surprise der Gegnerseite ablegen, zählt als zusätzliche Aktion', cd && cd.effect === "Send a Surprise from your opponent's side of the board to the discard pile. This counts as an additional Action.", cd && cd.effect);
    check('`inherentAction: true` (unbedingt), `spellPlayCondition`, Blinded-Marke', s.inherentAction === true && typeof s.spellPlayCondition === 'function' && s.requiresTarget === true);
  }
  console.log(`(Testkarten: Surprise-Spell ${SURP_SPELL}, Surprise-Creature ${SURP_KRE}, Kreatur ${KRE})`);

  console.log('Ohne Surprise auf der Gegnerseite: nicht spielbar');
  {
    const t = await fresh();
    legeSupport(t, 1, 0, 0, KRE);
    legeSurprise(t, 0, 0, SURP_SPELL);              // EIGENE Surprise zählt nicht
    check('nur eigene Surprises und eine normale Kreatur → `spellPlayCondition` falsch', loadCardEffect(CARD).spellPlayCondition(t.gs, 0, t.engine) === false);
    const r = await spiele(t);
    check('…der Zug schlägt fehl: Karte bleibt auf der Hand, keine Abfrage', r !== true && t.p0.hand.includes(CARD) && t.geboten.length === 0, { r, geboten: t.geboten });
  }

  console.log('Verdeckte Surprise in der Surprise Zone');
  {
    const t = await fresh();
    const inst = legeSurprise(t, 1, 1, SURP_SPELL);
    check('spielbar, sobald der Gegner eine Surprise hat', loadCardEffect(CARD).spellPlayCondition(t.gs, 0, t.engine) === true);
    const r = await spiele(t);
    check('der Zauber läuft durch', r === true, r);
    check('verdeckte Karten werden dem Wähler NICHT verraten (Name leer)', t.geboten.length === 1 && t.geboten[0].length === 1 && t.geboten[0][0] === '1:surprise:', t.geboten);
    check('die Surprise liegt in der Ablage des Gegners, die Zone ist leer', t.p1.discardPile.includes(SURP_SPELL) && (t.p1.surpriseZones[1] || []).length === 0 && inst.zone !== 'surprise', { abl: t.p1.discardPile, sz: t.p1.surpriseZones[1], zone: inst.zone });
    const an = anim(t);
    check('Animation `breakthrough_shatter` auf der Surprise Zone (Brett-Animation, Ziel mit zoneType surprise)', an.length === 1 && an[0].data.zoneType === 'board' && an[0].data.targets.length === 1 && an[0].data.targets[0].zoneType === 'surprise' && an[0].data.targets[0].owner === 1 && an[0].data.targets[0].heroIdx === 1, an);
    check('Breakthrough liegt in der Ablage des Wirkers', t.p0.discardPile.includes(CARD) && t.p0.hand.length === 0, t.p0.discardPile);
    const l = t.logs.find(x => x.type === 'breakthrough');
    check('Log `breakthrough` nennt die Karte', l && l.data.card === SURP_SPELL && l.data.discarded === true, l);
  }

  console.log('Offene Surprise-Creature im Support (ausdrücklich legal)');
  {
    const t = await fresh({ wahl: (v) => [v.find(x => x.type === 'equip')] });
    legeSupport(t, 1, 0, 0, KRE);
    const offen = legeSupport(t, 1, 0, 1, SURP_KRE);
    const r = await spiele(t);
    check('zur Wahl steht NUR die offene Surprise-Creature (nicht die normale Kreatur)', r === true && t.geboten[0].length === 1 && t.geboten[0][0] === `1:equip:${SURP_KRE}`, t.geboten);
    check('sie wird ABGELEGT (nicht besiegt): Ablage des Gegners, Zone frei, normale Kreatur bleibt', offen.zone !== 'support' && t.p1.discardPile.includes(SURP_KRE) && t.p1.supportZones[0][1].length === 0 && t.p1.supportZones[0][0].length === 1, { zone: offen.zone, abl: t.p1.discardPile });
    const an = anim(t);
    check('Animation auf dem Support-Slot der Creature (Held 0, Slot 1)', an.length === 1 && an[0].data.targets[0].zoneSlot === 1 && an[0].data.targets[0].heroIdx === 0 && !an[0].data.targets[0].zoneType, an);
  }
  {
    // Verdeckte Surprise-Creature in der Support Zone (Bakhm-Platz).
    const t = await fresh({ wahl: (v) => [v.find(x => x.type === 'equip')] });
    const verd = legeSupport(t, 1, 0, 0, SURP_KRE, { faceDown: true });
    await spiele(t);
    check('verdeckte Surprise-Creature im Support: wählbar, Name verborgen, danach abgelegt', t.geboten[0] && t.geboten[0][0] === '1:equip:' && verd.zone !== 'support' && t.p1.discardPile.includes(SURP_KRE), { g: t.geboten, zone: verd.zone });
  }

  console.log('Mehrere Surprises, Wahl, Abbruch');
  {
    const t = await fresh({ wahl: (v) => [v.find(x => x.type === 'surprise' && x.id.endsWith('-2'))] });
    legeSurprise(t, 1, 0, SURP_SPELL); legeSurprise(t, 1, 2, SURP_SPELL);
    legeSupport(t, 1, 1, 0, SURP_KRE);
    await spiele(t);
    check('drei Surprises zur Wahl (zwei verdeckt, eine offen), gewählt wird die in Spalte 2', t.geboten[0].length === 3, t.geboten);
    check('genau die gewählte ist weg, die anderen bleiben', (t.p1.surpriseZones[2] || []).length === 0 && (t.p1.surpriseZones[0] || []).length === 1 && t.p1.supportZones[1][0].length === 1, { sz: t.p1.surpriseZones, sup: t.p1.supportZones[1] });
  }
  {
    const t = await fresh();
    legeSurprise(t, 1, 0, SURP_SPELL);
    t.cancel = true;
    const r = await spiele(t);
    check('Abfrage abgebrochen: nichts abgelegt, Karte bleibt auf der Hand', r === true && t.p0.hand.includes(CARD) && (t.p1.surpriseZones[0] || []).length === 1 && anim(t).length === 0, { r, hand: t.p0.hand });
  }
  {
    const t = await fresh();
    const fest = legeSurprise(t, 1, 0, SURP_SPELL); fest.counters.immovable = 1;
    check('unbewegliche Surprise: kein Ziel → Karte nicht spielbar', loadCardEffect(CARD).spellPlayCondition(t.gs, 0, t.engine) === false);
  }

  console.log('Zusatzaktion');
  {
    const t = await fresh({ phase: 2 });
    legeSurprise(t, 1, 0, SURP_SPELL);
    check('`cardHasInherentAction` wahr (unbedingt)', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === true);
    await spiele(t);
    check('Main Phase 1: die Aktion bleibt frei (Phase unverändert, Held nicht „acted“)', t.gs.currentPhase === 2 && !t.p0.heroesActedThisTurn.includes(0) && !t.gs._pendingActionBurn, { ph: t.gs.currentPhase, acted: t.p0.heroesActedThisTurn, burn: t.gs._pendingActionBurn });
  }

  console.log('CPU-Entscheidung der Karte');
  {
    const t = await fresh();
    const s = loadCardEffect(CARD);
    const offen = { id: 'equip-1-0-1', type: 'equip', owner: 1, heroIdx: 0, slotIdx: 1, cardName: SURP_KRE };
    const verd = { id: 'surprise-1-2', type: 'surprise', owner: 1, heroIdx: 2, cardName: '' };
    const r1 = s.cpuResponse(t.engine, 'effectTarget', { validTargets: [verd, offen], config: { title: CARD }, playerIdx: 0 });
    check('die CPU nimmt die bekannte offene Surprise zuerst', JSON.stringify(r1) === JSON.stringify(['equip-1-0-1']), r1);
    const r2 = s.cpuResponse(t.engine, 'effectTarget', { validTargets: [verd], config: { title: CARD }, playerIdx: 0 });
    check('nur verdeckte: sie nimmt eine davon', JSON.stringify(r2) === JSON.stringify(['surprise-1-2']), r2);
  }

  console.log(fails === 0 ? '\nALLE GRÜN' : `\n${fails} FEHLER`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
