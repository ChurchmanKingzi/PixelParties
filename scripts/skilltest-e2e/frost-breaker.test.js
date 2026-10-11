'use strict';
// Frost Breaker (Spell, Decay Magic + Destruction Magic Lv1): „Choose a Frozen target. Heal it from its Freeze and deal 100/200/300 damage to it.
// If the target was already Frozen during your last turn, this counts as an additional Action."
// Geprueft wird der ECHTE Spielweg (`host.doPlaySpell`) mit gescripteter Zielwahl, dazu die Einsatzregeln je Ziel und Phase
// (`getHeroPlayableCards`, `cardHasInherentAction`, `gs._spellForcesActionConsume`) und die neuen Engine-Helfer fuer den Freeze-Zeitpunkt.
//   node scripts/skilltest-e2e/frost-breaker.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Frost Breaker';
const DB = require('../../cards/effects/_card-db').getCardDB();
const pick = (pred, n = 0) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[n].name;
const KRE = pick(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0 && (c.hp || 0) <= 100);
const ZAEH = DB.Cavalry ? 'Cavalry' : pick(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level <= 2 && (c.hp || 0) >= 150 && !/Token|Race Boat/.test(c.name));
const stapel = (name, n) => Array.from({ length: n }, () => name);

/** Spiel mit zwei Sitzen: Sitz 0 wirkt (Decay `dc`, Destruction `dm` an Held 0), Sitz 1 hat die Ziele. Zug 5, Sitz 0 am Zug → der letzte eigene Zug war 3. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  const hatteStempel = !!gs._zugNr && Object.keys(gs._zugNr).length > 0;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 3; gs.firstTurnProtectedPlayer = null;
  delete gs._zugNr;                               // Test-Aufbau: die Zwei-Spieler-Rechnung (letzter eigener Zug = 3)
  const [p0, p1] = gs.players;
  p0.abilityZones = p0.abilityZones.map((_, hi) => [stapel('Decay Magic', hi === 0 ? (opts.dc ?? 1) : (opts.dc1 ?? 0)), stapel('Destruction Magic', hi === 0 ? (opts.dm ?? 0) : 0), []]);
  p1.abilityZones = p1.abilityZones.map(() => [[], [], []]);
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.discardPile = []; ps.hand = []; ps.heroesActedThisTurn = opts.acted ? [0] : [];
  }
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support');
  p0.hand = [CARD];
  const t = { room, host, engine, gs, p0, p1, geboten: [], events: [], hatteStempel, wahl: opts.wahl || ((valid) => valid[0]), cancel: false };
  // Sitz 0 ist ein Bot: die Zielwahl laeuft durch den echten Dispatcher (Schutz, Markierung) bis zur CPU-Antwort — die ist hier gescriptet.
  engine._getCpuTargetResponse = (valid, config) => {
    t.geboten.push(valid.filter(v => !v.ineligible).map(v => `${v.owner}:${v.type}:${v.cardName}`)); t.config = config;
    if (t.cancel) return [];
    const w = t.wahl(valid.filter(v => !v.ineligible));
    return w ? [w.id] : [];
  };
  engine.promptGeneric = async () => undefined;
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const s = loadCardEffect(CARD);
  if (!s.__beobachtet) {
    const orig = s.hooks.onPlay;
    s.hooks.onPlay = async function (ctx) { s.__stempel = { inherent: !!ctx.gameState._spellWasInherent, haupt: !!ctx.gameState._spellConsumedMainAction }; return orig.call(this, ctx); };
    s.__beobachtet = true;
  }
  s.__stempel = null;
  return t;
}
function lege(t, seat, hi, slot, name) {
  t.gs.players[seat].supportZones[hi][slot] = [name];
  return t.engine._trackCard(name, seat, 'support', hi, slot);
}
/** Eine Kreatur einfrieren, als haette der Freeze in `seit` (gs.turn) begonnen. `seit` weglassen = unbekannt (Puzzle-Aufbau). */
function friereKreatur(inst, seit) { inst.counters.frozen = 1; if (seit !== undefined) inst.counters.frozenAppliedTurn = seit; }
function friereHeld(t, seat, hi, seit) { t.gs.players[seat].heroes[hi].statuses.frozen = { duration: 1, appliedBy: 0, ...(seit !== undefined ? { appliedTurn: seit } : {}) }; }
const spiele = (t, heroIdx = 0) => t.host.doPlaySpell(t.room, 0, { cardName: CARD, handIndex: 0, heroIdx });
const stempel = () => loadCardEffect(CARD).__stempel;
const anim = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'frost_breaker');
const namenAmHeld = (t, hi) => { const l = t.engine.getHeroPlayableCards(0); return ((l.own && l.own[hi]) || []).map(c => (typeof c === 'string' ? c : c.name)); };

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Spell, Normal, Lv1, Decay Magic + Destruction Magic', cd && cd.cardType === 'Spell' && cd.subtype === 'Normal' && cd.level === 1 && cd.spellSchool1 === 'Decay Magic' && cd.spellSchool2 === 'Destruction Magic', cd);
    check('Kartentext: gefrorenes Ziel, Heilen + 100/200/300, Zusatzaktion bei „during your last turn“', cd && /^Choose a Frozen target\. Heal it from its Freeze and deal 100\/200\/300 damage to it\./.test(cd.effect) && /already Frozen during your last turn, this counts as an additional Action\./.test(cd.effect), cd && cd.effect);
    check('`inherentAction` als FUNKTION, `spellPlayCondition` (nichts gefroren → grau), `cpuMeta.optionalInherent`', typeof s.inherentAction === 'function' && typeof s.spellPlayCondition === 'function' && s.cpuMeta && s.cpuMeta.optionalInherent === true);
  }
  console.log(`(Testkarten: Kreatur ${KRE} [${DB[KRE].hp} HP], zähe Kreatur ${ZAEH} [${DB[ZAEH].hp} HP])`);

  console.log('Engine: Zeitpunkt des Freeze');
  {
    const t = await fresh();
    check('das Spiel stempelt die eigenen Zugnummern schon beim Zugstart (`gs._zugNr`)', t.hatteStempel === true);
    const e = t.engine;
    check('Zug 5, Sitz 0 am Zug: letzter eigener Zug = 3; Sitz 1: 4', e.letzterEigenerZug(0) === 3 && e.letzterEigenerZug(1) === 4, [e.letzterEigenerZug(0), e.letzterEigenerZug(1)]);
    t.gs.turn = 1; t.gs.activePlayer = 0;
    check('Zug 1: es gab noch keinen eigenen Zug (null)', e.letzterEigenerZug(0) === null);
    t.gs.turn = 5;
    t.gs._zugNr = { 0: { laufend: 7, vorher: 3 }, 1: { laufend: 6, vorher: 2 } }; t.gs.turn = 7; t.gs.activePlayer = 0;
    check('mit gestempelten Zugnummern (auch bei übersprungenen Zügen): Sitz 0 am Zug → vorheriger = 3; Sitz 1 → laufender = 6', e.letzterEigenerZug(0) === 3 && e.letzterEigenerZug(1) === 6, [e.letzterEigenerZug(0), e.letzterEigenerZug(1)]);
    delete t.gs._zugNr; t.gs.turn = 5;
    const inst = lege(t, 1, 0, 0, KRE);
    const ok = await e.applyCreatureStatus(inst, 'frozen', { sourceOwner: 0, duration: 2, source: 'Test' });
    check('`applyCreatureStatus` stempelt `frozenAppliedTurn` mit dem aktuellen Zug', ok !== false && inst.counters.frozenAppliedTurn === 5, inst.counters);
    check('…`statusAnwendungsZug` liest ihn (Kreatur) bzw. `appliedTurn` (Held)', e.statusAnwendungsZug(inst, 'frozen') === 5);
    await e.addHeroStatus(1, 1, 'frozen', { duration: 1, appliedBy: 0 });
    check('…ein per `addHeroStatus` gesetzter Freeze trägt `appliedTurn` = 5', e.statusAnwendungsZug(t.p1.heroes[1], 'frozen') === 5, t.p1.heroes[1].statuses.frozen);
    check('ein Freeze aus DIESEM Zug zählt nicht als „schon im letzten Zug“', e.statusSeitLetztemEigenenZug(inst, 'frozen', 0) === false);
    inst.counters.frozenAppliedTurn = 3;
    check('Freeze aus Zug 3 (mein letzter Zug), noch aktiv → zählt', e.statusSeitLetztemEigenenZug(inst, 'frozen', 0) === true);
    inst.counters.frozenAppliedTurn = 2;
    check('Freeze aus Zug 2 (davor) → zählt', e.statusSeitLetztemEigenenZug(inst, 'frozen', 0) === true);
    inst.counters.frozenAppliedTurn = 4;
    check('Freeze aus Zug 4 (Zug des GEGNERS dazwischen) → zählt nicht', e.statusSeitLetztemEigenenZug(inst, 'frozen', 0) === false);
    delete inst.counters.frozenAppliedTurn;
    check('unbekannter Zeitpunkt (Puzzle-Aufbau) → zählt als „schon vorher“', e.statusSeitLetztemEigenenZug(inst, 'frozen', 0) === true);
    inst.counters.frozenAppliedTurn = 0;
    check('rückdatierter Zeitpunkt 0 (der Puzzle-Aufbau schreibt `appliedTurn: 0`) → zählt ebenfalls', e.statusSeitLetztemEigenenZug(inst, 'frozen', 0) === true);
    t.gs.turn = 1;
    check('…auch im allerersten Zug (noch kein eigener Zug), wenn der Freeze rückdatiert ist', e.statusSeitLetztemEigenenZug(inst, 'frozen', 0) === true);
    t.gs.turn = 5;
    delete inst.counters.frozen;
    check('nicht (mehr) gefroren → zählt nie', e.statusSeitLetztemEigenenZug(inst, 'frozen', 0) === false);
    const i2 = lege(t, 1, 0, 1, KRE);
    await e.applyCreatureStatus(i2, 'frozen', { sourceOwner: 0 });
    e.cleanseCreatureStatuses(i2, ['frozen'], 'Test');
    check('Auftauen per Cleanse räumt den Stempel mit ab', i2.counters.frozen === undefined && i2.counters.frozenAppliedTurn === undefined, i2.counters);
    const i3 = lege(t, 1, 0, 2, KRE);
    await e.applyCreatureStatus(i3, 'frozen', { sourceOwner: 0 });
    t.gs.activePlayer = 1;
    await e.processStatusExpiry('END');
    check('Auftauen am Zugende des Trägers räumt den Stempel mit ab', !i3.counters.frozen && i3.counters.frozenAppliedTurn === undefined, i3.counters);
  }

  console.log('Zielwahl: nur gefrorene Ziele, beide Seiten');
  {
    const t = await fresh({ dc: 1 });
    lege(t, 1, 0, 0, KRE);                          // nicht gefroren
    friereKreatur(lege(t, 1, 1, 0, KRE), 3);        // gefrorene Gegner-Kreatur
    friereKreatur(lege(t, 0, 1, 0, KRE), 3);        // gefrorene eigene Kreatur
    friereHeld(t, 1, 2, 3);                         // gefrorener Gegner-Held
    const r = await spiele(t);
    check('der Zauber läuft durch', r === true, r);
    const g = t.geboten[0] || [];
    check('zur Wahl stehen genau die drei gefrorenen Ziele (Held und Kreatur, beide Seiten) — nichts Ungefrorenes', g.length === 3 && g.includes(`1:hero:${t.p1.heroes[2].name}`) && g.filter(x => x.endsWith(KRE)).length === 2, g);
  }
  {
    const t = await fresh({ dc: 1 });
    lege(t, 1, 0, 0, KRE);
    check('nichts gefroren → `spellPlayCondition` falsch', loadCardEffect(CARD).spellPlayCondition(t.gs, 0, t.engine) === false);
    const r = await spiele(t);
    check('…und der Zug schlägt fehl: Karte bleibt auf der Hand, nichts passiert', r !== true && t.p0.hand.includes(CARD) && t.geboten.length === 0, { r, geboten: t.geboten });
  }

  console.log('Heilen, dann Schaden (Skalierung über BEIDE Schulen)');
  {
    const t = await fresh({ dc: 1 });
    friereHeld(t, 1, 0, 3);
    const hp0 = t.p1.heroes[0].hp;
    const r = await spiele(t);
    check('gefrorener Gegner-Held: aufgetaut und 100 Schaden (Decay 1 + Destruction 0 = 1)', r === true && !t.p1.heroes[0].statuses.frozen && t.p1.heroes[0].hp === hp0 - 100, { r, frozen: t.p1.heroes[0].statuses.frozen, hp: t.p1.heroes[0].hp });
    const a = anim(t);
    check('Animation `frost_breaker` auf dem Ziel (Seite 1, Held 0)', a.length === 1 && a[0].data.owner === 1 && a[0].data.heroIdx === 0 && a[0].data.zoneSlot === -1, a);
    check('Frost Breaker liegt in der Ablage des Wirkers', t.p0.discardPile.includes(CARD) && t.p0.hand.length === 0, { abl: t.p0.discardPile, hand: t.p0.hand });
  }
  for (const [dc, dm, erwartet] of [[0, 1, 100], [1, 1, 200], [2, 1, 300], [1, 2, 300], [3, 3, 300], [5, 0, 300]]) {
    const t = await fresh({ dc, dm });
    friereHeld(t, 1, 0, 3);
    const hp0 = t.p1.heroes[0].hp;
    await spiele(t);
    check(`Decay ${dc} + Destruction ${dm}: ${erwartet} Schaden${dc + dm > 3 ? ' (Deckel 3)' : ''}`, t.p1.heroes[0].hp === hp0 - erwartet && !t.p1.heroes[0].statuses.frozen, [hp0, t.p1.heroes[0].hp]);
  }
  {
    const t = await fresh({ dc: 0, dm: 0 });
    friereHeld(t, 1, 0, 3);
    const r = await spiele(t);
    check('ohne Decay/Destruction (Summe 0) ist der Lv1-Zauber nicht wirkbar', r !== true && t.p0.hand.includes(CARD) && t.p1.heroes[0].statuses.frozen, { r });
  }
  {
    const t = await fresh({ dc: 1, wahl: (v) => v.find(x => x.type === 'equip') });
    const inst = lege(t, 1, 1, 0, ZAEH);
    friereKreatur(inst, 3);
    await spiele(t);
    check(`gefrorene Kreatur (${ZAEH}): aufgetaut, 100 Schaden, sie überlebt`, inst.zone === 'support' && !inst.counters.frozen && inst.counters.currentHp === DB[ZAEH].hp - 100, { zone: inst.zone, c: inst.counters });
    const a = anim(t);
    check('…die Animation sitzt auf ihrer Zone (Held 1, Slot 0)', a.length === 1 && a[0].data.heroIdx === 1 && a[0].data.zoneSlot === 0, a);
  }
  {
    const t = await fresh({ dc: 1, wahl: (v) => v.find(x => x.type === 'equip') });
    const inst = lege(t, 1, 1, 0, KRE);
    friereKreatur(inst, 3);
    await spiele(t);
    check('eine schwache gefrorene Kreatur fällt unter den 100 Schaden', !t.p1.supportZones[1][0].length && t.p1.discardPile.includes(KRE), { zone: t.p1.supportZones[1], abl: t.p1.discardPile });
  }
  {
    const t = await fresh({ dc: 1, wahl: (v) => v.find(x => x.type === 'equip' && x.owner === 0) });
    const eigene = lege(t, 0, 1, 0, ZAEH);
    friereKreatur(eigene, 3);
    await spiele(t);
    check('auch eine EIGENE gefrorene Kreatur darf gewählt werden (aufgetaut + Schaden)', !eigene.counters.frozen && eigene.counters.currentHp === DB[ZAEH].hp - 100, eigene.counters);
  }
  {
    const t = await fresh({ dc: 1 });
    friereHeld(t, 1, 0, 3);
    t.cancel = true;
    const r = await spiele(t);
    check('Zielwahl abgebrochen: nichts geschieht, die Karte bleibt auf der Hand', r === true && t.p0.hand.includes(CARD) && t.p1.heroes[0].statuses.frozen && t.p1.heroes[0].hp === 800 && anim(t).length === 0, { r, hand: t.p0.hand });
  }

  console.log('Zusatzaktion je Ziel — Action Phase, Grund-Aktion frei (alle Ziele wählbar)');
  {
    const t = await fresh({ dc: 1 });
    friereHeld(t, 1, 0, 3);                         // alt
    friereHeld(t, 1, 1, 5);                         // jung (dieser Zug)
    check('ein altes Ziel genügt: `cardHasInherentAction` wahr', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === true);
    const r = await spiele(t, 0);
    const g = t.geboten[0] || [];
    check('beide gefrorenen Helden stehen zur Wahl (Rückfall-Aktion vorhanden)', r === true && g.length === 2, g);
    check('Stempel: Zusatzaktion (inherent) …', stempel() && stempel().inherent === true, stempel());
    check('…und das ALTE Ziel verbraucht die Aktion NICHT (Held 0 nicht „acted“)', !t.p0.heroesActedThisTurn.includes(0), t.p0.heroesActedThisTurn);
  }
  {
    const t = await fresh({ dc: 1, wahl: (v) => v.find(x => x.heroIdx === 1) });
    friereHeld(t, 1, 0, 3);                         // alt
    friereHeld(t, 1, 1, 5);                         // jung
    const hp0 = t.p1.heroes[1].hp;
    await spiele(t, 0);
    check('das JUNGE Ziel gewählt: aufgetaut + 100 Schaden …', !t.p1.heroes[1].statuses.frozen && t.p1.heroes[1].hp === hp0 - 100, [hp0, t.p1.heroes[1].hp]);
    check('…aber der Einsatz kostet die Aktion (Held 0 „acted“)', t.p0.heroesActedThisTurn.includes(0), t.p0.heroesActedThisTurn);
  }
  {
    const t = await fresh({ dc: 1 });
    friereHeld(t, 1, 0, 5);                         // nur junges Ziel
    check('nur junge Ziele: KEINE Zusatzaktion (`cardHasInherentAction` falsch)', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === false);
    const r = await spiele(t, 0);
    check('…der Zauber läuft als normale Aktion (Held 0 „acted“)', r === true && !t.p1.heroes[0].statuses.frozen && t.p0.heroesActedThisTurn.includes(0), { r, acted: t.p0.heroesActedThisTurn });
  }
  {
    const t = await fresh({ dc: 1 });
    friereHeld(t, 1, 0, 4);                         // im Zug des Gegners gefroren (nach meinem letzten Zug)
    check('Freeze im Zug des Gegners (4) ist NICHT „während meines letzten Zuges“ → keine Zusatzaktion', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === false);
  }
  {
    const t = await fresh({ dc: 1 });
    friereHeld(t, 1, 0);                            // Puzzle-Aufbau: Zeitpunkt unbekannt
    check('Freeze ohne bekannten Zeitpunkt (Puzzle-Aufbau) zählt als „schon vorher“ → Zusatzaktion', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === true);
  }

  console.log('Zusatzaktion — Main Phase 1 (Grund-Aktion der Action Phase als Rückfall)');
  {
    const t = await fresh({ dc: 1, phase: 2 });
    friereHeld(t, 1, 0, 3);                         // alt
    friereHeld(t, 1, 1, 5);                         // jung
    check('Main Phase 1: spielbar (ein altes Ziel)', namenAmHeld(t, 0).includes(CARD), namenAmHeld(t, 0));
    const r = await spiele(t, 0);
    const g = t.geboten[0] || [];
    check('…die Aktion der Action Phase ist noch frei (Rückfall) → BEIDE Ziele wählbar', r === true && g.length === 2, g);
    check('…das alte Ziel (zufällig das erste) ist gratis: aufgetaut, Phase bleibt Main Phase 1, nichts verbrannt', stempel() && stempel().inherent === true && !t.p1.heroes[0].statuses.frozen && t.gs.currentPhase === 2 && !t.gs._pendingActionBurn, { st: stempel(), ph: t.gs.currentPhase, burn: t.gs._pendingActionBurn });
  }
  {
    const t = await fresh({ dc: 1, phase: 2, wahl: (v) => v.find(x => x.heroIdx === 1) });
    friereHeld(t, 1, 0, 3);                         // alt
    friereHeld(t, 1, 1, 5);                         // jung
    await spiele(t, 0);
    check('Main Phase 1, JUNGES Ziel: der Einsatz verbrennt die kommende Aktion (Held 0 „acted“)', t.p0.heroesActedThisTurn.includes(0), { ph: t.gs.currentPhase, acted: t.p0.heroesActedThisTurn, burn: t.gs._pendingActionBurn });
  }
  {
    const t = await fresh({ dc: 1, phase: 2 });
    friereHeld(t, 1, 1, 5);                         // nur jung
    check('Main Phase 1 mit nur jungen Zielen: nicht spielbar', !namenAmHeld(t, 0).includes(CARD), namenAmHeld(t, 0));
    const r = await spiele(t, 0);
    check('…der Zug schlägt fehl, nichts bewegt sich', r !== true && t.p0.hand.includes(CARD) && !!t.p1.heroes[1].statuses.frozen && t.p1.heroes[1].hp === 800, { r });
  }

  console.log('Zusatzaktion — Main Phase 2 und nach verbrauchter Aktion (kein Rückfall: nur alte Ziele)');
  {
    const t = await fresh({ dc: 1, phase: 4 });
    friereHeld(t, 1, 0, 3);                         // alt
    friereHeld(t, 1, 1, 5);                         // jung
    check('Main Phase 2: spielbar (ein altes Ziel)', namenAmHeld(t, 0).includes(CARD), namenAmHeld(t, 0));
    const r = await spiele(t, 0);
    const g = t.geboten[0] || [];
    check('…die Zielwahl bietet NUR das alte Ziel (Held 0 des Gegners)', r === true && g.length === 1 && g[0] === `1:hero:${t.p1.heroes[0].name}`, g);
    check('…gratis (inherent) und der alte Held ist aufgetaut, der junge noch gefroren', stempel() && stempel().inherent === true && !t.p1.heroes[0].statuses.frozen && !!t.p1.heroes[1].statuses.frozen, { st: stempel() });
  }
  {
    const t = await fresh({ dc: 1, phase: 4 });
    friereHeld(t, 1, 1, 5);                         // nur jung
    check('Main Phase 2 mit nur jungen Zielen: nicht spielbar', !namenAmHeld(t, 0).includes(CARD), namenAmHeld(t, 0));
    const r = await spiele(t, 0);
    check('…der Zug schlägt fehl, nichts bewegt sich', r !== true && t.p0.hand.includes(CARD) && !!t.p1.heroes[1].statuses.frozen && t.p1.heroes[1].hp === 800, { r });
  }
  {
    const t = await fresh({ dc: 1, dc1: 1, acted: true });
    friereHeld(t, 1, 0, 3);                         // alt
    friereHeld(t, 1, 1, 5);                         // jung
    const r = await spiele(t, 1);
    const g = t.geboten[0] || [];
    check('Action Phase, Aktion schon verbraucht (kein Geber): die Zielwahl bietet NUR das alte Ziel', r === true && g.length === 1 && g[0] === `1:hero:${t.p1.heroes[0].name}`, { r, g });
  }

  console.log(fails === 0 ? '\n✓ Frost-Breaker-Tests grün' : `\n✗ ${fails} Fehler`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
