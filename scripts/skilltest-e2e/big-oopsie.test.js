'use strict';
// Big Oopsie (Spell, Destruction Magic Lv1): „Your opponent chooses a target they control and deals 150/300/450 damage to it. If the user is an
// Ascended Hero, this counts as an additional Action. You can only play 1 "Big Oopsie" per turn."
// Geprueft wird der ECHTE Spielweg (`host.doPlaySpell`) mit gescripteter Gegnerwahl, dazu die Einsatzregeln je Held und Phase.
//   node scripts/skilltest-e2e/big-oopsie.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Big Oopsie';
const DB = require('../../cards/effects/_card-db').getCardDB();
const pick = (pred, n = 0) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[n].name;
const KRE = pick(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0);
const ASC = pick(c => c.cardType === 'Ascended Hero');

/** Spiel mit zwei Sitzen: Sitz 0 wirkt (Destruction `dm`), Sitz 1 waehlt. `phase` 3 = Action, 2 = Main. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 3; gs.firstTurnProtectedPlayer = null;
  const [p0, p1] = gs.players;
  const stapel = (n) => Array.from({ length: n }, () => 'Destruction Magic');
  p0.abilityZones = p0.abilityZones.map((_, hi) => [stapel(hi === 0 ? (opts.dm ?? 1) : (opts.dm1 ?? 0)), [], []]);
  p1.abilityZones = p1.abilityZones.map(() => [[], [], []]);
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.discardPile = []; ps.hand = [];
  }
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support');
  p0.hand = opts.hand || [CARD];
  const t = { room, host, engine, gs, p0, p1, geboten: [], wer: [], wahl: opts.wahl || ((valid) => valid.find(v => v.type === 'hero')), events: [], hooks: {} };
  // Seite 1 ist ein Bot: die Zielwahl laeuft durch den echten Dispatcher (Schutz, Markierung) bis zur CPU-Antwort — die ist hier gescriptet.
  engine._getCpuTargetResponse = (valid, config, prompted) => {
    t.geboten.push(valid.map(v => `${v.owner}:${v.type}:${v.cardName}`)); t.wer.push(prompted); t.config = config;
    const w = t.wahl(valid);
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
function alsAscended(t, seat, hi) {
  const h = t.gs.players[seat].heroes[hi];
  h.name = ASC;
  const inst = t.engine.cardInstances.find(c => c.zone === 'hero' && c.owner === seat && c.heroIdx === hi);
  if (inst) { inst.name = ASC; inst.script = loadCardEffect(ASC); t.engine._clearHeroScriptCache?.(h); }
}
const spiele = (t, heroIdx = 0) => t.host.doPlaySpell(t.room, 0, { cardName: CARD, handIndex: 0, heroIdx });
const stempel = () => loadCardEffect(CARD).__stempel;

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Spell, Normal, Lv1, Destruction Magic', cd && cd.cardType === 'Spell' && cd.subtype === 'Normal' && cd.level === 1 && cd.spellSchool1 === 'Destruction Magic', cd);
    check('Kartentext: Gegner wählt, 150/300/450, Ascended Hero, 1 pro Zug', cd && /Your opponent chooses a target they control and deals 150\/300\/450 damage to it\./.test(cd.effect) && /Ascended Hero/.test(cd.effect) && /only play 1 "Big Oopsie" per turn/.test(cd.effect), cd && cd.effect);
    check('`inherentAction` als FUNKTION (je Held), `spellPlayCondition` für „1 pro Zug"', typeof s.inherentAction === 'function' && typeof s.spellPlayCondition === 'function');
  }
  console.log(`(Testkarten: Kreatur ${KRE}, Ascended Hero ${ASC})`);

  console.log('Der GEGNER wählt ein Ziel auf SEINER Seite');
  {
    const t = await fresh({ dm: 1 });
    lege(t, 1, 0, 0, KRE);
    lege(t, 0, 0, 0, KRE);                 // eigene Kreatur des Wirkers: darf nie zur Wahl stehen
    const hp0 = t.p1.heroes[0].hp;
    const r = await spiele(t);
    check('der Zauber läuft durch', r === true, r);
    check('die Wahl wird SITZ 1 (dem Gegner) vorgelegt', t.wer.length === 1 && t.wer[0] === 1, t.wer);
    check('zur Wahl stehen nur Ziele auf der Seite des Gegners (Helden und Kreatur), nichts vom Wirker', t.geboten[0].length >= 2 && t.geboten[0].every(x => x.startsWith('1:')) && t.geboten[0].some(x => x.includes(':hero:')) && t.geboten[0].some(x => x.includes(KRE)), t.geboten);
    check('die Wahl ist Pflicht (nicht abbrechbar)', t.config && t.config.cancellable === false, t.config);
    check('der gewählte Held des Gegners nimmt 150 Schaden (Destruction Magic 1)', t.p1.heroes[0].hp === hp0 - 150, [hp0, t.p1.heroes[0].hp]);
    check('der Wirker und seine Karten bleiben unberührt', t.p0.heroes.every(h => h.hp === 800) && t.p0.supportZones[0][0][0] === KRE, t.p0.heroes.map(h => h.hp));
    check('Big Oopsie liegt in der Ablage des Wirkers', t.p0.discardPile.includes(CARD) && t.p0.hand.length === 0, { abl: t.p0.discardPile, hand: t.p0.hand });
    const anim = t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'big_oopsie');
    check('Animation `big_oopsie` auf dem gewählten Ziel (Seite 1, Held 0)', anim.length === 1 && anim[0].data.owner === 1 && anim[0].data.heroIdx === 0 && anim[0].data.zoneSlot === -1, anim);
  }
  for (const [dm, erwartet] of [[1, 150], [2, 300], [3, 450], [5, 450]]) {
    const t = await fresh({ dm });
    const hp0 = t.p1.heroes[0].hp;
    await spiele(t);
    check(`Destruction Magic ${dm}${dm > 3 ? ' (Deckel 3)' : ''}: ${erwartet} Schaden`, t.p1.heroes[0].hp === hp0 - erwartet, [hp0, t.p1.heroes[0].hp]);
  }
  {
    const t = await fresh({ dm: 2, wahl: (valid) => valid.find(v => v.type === 'equip') });
    const inst = lege(t, 1, 1, 0, KRE);
    await spiele(t);
    check('wählt der Gegner eine Kreatur: sie nimmt 300 Schaden und fällt (Stufe-0-Kreatur)', !t.p1.supportZones[1][0].length && t.p1.discardPile.includes(KRE), { zone: t.p1.supportZones[1], abl: t.p1.discardPile });
    const anim = t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'big_oopsie');
    check('…die Animation sitzt auf ihrer Zone (Held 1, Slot 0)', anim.length === 1 && anim[0].data.heroIdx === 1 && anim[0].data.zoneSlot === 0, anim);
    void inst;
  }

  console.log('„Only 1 per turn“');
  {
    const t = await fresh({ dm: 1, hand: [CARD, CARD] });
    const r1 = await spiele(t);
    const hp1 = t.p1.heroes[0].hp;
    const r2 = await spiele(t);
    check('der erste Wurf läuft, der zweite Big Oopsie in demselben Zug nicht (Karte bleibt auf der Hand, nichts passiert)', r1 === true && r2 !== true && t.p0.hand.includes(CARD) && t.p1.heroes[0].hp === hp1, { r1, r2, hand: t.p0.hand });
    check('die Karte ist nach dem ersten Wurf ausgegraut (`spellPlayCondition`)', loadCardEffect(CARD).spellPlayCondition(t.gs, 0) === false);
    t.gs.turn += 1;
    check('im nächsten Zug ist sie wieder spielbar', loadCardEffect(CARD).spellPlayCondition(t.gs, 0) === true);
  }

  console.log('Zusatzaktion für einen Ascended Hero — je Held, je Phase');
  {
    const t = await fresh({ dm: 1, phase: 2 });
    t.p0.abilityZones[1] = [stap(1), [], []];
    alsAscended(t, 0, 1);
    const cd = DB[CARD];
    check('Ascended Hero (Held 1): `cardHasInherentAction` wahr', t.engine.cardHasInherentAction(0, 1, cd) === true);
    check('gewöhnlicher Held (Held 0): `cardHasInherentAction` falsch', t.engine.cardHasInherentAction(0, 0, cd) === false);
    const liste = t.engine.getHeroPlayableCards(0);
    const namen = (hi) => ((liste.own && liste.own[hi]) || []).map(c => (typeof c === 'string' ? c : c.name));
    check('Main Phase: spielbar NUR vom Ascended Hero', namen(1).includes(CARD) && !namen(0).includes(CARD), { h0: namen(0), h1: namen(1) });
    t.gs.currentPhase = 3;
    const liste3 = t.engine.getHeroPlayableCards(0);
    const namen3 = (hi) => ((liste3.own && liste3.own[hi]) || []).map(c => (typeof c === 'string' ? c : c.name));
    check('Action Phase: BEIDE Helden dürfen sie nutzen', namen3(0).includes(CARD) && namen3(1).includes(CARD), { h0: namen3(0), h1: namen3(1) });
  }
  function stap(n) { return Array.from({ length: n }, () => 'Destruction Magic'); }
  {
    const t = await fresh({ dm: 1 });
    alsAscended(t, 0, 0);
    await spiele(t, 0);
    check('Action Phase MIT Ascended Hero: die Aktion wird NICHT verbraucht (inherent)', stempel() && stempel().inherent === true && stempel().haupt === false, stempel());
  }
  {
    const t = await fresh({ dm: 1 });
    await spiele(t, 0);
    check('Action Phase mit gewöhnlichem Helden: die Aktion wird verbraucht', stempel() && stempel().inherent === false, stempel());
  }
  {
    const t = await fresh({ dm: 1, phase: 2 });
    const r = await spiele(t, 0);
    check('Main Phase mit gewöhnlichem Helden: nicht spielbar, nichts bewegt sich', r !== true && t.p0.hand.includes(CARD) && t.p1.heroes[0].hp === 800, { r });
  }
  {
    const t = await fresh({ dm: 1, phase: 2 });
    alsAscended(t, 0, 0);
    const r = await spiele(t, 0);
    check('Main Phase MIT Ascended Hero: spielbar und gratis', r === true && t.p1.heroes[0].hp === 650 && stempel() && stempel().inherent === true, { r, hp: t.p1.heroes[0].hp, st: stempel() });
  }

  console.log('Der Bot als Gegner (ohne Gehirn): so wenig verlieren wie möglich');
  {
    const t = await fresh({ dm: 3 });
    t.engine.isPuzzle = true;                       // `cpuResponse` greift nur ohne CPU-Gehirn
    delete t.engine._getCpuTargetResponse;          // Standardweg: Skript-Antwort
    t.p1.heroes[0].hp = 100; t.p1.heroes[1].hp = 800; t.p1.heroes[2].hp = 100;
    const r = await spiele(t);
    check('der Bot-Gegner opfert nicht den sterbenden Helden: er wählt den mit den meisten HP (überlebt)', r === true && t.p1.heroes[0].hp === 100 && t.p1.heroes[2].hp === 100 && t.p1.heroes[1].hp === 800 - 450, t.p1.heroes.map(h => h.hp));
  }

  console.log(fails === 0 ? '\n✓ Big-Oopsie-Tests grün' : `\n✗ ${fails} Fehler`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
