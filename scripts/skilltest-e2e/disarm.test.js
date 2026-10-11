'use strict';
// Disarm (Spell, Decay Magic + Magic Arts Lv1): „Choose any number of Artifacts equipped to one Hero (at least 1) and delete them. This counts as an
// additional Action." Geprueft wird der ECHTE Spielweg (`host.doPlaySpell`) mit gescripteter Zielwahl: Heldenwahl, Artefaktwahl (mindestens 1), Loeschen
// in den Deleted Pile des URSPRUENGLICHEN Besitzers, die unbedingte Zusatzaktion und die Karten-CPU.
//   node scripts/skilltest-e2e/disarm.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Disarm';
const DB = require('../../cards/effects/_card-db').getCardDB();
const eqNamen = Object.values(DB)
  .filter(c => c.cardType === 'Artifact' && c.subtype === 'Equipment' && !loadCardEffect(c.name)?.canEquipToHero && !Object.keys(loadCardEffect(c.name)?.hooks || {}).length)
  .map(c => c.name).sort();
const [EQ1, EQ2, EQ3] = eqNamen;
const KRE = Object.values(DB).filter(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0).map(c => c.name).sort()[0];
const stapel = (name, n) => Array.from({ length: n }, () => name);

/** Sitz 0 wirkt (Decay Magic `dc`, Magic Arts `ma` an Held 0), Sitz 1 traegt die Ausruestung. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = null; gs.skillTest = null;
  const [p0, p1] = gs.players;
  p0.abilityZones = p0.abilityZones.map((_, hi) => [stapel('Decay Magic', hi === 0 ? (opts.dc ?? 1) : 0), stapel('Magic Arts', hi === 0 ? (opts.ma ?? 0) : 0), []]);
  p1.abilityZones = p1.abilityZones.map(() => [[], [], []]);
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.discardPile = []; ps.deletedPile = []; ps.hand = []; ps.heroesActedThisTurn = [];
  }
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support');
  p0.hand = [CARD];
  const t = { room, host, engine, gs, p0, p1, geboten: [], configs: [], events: [], wahl: opts.wahl || ((valid) => valid), cancel: false };
  // Sitz 0 ist ein Bot: die Zielwahl laeuft durch den echten Dispatcher bis zur CPU-Antwort — die ist hier gescriptet (liefert eine LISTE von Zielen).
  engine._getCpuTargetResponse = (valid, config) => {
    const frei = valid.filter(v => !v.ineligible);
    t.geboten.push(frei.map(v => `${v.owner}:${v.type}:${v.cardName}`)); t.configs.push(config);
    if (t.cancel) return [];
    const w = t.wahl(frei, config);
    return (Array.isArray(w) ? w : (w ? [w] : [])).map(x => x.id);
  };
  engine.promptGeneric = async () => undefined;
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const logs = [];
  const origLog = engine.log.bind(engine);
  engine.log = (type, data) => { logs.push({ type, data }); return origLog(type, data); };
  t.logs = logs;
  return t;
}
function lege(t, seat, hi, slot, name, orig) {
  t.gs.players[seat].supportZones[hi][slot] = [name];
  const inst = t.engine._trackCard(name, seat, 'support', hi, slot);
  if (orig != null) inst.originalOwner = orig;
  return inst;
}
const spiele = (t, heroIdx = 0) => t.host.doPlaySpell(t.room, 0, { cardName: CARD, handIndex: 0, heroIdx });
const anim = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'disarm_snap');
const imBrett = (t, seat, hi, slot) => (t.gs.players[seat].supportZones[hi][slot] || []).length > 0;

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Spell, Normal, Lv1, Decay Magic + Magic Arts (nicht mehr Attack/Surprise/Fighting)', cd && cd.cardType === 'Spell' && cd.subtype === 'Normal' && cd.level === 1 && cd.spellSchool1 === 'Decay Magic' && cd.spellSchool2 === 'Magic Arts', cd);
    check('Kartentext: beliebig viele Artefakte EINES Helden (mindestens 1) löschen, zählt als zusätzliche Aktion', cd && cd.effect === 'Choose any number of Artifacts equipped to one Hero (at least 1) and delete them. This counts as an additional Action.', cd && cd.effect);
    check('`inherentAction: true` (unbedingt), `spellPlayCondition`, Blinded-Marke `requiresTarget`', s.inherentAction === true && typeof s.spellPlayCondition === 'function' && s.requiresTarget === true);
  }
  console.log(`(Testkarten: Ausrüstung ${EQ1}, ${EQ2}, ${EQ3}; Kreatur ${KRE})`);

  console.log('Ohne Ausrüstung: nicht spielbar');
  {
    const t = await fresh();
    lege(t, 1, 0, 0, KRE);
    check('nur eine Kreatur auf dem Brett → `spellPlayCondition` falsch', loadCardEffect(CARD).spellPlayCondition(t.gs, 0, t.engine) === false);
    const r = await spiele(t);
    check('…der Zug schlägt fehl: Karte bleibt auf der Hand, keine Abfrage', r !== true && t.p0.hand.includes(CARD) && t.geboten.length === 0, { r, geboten: t.geboten });
  }

  console.log('Ein Held, alle Artefakte');
  {
    const t = await fresh();
    const a = lege(t, 1, 0, 0, EQ1), b = lege(t, 1, 0, 1, EQ2);
    check('mit Ausrüstung am Gegner-Helden ist die Karte spielbar', loadCardEffect(CARD).spellPlayCondition(t.gs, 0, t.engine) === true);
    const r = await spiele(t);
    check('der Zauber läuft durch', r === true, r);
    check('es gibt nur EINEN Helden mit Ausrüstung → keine Heldenfrage, direkt die zwei Artefakte', t.geboten.length === 1 && t.geboten[0].length === 2 && t.geboten[0].every(x => x.startsWith('1:equip:')), t.geboten);
    check('Abfrage: mindestens 1, höchstens alle (minRequired 1, maxTotal 2)', t.configs[0].minRequired === 1 && t.configs[0].maxTotal === 2, t.configs[0]);
    check('beide Artefakte sind vom Brett', !imBrett(t, 1, 0, 0) && !imBrett(t, 1, 0, 1) && a.zone !== 'support' && b.zone !== 'support', { a: a.zone, b: b.zone });
    check('GELÖSCHT (Deleted Pile), nicht abgeworfen', t.p1.deletedPile.includes(EQ1) && t.p1.deletedPile.includes(EQ2) && !t.p1.discardPile.includes(EQ1) && !t.p1.discardPile.includes(EQ2), { del: t.p1.deletedPile, abl: t.p1.discardPile });
    const an = anim(t);
    check('Animation `disarm_snap` (Brett-Animation) mit beiden Artefakten als Ziel', an.length === 1 && an[0].data.zoneType === 'board' && an[0].data.targets.length === 2 && an[0].data.targets.every(x => x.owner === 1 && x.heroIdx === 0), an);
    check('Disarm liegt in der Ablage des Wirkers', t.p0.discardPile.includes(CARD) && t.p0.hand.length === 0, { abl: t.p0.discardPile });
    const l = t.logs.find(x => x.type === 'disarm');
    check('Log `disarm` nennt Held und gelöschte Karten', l && Array.isArray(l.data.cards) && l.data.cards.length === 2, l);
  }

  console.log('Nur ein Teil der Artefakte');
  {
    const t = await fresh({ wahl: (v) => [v[0]] });
    lege(t, 1, 0, 0, EQ1); lege(t, 1, 0, 1, EQ2); lege(t, 1, 0, 2, EQ3);
    await spiele(t);
    const noch = [0, 1, 2].filter(s => imBrett(t, 1, 0, s)).length;
    check('gewählt wird eines von dreien: zwei bleiben, eines ist im Deleted Pile', noch === 2 && t.p1.deletedPile.length === 1, { noch, del: t.p1.deletedPile });
  }

  console.log('Zwei Helden mit Ausrüstung: erst der Held');
  {
    const t = await fresh({ wahl: (v, cfg) => (cfg.maxPerType && cfg.maxPerType.hero ? [v.find(x => x.owner === 1 && x.heroIdx === 1)] : v) });
    lege(t, 1, 0, 0, EQ1); lege(t, 1, 1, 0, EQ2); lege(t, 1, 1, 1, EQ3);
    await spiele(t);
    check('erste Abfrage: Helden (beide mit Ausrüstung), zweite: nur die Artefakte des gewählten Helden', t.geboten.length === 2 && t.geboten[0].every(x => x.includes(':hero:')) && t.geboten[0].length === 2 && t.geboten[1].length === 2 && t.geboten[1].every(x => x.startsWith('1:equip:')), t.geboten);
    check('Held 1 ist entwaffnet, Held 0 behält sein Artefakt', imBrett(t, 1, 0, 0) && !imBrett(t, 1, 1, 0) && !imBrett(t, 1, 1, 1), { h0: t.p1.supportZones[0], h1: t.p1.supportZones[1] });
  }
  {
    // Der EIGENE Held und die eigene Ausrüstung sind erlaubt („one Hero", keine Gegnerklausel).
    const t = await fresh({ wahl: (v, cfg) => (cfg.maxPerType && cfg.maxPerType.hero ? [v.find(x => x.owner === 0)] : v) });
    lege(t, 0, 1, 0, EQ1); lege(t, 1, 0, 0, EQ2);
    await spiele(t);
    check('auch ein EIGENER Held darf gewählt werden: seine Ausrüstung ist gelöscht, die des Gegners bleibt', !imBrett(t, 0, 1, 0) && imBrett(t, 1, 0, 0) && t.p0.deletedPile.includes(EQ1), { p0: t.p0.supportZones[1], p1: t.p1.supportZones[0] });
  }

  console.log('Was keine wählbare Ausrüstung ist');
  {
    const t = await fresh();
    const frei = lege(t, 1, 0, 0, EQ1);
    const fest = lege(t, 1, 0, 1, EQ2); fest.counters.immovable = 1;
    lege(t, 1, 0, 2, KRE);
    await spiele(t);
    check('unbewegliche Karten und Kreaturen stehen nicht zur Wahl — nur das freie Artefakt', t.geboten.length === 0 ? imBrett(t, 1, 0, 1) : t.geboten[0].length === 1, t.geboten);
    check('…die unbewegliche Karte und die Kreatur bleiben liegen', imBrett(t, 1, 0, 1) && imBrett(t, 1, 0, 2) && frei.zone !== 'support', { z: t.p1.supportZones[0] });
  }

  console.log('Ablage des ursprünglichen Besitzers');
  {
    const t = await fresh();
    lege(t, 1, 0, 0, EQ1, 0);                       // gehört ursprünglich Sitz 0 (z. B. als Ausrüstung auf den Gegner gelegt)
    await spiele(t);
    check('„deleted“ geht in den Deleted Pile des URSPRÜNGLICHEN Besitzers (Sitz 0)', t.p0.deletedPile.includes(EQ1) && !t.p1.deletedPile.includes(EQ1), { p0: t.p0.deletedPile, p1: t.p1.deletedPile });
  }

  console.log('Abbruch und Zusatzaktion');
  {
    const t = await fresh();
    lege(t, 1, 0, 0, EQ1);
    t.cancel = true;
    const r = await spiele(t);
    check('Abfrage abgebrochen: nichts gelöscht, die Karte bleibt auf der Hand', r === true && t.p0.hand.includes(CARD) && imBrett(t, 1, 0, 0) && t.p1.deletedPile.length === 0 && anim(t).length === 0, { r, hand: t.p0.hand });
  }
  {
    const t = await fresh({ phase: 2 });
    lege(t, 1, 0, 0, EQ1);
    check('`cardHasInherentAction` wahr (unbedingt)', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === true);
    await spiele(t);
    check('Main Phase 1: die Aktion bleibt frei (Phase unverändert, Held nicht „acted“)', t.gs.currentPhase === 2 && !t.p0.heroesActedThisTurn.includes(0) && !t.gs._pendingActionBurn, { ph: t.gs.currentPhase, acted: t.p0.heroesActedThisTurn, burn: t.gs._pendingActionBurn });
  }
  {
    const t = await fresh({ dc: 0, ma: 0 });
    lege(t, 1, 0, 0, EQ1);
    const r = await spiele(t);
    check('ohne Decay Magic/Magic Arts (Summe 0) ist der Lv1-Zauber nicht wirkbar', r !== true && t.p0.hand.includes(CARD) && imBrett(t, 1, 0, 0), { r });
  }
  {
    const t = await fresh({ dc: 0, ma: 1 });
    lege(t, 1, 0, 0, EQ1);
    const r = await spiele(t);
    check('Magic Arts 1 allein genügt (Summe beider Schulen)', r === true && !imBrett(t, 1, 0, 0), { r });
  }

  console.log('CPU-Entscheidung der Karte');
  {
    const t = await fresh();
    lege(t, 0, 1, 0, EQ1); lege(t, 1, 0, 0, EQ2); lege(t, 1, 0, 1, EQ3); lege(t, 1, 1, 0, EQ2);
    const s = loadCardEffect(CARD);
    const heldZiele = [
      { id: 'hero-0-1', type: 'hero', owner: 0, heroIdx: 1, cardName: t.p0.heroes[1].name },
      { id: 'hero-1-0', type: 'hero', owner: 1, heroIdx: 0, cardName: t.p1.heroes[0].name },
      { id: 'hero-1-1', type: 'hero', owner: 1, heroIdx: 1, cardName: t.p1.heroes[1].name },
    ];
    const r1 = s.cpuResponse(t.engine, 'effectTarget', { validTargets: heldZiele, config: { title: CARD }, playerIdx: 0 });
    check('Heldenwahl der CPU: der Gegnerheld mit den meisten Artefakten (Held 0 des Gegners)', JSON.stringify(r1) === JSON.stringify(['hero-1-0']), r1);
    const r2 = s.cpuResponse(t.engine, 'effectTarget', { validTargets: [heldZiele[0]], config: { title: CARD }, playerIdx: 0 });
    check('Nur eigene Helden zur Wahl: die CPU bricht ab', Array.isArray(r2) && r2.length === 0, r2);
    const eq = [
      { id: 'equip-1-0-0', type: 'equip', owner: 1, heroIdx: 0, slotIdx: 0, cardName: EQ2 },
      { id: 'equip-1-0-1', type: 'equip', owner: 1, heroIdx: 0, slotIdx: 1, cardName: EQ3 },
    ];
    const r3 = s.cpuResponse(t.engine, 'effectTarget', { validTargets: eq, config: { title: CARD }, playerIdx: 0 });
    check('Artefaktwahl der CPU: alle gegnerischen', JSON.stringify(r3) === JSON.stringify(['equip-1-0-0', 'equip-1-0-1']), r3);
    const r4 = s.cpuResponse(t.engine, 'effectTarget', { validTargets: [{ id: 'equip-0-1-0', type: 'equip', owner: 0, heroIdx: 1, slotIdx: 0, cardName: EQ1 }], config: { title: CARD }, playerIdx: 0 });
    check('nur eigene Artefakte zur Wahl: abbrechen', Array.isArray(r4) && r4.length === 0, r4);
  }

  console.log(fails === 0 ? '\nALLE GRÜN' : `\n${fails} FEHLER`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
