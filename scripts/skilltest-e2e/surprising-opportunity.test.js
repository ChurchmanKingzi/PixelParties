'use strict';
// Surprising Opportunity (Spell, Reaction, Lv1, Decay Magic + Magic Arts): „Play this card immediately when a Hero (yours or your
// opponent's) is defeated. Choose up to 2 cards from that Hero's Support Zones and add them to your hand before the Hero is defeated."
// Geprueft wird das neue Hand-Fenster „Held wird besiegt — VOR dem Aufraeumen" (`_checkHeroDefeatWindowReactions`) ueber den ECHTEN
// Todesweg (`actionDealDamage` mit toedlichem Schaden), mit gescripteten Antworten.
//   node scripts/skilltest-e2e/surprising-opportunity.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Surprising Opportunity';
const DB = require('../../cards/effects/_card-db').getCardDB();
const pick = (pred, n = 0) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[n].name;
const ARTEFAKT = pick(c => c.cardType === 'Artifact' && !c.name.includes('Race Boat') && (c.cost || 0) > 0);
const ARTEFAKT2 = pick(c => c.cardType === 'Artifact' && !c.name.includes('Race Boat') && (c.cost || 0) > 0, 3);
const KREATUR = pick(c => c.cardType === 'Creature' && c.level === 0 && c.subtype === 'Normal');
const KREATUR2 = pick(c => c.cardType === 'Creature' && c.level === 0 && c.subtype === 'Normal', 2);
const SPELL1 = pick(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level === 1);
const quelle = (seat, name = SPELL1) => ({ name, owner: seat, controller: seat });

/** Beide Helden-Seiten vorbereiten. `opts.wirker`: Faehigkeiten je Held von Sitz 0 (Standard: Held 0 kann den Zauber wirken). */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { engine, gs } = out;
  gs.turn = 5; gs.currentPhase = 3; gs.firstTurnProtectedPlayer = opts.schutz ?? null;
  const [p0, p1] = gs.players;
  const faehig = [['Decay Magic'], ['Magic Arts'], []];
  const keine = [[], [], []];
  const wirker = opts.wirker || [faehig, keine, keine];
  p0.abilityZones = p0.abilityZones.map((_, hi) => (wirker[hi] || keine).map(z => [...z]));
  p1.abilityZones = p1.abilityZones.map((_, hi) => (opts.wirker1 ? (opts.wirker1[hi] || keine) : keine).map(z => [...z]));
  for (const ps of [p0, p1]) {
    for (const h of ps.heroes) { h.hp = 300; h.maxHp = 300; h.statuses = {}; }
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.discardPile = []; ps.deletedPile = []; ps.hand = [];
  }
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support');
  p0.hand = opts.hand || [CARD];
  p1.hand = opts.hand1 || [];
  const t = { engine, gs, p0, p1, prompts: [], events: [], bestaetigen: true, zeugen: [], picks: [], waehle: (ziele) => ziele.slice(0, 2).map(z => z.id), hooks: [] };
  if (opts.mensch) { engine.isCpuPlayer = () => false; engine._fastMode = false; engine._inMctsSim = false; }
  engine.promptGeneric = async (pi, d) => {
    t.prompts.push({ pi, ...d });
    if (typeof t.beimFenster === 'function' && d.type === 'confirm' && d.title === CARD) t.beimFenster(pi);
    if (d.type === 'confirm') return typeof t.bestaetigen === 'function' ? t.bestaetigen(pi) : t.bestaetigen;
    if (d.type === 'optionPicker') return { optionId: 'hero-0' };
    return undefined;
  };
  engine.promptEffectTarget = async (pi, ziele, config) => {
    t.picks.push({ pi, ziele, config });
    return t.waehle(ziele);
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origHooks = engine.runHooks.bind(engine);
  engine.runHooks = async (name, ctx = {}) => {
    if (name === 'onCardsReturnedToHand' || name === 'onCardLeaveZone') t.hooks.push({ name, ctx });
    return origHooks(name, ctx);
  };
  return t;
}

/** Karte auf ein Brett legen (Zustand + Instanz). */
function lege(t, seat, hi, slot, name) {
  t.gs.players[seat].supportZones[hi][slot] = [name];
  return t.engine._trackCard(name, seat, 'support', hi, slot);
}
const angeboten = (t, pi) => t.prompts.some(p => p.type === 'confirm' && p.title === CARD && (pi == null || p.pi === pi));
const bild = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'surprising_opportunity');
const toedlich = (t, seat, hi, von = 1 - seat) => t.engine.actionDealDamage(quelle(von), t.gs.players[seat].heroes[hi], 9999, 'destruction_spell');
const imZug = (ps, name) => ps.supportZones.some(h => h.some(z => z.includes(name)));

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD);
    check('Hand-Fenster „Held wird besiegt", nie aktiv spielbar', !!s && s.isHeroDefeatWindowReaction === true && s.neverPlayable === true && s.canActivate() === false);
    const cd = DB[CARD];
    check('Kartendaten: Spell, Reaction, Lv1, Decay Magic + Magic Arts', cd.cardType === 'Spell' && cd.subtype === 'Reaction' && cd.level === 1 && cd.spellSchool1 === 'Decay Magic' && cd.spellSchool2 === 'Magic Arts', cd);
    check('Kartentext: „from that Hero\'s Support Zones … before the Hero is defeated"', /from that Hero's Support Zones/.test(cd.effect) && /before the Hero is defeated/.test(cd.effect), cd.effect);
  }
  console.log(`(Testkarten: Artefakte ${ARTEFAKT} / ${ARTEFAKT2}, Kreaturen ${KREATUR} / ${KREATUR2})`);

  console.log('Eigener Held fällt: das Fenster steht VOR dem Aufräumen');
  {
    const t = await fresh({ mensch: true });
    const eq = lege(t, 0, 1, 0, ARTEFAKT), kr = lege(t, 0, 1, 1, KREATUR), eq2 = lege(t, 0, 1, 2, ARTEFAKT2);
    let beim = null;
    t.beimFenster = () => { beim = { zone: JSON.parse(JSON.stringify(t.p0.supportZones[1])), ablage: [...t.p0.discardPile], hp: t.p0.heroes[1].hp }; };
    t.waehle = (ziele) => [ziele.find(z => z.cardName === ARTEFAKT).id, ziele.find(z => z.cardName === KREATUR).id];
    await toedlich(t, 0, 1);
    check('Held 1 fällt, Held 0 (Decay 1 + Magic Arts 1) wirkt: das Fenster wird angeboten', angeboten(t, 0), t.prompts.map(p => p.title));
    check('im Fenster liegen Ausrüstung UND Kreatur noch in den Support Zones, die Ablage ist leer, der Held steht bei 0 HP',
      !!beim && beim.zone.flat().includes(ARTEFAKT) && beim.zone.flat().includes(KREATUR) && beim.zone.flat().includes(ARTEFAKT2) && beim.ablage.length === 0 && beim.hp <= 0, beim);
    check('die Auswahl bietet alle drei Karten an, höchstens zwei wählbar (maxTotal 2)',
      t.picks.length === 1 && t.picks[0].ziele.length === 3 && t.picks[0].config.maxTotal === 2 && t.picks[0].config.minRequired === 1, t.picks.map(p => [p.ziele.length, p.config.maxTotal]));
    check('die zwei gewählten Karten liegen in der Hand, die Spielkarte in der Ablage', t.p0.hand.includes(ARTEFAKT) && t.p0.hand.includes(KREATUR) && !t.p0.hand.includes(CARD) && t.p0.discardPile.includes(CARD), { hand: t.p0.hand, abl: t.p0.discardPile });
    check('die gewählten Karten sind NICHT in der Ablage und nicht mehr im Feld', !t.p0.discardPile.includes(ARTEFAKT) && !t.p0.discardPile.includes(KREATUR) && !imZug(t.p0, ARTEFAKT) && !imZug(t.p0, KREATUR), { abl: t.p0.discardPile, zonen: t.p0.supportZones[1] });
    check('die dritte (nicht gewählte) Ausrüstung wird danach normal aufgeräumt → Ablage', t.p0.discardPile.includes(ARTEFAKT2) && !imZug(t.p0, ARTEFAKT2), { abl: t.p0.discardPile });
    check('der Held ist besiegt (0 HP)', t.p0.heroes[1].hp <= 0);
    check('Animation `surprising_opportunity` auf dem fallenden Helden', bild(t).length === 1 && bild(t)[0].data.owner === 0 && bild(t)[0].data.heroIdx === 1, bild(t));
    check('kein zweites Fenster nach dem Aufräumen (nur ein Angebot)', t.prompts.filter(p => p.type === 'confirm' && p.title === CARD).length === 1);
    check('Rückkehr-Hooks (Teppes …) feuern für Karten von den EIGENEN Helden', t.hooks.some(h => h.name === 'onCardsReturnedToHand' && h.ctx.ownerIdx === 0 && h.ctx.returnedCards.length === 2), t.hooks.map(h => h.name));
    check('Austritts-Haken der Karten laufen auch am Helden mit 0 HP (`_bypassDeadHeroFilter`)', t.hooks.some(h => h.name === 'onCardLeaveZone' && h.ctx.leavingCard === eq && h.ctx._bypassDeadHeroFilter === true));
  }

  console.log('Gegnerischer Held fällt: die Karten kommen in MEINE Hand');
  {
    const t = await fresh({ mensch: true });
    lege(t, 1, 0, 0, ARTEFAKT); lege(t, 1, 0, 1, KREATUR);
    t.waehle = (ziele) => ziele.map(z => z.id);
    await toedlich(t, 1, 0, 0);
    check('das Fenster wird MIR (Sitz 0) angeboten, dem Gegner der gefallenen Seite', angeboten(t, 0) && !angeboten(t, 1), t.prompts.map(p => [p.pi, p.title]));
    check('beide Karten des Gegner-Helden liegen in meiner Hand, nicht in seiner', t.p0.hand.includes(ARTEFAKT) && t.p0.hand.includes(KREATUR) && !t.p1.hand.includes(ARTEFAKT) && !t.p1.hand.includes(KREATUR), { h0: t.p0.hand, h1: t.p1.hand });
    check('sie fehlen in der gegnerischen Ablage (nicht aufgeräumt) und im Feld', !t.p1.discardPile.includes(ARTEFAKT) && !t.p1.discardPile.includes(KREATUR) && !imZug(t.p1, ARTEFAKT) && !imZug(t.p1, KREATUR), { abl: t.p1.discardPile });
    check('…aber ihr Besitzer ist der Gegner: wirft sie jemand ab, landen sie in SEINER Ablage', t.engine._handCardPileOwner(0, ARTEFAKT) === 1 && t.engine._handCardPileOwner(0, KREATUR) === 1, [t.engine._handCardPileOwner(0, ARTEFAKT), t.engine._handCardPileOwner(0, KREATUR)]);
    check('Rückkehr-Hooks (Teppes …) feuern NICHT: die Karten kamen nicht von EIGENEN Helden', !t.hooks.some(h => h.name === 'onCardsReturnedToHand'), t.hooks.map(h => h.name));
    check('es gibt genau eine Hand-Instanz je geholter Karte (keine Doppelung)', ['hand'].every(() => t.engine.cardInstances.filter(c => c.zone === 'hand' && c.name === ARTEFAKT).length <= 1 && t.engine.cardInstances.filter(c => c.zone === 'hand' && c.name === KREATUR).length <= 1));
    check('Animation auf dem GEGNER-Helden (Seite 1)', bild(t).length === 1 && bild(t)[0].data.owner === 1 && bild(t)[0].data.heroIdx === 0, bild(t));
  }

  console.log('Bot: nimmt die wertvollsten zwei');
  {
    const t = await fresh();       // Sitz 0 ist ein Bot
    lege(t, 1, 0, 0, KREATUR2); lege(t, 1, 0, 1, ARTEFAKT); lege(t, 1, 0, 2, ARTEFAKT2);
    await toedlich(t, 1, 0, 0);
    check('der Bot spielt die Karte ohne Zielwahl-Dialog', t.picks.length === 0 && t.p0.discardPile.includes(CARD), t.picks.length);
    const teuer = [ARTEFAKT, ARTEFAKT2].sort((a, b) => (DB[b].cost || 0) - (DB[a].cost || 0));
    check('er nimmt zwei Karten (die teuren Ausrüstungen vor der Stufe-0-Kreatur)', t.p0.hand.length === 2 && teuer.every(n => t.p0.hand.includes(n)), t.p0.hand);
  }

  console.log('Beide Seiten halten die Karte: der Besitzer des fallenden Helden zuerst, danach der andere');
  {
    const t = await fresh({ mensch: true, hand1: [CARD], wirker1: [[['Decay Magic'], ['Magic Arts'], []], [[], [], []], [[], [], []]] });
    lege(t, 1, 1, 0, ARTEFAKT); lege(t, 1, 1, 1, KREATUR); lege(t, 1, 1, 2, ARTEFAKT2);
    const ordnung = [];
    t.beimFenster = (pi) => ordnung.push(pi);
    t.waehle = (ziele) => ziele.slice(0, 2).map(z => z.id);
    // Held 1 von Sitz 1 faellt; Sitz 1 hat Held 0 als Wirker, Sitz 0 ebenfalls
    t.engine.isCpuPlayer = () => false;
    await toedlich(t, 1, 1, 0);
    check('Reihenfolge der Angebote: erst Sitz 1 (Besitzer des Helden), dann Sitz 0', ordnung[0] === 1 && ordnung[1] === 0, ordnung);
    check('Sitz 1 nahm zwei Karten, für Sitz 0 blieb genau eine übrig (ein Zug: ein Fenster je Karte)', t.p1.hand.length === 2 && t.p0.hand.length === 1, { h1: t.p1.hand, h0: t.p0.hand });
    check('beide Spielkarten liegen in der Ablage ihres Spielers', t.p1.discardPile.includes(CARD) && t.p0.discardPile.includes(CARD));
  }

  console.log('Was NICHT gewählt werden darf');
  {
    const t = await fresh({ mensch: true });
    const tok = lege(t, 0, 1, 0, 'Pollution Token');
    const fest = lege(t, 0, 1, 1, ARTEFAKT); fest.counters.immovable = true;
    const verdeckt = lege(t, 0, 1, 2, KREATUR); verdeckt.faceDown = true;
    await toedlich(t, 0, 1);
    check('nur Token, unbewegliche und verdeckte Karten: kein Angebot (nichts zu holen)', !angeboten(t) && t.p0.hand.length === 1, t.prompts.map(p => p.title));
  }
  {
    const t = await fresh({ mensch: true });
    lege(t, 0, 1, 0, 'Pollution Token'); lege(t, 0, 1, 1, ARTEFAKT);
    const fest = lege(t, 0, 1, 2, ARTEFAKT2); fest.counters.immovable = true;
    await toedlich(t, 0, 1);
    check('gemischt: nur die bewegliche Karte steht zur Wahl', t.picks.length === 1 && t.picks[0].ziele.length === 1 && t.picks[0].ziele[0].cardName === ARTEFAKT, t.picks.map(p => p.ziele.map(z => z.cardName)));
  }
  {
    const t = await fresh({ mensch: true });
    lege(t, 0, 1, 0, ARTEFAKT);
    await t.engine.actionDealDamage(quelle(1), t.p0.heroes[1], 100, 'destruction_spell');
    check('ein Held, der nur Schaden nimmt und überlebt, öffnet kein Fenster', !angeboten(t) && t.p0.heroes[1].hp > 0);
  }

  console.log('„Up to 2“ erlaubt auch null Karten');
  {
    const t = await fresh({ mensch: true });
    lege(t, 0, 1, 0, ARTEFAKT); lege(t, 0, 1, 1, KREATUR);
    t.waehle = () => [];      // Abbruch: „Take nothing“
    await toedlich(t, 0, 1);
    check('die Zielwahl ist abbrechbar („Take nothing“)', t.picks.length === 1 && t.picks[0].config.cancellable === true && t.picks[0].config.cancelLabel === 'Take nothing', t.picks.map(p => p.config));
    check('Abbruch: keine Karte in der Hand, die Spielkarte ist trotzdem gespielt (Ablage), die Ausrüstung wird normal aufgeräumt',
      t.p0.hand.length === 0 && t.p0.discardPile.includes(CARD) && t.p0.discardPile.includes(ARTEFAKT), { hand: t.p0.hand, abl: t.p0.discardPile });
  }

  console.log('Wirker: ein LEBENDER eigener Held mit Decay Magic + Magic Arts');
  {
    const t = await fresh({ mensch: true, wirker: [[[], [], []], [['Decay Magic'], ['Magic Arts'], []], [[], [], []]] });
    lege(t, 0, 1, 0, ARTEFAKT);
    await toedlich(t, 0, 1);
    check('der einzige taugliche Held ist der fallende selbst: kein Angebot (ein toter Held wirkt nicht)', !angeboten(t), t.prompts.map(p => p.title));
  }
  {
    // Zwei Schulen auf der Karte: wie bei jedem Zwei-Schulen-Spell genügt EINE davon in Stufe 1 (Engine-Regel `heroMeetsLevelReq`).
    const t = await fresh({ mensch: true, wirker: [[['Decay Magic'], [], []], [[], [], []], [[], [], []]] });
    lege(t, 1, 0, 0, ARTEFAKT);
    await toedlich(t, 1, 0, 0);
    check('nur Decay Magic 1: der Held kann den Zwei-Schulen-Zauber wirken → Angebot', angeboten(t, 0), t.prompts.map(p => p.title));
  }
  {
    const t = await fresh({ mensch: true, wirker: [[['Magic Arts'], [], []], [[], [], []], [[], [], []]] });
    lege(t, 1, 0, 0, ARTEFAKT);
    await toedlich(t, 1, 0, 0);
    check('nur Magic Arts 1: ebenso → Angebot', angeboten(t, 0), t.prompts.map(p => p.title));
  }
  {
    const t = await fresh({ mensch: true, wirker: [[['Summoning Magic'], [], []], [[], [], []], [[], [], []]] });
    lege(t, 1, 0, 0, ARTEFAKT);
    await toedlich(t, 1, 0, 0);
    check('keine der beiden Schulen (nur Summoning Magic): kein Angebot', !angeboten(t), t.prompts.map(p => p.title));
  }
  {
    const t = await fresh({ mensch: true, wirker: [[['Decay Magic'], [], []], [[], [], []], [[], [], []]] });
    t.gs.players[0].heroes[0].statuses.frozen = { turns: 1 };
    lege(t, 1, 0, 0, ARTEFAKT);
    await toedlich(t, 1, 0, 0);
    check('der einzige taugliche Held ist eingefroren: kein Angebot', !angeboten(t), t.prompts.map(p => p.title));
  }

  console.log('Sperren');
  {
    const t = await fresh({ mensch: true, schutz: 0 });
    lege(t, 1, 0, 0, ARTEFAKT);
    await toedlich(t, 1, 0, 0);
    check('Erst-Runden-Schutz des Reagierenden: kein Angebot', !angeboten(t), t.prompts.map(p => p.title));
  }
  {
    const t = await fresh({ mensch: true });
    lege(t, 1, 0, 0, ARTEFAKT);
    t.bestaetigen = false;
    await toedlich(t, 1, 0, 0);
    check('„No": nichts passiert, die Karte bleibt auf der Hand, der Held wird normal aufgeräumt', angeboten(t, 0) && t.p0.hand.includes(CARD) && t.p1.discardPile.includes(ARTEFAKT) && t.picks.length === 0, { hand: t.p0.hand, abl: t.p1.discardPile });
  }

  console.log('Der Todesweg bleibt heil');
  {
    const t = await fresh({ mensch: true });
    lege(t, 1, 0, 0, ARTEFAKT);
    t.bestaetigen = false;
    const vorher = t.p1.heroes[0].hp;
    await toedlich(t, 1, 0, 0);
    check('ohne Annahme läuft der Tod wie vorher (Held 0 HP, Ausrüstung in der Ablage)', t.p1.heroes[0].hp <= 0 && vorher > 0 && t.p1.discardPile.includes(ARTEFAKT));
    const u = await fresh({ mensch: true, hand: [] });
    lege(u, 1, 0, 0, ARTEFAKT);
    await toedlich(u, 1, 0, 0);
    check('ohne die Karte auf der Hand: kein Fenster, Aufräumen wie gewohnt', !angeboten(u) && u.p1.discardPile.includes(ARTEFAKT));
  }

  console.log(fails === 0 ? '\n✓ Surprising-Opportunity-Tests grün' : `\n✗ ${fails} Fehler`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
