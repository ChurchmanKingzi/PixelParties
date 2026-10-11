'use strict';
// Secret Spell Book (Artifact, Normal, Kosten 2): „Take permanent control of all cards on the board that are originally owned by you. You may place any Creatures, Spells and
// Artifacts affected by this effect into the Support Zones of any Heroes you control. If you activate this card while your opponent controls no cards originally owned by
// you, draw 1 card instead." Geprueft wird der ECHTE Spielweg (`host.doUseArtifactEffect`, der Weg aller Normal-Artefakte) mit gescripteter Zonenwahl.
//   node scripts/skilltest-e2e/secret-spell-book.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Secret Spell Book';
const DB = require('../../cards/effects/_card-db').getCardDB();
const alle = (pred) => Object.values(DB).filter(pred).map(c => c.name).sort();
const KRE = alle(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0)[0];
const KRE2 = alle(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0)[1];
const EQ = alle(c => c.cardType === 'Artifact' && c.subtype === 'Equipment' && !loadCardEffect(c.name)?.canEquipToHero && !Object.keys(loadCardEffect(c.name)?.hooks || {}).length)[0];
const EQ_CECILIA = "Crusader's Cutlass";
const ATT = alle(c => c.cardType === 'Spell' && c.subtype === 'Attachment' && !loadCardEffect(c.name)?.canEquipToHero && !Object.keys(loadCardEffect(c.name)?.hooks || {}).length)[0];
const EIGENE_AREA = alle(c => c.cardType === 'Spell' && c.subtype === 'Area' && c.name !== 'Doom Clock' && !loadCardEffect(c.name)?.areaLimit)[0];   // eine Area ohne Limit-Anhebung (Limit 1)
const stapel = (name, n) => Array.from({ length: n }, () => name);

/** Sitz 0 spielt das Buch, Sitz 1 ist der Gegner. Zug 5, Main Phase 1, 20 Gold. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = 2; gs.firstTurnProtectedPlayer = null; gs.skillTest = null;
  const [p0, p1] = gs.players;
  p0.abilityZones = p0.abilityZones.map(() => [[], [], []]);
  p1.abilityZones = p1.abilityZones.map(() => [[], [], []]);
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.discardPile = []; ps.deletedPile = []; ps.hand = []; ps.heroesActedThisTurn = [];
  }
  gs.areaZones = [[], []];
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support' && c.zone !== 'area' && c.zone !== 'surprise');
  p0.gold = 20; p0.hand = [CARD];
  engine.cardInstances = engine.cardInstances.filter(c => !(c.zone === 'hand' && c.owner === 0));
  engine._trackCard(CARD, 0, 'hand');
  p0.mainDeck = [KRE2, KRE, EQ, ATT];
  const t = { room, host, engine, gs, p0, p1, events: [], logs: [], zonen: [], pick: opts.pick || ((zonen) => zonen[0]) };
  engine.promptGeneric = async (pi, d) => {
    if (d.type === 'zonePick') { t.zonen.push({ karte: d.previewCardName, zonen: d.zones.map(z => `${z.owner}:${z.heroIdx}:${z.slotIdx}`) }); const z = t.pick(d.zones, d); return z ? { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx } : { cancelled: true }; }
    return undefined;
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, data) => { t.logs.push({ type, data }); return origLog(type, data); };
  return t;
}
/** Eine Karte ursprünglich von Sitz 0, die der Gegner (Sitz 1) auf SEINER Seite kontrolliert. */
function gegnerKarte(t, name, hi, slot, o = {}) {
  t.p1.supportZones[hi][slot] = [name];
  const inst = t.engine._trackCard(name, 1, 'support', hi, slot);
  inst.originalOwner = 0; inst.controller = 1; inst.owner = 1;
  if (o.counters) Object.assign(inst.counters, o.counters);
  return inst;
}
const spiele = (t) => t.host.doUseArtifactEffect(t.room, 0, { cardName: CARD, handIndex: 0 });
const anim = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'spellbook_pages');
const log = (t) => t.logs.find(l => l.type === 'secret_spell_book');
const imSupport = (t, seat, hi, slot) => (t.gs.players[seat].supportZones[hi][slot] || []).length > 0;

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Artifact, Normal, Kosten 2 (vorher 3)', cd && cd.cardType === 'Artifact' && cd.subtype === 'Normal' && cd.cost === 2, cd);
    check('Kartentext (neu): inkl. „draw 1 card instead“', cd && cd.effect === 'Take permanent control of all cards on the board that are originally owned by you. You may place any Creatures, Spells and Artifacts affected by this effect into the Support Zones of any Heroes you control. If you activate this card while your opponent controls no cards originally owned by you, draw 1 card instead.', cd && cd.effect);
    check('Artefakt-Vertrag: `canActivate` + `resolve`, kein Zielartefakt, kein `takesControlOfTargets` (sonst wäre der Ziehsatz unter Boris gesperrt)', typeof s.canActivate === 'function' && typeof s.resolve === 'function' && s.isTargetingArtifact === false && !s.takesControlOfTargets);
  }
  console.log(`(Testkarten: Kreaturen ${KRE}, ${KRE2}; Ausrüstung ${EQ}; Anhängsel ${ATT}; Cecilia-Ausrüstung ${EQ_CECILIA})`);

  console.log('Ersatzeffekt: nichts zu übernehmen → 1 Karte ziehen');
  {
    const t = await fresh();
    const deckVorher = t.p0.mainDeck.length;
    check('mit leerem Gegnerbrett ist die Karte spielbar', loadCardEffect(CARD).canActivate(t.gs, 0, t.engine) === true);
    const r = await spiele(t);
    check('der Zug läuft durch, 2 Gold bezahlt', r === true && t.p0.gold === 18, { r, gold: t.p0.gold });
    check('1 Karte gezogen (das Buch ist weg, die Hand hat genau 1 Karte)', t.p0.hand.length === 1 && t.p0.mainDeck.length === deckVorher - 1, { hand: t.p0.hand });
    check('Animation `spellbook_pages` auf dem Deck, Log mit `drew: 1`', anim(t).length === 1 && anim(t)[0].data.targets[0].deck === true && log(t) && log(t).data.drew === 1 && log(t).data.taken.length === 0, { an: anim(t), l: log(t) });
    check('das Buch liegt in der Ablage', t.p0.discardPile.includes(CARD), t.p0.discardPile);
  }
  {
    // „originally owned by YOU": eine Karte des GEGNERS auf seiner Seite, eine eigene auf der eigenen Seite und eine eigene, aber schon von mir kontrollierte auf der Gegenseite zählen nicht.
    const t = await fresh();
    t.p1.supportZones[0][0] = [KRE]; t.engine._trackCard(KRE, 1, 'support', 0, 0);                    // gehört dem Gegner
    t.p0.supportZones[0][0] = [KRE]; t.engine._trackCard(KRE, 0, 'support', 0, 0);                    // gehört mir, liegt bei mir
    const seitenfremd = t.engine._trackCard(KRE2, 1, 'support', 1, 0); t.p1.supportZones[1][0] = [KRE2];
    seitenfremd.originalOwner = 0; seitenfremd.controller = 0; seitenfremd.counters.crossSideControlled = 0;   // meine Kreatur über einen geliehenen Helden, von mir kontrolliert
    await spiele(t);
    check('keine betroffene Karte → es wird gezogen (nichts wurde übernommen)', log(t) && log(t).data.drew === 1 && t.zonen.length === 0, log(t));
  }

  console.log('Eine Kreatur auf der Gegenseite');
  {
    const t = await fresh();
    const inst = gegnerKarte(t, KRE, 1, 1);
    const r = await spiele(t);
    check('der Zug läuft durch, KEINE Karte gezogen', r === true && t.p0.hand.length === 0 && log(t) && log(t).data.drew === 0, { r, hand: t.p0.hand });
    check('Platzfrage: alle freien Zonen meiner drei Helden (9 Basis-Zonen)', t.zonen.length === 1 && t.zonen[0].karte === KRE && t.zonen[0].zonen.length === 9 && t.zonen[0].zonen.every(z => z.startsWith('0:')), t.zonen);
    check('gewählt (erste Zone: Held 0, Slot 0): die Kreatur steht bei mir, kontrolliert von mir, ursprünglich weiter meine', t.p0.supportZones[0][0][0] === KRE && inst.controller === 0 && inst.owner === 0 && inst.originalOwner === 0 && !imSupport(t, 1, 1, 1), { c: inst.controller, o: inst.owner, oo: inst.originalOwner });
    check('Animation `spellbook_pages` mit der Kreatur als Ziel (Gegnerseite, Held 1, Slot 1), Ursprung bei mir', anim(t).length === 1 && anim(t)[0].data.targets.length === 1 && anim(t)[0].data.targets[0].owner === 1 && anim(t)[0].data.targets[0].heroIdx === 1 && anim(t)[0].data.targets[0].zoneSlot === 1 && anim(t)[0].data.originOwner === 0, anim(t));
    check('Log nennt Übernahme und Umsetzen', log(t) && log(t).data.taken[0] === KRE && log(t).data.placed[0] === KRE, log(t));
  }
  {
    const t = await fresh({ pick: () => null });          // Abbruch der Platzfrage
    const inst = gegnerKarte(t, KRE, 1, 1);
    await spiele(t);
    check('Abbruch: die Kreatur BLEIBT liegen, wird aber kontrolliert (Marke `crossSideControlled`)', imSupport(t, 1, 1, 1) && inst.controller === 0 && inst.counters.crossSideControlled === 0 && inst.originalOwner === 0, { c: inst.controller, k: inst.counters });
    check('…`physicalSide` bleibt die Gegenseite', t.engine.physicalSide(inst) === 1);
    check('…nicht umgesetzt: Log `placed` leer, aber übernommen', log(t) && log(t).data.placed.length === 0 && log(t).data.taken.length === 1, log(t));
  }
  {
    // Alle eigenen Zonen belegt: keine Platzfrage, die Karte wird an Ort und Stelle kontrolliert.
    const t = await fresh();
    for (let hi = 0; hi < 3; hi++) for (let si = 0; si < 3; si++) { t.p0.supportZones[hi][si] = [KRE2]; t.engine._trackCard(KRE2, 0, 'support', hi, si); }
    const inst = gegnerKarte(t, KRE, 1, 1);
    await spiele(t);
    check('keine freie Zone: keine Platzfrage, Kontrolle an Ort und Stelle', t.zonen.length === 0 && imSupport(t, 1, 1, 1) && inst.controller === 0, { z: t.zonen });
  }
  {
    // KO-Held und Frozen-Held: Kreaturen dürfen dorthin (wie Liberation/Dark Gear).
    const t = await fresh();
    t.p0.heroes[0].hp = 0; t.p0.heroes[1].statuses.frozen = { duration: 1 };
    gegnerKarte(t, KRE, 1, 1);
    await spiele(t);
    check('Kreaturen: auch Zonen eines KO-Helden und eines Frozen-Helden stehen zur Wahl (alle 9)', t.zonen[0].zonen.length === 9, t.zonen);
  }

  console.log('Ausrüstung in einer gegnerischen Support Zone');
  {
    const t = await fresh();
    const inst = gegnerKarte(t, EQ, 0, 0);
    await spiele(t);
    check('Platzfrage nach der Ausrüstung: nur Basis-Zonen eigener Helden (9)', t.zonen.length === 1 && t.zonen[0].karte === EQ && t.zonen[0].zonen.length === 9, t.zonen);
    check('die Ausrüstung hängt jetzt am gewählten Helden (Held 0, Slot 0), von mir kontrolliert, die Gegner-Zone ist leer', t.p0.supportZones[0][0][0] === EQ && !imSupport(t, 1, 0, 0) && inst.controller === 0 && inst.owner === 0 && inst.heroIdx === 0, { c: inst.controller, h: inst.heroIdx });
  }
  {
    // Frozen und tote Helden können KEINE Ausrüstung erhalten.
    const t = await fresh();
    t.p0.heroes[0].statuses.frozen = { duration: 1 }; t.p0.heroes[1].hp = 0;
    gegnerKarte(t, EQ, 0, 0);
    await spiele(t);
    check('Held 0 Frozen, Held 1 tot: nur noch die drei Zonen von Held 2 stehen zur Wahl', t.zonen.length === 1 && t.zonen[0].zonen.length === 3 && t.zonen[0].zonen.every(z => z.startsWith('0:2:')), t.zonen);
  }
  {
    const t = await fresh();
    t.p0.heroes[0].statuses.frozen = { duration: 1 }; t.p0.heroes[1].hp = 0; t.p0.heroes[2].hp = 0;
    const inst = gegnerKarte(t, EQ, 0, 0);
    await spiele(t);
    check('kein tauglicher Träger: keine Platzfrage, die Ausrüstung bleibt liegen und wird kontrolliert', t.zonen.length === 0 && imSupport(t, 1, 0, 0) && inst.controller === 0, { z: t.zonen });
  }
  {
    // Kartenbeschränkung: nur an Cecilia.
    const t = await fresh();
    gegnerKarte(t, EQ_CECILIA, 0, 0);
    await spiele(t);
    check('„Crusader\'s“-Ausrüstung: ohne Cecilia unter meinen Helden gibt es keine Zone (Beschränkung `canEquipToHero`) — Kontrolle an Ort und Stelle', t.zonen.length === 0 && imSupport(t, 1, 0, 0), t.zonen);
  }

  console.log('Anhängsel (Spell) und sonstige Support-Karten');
  {
    const t = await fresh();
    t.p0.heroes[0].statuses.frozen = { duration: 1 }; t.p0.heroes[1].hp = 0;
    const inst = gegnerKarte(t, ATT, 0, 0);
    await spiele(t);
    check('Anhängsel: tote Helden zählen nicht, ein Frozen-Held schon → Held 0 (Frozen) und Held 2 (je 3 Zonen)', t.zonen.length === 1 && t.zonen[0].zonen.length === 6 && !t.zonen[0].zonen.some(z => z.startsWith('0:1:')), t.zonen);
    check('…es wandert in die gewählte Zone und gehört mir', t.p0.supportZones[0][0][0] === ATT && inst.controller === 0 && !imSupport(t, 1, 0, 0), { c: inst.controller });
  }

  console.log('Mehrere Karten, vorübergehend Gestohlenes, Unbetroffene');
  {
    const t = await fresh({ pick: (zonen, d) => zonen.find(z => z.heroIdx === 2) || zonen[0] });
    const a = gegnerKarte(t, KRE, 0, 0), b = gegnerKarte(t, EQ, 1, 0), c = gegnerKarte(t, KRE2, 2, 2);
    await spiele(t);
    check('drei Karten: drei Platzfragen (Kreatur, Ausrüstung, Kreatur in fester Reihenfolge)', t.zonen.length === 3, t.zonen);
    check('alle drei gehören mir und liegen auf meiner Seite (Held 2)', [a, b, c].every(i => i.controller === 0 && i.owner === 0 && i.heroIdx === 2) && !imSupport(t, 1, 0, 0) && !imSupport(t, 1, 1, 0) && !imSupport(t, 1, 2, 2), { hs: [a, b, c].map(i => i.heroIdx) });
    check('Log: drei übernommene, drei umgesetzte Karten', log(t) && log(t).data.taken.length === 3 && log(t).data.placed.length === 3, log(t));
  }
  {
    // Vorübergehend gestohlen (Deepsea Succubus): liegt bei MIR, kontrolliert vom Dieb → dauerhaft zurück, ohne Platzfrage.
    const t = await fresh();
    t.p0.supportZones[0][0] = [KRE]; const inst = t.engine._trackCard(KRE, 0, 'support', 0, 0);
    inst.stolenBy = 1; inst.stolenFromOwner = 0; inst.controller = 1;
    await spiele(t);
    check('gestohlene Karte auf meiner Seite: Kontrolle dauerhaft zurück (kein `stolenBy`, `controller` = ich), keine Platzfrage', inst.controller === 0 && inst.stolenBy == null && t.zonen.length === 0, { c: inst.controller, s: inst.stolenBy });
  }
  {
    const t = await fresh();
    const cardinal = gegnerKarte(t, KRE, 0, 0, { counters: { _controlLocked: true } });
    await spiele(t);
    check('„Control cannot change“: keine betroffene Karte → es wird gezogen', cardinal.controller === 1 && log(t).data.drew === 1, { c: cardinal.controller, l: log(t) });
  }
  {
    // Eine Karte des GEGNERS (originalOwner 1) auf der Gegenseite ist nicht betroffen, eine von MIR schon.
    const t = await fresh();
    t.p1.supportZones[0][0] = [KRE2]; const fremd = t.engine._trackCard(KRE2, 1, 'support', 0, 0);
    const meine = gegnerKarte(t, KRE, 1, 0);
    await spiele(t);
    check('nur MEINE Karte wird übernommen, die des Gegners bleibt', meine.controller === 0 && fremd.controller === 1 && imSupport(t, 1, 0, 0), { m: meine.controller, f: fremd.controller });
  }

  console.log('Areas');
  {
    const t = await fresh();
    t.gs.areaZones[1] = ['Doom Clock'];
    const area = t.engine._trackCard('Doom Clock', 1, 'area', -1, -1);
    area.originalOwner = 0;
    await spiele(t);
    check('eine Area von mir in der Area Zone des Gegners wandert in MEINE Area Zone', t.gs.areaZones[1].length === 0 && t.gs.areaZones[0].includes('Doom Clock') && area.owner === 0 && area.controller === 0, { z: t.gs.areaZones, o: area.owner });
    check('…Anzeige-Animation mit der Area als Ziel', anim(t).length === 1 && anim(t)[0].data.targets[0].zoneType === 'area', anim(t));
  }
  {
    const t = await fresh();
    t.gs.areaZones[0] = [EIGENE_AREA]; t.engine._trackCard(EIGENE_AREA, 0, 'area', -1, -1);
    t.gs.areaZones[1] = ['Doom Clock'];
    const area = t.engine._trackCard('Doom Clock', 1, 'area', -1, -1);
    area.originalOwner = 0;
    const limit = t.engine.areaLimitFor(0);
    await spiele(t);
    check(`meine Area Zone ist voll (Limit ${limit}, ${EIGENE_AREA} liegt dort): die fremde Area bleibt liegen`, limit === 1 && t.gs.areaZones[1].includes('Doom Clock') && t.gs.areaZones[0].length === 1 && area.owner === 1, { z: t.gs.areaZones, limit });
  }

  console.log('Hand-Sperre: die Übernahme geht trotzdem');
  {
    const t = await fresh();
    t.p0.handLocked = true;
    const inst = gegnerKarte(t, KRE, 1, 1);
    check('`blockedByHandLock` ist ausdrücklich aus (die Auto-Erkennung wegen des Ziehsatzes greift nicht)', loadCardEffect(CARD).blockedByHandLock === false);
    const r = await spiele(t);
    check('unter einer Hand-Sperre wird die Karte trotzdem gespielt und die Kreatur übernommen', r === true && inst.controller === 0 && t.p0.hand.length === 0, { r, c: inst.controller, hand: t.p0.hand });
  }
  {
    const t = await fresh();
    t.p0.handLocked = true;
    const r = await spiele(t);
    check('ohne Betroffene fizzelt das Ziehen still an der Hand-Sperre (Karte gespielt, keine Karte gezogen)', r === true && t.p0.hand.length === 0 && t.p0.discardPile.includes(CARD), { r, hand: t.p0.hand });
  }

  console.log('Boris-Sperre');
  {
    const t = await fresh();
    t.p1.heroes[0].name = 'Boris, the Guardian of Blackport';
    check('mit wirksamem Boris beim Gegner, aber ohne betroffene Karte: spielbar (Ziehen)', loadCardEffect(CARD).canActivate(t.gs, 0, t.engine) === true);
    gegnerKarte(t, KRE, 1, 0);
    check('mit betroffener Karte: gesperrt (kein Kontrollwechsel gegen Boris)', loadCardEffect(CARD).canActivate(t.gs, 0, t.engine) === false);
    const r = await spiele(t);
    check('…der Zug schlägt fehl: Karte bleibt auf der Hand, nichts übernommen', r !== true && t.p0.hand.includes(CARD) && t.zonen.length === 0, { r });
  }

  console.log('CPU-Entscheidung der Karte');
  {
    const t = await fresh();
    const s = loadCardEffect(CARD);
    const r = s.cpuResponse(t.engine, 'generic', { title: CARD, type: 'zonePick', zones: [{ owner: 0, heroIdx: 1, slotIdx: 2 }, { owner: 0, heroIdx: 2, slotIdx: 0 }] });
    check('Platzfrage: die CPU nimmt die erste angebotene Zone', r && r.heroIdx === 1 && r.slotIdx === 2 && r.owner === 0, r);
  }

  console.log(fails === 0 ? '\nALLE GRÜN' : `\n${fails} FEHLER`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
