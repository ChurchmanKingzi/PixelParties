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
const BANANEN = 'Golden Bananas';                                                                                          // Normal-Artifact ohne Ziel: +12 Gold
const DOOM = 'Book of Doom';                                                                                              // Zielkarte mit eigener Kostenrechnung (4 Gold je Ziel)
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

  console.log('Einmal pro Zug: oberste Karte aufdecken, in der Mitte halten');
  const halten = () => reveal().filter(r => r.hold === true);
  const frei = () => t.events.filter(e => e.ev === 'mill_center_release').map(e => e.data);
  const imEventStrom = (a, b) => t.events.findIndex(e => e.ev === a) < t.events.findIndex(e => e.ev === b);   // a kam vor b
  {
    // Equipment: Karte liegt in der Mitte, Zonenwahl, Flug aus der Mitte auf den Platz
    t = await fresh({ phase: 2, deck: [GROSS_EQ, SPELL, SPELL] });
    legeSA();
    check('Vorbedingung: das Equipment hat Plätze', equipDestinations(t.engine, 0, GROSS_EQ).length > 0);
    let beiWahl = null;
    t.antwort = (pi, d) => {
      if (d.type === 'confirm' && d.title === SA && /Play it right now/.test(d.message)) { beiWahl = { halten: halten().length, frei: frei().length }; return true; }
      if (d.type === 'zonePick' && d.title === SA) return { heroIdx: 1, slotIdx: 0 };
      return undefined;
    };
    t.p0.gold = 77;
    const r = await aktivieren();
    const ausgeruestet = t.engine.cardInstances.find(c => c.name === GROSS_EQ && c.zone === 'support');
    check('die Aktivierung läuft', r !== false, r);
    check('das Equipment liegt am gewählten Helden (Held 1, Platz 0) — OHNE Gold zu zahlen', !!ausgeruestet && ausgeruestet.heroIdx === 1 && ausgeruestet.zoneSlot === 0 && t.p0.gold === 77, ausgeruestet && { h: ausgeruestet.heroIdx, z: ausgeruestet.zoneSlot });
    check('es verließ das Deck (die nächste Karte ist oben), nicht die Ablage', oben() === SPELL && t.p0.mainDeck.length === 2 && !t.p0.discardPile.includes(GROSS_EQ), { deck: t.p0.mainDeck, abl: t.p0.discardPile });
    check('die Karte wird in der Bildmitte GEHALTEN, noch bevor gefragt wird (`mill_center_reveal` mit `hold`, ohne Ziel: `dest: center`)', halten().length === 1 && halten()[0].cardNames[0] === GROSS_EQ && halten()[0].dest === 'center' && halten()[0].owner === 0 && typeof halten()[0].holdKey === 'string', halten());
    check('…und beim Fragen ist sie noch NICHT freigegeben', beiWahl && beiWahl.halten === 1 && beiWahl.frei === 0, beiWahl);
    const f = frei();
    check('Freigabe: Flug aus der Mitte auf den Brettplatz (`dest: support`, Held 1, Platz 0, Seite 0), gleicher Schlüssel', f.length === 1 && f[0].dest === 'support' && f[0].destHeroIdx === 1 && f[0].destSlotIdx === 0 && f[0].destSide === 0 && f[0].holdKey === halten()[0].holdKey && f[0].cardName === GROSS_EQ, f);
    const a = anims('sky_dig');
    check('Animation `sky_dig` läuft auf dem DECK (Ursprung `originDeck`, Ziel `deck: true`), nicht auf der Creature', a.length === 1 && a[0].zoneType === 'board' && a[0].originDeck === true && a[0].originOwner === 0 && a[0].targets.length === 1 && a[0].targets[0].deck === true && a[0].targets[0].owner === 0 && a[0].originHeroIdx === undefined && a[0].targets[0].zoneSlot === undefined, a);
    check('Log `sky_archeologist` nennt Karte und Spielweg', log('sky_archeologist').some(l => l.card === GROSS_EQ && l.played === 'equip'), log('sky_archeologist'));
    const r2 = await aktivieren();
    check('ein zweiter Einsatz DESSELBEN Archäologen im selben Zug ist gesperrt', r2 === false || t.p0.mainDeck.length === 2, { r2, deck: t.p0.mainDeck });
  }
  {
    // Normal-Artifact ohne Ziel: wirkt SOFORT, ohne Hand, ohne Gold, Ablage
    t = await fresh({ phase: 2, deck: [BANANEN, SPELL] });
    legeSA();
    t.antwort = ja('Play it right now');
    t.p0.gold = 5;
    await aktivieren();
    check('Golden Bananas wirkt SOFORT (+12 Gold) — und kostet KEINE 4 Gold', t.p0.gold === 17, t.p0.gold);
    check('es kommt NICHT auf die Hand (kein Nullpreis-Vermerk), sondern nach der Wirkung in die Ablage; das Deck hat sie verlassen', !t.p0.hand.includes(BANANEN) && !t.p0._freeArtifactNames && t.p0.discardPile.join() === BANANEN && t.p0.mainDeck.join() === SPELL, { hand: t.p0.hand, frei: t.p0._freeArtifactNames, abl: t.p0.discardPile, deck: t.p0.mainDeck });
    const f = frei();
    check('Freigabe: Flug aus der Mitte zur ABLAGE (`dest: discard`) — die Karte blieb während der Wirkung in der Mitte', halten().length === 1 && f.length === 1 && f[0].dest === 'discard' && f[0].cardName === BANANEN && f[0].holdKey === halten()[0].holdKey && imEventStrom('mill_center_reveal', 'play_gold_coins') && imEventStrom('play_gold_coins', 'mill_center_release'), { f, ev: t.events.map(e => e.ev) });
    check('Log: gespielt als Artifact', log('sky_archeologist').some(l => l.card === BANANEN && l.played === 'artifact'), log('sky_archeologist'));
    check('Log: `free_artifact_played`', log('free_artifact_played').some(l => l.card === BANANEN && l.as === 'artifact'), log('free_artifact_played'));
  }
  {
    // Zielkarte mit EIGENER Kostenrechnung (Book of Doom, 4 Gold je Ziel): gratis, mit Zielwahl
    t = await fresh({ phase: 2, deck: [DOOM, SPELL] });
    legeSA();
    t.p0.gold = 0;
    const lebenVorher = t.p1.heroes[0].hp;
    let ziele = null;
    t.engine.promptEffectTarget = async (pi, valid, config) => { ziele = { n: valid.length, titel: config.title, max: config.maxTotal }; return [valid.find(v => v.type === 'hero' && v.owner === 1).id]; };
    t.antwort = ja('Play it right now');
    await aktivieren();
    check('Book of Doom mit 0 Gold: die Zielwahl wird angeboten (Budget unbegrenzt)', ziele && ziele.n > 0 && ziele.max === 99, ziele);
    check('…sein Schaden (50) trifft SOFORT den gewählten Helden', t.p1.heroes.some(h => h.hp === lebenVorher - 50), { vorher: lebenVorher, hp: t.p1.heroes.map(h => h.hp) });
    check('…und es kostet NICHTS (Gold bleibt 0, nicht negativ)', t.p0.gold === 0, t.p0.gold);
    check('…danach liegt es in der Ablage, nicht auf der Hand', t.p0.discardPile.join() === DOOM && !t.p0.hand.includes(DOOM) && t.p0.mainDeck.join() === SPELL, { abl: t.p0.discardPile, hand: t.p0.hand, deck: t.p0.mainDeck });
    check('…und der Gratis-Scope ist wieder zu', !t.engine._kostenlosScope && !t.engine.canAffordGold(0, 4, DOOM), t.engine._kostenlosScope);
  }
  {
    // Der ECHTE Zielwähler (`promptEffectTarget` → Engine-Dispatcher, in der Sim beantwortet ihn die CPU-Logik): Book of Doom
    t = await fresh({ phase: 2, deck: [DOOM, SPELL] });
    legeSA();
    t.p0.gold = 0;
    t.antwort = ja('Play it right now');
    const echt = t.engine.promptEffectTarget.bind(t.engine);
    let cfg = null, zustand = null;
    t.engine.promptEffectTarget = async (pi, valid, config) => {
      cfg = { titel: config.title, abbrechbar: config.cancellable, text: config.description, max: config.maxTotal, quelle: config.sourceCardName };
      zustand = { deck: t.p0.mainDeck[0], gehalten: halten().length, frei: frei().length };
      return echt(pi, valid, config);
    };
    await aktivieren();
    check('die Zielwahl: Titel = Karte, abbrechbar, Hinweis „without paying its Cost“, bis zu 99 Ziele (kein Gold nötig), Quelle benannt', !!cfg && cfg.abbrechbar === true && /without paying its Cost/.test(cfg.text) && cfg.max === 99 && cfg.quelle === DOOM && cfg.titel === DOOM, cfg);
    check('…während sie offen ist, liegt die Karte noch oben im Deck und in der Mitte (gehalten, nicht freigegeben)', zustand && zustand.deck === DOOM && zustand.gehalten === 1 && zustand.frei === 0, zustand);
    check('…danach: 0 Gold gezahlt, Karte in der Ablage, Deck weiter', t.p0.gold === 0 && t.p0.discardPile.join() === DOOM && t.p0.mainDeck.join() === SPELL, { gold: t.p0.gold, abl: t.p0.discardPile });
  }
  {
    // Abbruch in der Zielwahl → zurück ins Deck, nichts passiert
    t = await fresh({ phase: 2, deck: [DOOM, SPELL] });
    legeSA();
    t.p0.gold = 9;
    t.engine.promptEffectTarget = async () => null;
    t.antwort = ja('Play it right now');
    await aktivieren();
    check('Abbruch der Zielwahl: das Artifact liegt unverändert OBEN im Deck, nichts in der Ablage, kein Gold bewegt, nichts auf der Hand', t.p0.mainDeck.join() === [DOOM, SPELL].join() && t.p0.discardPile.length === 0 && t.p0.hand.length === 0 && t.p0.gold === 9, { deck: t.p0.mainDeck, abl: t.p0.discardPile, gold: t.p0.gold });
    const f = frei();
    check('…die Karte fliegt aus der Mitte zurück ins Deck (`dest: deck`)', f.length === 1 && f[0].dest === 'deck' && f[0].cardName === DOOM, f);
    check('…und es gibt KEINE Oben/Unten-Frage (es ist ein Artifact)', !t.prompts.some(p => p.d._topOrBottom));
  }
  {
    // `resolve` meldet „cancelled" (Spieler bricht eine innere Abfrage ab) → die Karte liegt wieder oben
    t = await fresh({ phase: 2, deck: [BANANEN, SPELL] });
    legeSA();
    const sk = loadCardEffect(BANANEN), alt = sk.resolve;
    sk.resolve = async () => ({ cancelled: true });
    t.antwort = ja('Play it right now');
    try { await aktivieren(); } finally { sk.resolve = alt; }
    check('`cancelled` aus dem resolve: die Karte liegt wieder OBEN im Deck (nicht in der Ablage)', t.p0.mainDeck.join() === [BANANEN, SPELL].join() && t.p0.discardPile.length === 0, { deck: t.p0.mainDeck, abl: t.p0.discardPile });
  }
  {
    // Zugende-Reiter (Open-Invitation-Vertrag): `gs._spellEndsTurn` beendet den Zug nach der Wirkung
    t = await fresh({ phase: 2, deck: [BANANEN, SPELL] });
    legeSA();
    const sk = loadCardEffect(BANANEN), alt = sk.resolve;
    sk.resolve = async () => { t.gs._spellEndsTurn = true; return true; };
    t.antwort = ja('Play it right now');
    let ende = null;
    const altAdv = t.engine.advanceToPhase.bind(t.engine);
    t.engine.advanceToPhase = async (pi, ph, o) => { ende = { pi, ph, quelle: o && o.turnEndSource && o.turnEndSource.name }; return altAdv(pi, ph, o); };
    try { await aktivieren(); } finally { sk.resolve = alt; t.engine.advanceToPhase = altAdv; }
    check('`_spellEndsTurn`: der Zug endet nach der Wirkung (Phase 5), Quelle = das gespielte Artifact', ende && ende.pi === 0 && ende.ph === 5 && ende.quelle === BANANEN && !t.gs._spellEndsTurn, ende);
  }
  {
    // Das Kettenfenster kann das Artifact NEGIEREN → Ablage, keine Wirkung
    t = await fresh({ phase: 2, deck: [BANANEN, SPELL] });
    legeSA();
    t.p0.gold = 5;
    const altKette = t.engine.executeCardWithChain.bind(t.engine);
    let kettenInfo = null;
    t.engine.executeCardWithChain = async (info) => { if (info.cardName === BANANEN) { kettenInfo = info; return { negated: true, chainFormed: true, resolveResult: null }; } return altKette(info); };
    t.antwort = ja('Play it right now');
    await aktivieren();
    check('negiert: keine Wirkung (Gold bleibt 5), die Karte landet in der Ablage, nicht auf der Hand', t.p0.gold === 5 && t.p0.discardPile.join() === BANANEN && !t.p0.hand.includes(BANANEN) && t.p0.mainDeck.join() === SPELL, { gold: t.p0.gold, abl: t.p0.discardPile, deck: t.p0.mainDeck });
    check('…das Kettenfenster lief als Artifact-Spiel NICHT aus der Hand (`fromBoard`), zu 0 Gold', kettenInfo && kettenInfo.cardType === 'Artifact' && kettenInfo.fromBoard === true && kettenInfo.goldCost === 0 && kettenInfo.owner === 0, kettenInfo && { t: kettenInfo.cardType, fb: kettenInfo.fromBoard, g: kettenInfo.goldCost });
  }
  {
    // Abgelehnt → geht zurück ins Deck, als wäre es unspielbar gewesen (KEINE Oben/Unten-Wahl: die gilt nur für Nicht-Artifacts)
    t = await fresh({ phase: 2, deck: [GROSS_EQ, SPELL, KLEIN] });
    legeSA();
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA && /Play it right now/.test(d.message)) ? false : undefined;
    await aktivieren();
    check('abgelehnt: KEINE „oben oder unten“-Frage — das Artifact bleibt, wo es lag (oben), wie bei einem unspielbaren', !t.prompts.some(p => p.d._topOrBottom) && t.p0.mainDeck.join() === [GROSS_EQ, SPELL, KLEIN].join() && !t.engine.cardInstances.some(c => c.name === GROSS_EQ && c.zone === 'support'), { deck: t.p0.mainDeck, prompts: t.prompts.map(p => (p.d.message || '').slice(0, 40)) });
    const f = frei();
    check('die Karte lag in der Mitte und fliegt von dort ZURÜCK ins DECK (`dest: deck`)', halten().length === 1 && f.length === 1 && f[0].dest === 'deck' && f[0].holdKey === halten()[0].holdKey, { h: halten(), f });
    check('Log: nicht gespielt, nirgendwohin gelegt (`played`/`placed` leer)', log('sky_archeologist').some(l => l.card === GROSS_EQ && !l.played && !l.placed), log('sky_archeologist'));
  }
  {
    // Abbruch der Platzwahl (Equipment) → zurück ins Deck
    t = await fresh({ phase: 2, deck: [GROSS_EQ, SPELL] });
    legeSA();
    t.antwort = (pi, d) => {
      if (d.type === 'confirm' && d.title === SA && /Play it right now/.test(d.message)) return true;
      if (d.type === 'zonePick' && d.title === SA) return { cancelled: true };
      return undefined;
    };
    await aktivieren();
    check('Abbruch der Platzwahl: das Equipment bleibt oben im Deck, liegt nicht am Helden, fliegt zurück ins Deck', t.p0.mainDeck.join() === [GROSS_EQ, SPELL].join() && !t.engine.cardInstances.some(c => c.name === GROSS_EQ && c.zone === 'support') && frei().length === 1 && frei()[0].dest === 'deck', { deck: t.p0.mainDeck, f: frei() });
  }
  {
    // Karte, die kein Artifact ist: „Otherwise" — oben/unten, die Karte liegt dabei in der Mitte
    t = await fresh({ phase: 2, deck: [SPELL, GROSS, KLEIN] });
    legeSA();
    let beiFrage = null;
    t.antwort = (pi, d) => { if (d.type === 'confirm' && d.title === SA && d._topOrBottom) { beiFrage = { halten: halten().length, frei: frei().length }; return true; } return undefined; };      // „Top“
    await aktivieren();
    check('Spell oben (kein Artifact): KEINE Spielfrage, nur oben/unten — „Top“ lässt sie oben liegen', t.p0.mainDeck.join() === [SPELL, GROSS, KLEIN].join() && !t.prompts.some(p => /Play it right now/.test(p.d.message || '')), { deck: t.p0.mainDeck, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.message || '').slice(0, 30)) });
    check('…die Frage kommt BEI LIEGENDER Karte (gehalten, noch nicht freigegeben); danach fliegt sie zurück ins Deck', beiFrage && beiFrage.halten === 1 && beiFrage.frei === 0 && frei().length === 1 && frei()[0].dest === 'deck', { beiFrage, f: frei() });
  }
  {
    t = await fresh({ phase: 2, deck: [SPELL, GROSS] });
    legeSA();
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SA && d._topOrBottom) ? false : undefined;     // „Bottom“
    await aktivieren();
    check('Spell oben, „Bottom“: die Karte geht unter das Deck', t.p0.mainDeck.join() === [GROSS, SPELL].join(), t.p0.mainDeck);
  }
  {
    // Equipment ohne freien Platz → unspielbar → zurück ins Deck (ohne jede Frage)
    t = await fresh({ phase: 2, deck: [GROSS_EQ, SPELL] });
    legeSA();
    for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) if (!(h === 0 && z === 0)) t.p0.supportZones[h][z] = ['Platzhalter'];
    check('Vorbedingung: kein freier Platz für das Equipment', equipDestinations(t.engine, 0, GROSS_EQ).length === 0);
    await aktivieren();
    check('Equipment ohne freien Platz ist NICHT spielbar: keine Frage, die Karte bleibt oben im Deck', t.prompts.length === 0 && t.p0.mainDeck.join() === [GROSS_EQ, SPELL].join(), { prompts: t.prompts.map(p => p.d.message), deck: t.p0.mainDeck });
  }
  {
    // Artifact-Sperre (Boomerang)
    t = await fresh({ phase: 2, deck: [BANANEN, SPELL] });
    legeSA();
    t.p0._artifactLockTurn = t.gs.turn;
    await aktivieren();
    check('Artifact-Sperre („no Artifacts for the rest of this turn“): nicht spielbar — keine Frage, die Karte bleibt oben', t.prompts.length === 0 && t.p0.mainDeck.join() === [BANANEN, SPELL].join(), { prompts: t.prompts.map(p => p.d.message), deck: t.p0.mainDeck });
  }
  {
    // Zielkarte ohne gültiges Ziel / Spielbarkeits-Tor der Karte (Coffee: nur mit alten Status)
    t = await fresh({ phase: 2, deck: [GROSS, SPELL] });
    legeSA();
    await aktivieren();
    check('Coffee ohne Status auf den Helden: das kartenseitige Tor sperrt — keine Frage, die Karte bleibt oben', t.prompts.length === 0 && t.p0.mainDeck.join() === [GROSS, SPELL].join(), { prompts: t.prompts.map(p => p.d.message), deck: t.p0.mainDeck });
  }
  {
    // Nicht spielbare Unterarten: Reaction ohne `proactivePlay`, Area, Surprise, Artifact Creature
    t = await fresh({ phase: 2, deck: [SPELL] });
    const artSub = (f) => Object.values(DB).find(c => c.cardType.includes('Artifact') && f(c));
    const reaktion = artSub(c => (c.subtype || '').toLowerCase() === 'reaction' && !(loadCardEffect(c.name) || {}).proactivePlay);
    const flaeche = artSub(c => (c.subtype || '').toLowerCase() === 'area');
    const ueberraschung = artSub(c => (c.subtype || '').toLowerCase() === 'surprise');
    const kreatur = artSub(c => /creature/i.test(c.cardType + '/' + (c.subtype || '')));
    const sw = require('../../cards/effects/_free-artifact-shared').spielweg;
    for (const [bez, k] of [['Reaction ohne proactivePlay', reaktion], ['Area', flaeche], ['Surprise', ueberraschung], ['Artifact Creature', kreatur]]) {
      if (k) check(`${bez} (${k.name}) ist nicht spielbar`, sw(t.engine, 0, k.name) === null, sw(t.engine, 0, k.name));
    }
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
