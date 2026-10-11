'use strict';
// Amazing Finding (Attack, Fighting Lv0): „Reveal the top card of your deck until you reveal something other than an Artifact. Add all cards revealed by this effect
// to your hand. You cannot reveal more than 3 cards with this effect. Shuffle the first Non-Artifact card you reveal back into your deck. If this is the first Attack
// you use this turn, this counts as an additional Action." Geprueft wird der ECHTE Spielweg (`host.doPlaySpell`).
//   node scripts/skilltest-e2e/amazing-finding.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Amazing Finding';
const DB = require('../../cards/effects/_card-db').getCardDB();
const alle = (pred) => Object.values(DB).filter(pred).map(c => c.name).sort();
const ART = alle(c => c.cardType === 'Artifact' && c.subtype === 'Normal' && !/Token/.test(c.name));
const [A1, A2, A3, A4] = ART;
const EQ = alle(c => c.cardType === 'Artifact' && c.subtype === 'Equipment')[0];
const ACR = alle(c => c.cardType === 'Artifact' && c.subtype === 'Creature')[0];
const KRE = alle(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name))[0];
const SPELL = alle(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level === 1)[0];
const REST = alle(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 1 && !/Token|Race Boat/.test(c.name)).slice(0, 6);
const stapel = (name, n) => Array.from({ length: n }, () => name);

async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = null; gs.skillTest = null;
  const [p0, p1] = gs.players;
  p0.abilityZones = p0.abilityZones.map((_, hi) => [stapel('Fighting', hi === 0 ? 1 : 0), [], []]);
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.discardPile = []; ps.hand = []; ps.heroesActedThisTurn = []; ps.attacksPlayedThisTurn = opts.attacks || 0;
  }
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support');
  p0.hand = [CARD];
  p0.mainDeck = [...opts.deck, ...REST];
  p0.deckTopVisible = [];
  const t = { room, host, engine, gs, p0, p1, events: [], deckVorher: [...p0.mainDeck] };
  engine._broadcastEvent = ((orig) => (ev, data, ...r) => { t.events.push({ ev, data }); return orig(ev, data, ...r); })(engine._broadcastEvent.bind(engine));
  t.logs = [];
  const origLog = engine.log.bind(engine);
  engine.log = (type, data) => { t.logs.push({ type, data }); return origLog(type, data); };
  engine.promptGeneric = async () => undefined;
  return t;
}
const spiele = (t, heroIdx = 0) => t.host.doPlaySpell(t.room, 0, { cardName: CARD, handIndex: 0, heroIdx });
const summe = (arr) => arr.slice().sort().join('|');
const reveals = (t) => t.events.filter(e => e.ev === 'mill_center_reveal').map(e => ({ n: e.data.cardNames[0], dest: e.data.dest }));
const glint = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'finding_glint');

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Attack, Normal, Lv0, Fighting', cd && cd.cardType === 'Attack' && cd.subtype === 'Normal' && cd.level === 0 && cd.spellSchool1 === 'Fighting', cd);
    check('Kartentext: bis zu 3 aufdecken, Artefakte auf die Hand, erstes Nicht-Artefakt mischen, Zusatzaktion bei der ersten Attack', cd && /^Reveal the top card of your deck until you reveal something other than an Artifact\. Add all Artifacts revealed by this effect to your hand\. You cannot reveal more than 3 cards with this effect\. Shuffle the first Non-Artifact card you reveal back into your deck\. If this is the first Attack you use this turn, this counts as an additional Action\.$/.test(cd.effect), cd && cd.effect);
    check('`inherentAction` als FUNKTION (Quick-Attack-Vertrag)', typeof s.inherentAction === 'function');
  }
  console.log(`(Testkarten: Artefakte ${A1}, ${A2}, ${A3}, ${A4}; Ausrüstung ${EQ}; Artefakt-Kreatur ${ACR}; Kreatur ${KRE}; Spell ${SPELL})`);

  console.log('Gleich ein Nicht-Artefakt oben');
  {
    const t = await fresh({ deck: [KRE, A1, A2] });
    const r = await spiele(t);
    check('der Zauber läuft durch', r === true, r);
    check('die Nicht-Artefakt-Karte kommt NICHT auf die Hand (sie wird ins Deck gemischt), die Hand ist leer', t.p0.hand.length === 0 && !t.p0.hand.includes(KRE), t.p0.hand);
    check('…sie liegt weiter im Deck (Deckgröße unverändert), nichts ging verloren', summe(t.p0.mainDeck) === summe(t.deckVorher), { vorher: t.deckVorher.length, nachher: t.p0.mainDeck.length });
    const rv = reveals(t);
    check('genau EINE Aufdeckung (Flug zurück ins Deck)', rv.length === 1 && rv[0].n === KRE && rv[0].dest === 'deck', rv);
    check('Funkel-Animation `finding_glint` auf dem Deck des Wirkers', glint(t).length === 1 && glint(t)[0].data.targets[0].deck === true && glint(t)[0].data.targets[0].owner === 0, glint(t));
    const l = t.logs.find(x => x.type === 'amazing_finding');
    check('Log `amazing_finding`: keine Artefakte, gemischt', l && l.data.artifacts.length === 0 && l.data.shuffled === KRE, l);
    check('Amazing Finding liegt in der Ablage', t.p0.discardPile.includes(CARD), t.p0.discardPile);
  }

  console.log('Artefakte, dann ein Nicht-Artefakt');
  {
    const t = await fresh({ deck: [A1, A2, KRE, A3] });
    await spiele(t);
    check('beide Artefakte auf der Hand, das Nicht-Artefakt NICHT', summe(t.p0.hand) === summe([A1, A2]), t.p0.hand);
    check('Deck: zwei Karten weniger, die Kreatur ist wieder drin', t.p0.mainDeck.length === t.deckVorher.length - 2 && t.p0.mainDeck.includes(KRE) && !t.p0.mainDeck.includes(A1) && !t.p0.mainDeck.includes(A2), { n: t.p0.mainDeck.length });
    const rv = reveals(t);
    check('drei Aufdeckungen: Artefakt, Artefakt (je → Hand), Nicht-Artefakt (→ Deck)', rv.length === 3 && rv[0].dest === 'hand' && rv[1].dest === 'hand' && rv[2].dest === 'deck' && rv[2].n === KRE, rv);
    const l = t.logs.find(x => x.type === 'amazing_finding');
    check('Log nennt beide Artefakte und die gemischte Karte', l && l.data.artifacts.join() === [A1, A2].join() && l.data.shuffled === KRE, l);
  }
  {
    const t = await fresh({ deck: [EQ, ACR, SPELL, A1] });
    await spiele(t);
    check('Ausrüstung und Artefakt-Kreatur zählen als Artefakte (Hand), ein Spell beendet die Suche', summe(t.p0.hand) === summe([EQ, ACR]) && t.p0.mainDeck.includes(SPELL), { hand: t.p0.hand });
  }

  console.log('Höchstens 3 Karten');
  {
    const t = await fresh({ deck: [A1, A2, A3, A4, KRE] });
    await spiele(t);
    check('drei Artefakte in Folge: alle drei auf der Hand, das vierte bleibt unberührt oben', summe(t.p0.hand) === summe([A1, A2, A3]) && t.p0.mainDeck[0] === A4, { hand: t.p0.hand, top: t.p0.mainDeck[0] });
    check('es wird NICHT gemischt (kein Nicht-Artefakt aufgedeckt): die Reihenfolge des Rests bleibt', t.p0.mainDeck.join() === t.deckVorher.slice(3).join(), t.p0.mainDeck.slice(0, 4));
    check('genau drei Aufdeckungen, alle → Hand', reveals(t).length === 3 && reveals(t).every(x => x.dest === 'hand'), reveals(t));
    const l = t.logs.find(x => x.type === 'amazing_finding');
    check('Log: drei Artefakte, nichts gemischt', l && l.data.artifacts.length === 3 && l.data.shuffled === null, l);
  }
  {
    const t = await fresh({ deck: [A1, A2, KRE, A3] });
    await spiele(t);
    check('Artefakt, Artefakt, Nicht-Artefakt = drei Aufdeckungen — das vierte Artefakt wird NICHT mehr aufgedeckt', !t.p0.hand.includes(A3) && reveals(t).length === 3, { hand: t.p0.hand, rv: reveals(t) });
  }

  console.log('Randfälle');
  {
    const t = await fresh({ deck: [] });
    t.p0.mainDeck = [];
    const r = await spiele(t);
    check('leeres Deck: der Zauber läuft ohne Wirkung durch (keine Aufdeckung)', r === true && t.p0.hand.length === 0 && reveals(t).length === 0, { r, rv: reveals(t) });
  }
  {
    const t = await fresh({ deck: [A1] });
    t.p0.mainDeck = [A1];
    await spiele(t);
    check('Deck mit nur einem Artefakt: es kommt auf die Hand, das Deck ist danach leer, es wird nichts weiter aufgedeckt', t.p0.hand.includes(A1) && t.p0.mainDeck.length === 0 && reveals(t).length === 1, { hand: t.p0.hand, deck: t.p0.mainDeck.length });
  }

  console.log('Zusatzaktion: die ERSTE Attack des Zuges');
  {
    const t = await fresh({ deck: [KRE], attacks: 0, phase: 2 });
    check('noch keine Attack gespielt → `cardHasInherentAction` wahr', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === true);
    await spiele(t);
    check('Main Phase 1: die Aktion bleibt frei (Phase unverändert, Held nicht „acted“)', t.gs.currentPhase === 2 && !t.p0.heroesActedThisTurn.includes(0) && !t.gs._pendingActionBurn, { ph: t.gs.currentPhase, acted: t.p0.heroesActedThisTurn, burn: t.gs._pendingActionBurn });
    check('…der Attack-Zähler steht danach auf 1', t.p0.attacksPlayedThisTurn === 1, t.p0.attacksPlayedThisTurn);
  }
  {
    const t = await fresh({ deck: [KRE], attacks: 1, phase: 3 });
    check('schon eine Attack gespielt → `cardHasInherentAction` falsch', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === false);
    await spiele(t);
    check('Action Phase: die zweite Attack kostet die Aktion (Held „acted“ oder Phase weiter)', t.p0.heroesActedThisTurn.includes(0) || t.gs.currentPhase !== 3, { ph: t.gs.currentPhase, acted: t.p0.heroesActedThisTurn });
  }

  console.log(fails === 0 ? '\nALLE GRÜN' : `\n${fails} FEHLER`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
