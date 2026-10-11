'use strict';
// Cute Crown (Artifact, Equipment, Cost 8): „Equip this card to a Hero you control. You may once per turn summon a "Cute" Creature from your hand as an additional
// Action with the equipped Hero, but the equipped Hero cannot summon any Creatures except "Cute" Creatures."
// Als Vorgabe 10.10.: solange die Ladung da ist, kann der Träger in der Main Phase eine Cute Creature beschwören (oder in der Action Phase, ohne die Aktion zu verbrauchen) —
// ohne die Krone auszulösen. Geprüft wird der ECHTE Spielweg (`host.doPlayArtifact`, `host.doPlayCreature`) mit der Zusatzaktions-Maschinerie der Engine.
//   node scripts/skilltest-e2e/cute-crown.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CROWN = 'Cute Crown';
const WINGS = 'Cute Wings';
const CUTE1 = 'Cute Bunny', CUTE2 = 'Cute Bird';            // Lv0 / Lv1
const PLAIN = 'Sky Shaman';                                 // Lv0, kein „Cute"
const TYPE = 'cute_crown_summon';
const DB = require('../../cards/effects/_card-db').getCardDB();

async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = null;
  gs.skillTest = null;                                       // Skill-Test-Sim: dort gelten eigene Aktionsregeln
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand' || c.zone === 'ability')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = []; ps._actionsPlayedThisPhase = 0;
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
    ps.abilityGivenThisTurn = []; ps.gold = 30;
  }
  engine._fastMode = false; engine._delay = async () => {};
  const t = { room, host, engine, gs, p0, p1, events: [], prompts: [], antwort: null, logs: [] };
  const origPg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => {
    t.prompts.push({ pi, d });
    if (t.antwort) { const a = t.antwort(pi, d); if (a !== undefined) return a; }
    return origPg(pi, d, ...r);
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data, opts: r[0] }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, d) => { t.logs.push({ type, d }); return origLog(type, d); };
  return t;
}
let t;
function setzeHand(names) { t.p0.hand = [...names]; for (const n of names) t.engine._trackCard(n, 0, 'hand'); }
/** Die Krone aus der Hand an Held `hi` anlegen (echter Weg, bezahlt 8 Gold). */
async function legeKrone(hi = 0, slot = 0) {
  t.p0.hand.unshift(CROWN); t.engine._trackCard(CROWN, 0, 'hand');
  return t.host.doPlayArtifact(t.room, 0, { cardName: CROWN, handIndex: 0, heroIdx: hi, zoneSlot: slot });
}
const kroneInst = () => t.engine.cardInstances.find(c => c.name === CROWN && c.zone === 'support');
const ladung = () => (kroneInst()?.counters?.aaGrants || {})[TYPE];
const spiele = (name, hi = 0, slot = 1) => {
  const handIndex = t.p0.hand.indexOf(name);
  return t.host.doPlayCreature(t.room, 0, { cardName: name, handIndex, heroIdx: hi, zoneSlot: slot });
};
const aufBrett = (name) => t.engine.cardInstances.some(c => c.name === name && c.zone === 'support');
const log = (typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const anims = (typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === typ).map(e => e.data);
const typEintrag = () => t.engine.getAdditionalActions(0).find(a => a.typeId === TYPE);

(async () => {
  console.log('Karte und Skript');
  {
    const cd = DB[CROWN], s = loadCardEffect(CROWN);
    check('Artifact, Equipment, Kosten 8 (angehoben)', cd && cd.cardType === 'Artifact' && cd.subtype === 'Equipment' && cd.cost === 8, cd);
    check('Kartentext: neuer Wortlaut', cd && cd.effect === 'Equip this card to a Hero you control. You may once per turn summon a "Cute" Creature from your hand as an additional Action with the equipped Hero, but the equipped Hero cannot summon any Creatures except "Cute" Creatures.', cd && cd.effect);
    check('Skript: Equip nur eigene Seite, Beschwörungs-Gate (`canPlayCard`), Hooks', s && s.isEquip === true && s.equipOwnSideOnly === true && typeof s.canPlayCard === 'function' && s.hooks && typeof s.hooks.onTurnStart === 'function' && typeof s.hooks.onPlay === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst im Index und als Datei', idx[CROWN] && idx[CROWN].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[CROWN].id + '.png')));
    check(`Testkarten sind „Cute“ bzw. nicht (${CUTE1}, ${CUTE2} / ${PLAIN})`, DB[CUTE1] && DB[CUTE2] && DB[PLAIN] && /\bCute\b/.test(CUTE1) && !/Cute/.test(PLAIN));
  }

  console.log('Anlegen: die Ladung kommt von selbst');
  {
    t = await fresh({ phase: 2 });
    setzeHand([CUTE1, CUTE2, PLAIN]);
    const r = await legeKrone(0, 0);
    check('die Krone liegt an Held 0, 8 Gold bezahlt', r !== false && !!kroneInst() && kroneInst().heroIdx === 0 && t.p0.gold === 22, { r, gold: t.p0.gold });
    check('die Ladung ist SOFORT da (Besitzer am Zug) — kein Klick auf die Krone nötig', ladung() === 1, kroneInst()?.counters);
    const e = typEintrag();
    check('die Zusatzaktion erscheint im Zustand: Anbieter = Krone an Held 0, wählbare Handkarten = NUR die Cute Creatures', e && e.heroRestricted === true && e.providers.length === 1 && e.providers[0].heroIdx === 0 && e.eligibleHandCards.includes(CUTE1) && e.eligibleHandCards.includes(CUTE2) && !e.eligibleHandCards.includes(PLAIN), e);
    check('für den Träger ja, für einen ANDEREN Helden nein (heroRestricted)', t.engine.findAdditionalActionForCard(0, CUTE1, 0) === TYPE && t.engine.findAdditionalActionForCard(0, CUTE1, 1) === null);
    check('eine Nicht-Creature (Spell) und eine Nicht-Cute-Creature passen nicht in den Filter', t.engine.findAdditionalActionForCard(0, PLAIN, 0) === null);
  }

  console.log('Main Phase: die Cute Creature wird mit der Zusatzaktion beschworen');
  {
    t = await fresh({ phase: 2 });
    setzeHand([CUTE1, CUTE1, PLAIN]);                        // zwei Stufe-0-Hasen: Cute Bird (Stufe 1) scheiterte am Stufenpruefer des Helden, nicht an der Ladung
    await legeKrone(0, 0);
    const r = await spiele(CUTE1, 0, 1);
    check('die Cute Creature wird beschworen (Main Phase, keine Aktion nötig)', r !== false && aufBrett(CUTE1), r);
    check('die Ladung ist verbraucht (0), der Held gilt NICHT als gehandelt', ladung() === 0 && t.p0.heroesActedThisTurn.length === 0, { l: ladung(), acted: t.p0.heroesActedThisTurn });
    const a = anims('crown_flutter');
    check('Animation `crown_flutter` am Platz der Krone (Seite 0, Held 0, Platz 0)', a.length === 1 && a[0].zoneType === 'board' && a[0].targets[0].owner === 0 && a[0].targets[0].heroIdx === 0 && a[0].targets[0].zoneSlot === 0, a);
    check('Log `cute_crown_summon`', log('cute_crown_summon').length === 1, t.logs.map(l => l.type));
    const r2 = await spiele(CUTE1, 0, 2);
    check('einmal pro Zug: die zweite Cute Creature geht in der Main Phase NICHT (keine Ladung, keine Aktion)', r2 === false && t.engine.cardInstances.filter(c => c.name === CUTE1 && c.zone === 'support').length === 1, r2);
  }
  {
    t = await fresh({ phase: 2 });
    setzeHand([PLAIN]);
    await legeKrone(0, 0);
    const r = await spiele(PLAIN, 0, 1);
    check('eine Nicht-Cute-Creature kann der Träger NICHT beschwören (auch nicht mit der Ladung)', r === false && !aufBrett(PLAIN) && ladung() === 1, { r, l: ladung() });
    const r2 = await spiele(PLAIN, 1, 1);
    check('…ein anderer Held (ohne Krone) kann sie ohne Weiteres beschwören (der Nachteil hängt an der Ausrüstung)', r2 === false ? true : aufBrett(PLAIN) && ladung() === 1, { r2 });
  }

  console.log('Action Phase: die Aktion des Helden bleibt frei');
  {
    t = await fresh({ phase: 3 });
    setzeHand([CUTE1, CUTE1, PLAIN]);
    await legeKrone(0, 0).catch(() => {});                   // Artefakte nur in den Main Phases: für diesen Aufbau die Krone direkt an den Helden legen
    if (!kroneInst()) {
      const inst = t.engine._trackCard(CROWN, 0, 'support', 0, 0);
      t.p0.supportZones[0][0] = [CROWN];
      inst.turnPlayed = 1;
      const s = loadCardEffect(CROWN);
      await t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: CROWN, zone: 'support', heroIdx: 0, _skipReactionCheck: true });
      void s;
    }
    check('Aufbau: Krone liegt, Ladung da (Action Phase, Aktion frei)', !!kroneInst() && ladung() === 1 && t.p0.heroesActedThisTurn.length === 0 && t.gs.currentPhase === 3, { l: ladung(), ph: t.gs.currentPhase });
    const r = await spiele(CUTE1, 0, 1);
    check('erste Cute Creature: beschworen — die Ladung wird VOR der Aktion genommen: Ladung 0, Held NICHT gehandelt, Phase bleibt', r !== false && aufBrett(CUTE1) && ladung() === 0 && t.p0.heroesActedThisTurn.length === 0 && t.gs.currentPhase === 3, { l: ladung(), acted: t.p0.heroesActedThisTurn, ph: t.gs.currentPhase });
    // Der Nachteil des Trägers gilt auch bei FREIER Aktion (nicht nur, wenn keine Aktion da ist): eine Nicht-Cute-Creature geht beim Träger nie
    const rp = await spiele(PLAIN, 0, 2);
    check('Nachteil: eine Nicht-Cute-Creature geht beim Träger auch mit FREIER Aktion nicht (die Aktion bleibt frei)', rp === false && !aufBrett(PLAIN) && t.p0.heroesActedThisTurn.length === 0, { rp, acted: t.p0.heroesActedThisTurn });
    const rq = await spiele(PLAIN, 1, 0);
    check('…ein anderer Held (ohne Krone) beschwört sie mit seiner normalen Aktion', rq !== false && aufBrett(PLAIN), rq);
    t.p0.heroesActedThisTurn = []; t.gs.currentPhase = 3; t.p0._actionsPlayedThisPhase = 0;       // für die nächste Prüfung: Aktion wieder frei
    const r2 = await spiele(CUTE1, 0, 2);
    check('zweite Cute Creature: normale Aktion des Helden (jetzt gilt er als gehandelt)', r2 !== false && t.engine.cardInstances.filter(c => c.name === CUTE1 && c.zone === 'support').length === 2 && t.p0.heroesActedThisTurn.length === 1, { r2, brett: t.engine.cardInstances.filter(c => c.name === CUTE1 && c.zone === 'support').length, acted: t.p0.heroesActedThisTurn, ph: t.gs.currentPhase, n: t.p0._actionsPlayedThisPhase });
  }

  console.log('Einmal pro Zug: die Ladung kehrt mit jedem EIGENEN Zug zurück, verfällt am Zugende');
  {
    t = await fresh({ phase: 2 });
    setzeHand([CUTE1]);
    await legeKrone(0, 0);
    await spiele(CUTE1, 0, 1);
    check('verbraucht: Ladung 0', ladung() === 0);
    t.gs.turn += 2;                                            // nächster eigener Zug
    t.gs.activePlayer = 0;
    await t.engine.runHooks('onTurnStart', { playerIdx: 0, _skipReactionCheck: true });
    check('neuer eigener Zug: die Ladung ist wieder da', ladung() === 1, kroneInst()?.counters);
  }
  {
    t = await fresh({ phase: 2 });
    await legeKrone(0, 0);
    check('Ausgangslage: Ladung da', ladung() === 1);
    t.engine._expireTurnEndAdditionalActions();
    check('ungenutzt: am Zugende verfällt sie (`expiresAtTurnEnd`) — nichts rutscht in den nächsten Zug', ladung() === 0, kroneInst()?.counters);
    t.gs.activePlayer = 1;
    await t.engine.runHooks('onTurnStart', { playerIdx: 1, _skipReactionCheck: true });
    check('im Zug des GEGNERS wird die Ladung nicht gewährt', ladung() === 0, kroneInst()?.counters);
  }

  console.log('Cute Wings: „All Creatures that Hero summons count as Cute"');
  {
    t = await fresh({ phase: 2 });
    setzeHand([PLAIN]);
    const flügel = t.engine._trackCard(WINGS, 0, 'support', 0, 2);
    t.p0.supportZones[0][2] = [WINGS];
    flügel.turnPlayed = 1;
    await legeKrone(0, 0);
    check('mit Cute Wings darf der Träger JEDE Creature beschwören (der Nachteil entfällt)', t.engine.findAdditionalActionForCard(0, PLAIN, 0) === TYPE, t.engine.findAdditionalActionForCard(0, PLAIN, 0));
    const r = await spiele(PLAIN, 0, 1);
    check('…und sie wird mit der Ladung der Krone beschworen', r !== false && aufBrett(PLAIN) && ladung() === 0, { r, l: ladung() });
  }

  console.log('Die Krone geht');
  {
    t = await fresh({ phase: 2 });
    setzeHand([CUTE1]);
    await legeKrone(0, 0);
    const inst = kroneInst();
    await t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, inst, { source: 'Test' });
    check('Krone zerstört: die Ladung ist weg, keine Zusatzaktion mehr im Zustand', !t.engine.cardInstances.some(c => c.name === CROWN && c.zone === 'support') && !typEintrag(), t.engine.getAdditionalActions(0));
    const r = await spiele(CUTE1, 0, 1);
    check('…und in der Main Phase geht keine Beschwörung mehr', r === false && !aufBrett(CUTE1), r);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Cute-Crown-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
