'use strict';
// Super Fan (Creature, Normal, Lv0, 50 HP, Summoning Magic): „You may discard two Ability cards from your hand to summon this Creature as an additional
// Action. You may once per turn reveal the top card of your deck. If it is an Ability, immediately attach it to a Hero you control as an additional attachment,
// if possible. Otherwise, put it on top or bottom of your deck (your choice)."
// Geprüft wird der ECHTE Spielweg (`host.doPlayCreature`, `host.doActivateCreatureEffect`) mit gescripteten Antworten.
//   node scripts/skilltest-e2e/super-fan.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const SF = 'Super Fan';
const DB = require('../../cards/effects/_card-db').getCardDB();
const ABIL = Object.values(DB).filter(c => c.cardType === 'Ability' && !loadCardEffect(c.name)?.restrictedAttachment && !loadCardEffect(c.name)?.customPlacement)
  .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6).map(c => c.name);
const [AB1, AB2, AB3, AB4] = ABIL;
const SPELL = Object.values(DB).filter(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level <= 1).sort((a, b) => a.name.localeCompare(b.name))[0].name;
const RESTRICTED = Object.values(DB).find(c => c.cardType === 'Ability' && loadCardEffect(c.name)?.restrictedAttachment)?.name;

async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand' || c.zone === 'ability')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = [];
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
    ps.abilityGivenThisTurn = [];
  }
  p0.mainDeck = [...(opts.deck || [AB1, SPELL, SPELL])];
  engine._fastMode = false; engine._delay = async () => {};      // kein Fast-Mode: Flüge/Hooks laufen wie im Spiel
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
let t;
function setzeHand(names) { t.p0.hand = [...names]; for (const n of names) t.engine._trackCard(n, 0, 'hand'); }
const spiele = (handIndex = 0, zoneSlot = 0) => t.host.doPlayCreature(t.room, 0, { cardName: SF, handIndex, heroIdx: 0, zoneSlot });
const aufBrett = () => t.engine.cardInstances.some(c => c.name === SF && c.zone === 'support');
const kostenPrompt = () => t.prompts.filter(p => p.d.type === 'handPick' && p.d.title === SF);
/** Zahlt die beiden genannten Abilities (nach Name, erste freie Kopie). */
const zahle = (...namen) => (pi, d) => {
  if (!(d.type === 'handPick' && d.title === SF)) return undefined;
  const benutzt = new Set();
  const sel = namen.map(n => { const ix = d.eligibleIndices.find(i => t.p0.hand[i] === n && !benutzt.has(i)); benutzt.add(ix); return { handIndex: ix, cardName: n }; });
  return { selectedCards: sel };
};
const log = (typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const anims = (typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === typ).map(e => e.data);
const reveal = () => t.events.filter(e => e.ev === 'mill_center_reveal').map(e => e.data);
const release = () => t.events.filter(e => e.ev === 'mill_center_release').map(e => e.data);
const aktivieren = (slot = 0) => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: slot });
function legeSF(slot = 0, heroIdx = 0) {
  const inst = t.engine._trackCard(SF, 0, 'support', heroIdx, slot);
  t.p0.supportZones[heroIdx][slot] = [SF];
  inst.turnPlayed = 1;
  return inst;
}
const topBottom = (oben) => (pi, d) => (d.type === 'confirm' && d.title === SF && d._topOrBottom) ? (oben ? true : false) : undefined;
const zone = (hi, z) => t.p0.abilityZones[hi][z];
/** Alle drei Zonen der Helden `hs` mit fremden Abilities füllen — dort passt nichts mehr hin. */
function fuelle(...hs) { for (const h of hs) t.p0.abilityZones[h] = [[AB2], [AB3], [AB4]]; }

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[SF], s = loadCardEffect(SF);
    check('Creature, Normal, Lv0, Summoning Magic, 50 HP', cd && cd.cardType === 'Creature' && cd.subtype === 'Normal' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: zwei Abilities abwerfen → Zusatzaktion; 1×/Zug aufdecken, Ability als zusätzliche Anlage', cd && /^You may discard two Ability cards from your hand to summon this Creature as an additional Action\. You may once per turn reveal the top card of your deck\. If it is an Ability, immediately attach it to a Hero you control as an additional attachment, if possible\. Otherwise, put it on top or bottom of your deck \(your choice\)\.$/.test(cd.effect), cd && cd.effect);
    check('Skript: `inherentAction`, `beforeSummon`, Kreatureneffekt', typeof s.inherentAction === 'function' && typeof s.beforeSummon === 'function' && s.creatureEffect === true && typeof s.canActivateCreatureEffect === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst im Index und als Datei', idx[SF] && idx[SF].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[SF].id + '.png')));
  }
  console.log(`(Testkarten: Abilities ${ABIL.join(', ')}; Spell ${SPELL}; beschränkte Ability ${RESTRICTED})`);

  console.log('inherentAction je Lage');
  {
    const s = loadCardEffect(SF);
    t = await fresh({ phase: 2 });
    const ia = () => s.inherentAction(t.gs, 0, 0, t.engine);
    check('Main Phase, keine Ability auf der Hand: nein', ia() === false);
    t.p0.hand = [AB1, SPELL, SPELL];
    check('Main Phase, EINE Ability + Spells: nein (es müssen ZWEI sein)', ia() === false);
    t.p0.hand = [AB1, AB2];
    check('Main Phase, zwei Abilities: ja', ia() === true);
    t.p0.hand = [AB1, AB1];
    check('…auch zwei Kopien derselben Ability', ia() === true);
    t.p0.hand = []; t.p0.discardPile = [AB1, AB2];
    check('die Abilities müssen auf der HAND liegen (Ablage zählt nicht)', ia() === false);
    t.p0.hand = [AB1, AB2]; t.gs.currentPhase = 3;
    check('Action Phase mit freier Aktion: nein (beide Wege möglich — `beforeSummon` fragt)', ia() === false);
    t.p0.heroesActedThisTurn = [0];
    check('Action Phase, Aktion schon verbraucht: ja (die Zusatzaktion ist der einzige Weg)', ia() === true);
  }

  console.log('Beschwörung mit Abwurf von zwei Abilities');
  {
    t = await fresh({ phase: 2 });
    setzeHand([SF, AB1, SPELL, AB2]);
    t.antwort = zahle(AB1, AB2);
    const r = await spiele();
    const p = kostenPrompt()[0];
    check('Main Phase: die Beschwörung läuft, der Fan liegt auf dem Brett', r !== false && aufBrett(), r);
    check('die Abfrage ist EINE Auswahl für genau zwei Karten (`handPick`, min = max = 2, abbrechbar) und markiert NUR die Abilities', !!p && p.d.minSelect === 2 && p.d.maxSelect === 2 && p.d.cancellable === true && p.d.eligibleIndices.length === 2 && p.d.eligibleIndices.every(i => [SF, AB1, SPELL, AB2][i] === AB1 || [SF, AB1, SPELL, AB2][i] === AB2), p && { min: p.d.minSelect, max: p.d.maxSelect, el: p.d.eligibleIndices });
    check('beide Abilities liegen in der ABLAGE, der Spell bleibt auf der Hand, der Held gilt nicht als gehandelt (Zusatzaktion)', t.p0.discardPile.includes(AB1) && t.p0.discardPile.includes(AB2) && t.p0.hand.includes(SPELL) && t.p0.hand.length === 1 && t.p0.heroesActedThisTurn.length === 0, { abl: t.p0.discardPile, hand: t.p0.hand, acted: t.p0.heroesActedThisTurn });
  }
  {
    t = await fresh({ phase: 2 });
    setzeHand([SF, AB1, AB2]);
    t.antwort = (pi, d) => (d.type === 'handPick' && d.title === SF) ? { cancelled: true } : undefined;
    await spiele();
    check('Abbruch: keine Beschwörung, NICHTS abgeworfen', !aufBrett() && t.p0.hand.length === 3 && t.p0.discardPile.length === 0, { hand: t.p0.hand, abl: t.p0.discardPile });
    t = await fresh({ phase: 2 });
    setzeHand([SF, AB1, AB2]);
    t.antwort = (pi, d) => (d.type === 'handPick' && d.title === SF) ? { selectedCards: [{ handIndex: d.eligibleIndices[0], cardName: t.p0.hand[d.eligibleIndices[0]] }] } : undefined;
    await spiele();
    check('nur EINE Karte gewählt: abgelehnt, nichts abgeworfen (zwei sind der Preis)', !aufBrett() && t.p0.discardPile.length === 0, { abl: t.p0.discardPile });
    t = await fresh({ phase: 2 });
    setzeHand([SF, AB1, AB2]);
    t.antwort = (pi, d) => (d.type === 'handPick' && d.title === SF) ? { selectedCards: [0, 0].map(() => ({ handIndex: d.eligibleIndices[0], cardName: t.p0.hand[d.eligibleIndices[0]] })) } : undefined;
    await spiele();
    check('derselbe Handplatz zweimal gemeldet: abgelehnt (verschiedene Karten verlangt)', !aufBrett() && t.p0.discardPile.length === 0, { abl: t.p0.discardPile });
    t = await fresh({ phase: 2 });
    setzeHand([SF, AB1, SPELL]);
    t.antwort = (pi, d) => (d.type === 'handPick' && d.title === SF) ? { selectedCards: [{ handIndex: 1, cardName: AB1 }, { handIndex: 2, cardName: SPELL }] } : undefined;
    const r0 = await spiele();
    check('Main Phase mit nur EINER Ability: gar nicht spielbar', r0 === false && !aufBrett() && !kostenPrompt().length, r0);
    t = await fresh({ phase: 2 });
    setzeHand([SF, AB1, AB2, SPELL]);
    t.antwort = (pi, d) => (d.type === 'handPick' && d.title === SF) ? { selectedCards: [{ handIndex: 1, cardName: AB1 }, { handIndex: 3, cardName: SPELL }] } : undefined;
    await spiele();
    check('ein Nicht-Ability als „Kosten“ untergeschoben: abgelehnt', !aufBrett() && t.p0.discardPile.length === 0, { abl: t.p0.discardPile });
  }
  {
    t = await fresh({ phase: 3 });
    setzeHand([SF, AB1, AB2]);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SF) ? true : zahle(AB1, AB2)(pi, d);
    await spiele();
    check('Action Phase, „Special“: beide abgeworfen, Fan auf dem Brett, die Aktion ist ZURÜCK', aufBrett() && t.p0.discardPile.length === 2 && t.p0.heroesActedThisTurn.length === 0 && t.gs.currentPhase === 3, { abl: t.p0.discardPile, acted: t.p0.heroesActedThisTurn });
    t = await fresh({ phase: 3 });
    setzeHand([SF, AB1, AB2]);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === SF) ? false : undefined;
    await spiele();
    check('Action Phase, „Normal“: kein Abwurf, die Aktion des Helden ist VERBRAUCHT', aufBrett() && t.p0.discardPile.length === 0 && t.p0.hand.length === 2 && t.p0.heroesActedThisTurn.length === 1, { acted: t.p0.heroesActedThisTurn });
  }

  console.log('Einmal pro Zug: oberste Karte aufdecken, Ability sofort als zusätzliche Anlage');
  {
    t = await fresh({ phase: 2, deck: [AB1, SPELL, SPELL, SPELL] });
    legeSF();
    fuelle(1, 2);                                              // nur Held 0 kann die Ability aufnehmen
    t.p0.abilityGivenThisTurn[0] = true;                       // das reguläre Anlegen des Helden ist für diesen Zug schon verbraucht
    const handVorher = t.p0.hand.length;
    const r = await aktivieren();
    check('die Aktivierung läuft', r !== false, r);
    check('die Ability liegt in der ersten freien Zone von Held 0, obwohl sein Anlegen verbraucht war („additional attachment“)', zone(0, 0).join() === AB1, t.p0.abilityZones[0]);
    check('Anlegen war NICHT nötig: das Zug-Kontingent bleibt wie es war (kein zweiter Verbrauch)', t.p0.abilityGivenThisTurn[0] === true && (t.p0._bonusAbilityAttachments?.[0] || 0) === 0, { g: t.p0.abilityGivenThisTurn, b: t.p0._bonusAbilityAttachments });
    check('sie kam vom Deck (nächste Karte oben), das Deck wurde NICHT gemischt, die Hand ist unverändert (Durchgang)', t.p0.mainDeck.join() === [SPELL, SPELL, SPELL].join() && t.p0.hand.length === handVorher, { deck: t.p0.mainDeck, hand: t.p0.hand });
    check('als Karteninstanz im Ability-Bereich von Held 0 gebucht', t.engine.cardInstances.some(c => c.name === AB1 && c.zone === 'ability' && c.heroIdx === 0 && c.zoneSlot === 0));
    check('es war keine Aktion: der Held gilt nicht als gehandelt', t.p0.heroesActedThisTurn.length === 0);
    const hl = reveal().filter(x => x.hold === true), fr = release();
    check('Aufdecken: die Karte fliegt vom Deck in die Mitte und wird GEHALTEN (`hold`, `dest: center`)', hl.length === 1 && hl[0].cardNames[0] === AB1 && hl[0].dest === 'center' && hl[0].owner === 0 && typeof hl[0].holdKey === 'string', reveal());
    check('Freigabe: Flug aus der Mitte in die ABILITY ZONE (`dest: ability`, Held 0, Platz 0, Seite 0), gleicher Schlüssel', fr.length === 1 && fr[0].dest === 'ability' && fr[0].destHeroIdx === 0 && fr[0].destSlotIdx === 0 && fr[0].destSide === 0 && fr[0].holdKey === hl[0].holdKey && fr[0].cardName === AB1, fr);
    check('…die Reihenfolge stimmt: erst halten, dann freigeben', t.events.findIndex(e => e.ev === 'mill_center_reveal') < t.events.findIndex(e => e.ev === 'mill_center_release'));
    check('…und nur EIN Flug: kein zweiter Handflug (`hand_to_board_fly`) und kein Deck → Platz-Flug', !t.events.some(e => e.ev === 'hand_to_board_fly') && !t.events.some(e => e.ev === 'play_pile_transfer' && e.data.cardName === AB1), t.events.filter(e => /fly|transfer/.test(e.ev)).map(e => e.ev));
    const a = anims('fan_cheer');
    check('Animation `fan_cheer` läuft auf dem DECK (Ursprung `originDeck`, Ziel `deck: true`), nicht auf der Creature', a.length === 1 && a[0].zoneType === 'board' && a[0].originDeck === true && a[0].originOwner === 0 && a[0].targets.length === 1 && a[0].targets[0].deck === true && a[0].targets[0].owner === 0 && a[0].originHeroIdx === undefined && a[0].targets[0].zoneSlot === undefined, a);
    check('Log `ability_attached` (→ Anlege-Klang) und `super_fan`', log('ability_attached').some(l => l.card === AB1) && log('super_fan').some(l => l.card === AB1 && !l.placed && l.attachedTo), { a: log('ability_attached'), s: log('super_fan') });
    check('keine „oben oder unten?“-Frage, wenn angelegt wurde', !t.prompts.some(p => p.d._topOrBottom));
    const r2 = await aktivieren();
    check('ein zweiter Einsatz DESSELBEN Fans im selben Zug ist gesperrt', r2 === false || t.p0.mainDeck.length === 3, { r2, deck: t.p0.mainDeck });
  }
  {
    // Stapeln: der Held hat die Ability schon — die neue Kopie kommt auf DENSELBEN Stapel (Stufe 2)
    t = await fresh({ phase: 2, deck: [AB1, SPELL] });
    legeSF();
    fuelle(1, 2);
    t.p0.abilityZones[0] = [[AB2], [AB1], []];
    t.engine._trackCard(AB1, 0, 'ability', 0, 1);
    await aktivieren();
    check('gleichnamiger Stapel: die Kopie liegt auf Zone 1 (Stufe 2), nicht in der freien Zone 2', zone(0, 1).join() === [AB1, AB1].join() && zone(0, 2).length === 0, t.p0.abilityZones[0]);
    check('…der Flug zeigt GENAU diese Zone (`destSlotIdx` 1)', release().length === 1 && release()[0].destSlotIdx === 1, release());
  }
  {
    // Mehrere taugliche Helden: der Spieler wählt bei liegender Karte
    t = await fresh({ phase: 2, deck: [AB1, SPELL] });
    legeSF();
    let beiWahl = null;
    t.antwort = (pi, d) => {
      if (d.type === 'abilityAttachTarget' && d.title === SF) {
        beiWahl = { gehalten: reveal().filter(r => r.hold).length, frei: release().length, deck: t.p0.mainDeck[0] };
        return { heroIdx: 2, zoneSlot: 1 };
      }
      return undefined;
    };
    await aktivieren();
    const ap = t.prompts.filter(p => p.d.type === 'abilityAttachTarget' && p.d.title === SF);
    check('mehrere Helden können sie aufnehmen: Heldenwahl BEI LIEGENDER Karte (`abilityAttachTarget`, nicht abbrechbar, ohne „einmal pro Zug“-Sperre)', ap.length === 1 && ap[0].d.cancellable === false && ap[0].d.skipAbilityGiven === true && ap[0].d.cardName === AB1 && ap[0].d.eligibleHeroIdxs.length === t.p0.heroes.filter(h => h?.name && h.hp > 0).length && beiWahl && beiWahl.gehalten === 1 && beiWahl.frei === 0 && beiWahl.deck === AB1, { n: ap.map(p => p.d.eligibleHeroIdxs), beiWahl });
    check('die Ability liegt bei Held 2 in der GEWÄHLTEN Zone 1', zone(2, 1).join() === AB1 && zone(0, 0).length === 0 && zone(1, 0).length === 0, t.p0.abilityZones);
    check('…der Flug aus der Mitte zeigt genau diesen Platz (`dest: ability`, Held 2, Platz 1)', release().length === 1 && release()[0].dest === 'ability' && release()[0].destHeroIdx === 2 && release()[0].destSlotIdx === 1, release());
  }
  {
    // Tote Helden sind keine Ziele
    t = await fresh({ phase: 2, deck: [AB1, SPELL] });
    legeSF();
    t.p0.heroes[1].hp = 0; t.p0.heroes[2].hp = 0;
    await aktivieren();
    check('tote Helden werden nicht angeboten: genau einer lebt → direkt angelegt, ohne Wahl', zone(0, 0).join() === AB1 && !t.prompts.some(p => p.d.type === 'abilityAttachTarget'), { z: t.p0.abilityZones, p: t.prompts.map(p => p.d.type) });
  }
  {
    // „if possible" scheitert: alle Zonen voll → oben/unten, die Karte liegt dabei in der Mitte
    t = await fresh({ phase: 2, deck: [AB1, SPELL, SPELL] });
    legeSF();
    fuelle(0, 1, 2);
    let beiFrage = null;
    t.antwort = (pi, d) => { if (d._topOrBottom) beiFrage = { gehalten: reveal().filter(r => r.hold).length, frei: release().length }; return topBottom(false)(pi, d); };
    await aktivieren();
    check('kein Held kann die Ability aufnehmen: nicht angelegt, die Frage „oben oder unten?“ folgt (Karte liegt dabei in der Mitte)', t.prompts.filter(p => p.d._topOrBottom).length === 1 && beiFrage && beiFrage.gehalten === 1 && beiFrage.frei === 0 && !t.engine.cardInstances.some(c => c.name === AB1 && c.zone === 'ability'), { beiFrage, z: t.p0.abilityZones });
    check('…und sie fliegt danach zurück ins Deck (`dest: deck`, Rückwärts-Aufdecken)', release().length === 1 && release()[0].dest === 'deck', release());
    check('„Bottom“: die Karte liegt unten im Deck', t.p0.mainDeck.join() === [SPELL, SPELL, AB1].join(), t.p0.mainDeck);
    check('Log: nicht angelegt, unten', log('super_fan').some(l => l.card === AB1 && !l.attachedTo && l.placed === 'bottom'), log('super_fan'));
  }
  {
    t = await fresh({ phase: 2, deck: [AB1, SPELL] });
    legeSF();
    fuelle(0, 1, 2);
    t.antwort = topBottom(true);
    await aktivieren();
    check('„Top“ lässt die Karte oben liegen', t.p0.mainDeck[0] === AB1 && t.p0.mainDeck.length === 2, t.p0.mainDeck);
  }
  {
    // Keine Ability oben
    t = await fresh({ phase: 2, deck: [SPELL, AB1] });
    legeSF();
    t.antwort = topBottom(false);
    await aktivieren();
    check('ein Spell oben: nicht angelegt, „oben oder unten?“ — „Bottom“', t.p0.mainDeck.join() === [AB1, SPELL].join() && !t.prompts.some(p => p.d.type === 'abilityAttachTarget') && !t.p0.abilityZones.some(h => h.some(z => z.length)), t.p0.mainDeck);
  }
  if (RESTRICTED) {
    t = await fresh({ phase: 2, deck: [RESTRICTED, SPELL] });
    legeSF();
    t.antwort = topBottom(true);
    await aktivieren();
    check(`beschränkt anlegbare Ability (${RESTRICTED}) bleibt draußen: „oben oder unten?“`, !t.engine.cardInstances.some(c => c.name === RESTRICTED && c.zone === 'ability') && t.prompts.some(p => p.d._topOrBottom), t.p0.abilityZones);
  }
  {
    t = await fresh({ phase: 2, deck: [] });
    legeSF();
    await aktivieren();
    check('leeres Deck: nicht aktivierbar, keine Frage', t.prompts.length === 0 && !log('super_fan').length);
  }

  console.log('CPU-Antworten');
  {
    const s = loadCardEffect(SF);
    t = await fresh();
    check('wählt „Special“ statt „Normal“', (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: SF, message: `Choose how to summon ${SF}:` }) || {}).confirmed === true);
    t.engine._cpuPlayerIdx = 0;
    t.engine._cpuEstimateHandValue = (pi, n) => (n === AB1 ? 10 : 1);
    t.p0.mainDeck = [SPELL, AB1];
    check('legt eine schwache Karte nach UNTEN, eine gute OBEN', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: SF, message: 'x', _topOrBottom: true, showCard: SPELL }) === null && (s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: SF, message: 'x', _topOrBottom: true, showCard: AB1 }) || {}).confirmed === true);
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: 'Anderes', message: 'x' }) === undefined);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Super-Fan-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
