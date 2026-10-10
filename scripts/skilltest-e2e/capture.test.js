'use strict';
// Capture (Attack, Fighting Lv1): „Choose a level 1/2/3 or lower Creature your opponent controls and take permanent control of it. Place it in
// one of the user's free Support Zones. If the user is equipped with "Truth-Seeing Eye", this counts as an additional Action."
// Geprueft wird der ECHTE Spielweg (`host.doPlaySpell`) mit gescripteten Antworten, dazu die Einsatzregeln je Held und Phase
// (`getHeroPlayableCards`, `cardHasInherentAction`).
//   node scripts/skilltest-e2e/capture.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Capture';
const DB = require('../../cards/effects/_card-db').getCardDB();
const pick = (pred, n = 0) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[n].name;
const KRE = (lvl, n = 0) => pick(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === lvl && !/Token|Race Boat/.test(c.name), n);
const K0 = KRE(0), K1 = KRE(1), K2 = KRE(2), K3 = KRE(3), K4 = KRE(4);
const EYE = 'Truth-Seeing Eye';

/** Spiel mit zwei Sitzen. `fighting` = Fighting-Stufe von Held 0 (Held 1: `fighting1`). Sitz 0 spielt, Sitz 1 hat die Ziele. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 3; gs.firstTurnProtectedPlayer = null;
  const [p0, p1] = gs.players;
  const stapel = (n) => Array.from({ length: n }, () => 'Fighting');
  p0.abilityZones = p0.abilityZones.map((_, hi) => [stapel(hi === 0 ? (opts.fighting ?? 1) : (opts.fighting1 ?? 0)), [], []]);
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    for (const h of ps.heroes) { h.hp = 300; h.maxHp = 300; h.statuses = {}; }
    ps.discardPile = []; ps.hand = [];
  }
  p1.abilityZones = p1.abilityZones.map(() => [[], [], []]);
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support');
  p0.hand = [CARD];
  const t = { room, host, engine, gs, p0, p1, wahl: [], zonen: [], events: [], cancelTarget: false, zonePickIdx: 0, verfuegbar: [] };
  // Sitz 0 ist ein Bot: die Zielwahl laeuft durch den echten Dispatcher (Schutz, Markierung) bis zur CPU-Antwort — die ist hier gescriptet.
  engine._getCpuTargetResponse = (valid) => { t.verfuegbar = valid.map(v => v.cardName); t.wahl.push(valid.map(v => v.cardName)); return t.cancelTarget ? [] : valid.slice(0, 1).map(v => v.id); };
  engine.promptGeneric = async (pi, d) => {
    if (d.type === 'zonePick') { t.zonen.push(d.zones.map(z => `${z.heroIdx}:${z.slotIdx}`)); const z = d.zones[t.zonePickIdx] || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx }; }
    return undefined;
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  // Welche Stempel trug der Spielweg beim Wirken? (inherent / Hauptaktion)
  const skript = loadCardEffect(CARD);
  if (!skript.__beobachtet) {
    const orig = skript.hooks.onPlay;
    skript.hooks.onPlay = async function (ctx) { skript.__stempel = { inherent: !!ctx.gameState._spellWasInherent, haupt: !!ctx.gameState._spellConsumedMainAction }; return orig.call(this, ctx); };
    skript.__beobachtet = true;
  }
  skript.__stempel = null;
  return t;
}
function lege(t, seat, hi, slot, name) {
  t.gs.players[seat].supportZones[hi][slot] = [name];
  return t.engine._trackCard(name, seat, 'support', hi, slot);
}
const spiele = (t, heroIdx = 0) => t.host.doPlaySpell(t.room, 0, { cardName: CARD, handIndex: 0, heroIdx });
const kreisAnim = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'capture_lasso');

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Attack, Fighting Lv1, Normal', cd.cardType === 'Attack' && cd.level === 1 && cd.spellSchool1 === 'Fighting', cd);
    check('Kartentext enthält die Truth-Seeing-Eye-Klausel', /If the user is equipped with "Truth-Seeing Eye", this counts as an additional Action\./.test(cd.effect), cd.effect);
    check('Boris-Sperre (`takesControlOfTargets`) und `inherentAction` als FUNKTION (je Held)', s.takesControlOfTargets === true && typeof s.inherentAction === 'function');
  }
  console.log(`(Testkreaturen: Lv0 ${K0}, Lv1 ${K1}, Lv2 ${K2}, Lv3 ${K3}, Lv4 ${K4})`);

  console.log('Stufengrenze = Fighting-Stufe des Nutzers');
  for (const [f, erlaubt, nicht] of [[1, [K0, K1], [K2, K3, K4]], [2, [K0, K1, K2], [K3, K4]], [3, [K0, K1, K2, K3], [K4]], [5, [K0, K1, K2, K3], [K4]]]) {
    const t = await fresh({ fighting: f });
    lege(t, 1, 0, 0, K0); lege(t, 1, 0, 1, K1); lege(t, 1, 1, 0, K2); lege(t, 1, 1, 1, K3); lege(t, 1, 2, 0, K4);
    const r = await spiele(t);
    const gewaehlt = t.wahl[0] || [];
    check(`Fighting ${f}${f > 3 ? ' (Deckel 3)' : ''}: wählbar ${erlaubt.length} Kreaturen (bis Lv${Math.min(f, 3)}), die höheren nicht`,
      r === true && erlaubt.every(n => gewaehlt.includes(n)) && nicht.every(n => !gewaehlt.includes(n)), { r, gewaehlt });
  }

  console.log('Dauerhafte Kontrolle, freie Zone des Nutzers');
  {
    const t = await fresh({ fighting: 1 });
    const inst = lege(t, 1, 0, 0, K1);
    const r = await spiele(t);
    check('der Spielweg lief durch', r === true, r);
    check('die Kreatur liegt in einer Support Zone des Nutzers (Held 0)', t.p0.supportZones[0].some(z => z[0] === K1) && !t.p1.supportZones[0].some(z => z.includes(K1)), { p0: t.p0.supportZones[0], p1: t.p1.supportZones[0] });
    check('Kontrolle dauerhaft: Kontrolleur = Sitz 0, Besitzer (originalOwner) bleibt Sitz 1', inst.controller === 0 && inst.owner === 0 && inst.originalOwner === 1, { c: inst.controller, o: inst.owner, oo: inst.originalOwner });
    check('die Kreatur ist NICHT negiert (der Text sagt nichts davon)', !inst.counters.negated && !(inst.counters.buffs && Object.keys(inst.counters.buffs).length), inst.counters);
    check('die Attack liegt in der Ablage, die Hand ist leer', t.p0.discardPile.includes(CARD) && t.p0.hand.length === 0, { disc: t.p0.discardPile, hand: t.p0.hand });
    check('Bild: Held rennt an (`play_ram_animation`), dann Lasso (`capture_lasso`), dann Flug (`play_card_transfer`)', (() => {
      const i = (ev) => t.events.findIndex(e => e.ev === ev);
      return i('play_ram_animation') >= 0 && kreisAnim(t).length === 1 && i('play_card_transfer') > t.events.findIndex(e => e.data && e.data.type === 'capture_lasso') && i('play_ram_animation') < t.events.findIndex(e => e.data && e.data.type === 'capture_lasso');
    })(), t.events.map(e => e.ev + (e.data && e.data.type ? ':' + e.data.type : '')));
    check('`capture_lasso` sitzt auf der Zone der gefangenen Kreatur (Seite 1, Held 0, Slot 0)', kreisAnim(t)[0].data.owner === 1 && kreisAnim(t)[0].data.heroIdx === 0 && kreisAnim(t)[0].data.zoneSlot === 0, kreisAnim(t));
    check('nach dem Zug der Gegner bleibt sie in meinem Besitz (permanent)', (() => { t.gs.turn += 1; return inst.controller === 0 && t.p0.supportZones[0].some(z => z[0] === K1); })());
  }
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 1, 0, 0, K1);
    lege(t, 0, 0, 0, K0);                      // eine der drei Zonen von Held 0 ist belegt: zwei frei → der Spieler wählt
    t.zonePickIdx = 1;
    await spiele(t);
    check('zwei freie Zonen: der Spieler wählt, und zwar NUR unter den Zonen des Nutzers (Held 0, Slot 1 und 2)', t.zonen.length === 1 && t.zonen[0].join() === '0:1,0:2', t.zonen);
    check('…die gewählte (zweite) Zone nimmt die Kreatur', t.p0.supportZones[0][2][0] === K1 && t.p0.supportZones[0][1].length === 0, t.p0.supportZones[0]);
  }
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 1, 0, 0, K1);
    lege(t, 0, 0, 0, K0); lege(t, 0, 0, 1, K0);   // genau eine frei
    await spiele(t);
    check('genau eine freie Zone: keine Zonenwahl, die Kreatur landet dort', t.zonen.length === 0 && t.p0.supportZones[0][2][0] === K1, { zonen: t.zonen, z: t.p0.supportZones[0] });
  }
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 1, 0, 0, K1);
    lege(t, 0, 0, 0, K0); lege(t, 0, 0, 1, K0); lege(t, 0, 0, 2, K0);   // Held 0 voll; Held 1 / 2 haben freie Zonen, kennen aber kein Fighting
    const r = await spiele(t);
    check('keine freie Zone beim Nutzer: nicht spielbar, die Karte bleibt auf der Hand, nichts bewegt sich', r !== true && t.p0.hand.includes(CARD) && t.p1.supportZones[0][0][0] === K1, { r, hand: t.p0.hand });
  }
  {
    const t = await fresh({ fighting: 1, fighting1: 1 });
    lege(t, 1, 0, 0, K1);
    lege(t, 0, 0, 0, K0); lege(t, 0, 0, 1, K0); lege(t, 0, 0, 2, K0);
    const r = await spiele(t, 1);
    check('mit Held 1 (eigene freie Zonen) spielbar — die Kreatur geht in DESSEN Zone, nicht in die von Held 0', r === true && t.p0.supportZones[1].some(z => z[0] === K1) && !t.p0.supportZones[0].some(z => z[0] === K1), { z1: t.p0.supportZones[1], z0: t.p0.supportZones[0] });
  }

  console.log('Wer darf wählen / was nicht');
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 0, 0, 0, K0);                       // EIGENE Kreatur
    lege(t, 1, 0, 0, K1);
    await spiele(t);
    check('eigene Kreaturen stehen nie zur Wahl, nur die des Gegners', t.wahl.length === 1 && t.wahl[0].join() === K1, t.wahl);
  }
  {
    const t = await fresh({ fighting: 1 });
    const kr = lege(t, 1, 0, 0, K1); kr.faceDown = true;
    const r = await spiele(t);
    check('nur eine verdeckte Kreatur beim Gegner: kein Ziel, nicht spielbar', r !== true && t.p0.hand.includes(CARD), r);
  }
  {
    const t = await fresh({ fighting: 0 });
    lege(t, 1, 0, 0, K0);
    const r = await spiele(t);
    check('ein Held ohne Fighting kann die Attack nicht wirken', r !== true && t.p0.hand.includes(CARD), r);
  }
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 1, 0, 0, K1);
    t.cancelTarget = true;
    const r = await spiele(t);
    check('Abbruch der Zielwahl: nichts passiert, die Karte bleibt auf der Hand (kein Aktionsverbrauch)', t.p0.hand.includes(CARD) && t.p1.supportZones[0][0][0] === K1 && t.p0.discardPile.length === 0, { r, hand: t.p0.hand });
  }
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 1, 0, 0, K1);
    t.p1.heroes[0].name = 'Boris, the Guardian of Blackport';
    const r = await spiele(t);
    check('gegnerischer Boris: Boris-Sperre — die Karte ist nicht spielbar', t.engine.isBorisBlocked(CARD, 0) === true && r !== true && t.p0.hand.includes(CARD) && t.p1.supportZones[0][0][0] === K1, { r, blockt: t.engine.isBorisBlocked(CARD, 0) });
  }

  console.log('Schutz („kann nicht gewählt werden“) und das Truth-Seeing Eye');
  {
    const t = await fresh({ fighting: 1 });
    const geschuetzt = lege(t, 1, 0, 0, K1); geschuetzt.counters.untargetable_all = true;
    lege(t, 1, 0, 1, K0);
    await spiele(t);
    check('ohne Auge: die geschützte Kreatur ist nicht wählbar', t.wahl.length === 1 && t.wahl[0].join() === K0 && !t.wahl[0].includes(K1), t.wahl);
  }
  {
    const t = await fresh({ fighting: 1 });
    const geschuetzt = lege(t, 1, 0, 0, K1); geschuetzt.counters.untargetable_all = true;
    lege(t, 0, 0, 2, EYE);                     // Held 0 trägt das Auge
    await spiele(t);
    check('MIT Auge: die geschützte Kreatur IST wählbar („negating all effects that would prevent those targets from being chosen“)', t.wahl.length === 1 && t.wahl[0].includes(K1), t.wahl);
    check('…und sie wechselt die Seite', t.p0.supportZones[0].some(z => z[0] === K1), t.p0.supportZones[0]);
  }
  {
    const t = await fresh({ fighting: 1 });
    const geschuetzt = lege(t, 1, 0, 0, K1); geschuetzt.counters.untargetable_all = true;
    const r = await spiele(t);
    check('ohne Auge und nur geschützte Ziele: nicht spielbar', r !== true && t.p0.hand.includes(CARD), r);
  }

  console.log('Zusatzaktion mit Truth-Seeing Eye — je Held, je Phase');
  {
    const t = await fresh({ fighting: 1, fighting1: 1, phase: 2 });      // Main Phase 1
    lege(t, 1, 0, 0, K1);
    lege(t, 0, 0, 2, EYE);                     // Held 0 mit Auge, Held 1 ohne
    const cd = DB[CARD];
    check('Held 0 (Auge): `cardHasInherentAction` wahr', t.engine.cardHasInherentAction(0, 0, cd) === true);
    check('Held 1 (kein Auge): `cardHasInherentAction` falsch', t.engine.cardHasInherentAction(0, 1, cd) === false);
    const liste = t.engine.getHeroPlayableCards(0);
    const namen = (hi) => ((liste.own && liste.own[hi]) || []).map(c => (typeof c === 'string' ? c : c.name));
    check('Main Phase: spielbar NUR von Held 0 (mit Auge)', namen(0).includes(CARD) && !namen(1).includes(CARD), { h0: namen(0), h1: namen(1) });
    t.gs.currentPhase = 3;
    const liste3 = t.engine.getHeroPlayableCards(0);
    const namen3 = (hi) => ((liste3.own && liste3.own[hi]) || []).map(c => (typeof c === 'string' ? c : c.name));
    check('Action Phase: BEIDE Helden dürfen sie nutzen', namen3(0).includes(CARD) && namen3(1).includes(CARD), { h0: namen3(0), h1: namen3(1) });
  }
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 1, 0, 0, K1);
    lege(t, 0, 0, 2, EYE);
    await spiele(t, 0);
    check('Action Phase MIT Auge: die Aktion wird NICHT verbraucht (inherent)', t.engine.gs && loadCardEffect(CARD).__stempel && loadCardEffect(CARD).__stempel.inherent === true && loadCardEffect(CARD).__stempel.haupt === false, loadCardEffect(CARD).__stempel);
  }
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 1, 0, 0, K1);
    await spiele(t, 0);
    check('Action Phase OHNE Auge: die Aktion wird verbraucht (nicht inherent)', loadCardEffect(CARD).__stempel && loadCardEffect(CARD).__stempel.inherent === false, loadCardEffect(CARD).__stempel);
  }
  {
    const t = await fresh({ fighting: 1, phase: 2 });
    lege(t, 1, 0, 0, K1);
    const r = await spiele(t, 0);
    check('Main Phase OHNE Auge: nicht spielbar (keine Zusatzaktion), nichts bewegt sich', r !== true && t.p0.hand.includes(CARD) && t.p1.supportZones[0][0][0] === K1, { r });
  }
  {
    const t = await fresh({ fighting: 1, phase: 2 });
    lege(t, 1, 0, 0, K1);
    lege(t, 0, 0, 2, EYE);
    const r = await spiele(t, 0);
    check('Main Phase MIT Auge: spielbar, gratis (inherent)', r === true && t.p0.supportZones[0].some(z => z[0] === K1) && loadCardEffect(CARD).__stempel && loadCardEffect(CARD).__stempel.inherent === true, { r, st: loadCardEffect(CARD).__stempel });
  }
  {
    const t = await fresh({ fighting: 1, phase: 2 });
    lege(t, 1, 0, 0, K1);
    const auge = lege(t, 0, 0, 2, EYE); auge.counters.negated = true;
    check('negiertes Auge zählt nicht: keine Zusatzaktion', t.engine.cardHasInherentAction(0, 0, DB[CARD]) === false);
  }

  console.log('Der Bot (Heuristik-Wahl)');
  {
    const t = await fresh({ fighting: 1 });
    lege(t, 1, 0, 0, K1);
    delete t.engine._getCpuTargetResponse;     // Standard-Antwort des Sim-Bots
    const r = await spiele(t);
    check('der Sim-Bot beantwortet die Zielwahl ohne Absturz (Ergebnis ist egal, die Karte läuft sauber durch oder wird zurückgegeben)', r === true || r === false || r === undefined);
  }

  console.log(fails === 0 ? '\n✓ Capture-Tests grün' : `\n✗ ${fails} Fehler`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
