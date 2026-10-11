'use strict';
// Front Soldier (Creature/Reaction, Summoning Magic Lv0, 50 HP): „Immediately summon this Creature from your hand as an additional Action when your opponent plays
// a Reaction or activates a Surprise. Negate that Reaction or Surprise. Then, both players draw 2 cards."
// Drei Wege: ① Kettenfenster (der Gegner spielt eine Reaction in eine Kette — hier mit The Melting als echter Gegner-Reaction), ② Surprise-Aktivierung
// (`onSurpriseActivated`, wie Boots of Hermes), ③ Hand-Reaktionsfenster der Engine (`_rxHandkarteEinsetzen` → `onReactionPlayed`).
//   node scripts/skilltest-e2e/front-soldier.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const FS = 'Front Soldier';
const MELT = 'The Melting';
const DB = require('../../cards/effects/_card-db').getCardDB();
const pick = (pred, n = 0) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[n].name;
const KRE = pick(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0);
const stapel = (name, n) => Array.from({ length: n }, () => name);
const DECK = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? 'Fireball' : 'Cool Repair'));

/**
 * Zwei Sitze. Sitz 0 spielt die gegnerische Reaction (hält The Melting, Support Magic Lv1), Sitz 1 hält den Front Soldier. `aktiv` = wessen Zug (Standard: 0).
 * Beide Decks haben 10 Karten, die Hände sind leer — so zählt „ziehen" genau.
 */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  engine._fastMode = false; engine._delay = async () => {};
  gs.skillTest = null;                            // Normalspiel: im Skill-Test-Modus räumt der Zieh-Wrapper die Decks nach jedem Zug auf
  gs.turn = 6; gs.activePlayer = opts.aktiv ?? 0; gs.currentPhase = 3; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = [];
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
    ps.mainDeck = DECK(10);
  }
  p0.abilityZones[0] = [stapel('Support Magic', 1), [], []];
  const t = { room, host, engine, gs, p0, p1, prompts: [], events: [], logs: [], antwort: () => true };
  engine.promptGeneric = async (pi, d) => {
    t.prompts.push({ pi, d });
    if (d.type === 'confirm') { const a = t.antwort(pi, d); return a; }
    if (d.type === 'zonePick') { const w = t.zone ? t.zone(pi, d) : null; return w || { heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, ...(d.zones[0].owner != null ? { owner: d.zones[0].owner } : {}) }; }
    if (d.type === 'optionPicker') return { optionId: d.options[0].id };
    return undefined;
  };
  engine.promptEffectTarget = async (pi, ziele) => (ziele[0] ? [ziele[0].id] : []);
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, d) => { t.logs.push({ type, d }); return origLog(type, d); };
  return t;
}
function setzeHand(t, names, seat) {
  t.gs.players[seat].hand = [...names];
  for (const n of names) t.engine._trackCard(n, seat, 'hand');
}
function lege(t, seat, hi, slot, name = KRE) {
  t.gs.players[seat].supportZones[hi][slot] = [name];
  return t.engine._trackCard(name, seat, 'support', hi, slot);
}
const friere = (t, inst, von = 1) => t.engine.applyCreatureStatus(inst, 'frozen', { sourceOwner: von, source: 'Test', duration: 1 });
const angebote = (t, pi, titel = FS) => t.prompts.filter(p => p.pi === pi && p.d.type === 'confirm' && p.d.title === titel);
const log = (t, typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const anim = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'front_soldier_block').map(e => e.data);
const aufBrett = (t, seat, name = FS) => t.engine.cardInstances.find(c => c.name === name && c.zone === 'support' && (c.controller ?? c.owner) === seat);

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[FS], s = loadCardEffect(FS);
    check('Creature, Reaction, Lv0, Summoning Magic, 50 HP', cd && cd.cardType === 'Creature' && cd.subtype === 'Reaction' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: „Then, both players draw 2 cards.“ (vorher: nur der Gegner)', cd && /Negate that Reaction or Surprise\. Then, both players draw 2 cards\.$/.test(cd.effect) && /plays a Reaction or activates a Surprise/.test(cd.effect), cd && cd.effect);
    check('Skript: Reaction-Creature (`isReaction`, `skipPostResolveDiscard`, Hand), Bedingung, Auflösung, Surprise- und Reaction-Hook', s.isReaction === true && s.skipPostResolveDiscard === true && s.activeIn.includes('hand') && typeof s.reactionCondition === 'function' && typeof s.resolve === 'function' && typeof s.hooks.onSurpriseActivated === 'function' && typeof s.hooks.onReactionPlayed === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst nativ 76×51 im Index und als Datei', idx[FS] && idx[FS].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[FS].id + '.png')));
  }
  console.log(`(Testkreatur: ${KRE})`);

  console.log('① Kettenfenster: der Gegner spielt eine Reaction (The Melting) — der Soldat negiert sie');
  {
    const t = await fresh();
    setzeHand(t, [MELT], 0); setzeHand(t, [FS], 1);
    const eigene = lege(t, 0, 1, 0);
    t.prompts.length = 0; t.events.length = 0;
    await friere(t, eigene, 1);                // der Gegner (Sitz 1) friert meine Kreatur ein → The Melting kommt in die Kette
    const f = angebote(t, 1);
    check('Sitz 1 bekommt den Soldaten als Antwort auf die Melting-Reaction angeboten', f.length === 1, t.prompts.map(p => p.pi + ':' + p.d.type + ':' + p.d.title));
    check('der Soldat steht auf dem Brett von Sitz 1 (beschworen, nicht in der Ablage)', !!aufBrett(t, 1) && !t.p1.discardPile.includes(FS) && !t.p1.hand.includes(FS), { abl: t.p1.discardPile, hand: t.p1.hand });
    check('The Melting ist NEGIERT: die Kreatur bleibt gefroren, die Karte liegt in der Ablage von Sitz 0', !!eigene.counters.frozen && t.p0.discardPile.includes(MELT), { frozen: eigene.counters.frozen, abl: t.p0.discardPile });
    check('BEIDE haben 2 Karten gezogen (Besitzer und Gegner)', t.p1.hand.length === 2 && t.p0.hand.length === 2 && t.p1.mainDeck.length === 8 && t.p0.mainDeck.length === 8, { h1: t.p1.hand, h0: t.p0.hand, d1: t.p1.mainDeck.length, d0: t.p0.mainDeck.length });
    check('es war eine Zusatzaktion: der Held von Sitz 1 gilt nicht als gehandelt', t.p1.heroesActedThisTurn.length === 0, t.p1.heroesActedThisTurn);
    check('Log `front_soldier` (via chain) und `reaction_negated`', log(t, 'front_soldier').some(l => l.via === 'chain' && l.negated === MELT) && log(t, 'reaction_negated').some(l => l.negator === FS && l.negated === MELT), { fs: log(t, 'front_soldier'), neg: log(t, 'reaction_negated') });
    const a = anim(t);
    check('Animation `front_soldier_block` (Brett-Animation, Soldat als Ursprung UND Ziel) am Platz des Soldaten', a.length === 1 && a[0].zoneType === 'board' && a[0].targets.length === 1 && a[0].targets[0].owner === 1 && a[0].originOwner === 1, a);
  }
  {
    const t = await fresh();
    setzeHand(t, [MELT], 0); setzeHand(t, [FS], 1);
    const eigene = lege(t, 0, 1, 0);
    t.antwort = (pi, d) => (pi === 1 && d.title === FS) ? false : true;       // Sitz 1 passt
    await friere(t, eigene, 1);
    check('„Nein“: der Soldat bleibt auf der Hand, The Melting wirkt (alles taut), nichts gezogen', t.p1.hand.includes(FS) && !aufBrett(t, 1) && !eigene.counters.frozen && t.p1.hand.length === 1 && t.p0.hand.length === 0, { frozen: eigene.counters.frozen, h1: t.p1.hand, h0: t.p0.hand });
  }
  {
    const t = await fresh();
    setzeHand(t, [MELT], 0); setzeHand(t, [FS], 1);
    for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) t.p1.supportZones[h][z] = ['Platzhalter'];
    const eigene = lege(t, 0, 1, 0);
    await friere(t, eigene, 1);
    check('Sitz 1 hat keinen freien Platz: der Soldat wird gar nicht angeboten, The Melting wirkt', angebote(t, 1).length === 0 && !eigene.counters.frozen && t.p1.hand.includes(FS), t.prompts.map(p => p.pi + ':' + p.d.title));
  }
  {
    const t = await fresh();
    setzeHand(t, [MELT], 0); setzeHand(t, [FS], 1);
    for (const h of t.p1.heroes) h.statuses = { frozen: { duration: 2, appliedBy: 0 } };    // alle eigenen Helden gefroren: keiner kann beschwören
    const eigene = lege(t, 0, 1, 0);
    await friere(t, eigene, 1);
    check('Sitz 1: alle Helden gefroren = kein tauglicher Beschwörer → der Soldat wird nicht angeboten', angebote(t, 1).length === 0 && t.p1.hand.includes(FS), t.prompts.map(p => p.pi + ':' + p.d.title));
  }
  {
    // der Soldat reagiert nicht auf EIGENE Reactions
    const t = await fresh();
    setzeHand(t, [MELT, FS], 0);
    const eigene = lege(t, 0, 1, 0);
    await friere(t, eigene, 1);
    check('eigene Reaction (The Melting von Sitz 0, Soldat auf DERSELBEN Hand): kein Angebot', angebote(t, 0).length === 0 && t.p0.hand.includes(FS), t.prompts.map(p => p.pi + ':' + p.d.title));
  }
  {
    const s = loadCardEffect(FS), t = await fresh();
    const link = (o) => ({ isInitialCard: false, owner: 0, cardName: MELT, cardType: 'Spell', ...o });
    check('Bedingung: ein späteres Kettenglied des Gegners IST eine Reaction', s.reactionCondition(t.gs, 1, t.engine, { chain: [link({ isInitialCard: true, owner: 0, cardName: 'Fireball' }), link({})] }) === true);
    check('…ein eigenes Glied nicht', s.reactionCondition(t.gs, 1, t.engine, { chain: [link({ owner: 1 })] }) === false);
    check('…eine als Erstes gespielte Karte des Gegners nur, wenn sie eine Reaction ist (The Melting ja, Fireball nein)', s.reactionCondition(t.gs, 1, t.engine, { chain: [link({ isInitialCard: true })] }) === true && s.reactionCondition(t.gs, 1, t.engine, { chain: [link({ isInitialCard: true, cardName: 'Fireball' })] }) === false);
    check('…eine Reaction-CREATURE als erstes Glied (Beschwörungsfenster) zählt nicht (sie gilt über `onReactionPlayed`)', s.reactionCondition(t.gs, 1, t.engine, { chain: [link({ isInitialCard: true, cardName: 'Explosive Drone', cardType: 'Creature' })] }) === false);
    check('…ein Helden-Effekt des Gegners zählt nicht', s.reactionCondition(t.gs, 1, t.engine, { chain: [link({ fromHero: true })] }) === false);
    check('…leere Kette: nein', s.reactionCondition(t.gs, 1, t.engine, { chain: [] }) === false);
  }

  console.log('② Surprise-Aktivierung: der Gegner aktiviert eine Surprise — der Soldat negiert sie');
  {
    const t = await fresh();
    setzeHand(t, [FS], 1);
    const hookCtx = { surpriseCardName: 'Booby Trap', surpriseOwner: 0, heroIdx: 0, surpriseController: 0, _skipReactionCheck: true };
    await t.engine.runHooks('onSurpriseActivated', hookCtx);
    check('die Surprise ist negiert (`_surpriseNegated`, `_surpriseNegatedBy`)', hookCtx._surpriseNegated === true && hookCtx._surpriseNegatedBy === FS, hookCtx);
    check('der Soldat steht auf dem Brett von Sitz 1, beide haben 2 Karten gezogen', !!aufBrett(t, 1) && t.p1.hand.length === 2 && t.p0.hand.length === 2, { h1: t.p1.hand, h0: t.p0.hand });
    const q = angebote(t, 1);
    check('die Frage nennt die Surprise (rechts), zeigt den Soldaten selbst LINKS und ist gerrymander-fähig (echtes „may“)', q.length === 1 && /Booby Trap/.test(q[0].d.message) && q[0].d.gerrymanderEligible === true && q[0].d.showCard === 'Booby Trap' && q[0].d.showCardLeft === FS, q.map(p => p.d));
    check('Log `front_soldier` (via surprise)', log(t, 'front_soldier').some(l => l.via === 'surprise' && l.negated === 'Booby Trap'), log(t, 'front_soldier'));
  }
  {
    const t = await fresh();
    setzeHand(t, [FS], 1);
    t.antwort = () => false;
    const hookCtx = { surpriseCardName: 'Booby Trap', surpriseOwner: 0, heroIdx: 0, surpriseController: 0, _skipReactionCheck: true };
    await t.engine.runHooks('onSurpriseActivated', hookCtx);
    check('„Pass“: nichts negiert, der Soldat bleibt auf der Hand', !hookCtx._surpriseNegated && t.p1.hand.includes(FS) && !aufBrett(t, 1) && t.p0.hand.length === 0, hookCtx);
  }
  {
    const t = await fresh();
    setzeHand(t, [FS], 0);
    const hookCtx = { surpriseCardName: 'Booby Trap', surpriseOwner: 0, heroIdx: 0, surpriseController: 0, _skipReactionCheck: true };
    await t.engine.runHooks('onSurpriseActivated', hookCtx);
    check('eigene Surprise: kein Angebot', !hookCtx._surpriseNegated && angebote(t, 0).length === 0, t.prompts.map(p => p.d.title));
  }
  {
    // Zonenwahl abgebrochen → nichts negiert, nichts gezogen
    const t = await fresh();
    setzeHand(t, [FS], 1);
    const orig = t.engine.promptGeneric;
    t.engine.promptGeneric = async (pi, d) => (d.type === 'zonePick' && d.title === FS) ? { cancelled: true } : orig(pi, d);
    const hookCtx = { surpriseCardName: 'Booby Trap', surpriseOwner: 0, heroIdx: 0, surpriseController: 0, _skipReactionCheck: true };
    await t.engine.runHooks('onSurpriseActivated', hookCtx);
    check('Abbruch der Zonenwahl: weder negiert noch beschworen noch gezogen', !hookCtx._surpriseNegated && t.p1.hand.includes(FS) && !aufBrett(t, 1) && t.p0.hand.length === 0 && t.p1.hand.length === 1, { hook: hookCtx, h1: t.p1.hand });
  }
  {
    // zwei Soldaten: der erste negiert, der zweite sieht `_surpriseNegated` und bleibt auf der Hand
    const t = await fresh();
    setzeHand(t, [FS, FS], 1);
    const hookCtx = { surpriseCardName: 'Booby Trap', surpriseOwner: 0, heroIdx: 0, surpriseController: 0, _skipReactionCheck: true };
    await t.engine.runHooks('onSurpriseActivated', hookCtx);
    const n = t.engine.cardInstances.filter(c => c.name === FS && c.zone === 'support').length;
    check('zwei Soldaten auf der Hand: nur EINER wird eingesetzt (die Surprise ist schon negiert), beide Spieler ziehen genau 2', hookCtx._surpriseNegated === true && n === 1 && t.p1.hand.filter(x => x === FS).length === 1 && t.p0.hand.length === 2, { n, h1: t.p1.hand, h0: t.p0.hand });
  }

  console.log('③ Hand-Reaktionsfenster der Engine (`_rxHandkarteEinsetzen`): der Gegner spielt eine Reaction — der Soldat negiert sie');
  {
    const t = await fresh();
    const REAKTION = 'Test Flight';
    setzeHand(t, [REAKTION], 0); setzeHand(t, [FS], 1);
    const script = loadCardEffect(REAKTION);
    const ok = await t.engine._rxHandkarteEinsetzen(0, REAKTION, script, { casterIdx: 0 });
    check('die Reaction wurde gespielt UND negiert: `_rxHandkarteEinsetzen` meldet `false` (der Aufrufer überspringt ihre Wirkung)', ok === false, ok);
    check('sie liegt in der Ablage (bezahlt, aufgedeckt), der Soldat steht auf dem Brett, beide haben 2 gezogen', t.p0.discardPile.includes(REAKTION) && !!aufBrett(t, 1) && t.p0.hand.length === 2 && t.p1.hand.length === 2, { abl: t.p0.discardPile, h0: t.p0.hand, h1: t.p1.hand });
    check('Logs `reaction_negated` und `front_soldier` (via reaction)', log(t, 'reaction_negated').some(l => l.negator === FS && l.negated === REAKTION) && log(t, 'front_soldier').some(l => l.via === 'reaction' && l.negated === REAKTION), { neg: log(t, 'reaction_negated'), fs: log(t, 'front_soldier') });
  }
  {
    const t = await fresh();
    const REAKTION = 'Test Flight';
    setzeHand(t, [REAKTION], 0);
    const ok = await t.engine._rxHandkarteEinsetzen(0, REAKTION, loadCardEffect(REAKTION), { casterIdx: 0 });
    check('ohne Front Soldier beim Gegner: die Reaction läuft wie bisher (`true`)', ok === true && t.p0.discardPile.includes(REAKTION), ok);
    const t2 = await fresh();
    setzeHand(t2, [REAKTION, FS], 0);
    const ok2 = await t2.engine._rxHandkarteEinsetzen(0, REAKTION, loadCardEffect(REAKTION), { casterIdx: 0 });
    check('der Soldat auf der EIGENEN Hand ändert nichts (`true`, kein Angebot)', ok2 === true && angebote(t2, 0).length === 0, ok2);
  }

  console.log('④ Reaction-CREATURES aus der Hand (Doomed Town Guard, Explosive Drone, Enhanced Guard Dog, Chaorc Rider Warg, Elven Rider) sind „gespielte Reactions" — der Soldat negiert sie');
  for (const name of ['Doomed Town Guard', 'Explosive Drone', 'Enhanced Guard Dog', 'Chaorc Rider Warg', 'Elven Rider']) {
    const t = await fresh();
    setzeHand(t, [name], 0); setzeHand(t, [FS], 1);
    const handIdx = t.p0.hand.indexOf(name);
    t.engine.takeFromPileSync(t.p0, 'hand', handIdx);            // so ruft jede der fünf Karten die Beschwörung: erst aus der Hand nehmen …
    const res = await t.engine.summonCreatureWithHooks(name, 0, 1, 0, { source: name, fromHandIdx: handIdx, summonWindow: true });   // … dann beschwören
    check(`${name}: negiert — `+ '`summonCreatureWithHooks` meldet `{ negated: true, inst: null }` (der Aufrufer beendet seinen Effekt ohne Wirkung)', !!res && res.negated === true && res.inst === null, res);
    check(`${name}: die Karte liegt in der Ablage, NICHT auf dem Brett; der Soldat steht bei Sitz 1; beide haben 2 gezogen`, t.p0.discardPile.includes(name) && !t.engine.cardInstances.some(c => c.name === name && c.zone === 'support') && !!aufBrett(t, 1) && t.p0.hand.length === 2 && t.p1.hand.length === 2, { abl: t.p0.discardPile, h0: t.p0.hand, h1: t.p1.hand });
    check(`${name}: Logs `+ '`reaction_negated` und `front_soldier` (via reaction)', log(t, 'reaction_negated').some(l => l.negator === FS && l.negated === name) && log(t, 'front_soldier').some(l => l.via === 'reaction' && l.negated === name), { neg: log(t, 'reaction_negated'), fs: log(t, 'front_soldier') });
  }
  {
    // Gegenprobe: ohne Soldat beim Gegner beschwört sich der Drohne wie bisher
    const t = await fresh();
    setzeHand(t, ['Explosive Drone'], 0);
    const handIdx = 0;
    t.engine.takeFromPileSync(t.p0, 'hand', handIdx);
    const res = await t.engine.summonCreatureWithHooks('Explosive Drone', 0, 1, 0, { source: 'Explosive Drone', fromHandIdx: handIdx, summonWindow: true });
    check('ohne Front Soldat beim Gegner: die Drohne landet auf dem Brett wie bisher', !!res && !!res.inst && !t.p0.discardPile.includes('Explosive Drone'), res && { neg: res.negated, inst: !!res.inst });
    const t2 = await fresh();
    setzeHand(t2, ['Explosive Drone', FS], 0);
    t2.engine.takeFromPileSync(t2.p0, 'hand', 0);
    const res2 = await t2.engine.summonCreatureWithHooks('Explosive Drone', 0, 1, 0, { source: 'Explosive Drone', fromHandIdx: 0, summonWindow: true });
    check('der Soldat auf der EIGENEN Hand ändert nichts (kein Angebot, die Drohne landet)', !!res2 && !!res2.inst && angebote(t2, 0).length === 0, res2 && { neg: res2.negated });
    const t3 = await fresh();
    setzeHand(t3, ['Doomed Town Guard'], 0); setzeHand(t3, [FS], 1);
    t3.engine.takeFromPileSync(t3.p0, 'hand', 0);
    const res3 = await t3.engine.summonCreatureWithHooks('Doomed Town Guard', 0, 1, 0, { source: 'Doomed Town Guard', fromHandIdx: 0 });     // ohne `summonWindow`: keine Reaction-Hand-Beschwörung (z. B. ein Effekt, der sie platziert)
    check('eine Reaction-Creature, die NICHT als Hand-Reaction beschworen wird (kein `summonWindow`), wird nicht angeboten — auch nicht über das Beschwörungsfenster „A creature was just summoned“', !!res3 && !!res3.inst && angebote(t3, 1).length === 0, res3 && { neg: res3.negated, inst: !!res3.inst, prompts: t3.prompts.map(p => p.pi + ':' + p.d.title + ':' + (p.d.message || '').slice(0, 60)) });
  }
  {
    // „Pass" beim Soldaten: GENAU EINE Abfrage — nicht noch einmal im Beschwörungsfenster nach dem Landen
    const t = await fresh();
    setzeHand(t, ['Explosive Drone'], 0); setzeHand(t, [FS], 1);
    t.antwort = (pi, d) => (pi === 1 && d.title === FS) ? false : true;
    t.engine.takeFromPileSync(t.p0, 'hand', 0);
    const res = await t.engine.summonCreatureWithHooks('Explosive Drone', 0, 1, 0, { source: 'Explosive Drone', fromHandIdx: 0, summonWindow: true });
    check('Soldat sagt „Pass": die Drohne landet, und der Soldat wurde NUR EINMAL gefragt (keine Doppelabfrage im Beschwörungsfenster)', !!res && !!res.inst && angebote(t, 1).length === 1 && t.p1.hand.includes(FS), { n: angebote(t, 1).length, neg: res && res.negated });
  }
  {
    // Echter Weg: der Gegner besiegt meine Kreatur → Explosive Drone antwortet → der Soldat des Gegners negiert die Drohne
    const t = await fresh({ aktiv: 1 });
    setzeHand(t, ['Explosive Drone'], 0); setzeHand(t, [FS], 1);
    const opfer = lege(t, 0, 1, 0);
    t.prompts.length = 0;
    await t.engine.actionDealCreatureDamage({ name: 'Testquelle', owner: 1, heroIdx: 0, heroOwner: 1 }, opfer, 9999, 'creature', { sourceOwner: 1 });
    const d = angebote(t, 0, 'Explosive Drone'), f = angebote(t, 1);
    check('echter Weg: meine Kreatur stirbt durch den Gegner → die Drohne wird mir angeboten, danach DEM GEGNER der Soldat', d.length === 1 && f.length === 1 && /Explosive Drone/.test(f[0].d.message), { d: d.length, f: f.length, prompts: t.prompts.map(p => p.pi + ':' + p.d.title) });
    check('…die Drohne ist negiert (Ablage, nicht auf dem Brett), der Soldat steht beim Gegner, beide haben 2 gezogen', t.p0.discardPile.includes('Explosive Drone') && !t.engine.cardInstances.some(c => c.name === 'Explosive Drone' && c.zone === 'support') && !!aufBrett(t, 1) && t.p0.hand.length === 2 && t.p1.hand.length === 2, { abl: t.p0.discardPile, h0: t.p0.hand, h1: t.p1.hand });
  }

  console.log('CPU');
  {
    const s = loadCardEffect(FS), t = await fresh();
    check('antwortet auf die eigene Handfallen-Frage mit „ja“', (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: FS, message: 'x' }) || {}).confirmed === true);
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: 'Anderes', message: 'x' }) === undefined);
    check('`cpuMeta.reactionHeuristic` für das Kettenfenster', s.cpuMeta && typeof s.cpuMeta.reactionHeuristic === 'function' && s.cpuMeta.reactionHeuristic(t.engine) === true);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Front-Soldier-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
