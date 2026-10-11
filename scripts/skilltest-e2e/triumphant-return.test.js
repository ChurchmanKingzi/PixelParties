'use strict';
// Triumphant Return (Spell/Reaction, Magic Arts Lv1): „Play this card immediately when a Hero you control, except the user, is revived. Immediately
// perform an additional Action with that Hero." — Das neue Hand-Fenster `isHeroRevivedReaction` (`_checkHeroRevivedHandReactions`), das nach JEDER
// echten Wiederbelebung läuft (`actionReviveHero`, Extra Life); die Zusatzaktion gehört dem WIEDERBELEBTEN Helden, nie dem Wirker.
//   node scripts/skilltest-e2e/triumphant-return.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const TR = 'Triumphant Return';
const DB = require('../../cards/effects/_card-db').getCardDB();
const SPELL = 'Burning Finger';       // Destruction Magic Lv1, ohne Sonderbedingung: der wiederbelebte Held (Destruction Magic 1) kann ihn sofort wirken

/** Spiel mit zwei Sitzen: Sitz 0 am Zug. Held 0 hat Magic Arts Lv1 (Wirker), Held 1 liegt tot da (hp 0) und hat Destruction Magic Lv1, Held 2 hat nichts. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = 3; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = [];
    ps.heroesActedThisTurn = [];
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
  }
  p0.abilityZones[0] = [[opts.caster === false ? 'Fighting' : 'Magic Arts'], [], []];
  p0.abilityZones[1] = [['Destruction Magic'], [], []];
  p0.heroes[1].hp = 0; p0.heroes[1].diedOnTurn = 4; p0.heroes[1]._koProcessed = true;
  const t = { room, host, engine, gs, p0, p1, prompts: [], events: [], logs: [], sofort: [], antwort: null, echteAktion: !!opts.echteAktion };
  const origPg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => {
    t.prompts.push({ pi, d });
    if (t.antwort) { const a = t.antwort(pi, d); if (a !== undefined) return a; }
    if (d.type === 'confirm' && d.title === TR) return true;
    if (d.type === 'heroAction') return { cancelled: true };
    return origPg(pi, d, ...r);
  };
  if (!opts.echteAktion) {
    // die Zusatzaktion mitschreiben: wer, mit welchem Helden, mit welchem Banner
    engine.performImmediateAction = async (pi, heroIdx, cfg) => { t.sofort.push({ pi, heroIdx, cfg }); return { played: false }; };
  }
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, d) => { t.logs.push({ type, d }); return origLog(type, d); };
  return t;
}
function setzeHand(t, names, seat = 0) {
  t.gs.players[seat].hand = [...names];
  for (const n of names) t.engine._trackCard(n, seat, 'hand');
}
const wiederbeleben = (t, seat = 0, heroIdx = 1) => t.engine.actionReviveHero(seat, heroIdx, 100, { source: 'Test', animDelay: 0 });
const angebot = (t, pi = 0) => t.prompts.filter(p => p.pi === pi && p.d.type === 'confirm' && p.d.title === TR);
const anims = (t, typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data.type === typ).map(e => e.data);

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[TR], s = loadCardEffect(TR);
    check('Spell, Reaction, Lv1, Magic Arts', cd && cd.cardType === 'Spell' && cd.subtype === 'Reaction' && cd.level === 1 && cd.spellSchool1 === 'Magic Arts', cd);
    check('Kartentext: „except the user" und die sofortige Zusatzaktion mit DEM Helden', cd && /Hero you control, except the user, is revived/.test(cd.effect) && /Immediately perform an additional Action with that Hero/.test(cd.effect), cd && cd.effect);
    check('Skript: Hand-Fenster `isHeroRevivedReaction`, nie aktiv spielbar, Wirker-Filter', s.isHeroRevivedReaction === true && s.neverPlayable === true && typeof s.reactionCasterAllowed === 'function' && typeof s.heroRevivedResolve === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst nativ 76×51 im Index und als Datei', idx[TR] && idx[TR].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[TR].id + '.png')));
  }
  console.log(`(Testzauber des wiederbelebten Helden: ${SPELL})`);

  console.log('Wiederbelebung → Angebot → Zusatzaktion des WIEDERBELEBTEN');
  {
    const t = await fresh();
    setzeHand(t, [TR]);
    const ok = await wiederbeleben(t);
    check('der Held lebt wieder', ok === true && t.p0.heroes[1].hp === 100, [ok, t.p0.heroes[1].hp]);
    const a = angebot(t);
    check('die Karte wird dem Kontrolleur angeboten (Held: „wurde wiederbelebt")', a.length === 1 && a[0].d._handReactionWindow === true && a[0].d.showCardLeft === t.p0.heroes[1].name && /revived/.test(a[0].d.message), a.map(x => x.d.message));
    check('Triumphant Return ist gespielt (Ablage, nicht mehr auf der Hand)', t.p0.discardPile.includes(TR) && !t.p0.hand.includes(TR), { abl: t.p0.discardPile, hand: t.p0.hand });
    check('die Zusatzaktion geht SOFORT an den WIEDERBELEBTEN Helden (Held 1) — nicht an den Wirker (Held 0)', t.sofort.length === 1 && t.sofort[0].pi === 0 && t.sofort[0].heroIdx === 1, t.sofort);
    check('…mit Banner „Triumphant Return"', t.sofort[0] && t.sofort[0].cfg.title === TR && /perform an additional Action/.test(t.sofort[0].cfg.description), t.sofort[0] && t.sofort[0].cfg);
    const an = anims(t, 'triumphant_return');
    check('Animation `triumphant_return` am wiederbelebten Helden (Seite 0, Held 1)', an.length === 1 && an[0].owner === 0 && an[0].heroIdx === 1 && an[0].zoneSlot === -1, an);
    check('Log `hero_revived_window_reaction` und `triumphant_return`', t.logs.some(l => l.type === 'hero_revived_window_reaction') && t.logs.some(l => l.type === 'triumphant_return' && l.d.acted === false), t.logs.map(l => l.type).slice(-6));
  }

  console.log('„except the user": der Wirker ist nie der Wiederbelebte');
  {
    const t = await fresh({ caster: false });                      // Held 0 kann kein Magic Arts → der einzige mögliche Wirker wäre der Wiederbelebte
    t.p0.abilityZones[1] = [['Magic Arts'], [], []];                // nur Held 1 (der Wiederbelebte) hätte Magic Arts
    setzeHand(t, [TR]);
    await wiederbeleben(t);
    check('kann nur der WIEDERBELEBTE selbst die Karte wirken: sie wird gar nicht angeboten', angebot(t).length === 0 && t.p0.hand.includes(TR) && t.sofort.length === 0, { frag: angebot(t).length, hand: t.p0.hand });
  }
  {
    const t = await fresh();
    t.p0.abilityZones[1] = [['Magic Arts'], [], []];                // BEIDE können — der Wirker ist trotzdem Held 0
    setzeHand(t, [TR]);
    await wiederbeleben(t);
    check('können beide: angeboten, die Aktion gehört dem Wiederbelebten (Held 1), kein Wirker-Picker (nur ein erlaubter Wirker)', angebot(t).length === 1 && t.sofort[0] && t.sofort[0].heroIdx === 1 && !t.prompts.some(p => p.d.type === 'optionPicker'), { sofort: t.sofort, prompts: t.prompts.map(p => p.d.type) });
  }

  console.log('Nur der KONTROLLEUR bekommt das Angebot');
  {
    const t = await fresh();
    setzeHand(t, [TR], 0);                                          // Sitz 0 hält die Karte …
    t.p1.heroes[1].hp = 0; t.p1.heroes[1]._koProcessed = true;      // … aber der Held des GEGNERS wird wiederbelebt
    await wiederbeleben(t, 1, 1);
    check('ein Held des Gegners: keine Frage an Sitz 0, Karte bleibt auf der Hand', angebot(t, 0).length === 0 && t.p0.hand.includes(TR), { frage0: angebot(t, 0).length });
  }
  {
    const t = await fresh();
    await wiederbeleben(t);
    check('ohne Karte auf der Hand: nichts wird gefragt, kein Fehler', t.prompts.length === 0 && t.sofort.length === 0);
  }
  {
    const t = await fresh();
    setzeHand(t, [TR]);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === TR) ? false : undefined;
    await wiederbeleben(t);
    check('„Nein": die Karte bleibt auf der Hand, keine Zusatzaktion', t.p0.hand.includes(TR) && t.sofort.length === 0 && !t.p0.discardPile.includes(TR), { hand: t.p0.hand, sofort: t.sofort.length });
  }

  console.log('Extra Life zählt als Wiederbelebung');
  {
    const t = await fresh();
    t.p0.heroes[1].hp = 800; t.p0.heroes[1].diedOnTurn = undefined; delete t.p0.heroes[1]._koProcessed;
    t.engine.addExtraLife(t.p0.heroes[1], { by: 'Test' });
    setzeHand(t, [TR]);
    await t.engine.actionDefeatHero({ name: 'Test', owner: 1 }, t.p0.heroes[1], { skipDefeatReactions: true });
    check('der Held kehrt über sein Extra Life zurück …', t.p0.heroes[1].hp > 0, t.p0.heroes[1].hp);
    check('… und Triumphant Return wird angeboten; die Aktion geht an ihn', angebot(t).length === 1 && t.sofort.length === 1 && t.sofort[0].heroIdx === 1, { frage: angebot(t).length, sofort: t.sofort });
  }

  console.log('Verfall der Bonus-Aktion (echte Engine-Aktion)');
  {
    const t = await fresh({ echteAktion: true });
    setzeHand(t, [TR]);                                              // nach dem Spielen ist die Hand leer: keine Karte, keine Ability mit Aktionskosten
    await wiederbeleben(t);
    check('der Wiederbelebte hat keine legitime Aktion: KEIN Auswahlfenster, die Bonus-Aktion verfällt (Karte trotzdem verbraucht)',
      !t.prompts.some(p => p.d.type === 'heroAction') && t.p0.discardPile.includes(TR), { prompts: t.prompts.map(p => p.d.type) });
    check('…das Log meldet den Verfall (`acted: false`)', t.logs.some(l => l.type === 'triumphant_return' && l.d.acted === false), t.logs.map(l => l.type).slice(-5));
  }
  {
    const t = await fresh({ echteAktion: true });
    setzeHand(t, [TR, SPELL]);                                       // ein Zauber, den der Wiederbelebte (Destruction Magic 1) wirken kann
    await wiederbeleben(t);
    const w = t.prompts.filter(p => p.d.type === 'heroAction');
    check('mit spielbarem Zauber: das Aktionsfenster öffnet SOFORT für den Wiederbelebten (Held 1) mit genau seinen Karten', w.length === 1 && w[0].pi === 0 && w[0].d.heroIdx === 1 && w[0].d.eligibleCards.includes(SPELL), w.map(x => [x.pi, x.d.heroIdx, x.d.eligibleCards]));
    check('…der Wirker (Held 0) gibt keine eigenen Karten her: sein Banner nennt den Wiederbelebten', w[0] && w[0].d.heroName === t.p0.heroes[1].name && w[0].d.title === TR, w[0] && [w[0].d.heroName, w[0].d.title]);
    check('Abbruch des Fensters: nichts gespielt, der Zauber bleibt auf der Hand (aufgespart wird nichts)', t.p0.hand.includes(SPELL) && t.logs.some(l => l.type === 'triumphant_return' && l.d.acted === false), { hand: t.p0.hand });
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Triumphant-Return-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
