'use strict';
// Spearman (Creature, Normal, Lv0, 50 HP, Summoning Magic): „Once per turn, when your opponent activates one of their Creatures' active effects, you may negate that
// effect and deal 50 damage to that Creature instead."
// Geprüft wird der ECHTE Aktivierungsweg (`host.doActivateCreatureEffect`) mit der Kette um die Aktivierung: der Speerkämpfer des Gegners steigt als Board-Creature-
// Reaktion ein (`isCreatureReaction`), gescriptete Antworten auf „Activate Spearman?" und die Deck-Galerie des angegriffenen Sky Shaman.
//   node scripts/skilltest-e2e/spearman.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const SP = 'Spearman';
const SHAMAN = 'Sky Shaman';                                // Gegner-Creature mit aktivem Effekt (Deck-Galerie), 50 HP
const DB = require('../../cards/effects/_card-db').getCardDB();
const [A, B, C] = Object.values(DB).filter(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level <= 1 && !/Token/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3).map(c => c.name);

/** Seite 0 ist am Zug (Main Phase 1) und besitzt den Schamanen; Seite 1 besitzt den/die Speerkämpfer. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = 2; gs.firstTurnProtectedPlayer = opts.erstzug ? 0 : null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = [];
  }
  p0.mainDeck = [A, B, C, B];
  engine._fastMode = false; engine._delay = async () => {};     // die Sim steht auf Fast-Mode: ohne das feuern Kreatur-Hooks nicht
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
function legeSchamane(t, slot = 0, heroIdx = 0) {
  const inst = t.engine._trackCard(SHAMAN, 0, 'support', heroIdx, slot);
  t.p0.supportZones[heroIdx][slot] = [SHAMAN];
  inst.turnPlayed = 1;
  return inst;
}
function legeSpeer(t, seat = 1, heroIdx = 0, slot = 0) {
  const inst = t.engine._trackCard(SP, seat, 'support', heroIdx, slot);
  t.gs.players[seat].supportZones[heroIdx][slot] = [SP];
  inst.turnPlayed = 1;
  return inst;
}
const aktivieren = (t, slot = 0, heroIdx = 0) => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx, zoneSlot: slot });
const speerFragen = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === SP);
const galerie = (t) => t.prompts.filter(p => p.d.type === 'cardGallery' && p.d.title === SHAMAN);
const log = (t, typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const anims = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'spearman_thrust').map(e => e.data);
const ja = (pi, d) => (d.type === 'confirm' && d.title === SP) ? true : undefined;
const nein = (pi, d) => (d.type === 'confirm' && d.title === SP) ? false : undefined;
const kombi = (...fs) => (pi, d) => { for (const f of fs) { const a = f(pi, d); if (a !== undefined) return a; } return undefined; };
const waehle = (name) => (pi, d) => (d.type === 'cardGallery' && d.title === SHAMAN) ? { cardName: name, source: 'deck' } : undefined;
const lebt = (t, inst) => t.engine.cardInstances.some(c => c.id === inst.id && c.zone === 'support');

(async () => {
  console.log('Karte und Skript');
  {
    const cd = DB[SP], s = loadCardEffect(SP);
    check('Creature, Normal, Lv0 (vorher Lv1), 50 HP, Summoning Magic', cd && cd.cardType === 'Creature' && cd.subtype === 'Normal' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: aktive Effekte (nicht mehr „once per turn effects")', cd && /^Once per turn, when your opponent activates one of their Creatures' active effects, you may negate that effect and deal 50 damage to that Creature instead\.$/.test(cd.effect), cd && cd.effect);
    check('Skript: Board-Creature-Reaktion (`isCreatureReaction`, Bedingung, Auflösung)', s && s.isCreatureReaction === true && typeof s.creatureReactionCondition === 'function' && typeof s.creatureReactionResolve === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst im Index und als Datei (natives Raster 96×65, ohne Verkleinerung)', idx[SP] && idx[SP].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[SP].id + '.png')));
    const { PNG } = (() => { try { return require('pngjs'); } catch { return {}; } })();
    if (PNG) { const im = PNG.sync.read(fs.readFileSync(path.join(__dirname, '../../data/card-art/native', idx[SP].id + '.png'))); check('…die Datei ist 96×65 Pixel groß', im.width === 96 && im.height === 65, [im.width, im.height]); }
  }

  console.log('Die Reaktion im Kettenfenster');
  {
    const t = await fresh();
    const schamane = legeSchamane(t);
    const speer = legeSpeer(t);
    t.antwort = ja;
    const r = await aktivieren(t);
    check('die Aktivierung läuft durch', r !== false, r);
    const f = speerFragen(t);
    check('der Gegner bekommt GENAU EIN Angebot „Activate Spearman?", Speerkämpfer links, der Auslöser (Sky Shaman) rechts', f.length === 1 && f[0].pi === 1 && f[0].d.showCardLeft === SP && f[0].d.showCard === SHAMAN, f.map(x => ({ pi: x.pi, l: x.d.showCardLeft, r: x.d.showCard })));
    check('der aktive Effekt wurde NEGIERT: der Schamane hat nichts getan (keine Galerie, Deck unverändert)', galerie(t).length === 0 && t.p0.mainDeck.join() === [A, B, C, B].join() && t.p0.discardPile.length === 0 || t.p0.discardPile.join() === SHAMAN, { gal: galerie(t).length, deck: t.p0.mainDeck, abl: t.p0.discardPile });
    check('…die Galerie des Effekts wurde nie geöffnet', galerie(t).length === 0, galerie(t).length);
    check('der Schamane bekam 50 Schaden und ist (50 HP) besiegt — er liegt in der Ablage seines Besitzers', !lebt(t, schamane) && t.p0.discardPile.includes(SHAMAN), { abl: t.p0.discardPile });
    check('der Speerkämpfer hat in diesem Zug gestochen (Stempel `_spearTurn`)', speer.counters._spearTurn === t.gs.turn, speer.counters);
    check('die Aktivierung gilt als verbraucht: Rundensperre der negierten Creature gestempelt', t.gs.hoptUsed && t.gs.hoptUsed[`creature-effect:${schamane.id}`] === t.gs.turn, t.gs.hoptUsed);
    const a = anims(t);
    check('Animation `spearman_thrust`: Ursprung = der Speerkämpfer (Seite 1, Held 0, Platz 0), Ziel = der Schamane (Seite 0)', a.length === 1 && a[0].zoneType === 'board' && a[0].originOwner === 1 && a[0].originHeroIdx === 0 && a[0].originZoneSlot === 0 && a[0].targets[0].owner === 0 && a[0].targets[0].zoneSlot === 0 && a[0].targets[0].cardName === SHAMAN, a);
    check('Log `spearman_negate` nennt das Ziel und die 50 Schaden', log(t, 'spearman_negate').some(l => l.target === SHAMAN && l.damage === 50), log(t, 'spearman_negate'));
    check('Log `card_negated` für die Aktivierung', log(t, 'card_negated').some(l => l.card === SHAMAN), log(t, 'card_negated'));
  }
  {
    // „you MAY": abgelehnt → der Effekt läuft normal, der Speerkämpfer hat nichts verbraucht
    const t = await fresh();
    const schamane = legeSchamane(t);
    const speer = legeSpeer(t);
    t.antwort = kombi(nein, waehle(B));
    await aktivieren(t);
    check('abgelehnt: der Schamane wirkt (die Galerie öffnet sich, die gewählte Karte liegt in der Ablage)', galerie(t).length === 1 && t.p0.discardPile.includes(B), { gal: galerie(t).length, abl: t.p0.discardPile });
    check('…der Schamane lebt, kein Schaden, der Speerkämpfer hat NICHT gestempelt', lebt(t, schamane) && !speer.counters._spearTurn && !anims(t).length, { lebt: lebt(t, schamane), c: speer.counters });
  }
  {
    // Einmal pro Zug JE SPEERKÄMPFER: zwei Kopien stechen zweimal, die dritte Aktivierung bleibt ungestört
    const t = await fresh();
    legeSchamane(t, 0, 0); legeSchamane(t, 0, 1); legeSchamane(t, 0, 2);
    const s1 = legeSpeer(t, 1, 0, 0), s2 = legeSpeer(t, 1, 1, 0);
    t.antwort = kombi(ja, waehle(A));
    await aktivieren(t, 0, 0);
    check('erste Aktivierung: Speerkämpfer 1 sticht', anims(t).length === 1 && speerFragen(t).length === 1, { a: anims(t).length, f: speerFragen(t).length });
    await aktivieren(t, 0, 1);
    check('zweite Aktivierung: Speerkämpfer 2 sticht (jede Kopie einmal pro Zug)', anims(t).length === 2 && speerFragen(t).length === 2, { a: anims(t).length, f: speerFragen(t).length });
    check('…beide gestempelt', s1.counters._spearTurn === t.gs.turn && s2.counters._spearTurn === t.gs.turn);
    await aktivieren(t, 0, 2);
    check('dritte Aktivierung: kein Angebot mehr, der Effekt läuft (Galerie öffnet sich)', speerFragen(t).length === 2 && anims(t).length === 2 && galerie(t).length === 1, { f: speerFragen(t).length, a: anims(t).length, g: galerie(t).length });
  }

  console.log('Wann der Speerkämpfer schweigt');
  {
    // Nur gegen den GEGNER: der eigene Speerkämpfer des Aktivierenden reagiert nicht
    const t = await fresh();
    legeSchamane(t);
    legeSpeer(t, 0, 1, 0);                                     // der Speerkämpfer steht bei SEITE 0, dem Aktivierenden
    t.antwort = kombi(ja, waehle(A));
    await aktivieren(t);
    check('der eigene Speerkämpfer des Aktivierenden bietet sich nicht an', speerFragen(t).length === 0 && !anims(t).length && galerie(t).length === 1, { f: speerFragen(t).length });
  }
  {
    const t = await fresh();
    legeSchamane(t);
    const speer = legeSpeer(t);
    speer.counters.frozen = 1;
    t.antwort = kombi(ja, waehle(A));
    await aktivieren(t);
    check('ein GEFRORENER Speerkämpfer ist stumm (kein Angebot, der Effekt läuft)', speerFragen(t).length === 0 && galerie(t).length === 1, { f: speerFragen(t).length, g: galerie(t).length });
  }
  {
    const t = await fresh({ erstzug: true });              // Seite 0 ist erster Zug: Seite 1 (der Reagierende) ist NICHT geschützt; Seite 0 aktiviert
    legeSchamane(t);
    legeSpeer(t);
    t.gs.firstTurnProtectedPlayer = 1;                       // der Reagierende steht unter Erstzug-Schutz → er darf nicht reagieren (Kettenfenster-Regel)
    t.antwort = kombi(ja, waehle(A));
    await aktivieren(t);
    check('unter dem Erstzug-Schutz des Reagierenden öffnet das Kettenfenster nicht für ihn', speerFragen(t).length === 0, speerFragen(t).length);
  }
  {
    // Der Speerkämpfer reagiert nicht auf Dinge, die KEINE Aktivierung einer Gegner-Creature sind (andere Kettenglieder)
    const t = await fresh();
    const s = loadCardEffect(SP);
    const speer = legeSpeer(t);
    const ctx = (chain) => ({ chain });
    check('Bedingung: keine Reaktion auf eine Kette, deren Initialkarte kein Creature-Effekt ist (Spell)', s.creatureReactionCondition(t.gs, 1, t.engine, ctx([{ isInitialCard: true, cardType: 'Spell', owner: 0 }]), speer) === false);
    check('Bedingung: keine Reaktion auf die eigene Aktivierung (Initialglied gehört mir)', s.creatureReactionCondition(t.gs, 1, t.engine, ctx([{ isInitialCard: true, cardType: 'CreatureEffect', owner: 1 }]), speer) === false);
    t.gs._creatureEffectActivationContext = { activatingInst: t.engine._trackCard(SHAMAN, 0, 'support', 0, 0), activator: 0 };
    check('Bedingung: Gegner-Aktivierung, Ziel auf dem Brett → wahr', s.creatureReactionCondition(t.gs, 1, t.engine, ctx([{ isInitialCard: true, cardType: 'CreatureEffect', owner: 0 }]), speer) === true);
    speer.counters._spearTurn = t.gs.turn;
    check('Bedingung: nach dem Stich in diesem Zug → falsch', s.creatureReactionCondition(t.gs, 1, t.engine, ctx([{ isInitialCard: true, cardType: 'CreatureEffect', owner: 0 }]), speer) === false);
    speer.counters._spearTurn = t.gs.turn - 1;
    check('Bedingung: Stich vom letzten Zug → wieder wahr (Rundengrenze)', s.creatureReactionCondition(t.gs, 1, t.engine, ctx([{ isInitialCard: true, cardType: 'CreatureEffect', owner: 0 }]), speer) === true);
  }

  console.log('CPU-Antworten');
  {
    const s = loadCardEffect(SP);
    const t = await fresh();
    check('die CPU nimmt „Activate Spearman?" an', (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: SP, message: 'x' }) || {}).confirmed === true);
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: 'Anderes', message: 'x' }) === undefined);
    check('Reaktions-Heuristik der CPU: immer (cpuMeta.reactionHeuristic)', typeof s.cpuMeta?.reactionHeuristic === 'function' && s.cpuMeta.reactionHeuristic() === true);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Spearman-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
