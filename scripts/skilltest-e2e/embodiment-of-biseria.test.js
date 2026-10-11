'use strict';
// Embodiment of Biseria (Creature, Summoning Magic Lv9, 400 HP): „This Creature's level in your hand is reduced by the combined original levels
// of all Creatures on the board, except "Embodiment of Biseria", to a minimum of 1. This Creature cannot be Frozen. You may once per turn
// choose a target and deal 300 damage to it OR Freeze all Creatures your opponent controls for 1 turn."
//   node scripts/skilltest-e2e/embodiment-of-biseria.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const BIS = 'Embodiment of Biseria';
const DB = require('../../cards/effects/_card-db').getCardDB();
const pick = (pred, n = 0) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[n].name;
const normal = (c) => c.cardType === 'Creature' && c.subtype === 'Normal' && !/Token|Race Boat/.test(c.name) && c.name !== BIS && (c.hp || 0) > 0
  && !loadCardEffect(c.name)?.selfFreezeImmune;
const L = (lvl, n = 0) => pick(c => normal(c) && c.level === lvl, n);
const EQUIP = pick(c => c.cardType === 'Artifact' && (c.subtype || '').toLowerCase() === 'equipment');

/** Spiel mit zwei Sitzen: Sitz 0 am Zug (Action Phase), Biseria steht auf Held 0, Platz 0 (über den echten Einsetzweg, also mit `onPlay`). */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = 2; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = [];
  }
  const t = { room, host, engine, gs, p0, p1, events: [], opt: [], ziele: [], optBoten: [], zielBoten: [] };
  const stelle = (pi, name, hi, slot) => {
    gs.players[pi].supportZones[hi][slot] = [name];
    const inst = engine._trackCard(name, pi, 'support', hi, slot);
    inst.turnPlayed = 1;
    return inst;
  };
  t.stelle = stelle;
  // Biseria über den Einsetzweg, damit `onPlay` (Frost-Immunität) läuft
  if (opts.biseria !== false) {
    t.bis = stelle(0, BIS, 0, 0);
    await loadCardEffect(BIS).hooks.onPlay({ card: t.bis, playedCard: t.bis, _engine: engine, gameState: gs });
  }
  // Wahlfenster der Karte: ODER-Auswahl und Zielwahl werden aus Warteschlangen beantwortet.
  engine.promptGeneric = async (pi, cfg) => { t.optBoten.push(cfg); const w = t.opt.shift(); return w === undefined ? { optionId: 'damage' } : w; };
  engine.promptEffectTarget = async (pi, ziele, cfg) => {
    t.zielBoten.push({ pi, ids: ziele.map(z => z.id), cfg });
    const f = t.ziele.shift();
    return f ? f(pi, ziele, cfg) : [];
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  return t;
}
const aktivieren = (t) => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 });
const anims = (t, typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data.type === typ).map(e => e.data);
const stufeInHand = (t, opts = {}) => t.engine.effectiveCardLevel(DB[BIS], 0, { handIdx: 0, ...opts });
/** Biseria als Handkarte (die Handkopie ist eine getrackte Instanz, wie im echten Spiel). */
const handKopie = (t) => { t.p0.hand = [BIS]; return t.engine._trackCard(BIS, 0, 'hand'); };
const waehleHeld = (pi, ziele) => ziele.filter(z => z.type === 'hero' && z.owner === 1 && !z.ineligible).slice(0, 1).map(z => z.id);

(async () => {
  console.log('Karte und Skript');
  {
    const cd = DB[BIS], s = loadCardEffect(BIS);
    check('Creature, Summoning Magic, Lv9, 400 HP', cd && cd.cardType === 'Creature' && cd.spellSchool1 === 'Summoning Magic' && cd.level === 9 && cd.hp === 400, cd);
    check('Kartentext: Handstufe ohne „Summoning Magic“-Einschränkung, Mindeststufe 1', cd && /reduced by the combined original levels of all Creatures on the board, except "Embodiment of Biseria", to a minimum of 1\./.test(cd.effect), cd && cd.effect);
    check('Kartentext: nicht einfrierbar; 1× pro Zug 300 Schaden ODER alle Gegnerkreaturen 1 Zug einfrieren', cd && /cannot be Frozen/.test(cd.effect) && /deal 300 damage to it OR Freeze all Creatures your opponent controls for 1 turn/.test(cd.effect), cd && cd.effect);
    check('Skript: Kreatureneffekt, in Hand UND Support aktiv, `reduceCardLevel`, AoE-Flag', s.creatureEffect === true && s.activeIn.includes('hand') && s.activeIn.includes('support') && typeof s.reduceCardLevel === 'function' && s.hitsMultipleTargets === true);
    check('Skript: `selfFreezeImmune` (aus „Freeze it“-Kosten heraushalten)', s.selfFreezeImmune === true);
  }

  console.log('Stufe in der Hand');
  {
    const t = await fresh({ biseria: false });
    handKopie(t);
    check('leeres Brett: gedruckte Stufe 9', stufeInHand(t) === 9, stufeInHand(t));
    t.stelle(0, L(1), 0, 0); t.stelle(1, L(2), 0, 0); t.stelle(1, L(3), 1, 0);
    check('Stufen 1 + 2 + 3 auf BEIDEN Seiten → 9 − 6 = Stufe 3', stufeInHand(t) === 3, stufeInHand(t));
    const eq = t.stelle(0, EQUIP, 1, 0);
    check('Ausrüstung in einer Support Zone zählt nicht', stufeInHand(t) === 3, stufeInHand(t));
    t.engine._untrackCard(eq.id); t.gs.players[0].supportZones[1][0] = [];
    t.stelle(1, L(4), 2, 0); t.stelle(0, L(4), 2, 0);
    check('summiert die Stufen 14 > 8: nicht unter Stufe 1 („to a minimum of 1“)', stufeInHand(t) === 1, stufeInHand(t));
  }
  {
    const t = await fresh({ biseria: false });
    handKopie(t);
    t.stelle(0, L(2), 0, 0);
    const fremde = t.stelle(1, BIS, 0, 0);
    check('eine ANDERE „Embodiment of Biseria“ auf dem Brett zählt nicht mit (Stufe 9 − 2 = 7)', stufeInHand(t) === 7, stufeInHand(t));
    check('…und eine Brettkopie hat keine gesenkte Stufe („in your hand“)', t.engine.effectiveCardLevel(DB[BIS], 1, { inst: fremde }) === 9, t.engine.effectiveCardLevel(DB[BIS], 1, { inst: fremde }));
    check('in Ablage/Deck (pileSide) gilt die gedruckte Stufe 9', t.engine.effectiveCardLevel(DB[BIS], 0, { pileSide: 'discard' }) === 9);
  }
  {
    const t = await fresh({ biseria: false });
    t.p0.hand = [BIS, BIS];
    t.engine._trackCard(BIS, 0, 'hand'); t.engine._trackCard(BIS, 0, 'hand');
    t.stelle(0, L(1), 0, 0); t.stelle(1, L(2), 0, 0);
    check('zwei Kopien auf der Hand senken einander nicht doppelt (je Stufe 9 − 3 = 6)', stufeInHand(t) === 6 && t.engine.effectiveCardLevel(DB[BIS], 0, { handIdx: 1 }) === 6, [stufeInHand(t), t.engine.effectiveCardLevel(DB[BIS], 0, { handIdx: 1 })]);
  }

  console.log('Nicht einfrierbar');
  {
    const t = await fresh();
    check('`freeze_immune` nach dem Einsetzen', t.bis.counters.freeze_immune === 1);
    const ok = await t.engine.applyCreatureStatus(t.bis, 'frozen', { duration: 1, sourceOwner: 1, source: 'Test' });
    check('Frost wird verweigert', ok === false && !t.bis.counters.frozen, { ok, frozen: t.bis.counters.frozen });
    const nachbar = t.stelle(0, L(1), 0, 1);
    const ok2 = await t.engine.applyCreatureStatus(nachbar, 'frozen', { duration: 1, sourceOwner: 1, source: 'Test' });
    check('eine gewöhnliche Kreatur lässt sich einfrieren (der Test taugt)', ok2 !== false && !!nachbar.counters.frozen, { ok2 });
  }

  console.log('Schaden-Modus');
  {
    const t = await fresh();
    t.stelle(1, L(1), 0, 0);
    t.ziele.push(waehleHeld);
    const hp0 = t.p1.heroes[0].hp;
    t.opt.push({ optionId: 'damage' });
    const r = await aktivieren(t);
    check('die Aktivierung läuft', r !== false, r);
    check('mit gegnerischer Kreatur erscheint die ODER-Wahl (gerrymander-fähig, Karte gezeigt)', t.optBoten.length === 1 && t.optBoten[0].type === 'optionPicker' && t.optBoten[0].options.map(o => o.id).join() === 'damage,freeze' && t.optBoten[0].gerrymanderEligible === true, t.optBoten.map(o => o.options));
    check('300 Schaden auf den gewählten Helden', t.p1.heroes[0].hp === hp0 - 300, [hp0, t.p1.heroes[0].hp]);
    const a = anims(t, 'biseria_fist');
    check('Animation `biseria_fist` auf dem Ziel (Seite 1, Held 0)', a.length === 1 && a[0].owner === 1 && a[0].heroIdx === 0 && a[0].zoneSlot === -1, a);
    const r2 = await aktivieren(t);
    check('ein zweiter Einsatz in demselben Zug ist gesperrt (einmal pro Zug)', r2 === false || t.p1.heroes[0].hp === hp0 - 300, { r2, hp: t.p1.heroes[0].hp });
    check('…und es kam keine zweite Frage', t.zielBoten.length === 1, t.zielBoten.length);
  }
  {
    const t = await fresh();
    const kre = t.stelle(1, L(0), 1, 0);
    const hp = DB[kre.name].hp;
    t.ziele.push((pi, ziele) => ziele.filter(z => z.cardInstance && z.cardInstance.id === kre.id).map(z => z.id));
    await aktivieren(t);
    check('wählt man eine Kreatur: Creature-Effekt-Schaden 300 (stirbt oder nimmt Schaden)', !t.p1.supportZones[1][0].length || (kre.counters.damageTaken || 0) === 300, { zone: t.p1.supportZones[1], genommen: kre.counters.damageTaken, hp });
    const a = anims(t, 'biseria_fist');
    check('…die Animation sitzt auf ihrer Zone (Held 1, Slot 0)', a.length === 1 && a[0].owner === 1 && a[0].heroIdx === 1 && a[0].zoneSlot === 0, a);
  }
  {
    const t = await fresh();                       // Gegner ohne Kreaturen: keine ODER-Wahl, nur der Schaden
    t.ziele.push(waehleHeld);
    const hp0 = t.p1.heroes[0].hp;
    await aktivieren(t);
    check('ohne gegnerische Kreatur fällt die ODER-Wahl weg (direkt zur Zielwahl)', t.optBoten.length === 0 && t.zielBoten.length === 1 && t.p1.heroes[0].hp === hp0 - 300, { frag: t.optBoten.length, ziel: t.zielBoten.length, hp: t.p1.heroes[0].hp });
  }
  {
    const t = await fresh();
    t.stelle(1, L(1), 0, 0);
    t.ziele.push(() => []);                        // Abbruch der Zielwahl
    await aktivieren(t);
    check('Abbruch der Zielwahl: kein Schaden, keine Animation', anims(t, 'biseria_fist').length === 0 && t.p1.heroes.every(h => h.hp === 800));
    t.ziele.push(waehleHeld);
    t.opt.push({ optionId: 'damage' });
    await aktivieren(t);
    check('…und die Nutzung ist NICHT verbraucht (zweiter Versuch trifft)', t.p1.heroes[0].hp === 500, t.p1.heroes.map(h => h.hp));
  }
  {
    const t = await fresh();
    t.stelle(1, L(1), 0, 0);
    t.opt.push(null);                              // Abbruch der ODER-Wahl
    await aktivieren(t);
    check('Abbruch der ODER-Wahl: nichts geschieht (kein Schaden, keine Zielwahl, keine Animation)', t.p1.heroes.every(h => h.hp === 800) && t.zielBoten.length === 0 && anims(t, 'biseria_fist').length === 0 && anims(t, 'biseria_blizzard').length === 0);
    t.opt.push({ optionId: 'damage' }); t.ziele.push(waehleHeld);
    await aktivieren(t);
    check('…und die Nutzung bleibt frei (der zweite Versuch trifft)', t.p1.heroes[0].hp === 500, t.p1.heroes.map(h => h.hp));
  }

  console.log('Frost-Modus');
  {
    const t = await fresh();
    const g1 = t.stelle(1, L(1), 0, 0), g2 = t.stelle(1, L(2), 1, 0), g3 = t.stelle(1, L(3), 2, 1);
    const eigene = t.stelle(0, L(1), 1, 0);
    t.opt.push({ optionId: 'freeze' });
    const r = await aktivieren(t);
    check('die Aktivierung läuft', r !== false, r);
    check('ALLE Kreaturen des Gegners sind eingefroren (3 von 3)', [g1, g2, g3].every(g => !!g.counters.frozen), [g1, g2, g3].map(g => g.counters.frozen));
    check('…für 1 Zug', [g1, g2, g3].every(g => !g.counters.frozenDuration || g.counters.frozenDuration === 1), [g1, g2, g3].map(g => g.counters.frozenDuration));
    check('eigene Kreaturen und Biseria bleiben unberührt', !eigene.counters.frozen && !t.bis.counters.frozen);
    check('Helden werden nicht eingefroren (nur „Creatures“)', t.p1.heroes.every(h => !h.statuses.frozen) && t.p0.heroes.every(h => !h.statuses.frozen));
    const a = anims(t, 'biseria_blizzard');
    check('Animation `biseria_blizzard`: Brett-Animation über die Gegnerseite, Ursprung Biseria, drei Ziele', a.length === 1 && a[0].zoneType === 'board' && a[0].regionOwner === 1 && a[0].originOwner === 0 && a[0].originHeroIdx === 0 && a[0].originZoneSlot === 0 && a[0].targets.length === 3, a);
    check('…die Ziele tragen Seite, Held und Platz', a[0] && a[0].targets.some(x => x.owner === 1 && x.heroIdx === 2 && x.zoneSlot === 1), a[0] && a[0].targets);
    const r2 = await aktivieren(t);
    check('dieselbe Nutzung ist für den Zug verbraucht — auch der Schaden-Zweig ist gesperrt', r2 === false && t.zielBoten.length === 0, { r2 });
  }
  {
    const t = await fresh();
    const immun = t.stelle(1, BIS, 0, 0);
    await loadCardEffect(BIS).hooks.onPlay({ card: immun, playedCard: immun, _engine: t.engine, gameState: t.gs });
    const g = t.stelle(1, L(1), 1, 0);
    t.opt.push({ optionId: 'freeze' });
    await aktivieren(t);
    check('eine nicht einfrierbare Gegner-Kreatur bleibt frei, die übrigen frieren ein, nichts bricht ab', !immun.counters.frozen && !!g.counters.frozen, { immun: immun.counters.frozen, g: g.counters.frozen });
  }

  console.log('CPU-Wahl (ohne Gehirn)');
  {
    const t = await fresh();
    t.stelle(1, L(1), 0, 0); t.stelle(1, L(2), 1, 0);
    const s = loadCardEffect(BIS);
    const w2 = s.cpuResponse(t.engine, 'generic', { type: 'optionPicker', title: BIS, casterIdx: 0 });
    check('zwei Gegner-Kreaturen: die CPU wählt Frost', w2 && w2.optionId === 'freeze', w2);
    t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === 1).slice(1).forEach(c => t.engine._untrackCard(c.id));
    const w1 = s.cpuResponse(t.engine, 'generic', { type: 'optionPicker', title: BIS, casterIdx: 0 });
    check('nur eine: Schaden', w1 && w1.optionId === 'damage', w1);
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: BIS }) === undefined);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Embodiment-of-Biseria-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
