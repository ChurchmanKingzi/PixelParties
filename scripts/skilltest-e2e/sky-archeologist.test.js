'use strict';
// Sky Archeologist (Creature, Normal, Lv0, 50 HP, Summoning Magic): „You may discard an Artifact with a Cost of 10 or more to summon this Creature as
// an additional Action. You may once per turn reveal the top card of your deck. If it is an Artifact, you may immediately play it without paying its Cost.
// Otherwise, put it on top or bottom of your deck (your choice)."
// Geprüft wird der ECHTE Spielweg (`host.doPlayCreature`, `host.doActivateCreatureEffect`) mit gescripteten Antworten.
//   node scripts/skilltest-e2e/sky-archeologist.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
const { equipDestinations } = require('../../cards/effects/_orchestra-shared');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const SA = 'Sky Archeologist';
const DB = require('../../cards/effects/_card-db').getCardDB();
const arts = Object.values(DB).filter(c => c.cardType === 'Artifact').sort((a, b) => a.name.localeCompare(b.name));
const GROSS = arts.find(c => c.subtype === 'Normal' && (c.cost || 0) >= 10 && !c.name.includes('Token')).name;           // Artifact mit Cost ≥ 10 (Normal)
const GROSS_EQ = arts.find(c => c.subtype === 'Equipment' && (c.cost || 0) >= 10).name;                                   // Equipment mit Cost ≥ 10
const KLEIN = arts.find(c => c.subtype === 'Normal' && (c.cost || 0) > 0 && (c.cost || 0) < 10).name;                     // Artifact mit Cost < 10
const SPELL = Object.values(DB).filter(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level <= 1).sort((a, b) => a.name.localeCompare(b.name))[0].name;

/** `phase` 2 = Main, 3 = Action. Held 0 trägt keine Fähigkeiten (Lv0-Creature braucht keine). */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = [];
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
  }
  p0.mainDeck = [...(opts.deck || [SPELL, SPELL, SPELL])];
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
function setzeHand(t, names) {
  t.p0.hand = [...names];
  for (const n of names) t.engine._trackCard(n, 0, 'hand');
}
const spiele = (t, handIndex = 0, zoneSlot = 0) => t.host.doPlayCreature(t.room, 0, { cardName: SA, handIndex, heroIdx: 0, zoneSlot });
const aufBrett = (t) => t.engine.cardInstances.some(c => c.name === SA && c.zone === 'support');
const kostenPrompt = (t) => t.prompts.filter(p => p.d.type === 'forceDiscardCancellable' && p.d.title === SA);
const zahle = (name) => (pi, d) => {
  if (d.type === 'forceDiscardCancellable' && d.title === SA) return { cardName: name, handIndex: d.eligibleIndices.find(ix => t.p0.hand[ix] === name) };
  return undefined;
};
let t;   // aktuelles Spiel für `zahle`
const log = (typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const anims = (typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === typ).map(e => e.data);
const reveal = () => t.events.filter(e => e.ev === 'mill_center_reveal').map(e => e.data);
const aktivieren = () => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 });
function legeSA(slot = 0) {
  const inst = t.engine._trackCard(SA, 0, 'support', 0, slot);
  t.p0.supportZones[0][slot] = [SA];
  inst.turnPlayed = 1;
  return inst;
}
const ja = (titelTeil) => (pi, d) => (d.type === 'confirm' && d.title === SA && new RegExp(titelTeil).test(d.message || '')) ? true : undefined;
const nein = (titelTeil) => (pi, d) => (d.type === 'confirm' && d.title === SA && new RegExp(titelTeil).test(d.message || '')) ? false : undefined;
const oben = () => t.p0.mainDeck[0];

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[SA], s = loadCardEffect(SA);
    check('Creature, Normal, Lv0, Summoning Magic, 50 HP', cd && cd.cardType === 'Creature' && cd.subtype === 'Normal' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: Artifact mit Cost ≥ 10 abwerfen → Zusatzaktion; 1×/Zug aufdecken', cd && /^You may discard an Artifact with a Cost of 10 or more to summon this Creature as an additional Action\. You may once per turn reveal the top card of your deck\. If it is an Artifact, you may immediately play it without paying its Cost\. Otherwise, put it on top or bottom of your deck \(your choice\)\.$/.test(cd.effect), cd && cd.effect);
    check('Skript: `inherentAction` (Funktion), `beforeSummon`, Kreatureneffekt', typeof s.inherentAction === 'function' && typeof s.beforeSummon === 'function' && s.creatureEffect === true && typeof s.canActivateCreatureEffect === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst nativ 76×51 im Index und als Datei', idx[SA] && idx[SA].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[SA].id + '.png')));
  }
  console.log(`(Testkarten: Artifact ≥10 ${GROSS} [${DB[GROSS].cost}], Equipment ≥10 ${GROSS_EQ} [${DB[GROSS_EQ].cost}], Artifact <10 ${KLEIN} [${DB[KLEIN].cost}], Spell ${SPELL})`);

  console.log('inherentAction je Lage');
  {
    const s = loadCardEffect(SA);
    t = await fresh({ phase: 2 });
    const ia = () => s.inherentAction(t.gs, 0, 0, t.engine);
    check('Main Phase, nichts Passendes auf der Hand: nein', ia() === false);
    t.p0.hand = [KLEIN, SPELL];
    check('Main Phase, nur ein Artifact mit Cost < 10 (und ein Spell): nein', ia() === false);
    t.p0.hand = [GROSS];
    check('Main Phase, Artifact mit Cost ≥ 10 auf der Hand: ja', ia() === true);
    t.p0.hand = []; t.p0.discardPile = [GROSS];
    check('das Artifact muss auf der HAND liegen (Ablage zählt nicht)', ia() === false);
    t.p0.hand = [GROSS]; t.gs.currentPhase = 3;
    check('Action Phase mit freier Aktion: nein (beide Wege möglich — `beforeSummon` fragt)', ia() === false);
    t.p0.heroesActedThisTurn = [0];
    check('Action Phase, Aktion schon verbraucht: ja (die Zusatzaktion ist der einzige Weg)', ia() === true);
  }

  console.log('Main Phase: Artifact abwerfen, Archäologe beschwören');
  {
    t = await fresh({ phase: 2 });
    setzeHand(t, [SA, GROSS, KLEIN, GROSS_EQ]);
    t.antwort = zahle(GROSS);
    const r = await spiele(t);
    const p = kostenPrompt(t)[0];
    check('die Beschwörung läuft, der Archäologe liegt auf dem Brett', r !== false && aufBrett(t), r);
    check('die Abfrage markiert NUR Artifacts mit Cost ≥ 10 (GROSS und GROSS_EQ, nicht KLEIN, nicht den Archäologen)', !!p && p.d.eligibleIndices.length === 2 && p.d.eligibleIndices.every(i => [GROSS, GROSS_EQ].includes(['x', GROSS, KLEIN, GROSS_EQ][i])), p && { idx: p.d.eligibleIndices, hand: [SA, GROSS, KLEIN, GROSS_EQ] });
    check('die Abfrage ist abbrechbar („Cancel summon“) und trägt die Kosten-Lernmarke', !!p && p.d.cancellable === true && p.d.costFor === SA);
    check('das gewählte Artifact liegt in der ABLAGE (abgeworfen), die anderen bleiben auf der Hand', t.p0.discardPile.includes(GROSS) && t.p0.hand.includes(KLEIN) && t.p0.hand.includes(GROSS_EQ) && !t.p0.hand.includes(GROSS) && !t.p0.hand.includes(SA), { abl: t.p0.discardPile, hand: t.p0.hand });
    check('es war eine Zusatzaktion: der Held gilt nicht als gehandelt', t.p0.heroesActedThisTurn.length === 0, t.p0.heroesActedThisTurn);
  }
  {
    t = await fresh({ phase: 2 });
    setzeHand(t, [SA, GROSS]);
    t.antwort = (pi, d) => (d.type === 'forceDiscardCancellable' && d.title === SA) ? { cancelled: true } : undefined;
    await spiele(t);
    check('Abbruch der Kosten: keine Beschwörung, Archäologe und Artifact bleiben auf der Hand', !aufBrett(t) && t.p0.hand.includes(SA) && t.p0.hand.includes(GROSS) && t.p0.discardPile.length === 0, { hand: t.p0.hand, abl: t.p0.discardPile });
  }
  {
    t = await fresh({ phase: 2 });
    setzeHand(t, [SA, KLEIN]);
    const r = await spiele(t);
    check('Main Phase ohne passendes Artifact: der Archäologe ist nicht spielbar', r === false && !aufBrett(t) && t.p0.hand.includes(SA), r);
  }

  console.log('Action Phase: zwei Wege (Pflicht ohne Aktion, Wahl mit Aktion)');
  {
    t = await fresh({ phase: 3 });
    setzeHand(t, [SA, GROSS]);
    t.antwort = (pi, d) => {
      if (d.type === 'confirm' && d.title === SA) return true;                                // Special
      return zahle(GROSS)(pi, d);
    };
    await spiele(t);
    check('„Special“: Artifact abgeworfen, Archäologe auf dem Brett', aufBrett(t) && t.p0.discardPile.includes(GROSS), { abl: t.p0.discardPile });
    check('…und die Aktion ist ZURÜCK (Held nicht gehandelt, Action Phase offen)', t.p0.heroesActedThisTurn.length === 0 && t.gs.currentPhase === 3, { acted: t.p0.heroesActedThisTurn, phase: t.gs.currentPhase });
    check('die Frage nannte beide Wege und war nicht gerrymander-fähig', t.prompts.some(p => p.d.type === 'confirm' && p.d.title === SA && /Special/.test(p.d.confirmLabel) && /Normal/.test(p.d.cancelLabel) && p.d.gerrymanderEligible === false));
  }
  {
    t = await fresh({ phase: 3 });
    setzeHand(t, [SA, GROSS]);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA) ? false : undefined;      // Normal
    await spiele(t);
    check('„Normal“: kein Abwurf, Archäologe auf dem Brett, die Aktion des Helden ist VERBRAUCHT', aufBrett(t) && t.p0.discardPile.length === 0 && t.p0.hand.includes(GROSS) && t.p0.heroesActedThisTurn.length === 1, { abl: t.p0.discardPile, acted: t.p0.heroesActedThisTurn });
  }
  {
    t = await fresh({ phase: 3 });
    setzeHand(t, [SA, GROSS]);
    t.p0.heroesActedThisTurn = [0];                                                           // Aktion schon verbraucht → nur die Zusatzaktion
    t.antwort = zahle(GROSS);
    await spiele(t);
    check('Aktion schon verbraucht: KEINE Zweiwegefrage, das Artifact wird verlangt und abgeworfen (Pflicht)', aufBrett(t) && t.p0.discardPile.includes(GROSS) && !t.prompts.some(p => p.d.type === 'confirm' && p.d.title === SA), { abl: t.p0.discardPile, prompts: t.prompts.map(p => p.d.type) });
  }
  {
    t = await fresh({ phase: 3 });
    setzeHand(t, [SA]);
    await spiele(t);
    check('Action Phase ohne Artifact: der normale Weg (kostet die Aktion, keine Frage)', aufBrett(t) && t.p0.heroesActedThisTurn.length === 1 && t.prompts.length === 0, { acted: t.p0.heroesActedThisTurn, prompts: t.prompts.map(p => p.d.type) });
  }

  console.log('Einmal pro Zug: oberste Karte aufdecken');
  {
    // Equipment, ein freier Platz bei jedem Helden → Zonenwahl
    t = await fresh({ phase: 2, deck: [GROSS_EQ, SPELL, SPELL] });
    legeSA();
    check('Vorbedingung: das Equipment hat Plätze', equipDestinations(t.engine, 0, GROSS_EQ).length > 0);
    t.antwort = (pi, d) => {
      if (d.type === 'confirm' && d.title === SA && /Play it right now/.test(d.message)) return true;
      if (d.type === 'zonePick' && d.title === SA) return { heroIdx: 1, slotIdx: 0 };
      return undefined;
    };
    t.p0.gold = 77;
    const r = await aktivieren();
    const ausgeruestet = t.engine.cardInstances.find(c => c.name === GROSS_EQ && c.zone === 'support');
    check('die Aktivierung läuft', r !== false, r);
    check('das Equipment liegt am gewählten Helden (Held 1, Platz 0) — OHNE Gold zu zahlen', !!ausgeruestet && ausgeruestet.heroIdx === 1 && ausgeruestet.zoneSlot === 0 && t.p0.gold === 77, ausgeruestet && { h: ausgeruestet.heroIdx, z: ausgeruestet.zoneSlot });
    check('es verließ das Deck (die nächste Karte ist oben), nicht die Ablage', oben() === SPELL && t.p0.mainDeck.length === 2 && !t.p0.discardPile.includes(GROSS_EQ), { deck: t.p0.mainDeck, abl: t.p0.discardPile });
    const rv = reveal();
    check('Aufdecken: Flug Deck → Mitte → auf den Brettplatz (`dest: support`, Held 1, Platz 0)', rv.length === 1 && rv[0].cardNames[0] === GROSS_EQ && rv[0].dest === 'support' && rv[0].destHeroIdx === 1 && rv[0].destSlotIdx === 0 && rv[0].owner === 0, rv);
    const a = anims('sky_dig');
    check('Animation `sky_dig` als Brett-Animation mit dem Archäologen als Ursprung UND Ziel', a.length === 1 && a[0].zoneType === 'board' && a[0].originHeroIdx === 0 && a[0].originZoneSlot === 0 && a[0].targets[0].zoneSlot === 0, a);
    check('Log `sky_archeologist` nennt Karte und Spielweg', log('sky_archeologist').some(l => l.card === GROSS_EQ && l.played === 'equip'), log('sky_archeologist'));
    const r2 = await aktivieren();
    check('ein zweiter Einsatz DESSELBEN Archäologen im selben Zug ist gesperrt', r2 === false || t.p0.mainDeck.length === 2, { r2, deck: t.p0.mainDeck });
  }
  {
    // Nicht-Equipment: Hand + Nullpreis-Vermerk
    t = await fresh({ phase: 2, deck: [GROSS, SPELL] });
    legeSA();
    t.antwort = ja('Play it right now');
    await aktivieren();
    check('Normal-Artifact: kommt auf die HAND und trägt den Nullpreis-Vermerk (`_freeArtifactNames`) — der Spieler spielt es kostenlos über den eigenen Weg', t.p0.hand.includes(GROSS) && t.p0._freeArtifactNames && t.p0._freeArtifactNames[GROSS] === true && t.p0.mainDeck.length === 1, { hand: t.p0.hand, frei: t.p0._freeArtifactNames, deck: t.p0.mainDeck });
    check('Aufdecken: Flug zur HAND (`dest: hand`)', reveal().length === 1 && reveal()[0].dest === 'hand', reveal());
    check('Log: `free_in_hand`', log('sky_archeologist').some(l => l.played === 'hand'), log('sky_archeologist'));
  }
  {
    // Abgelehnt → oben/unten
    t = await fresh({ phase: 2, deck: [GROSS_EQ, SPELL, KLEIN] });
    legeSA();
    t.antwort = (pi, d) => {
      if (d.type === 'confirm' && d.title === SA && /Play it right now/.test(d.message)) return false;
      if (d.type === 'confirm' && d.title === SA && d._topOrBottom) return false;      // „Bottom“
      return undefined;
    };
    await aktivieren();
    const tb = t.prompts.filter(p => p.d._topOrBottom);
    check('abgelehnt: das Artifact bleibt im Deck — die Abfrage „oben oder unten“ folgt (mit Kartenbild, Beschriftung Top/Bottom)', tb.length === 1 && tb[0].d.showCard === GROSS_EQ && /Top/.test(tb[0].d.confirmLabel) && /Bottom/.test(tb[0].d.cancelLabel), tb.map(p => p.d));
    check('„Bottom“: die Karte liegt UNTEN im Deck (die nächste ist oben), nicht gespielt', t.p0.mainDeck.join() === [SPELL, KLEIN, GROSS_EQ].join() && !t.engine.cardInstances.some(c => c.name === GROSS_EQ && c.zone === 'support'), t.p0.mainDeck);
    check('der Flug des Aufdeckens geht zurück ins DECK (`dest: deck`)', reveal().length === 1 && reveal()[0].dest === 'deck', reveal());
  }
  {
    t = await fresh({ phase: 2, deck: [SPELL, GROSS, KLEIN] });
    legeSA();
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA && d._topOrBottom) ? true : undefined;      // „Top“
    await aktivieren();
    check('Spell oben (kein Artifact): KEINE Spielfrage, nur oben/unten — „Top“ lässt sie oben liegen', t.p0.mainDeck.join() === [SPELL, GROSS, KLEIN].join() && !t.prompts.some(p => /Play it right now/.test(p.d.message || '')), { deck: t.p0.mainDeck, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.message || '').slice(0, 30)) });
  }
  {
    t = await fresh({ phase: 2, deck: [SPELL, GROSS] });
    legeSA();
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA && d._topOrBottom) ? false : undefined;     // „Bottom“
    await aktivieren();
    check('Spell oben, „Bottom“: die Karte geht unter das Deck', t.p0.mainDeck.join() === [GROSS, SPELL].join(), t.p0.mainDeck);
  }
  {
    // Equipment ohne freien Platz → unspielbar → direkt oben/unten
    t = await fresh({ phase: 2, deck: [GROSS_EQ, SPELL] });
    legeSA();
    for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) if (!(h === 0 && z === 0)) t.p0.supportZones[h][z] = ['Platzhalter'];
    t.p0.supportZones[0][1] = ['Platzhalter']; t.p0.supportZones[0][2] = ['Platzhalter'];
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA && d._topOrBottom) ? true : undefined;
    check('Vorbedingung: kein freier Platz für das Equipment', equipDestinations(t.engine, 0, GROSS_EQ).length === 0);
    await aktivieren();
    check('Equipment ohne freien Platz ist NICHT spielbar: keine Spielfrage, nur oben/unten', !t.prompts.some(p => /Play it right now/.test(p.d.message || '')) && t.prompts.some(p => p.d._topOrBottom) && t.p0.mainDeck[0] === GROSS_EQ, t.prompts.map(p => p.d.message));
  }
  {
    // Artifact-Sperre (Boomerang)
    t = await fresh({ phase: 2, deck: [GROSS, SPELL] });
    legeSA();
    t.p0._artifactLockTurn = t.gs.turn;
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA && d._topOrBottom) ? true : undefined;
    await aktivieren();
    check('Artifact-Sperre („no Artifacts for the rest of this turn“): nicht spielbar, nur oben/unten', !t.prompts.some(p => /Play it right now/.test(p.d.message || '')) && t.p0.mainDeck[0] === GROSS && !t.p0.hand.includes(GROSS), t.prompts.map(p => p.d.message));
  }
  {
    // Hand-Sperre: das Artifact müsste auf die Hand
    t = await fresh({ phase: 2, deck: [GROSS, SPELL] });
    legeSA();
    t.p0.handLocked = true;
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA && d._topOrBottom) ? true : undefined;
    await aktivieren();
    check('Hand-Sperre: ein Normal-Artifact (läuft über die Hand) ist nicht spielbar — nur oben/unten', !t.prompts.some(p => /Play it right now/.test(p.d.message || '')) && t.p0.mainDeck[0] === GROSS, t.prompts.map(p => p.d.message));
  }
  {
    t = await fresh({ phase: 2, deck: [] });
    legeSA();
    const r = await aktivieren();
    check('leeres Deck: nicht aktivierbar, keine Frage', t.prompts.length === 0 && !log('sky_archeologist').length, { r, prompts: t.prompts.length });
  }
  {
    t = await fresh({ phase: 2, deck: [SPELL, SPELL, SPELL] });
    legeSA(0); legeSA(1);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA && d._topOrBottom) ? true : undefined;
    await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 });
    await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 1 });
    check('zwei Archäologen: jeder darf einmal pro Zug (zwei Aufdeck-Läufe)', log('sky_archeologist').length === 2, log('sky_archeologist'));
  }

  console.log('CPU-Antworten');
  {
    const s = loadCardEffect(SA);
    t = await fresh();
    check('wählt „Special“ statt „Normal“', (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: SA, message: `Choose how to summon ${SA}:` }) || {}).confirmed === true);
    check('spielt ein Artifact kostenlos', (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: SA, message: 'X is an Artifact! Play it right now without paying its Cost?' }) || {}).confirmed === true);
    t.engine._cpuPlayerIdx = 0;
    t.p0.mainDeck = [SPELL, GROSS, KLEIN];
    t.engine._cpuEstimateHandValue = (pi, n) => (n === GROSS ? 10 : n === KLEIN ? 8 : 1);
    check('legt eine schwache Karte (Wert unter dem Deckdurchschnitt) nach UNTEN', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: SA, message: 'x', _topOrBottom: true, showCard: SPELL }) === null);
    check('…und eine gute (Wert über dem Durchschnitt) OBEN', (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: SA, message: 'x', _topOrBottom: true, showCard: GROSS }) || {}).confirmed === true);
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: 'Anderes', message: 'x' }) === undefined);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Sky-Archeologist-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
