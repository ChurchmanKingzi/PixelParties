'use strict';
// Race Boats: Crocodile, Frog, Snake und Whale Race Boat + das gemeinsame Geruest `_race-boat-shared.js`.
//   node scripts/skilltest-e2e/race-boats.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
const RB = require('../../cards/effects/_race-boat-shared');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CROC = 'Crocodile Race Boat', FROG = 'Frog Race Boat', SNAKE = 'Snake Race Boat', WHALE = 'Whale Race Boat';

/** Ein Spiel; A (am Zug) und B, leeres Brett, keine Handkarten und Surprises, grosse HP. */
async function fresh() {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  const A = gs.activePlayer, B = A === 0 ? 1 : 0;
  gs.turn = 5; gs.currentPhase = 2;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise')) engine._untrackCard(c.id);
  for (const p of gs.players) for (const hz of p.supportZones) for (let i = 0; i < hz.length; i++) hz[i] = [];
  for (const p of gs.players) for (let i = 0; i < (p.surpriseZones || []).length; i++) p.surpriseZones[i] = [];
  for (const p of gs.players) { p.hand = []; for (const h of p.heroes) { h.hp = h.maxHp = 3000; } }
  const stelle = (pi, name, hi, slot) => {
    while ((gs.players[pi].supportZones[hi] || []).length <= slot) gs.players[pi].supportZones[hi].push([]);
    gs.players[pi].supportZones[hi][slot] = [name];
    const inst = engine._trackCard(name, pi, 'support', hi, slot);
    inst.turnPlayed = 1;
    return inst;
  };
  const t = { room, host, engine, gs, A, B, stelle, prompts: [], events: [], sofort: [] };
  // Die Zusatzaktion mitschreiben (ohne Handkarten kaeme gar kein Auswahlfenster): wer, mit welchem Helden.
  engine.performImmediateAction = async (pi, heroIdx, cfg) => { t.sofort.push({ pi, heroIdx, cfg }); return { played: false }; };
  const origPg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => { t.prompts.push({ pi, d }); if (t.antwort) { const a = t.antwort(pi, d); if (a !== undefined) return a; } return origPg(pi, d, ...r); };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origAoe = engine.beginAoeStrike.bind(engine);
  engine.beginAoeStrike = (n, o) => { t.events.push({ ev: 'AOE', data: { n, amount: o.amount } }); return origAoe(n, o); };
  return t;
}
const hp = (t, pi, hi) => t.gs.players[pi].heroes[hi].hp;
const lebt = (t, inst) => t.engine.cardInstances.includes(inst) && inst.zone === 'support';
const heldenAktionen = (t) => t.sofort.map(x => ({ d: { heroIdx: x.heroIdx, ...x.cfg }, pi: x.pi }));

(async () => {
  console.log('Karten: Daten und Kunst');
  {
    const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf8'));
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    const atlas = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/cardgen/art.json'), 'utf8'));
    for (const n of [CROC, FROG, SNAKE, WHALE]) {
      const c = cards.find(x => x.name === n);
      check(`${n}: Artifact/Equipment, Kosten 12`, c && c.cardType === 'Artifact' && c.subtype === 'Equipment' && c.cost === 12, c && [c.cardType, c.subtype, c.cost]);
      check(`${n}: Kunst nativ 76×51 im Index, Datei und Atlas`, idx[n] && idx[n].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[n].id + '.png')) && atlas.a[n] && atlas.a[n][2] === 76 && atlas.a[n][3] === 51);
    }
    check('Snake ist im Skill Test gebannt, die anderen drei sind es nicht', cards.find(x => x.name === SNAKE).skilltestLegal === false && [CROC, FROG, WHALE].every(n => cards.find(x => x.name === n).skilltestLegal === true));
    check('nur Snake ist klickbar (equipEffect); die anderen drei haben keinen Klick-Effekt', loadCardEffect(SNAKE).equipEffect === true && [CROC, FROG, WHALE].every(n => !loadCardEffect(n).equipEffect));
  }

  console.log('Gemeinsames Geruest: nur 1 Race Boat je Held, Creatures-Zaehlung');
  {
    const t = await fresh();
    check('„Race Boat Captain" ist kein Race Boat (Creature), die vier Boote sind es', !RB.istRaceBoat('Race Boat Captain') && [CROC, FROG, SNAKE, WHALE].every(RB.istRaceBoat));
    t.stelle(t.A, FROG, 0, 2);
    check('ein Held mit einem Race Boat nimmt kein zweites (egal welches)', [CROC, SNAKE, WHALE, FROG].every(n => !t.engine.canEquipCardToHero(n, t.A, 0)));
    check('ein anderer Held darf', [CROC, SNAKE, WHALE, FROG].every(n => t.engine.canEquipCardToHero(n, t.A, 1)));
    // Zaehlung
    check('0 Creatures: Boote und Ausruestung zaehlen nicht', RB.kreaturenAmHeld(t.engine, t.A, 0) === 0);
    t.stelle(t.A, 'Barkeeper', 0, 0);
    t.stelle(t.A, 'Archer', 0, 1);
    check('2 Creatures in den Grundzonen', RB.kreaturenAmHeld(t.engine, t.A, 0) === 2);
    t.stelle(t.A, 'Baby Spider', 0, 3);                  // Bonus-Zone (Flying Island in the Sky)
    check('Creatures in BONUS-Zonen (Flying Island) zaehlen mit', RB.kreaturenAmHeld(t.engine, t.A, 0) === 3);
    t.stelle(t.B, 'Cute Bunny', 0, 0);
    check('Creatures anderer Helden und der Gegenseite zaehlen nicht', RB.kreaturenAmHeld(t.engine, t.A, 0) === 3 && RB.kreaturenAmHeld(t.engine, t.A, 1) === 0);
    const fremd = t.stelle(t.A, 'Cute Bunny', 1, 0);
    fremd.controller = t.B; fremd.counters.crossSideControlled = t.B;   // Gegner-Creature in meiner Zone (Styx: owner = Seite des Helden)
    check('eine Creature des Gegners in den Zonen meines Helden zaehlt (physischer Ort)', RB.kreaturenAmHeld(t.engine, t.A, 1) === 1, RB.kreaturenAmHeld(t.engine, t.A, 1));
  }

  console.log('Crocodile Race Boat');
  {
    const CROC_S = loadCardEffect(CROC)._test;
    const t0 = await fresh();
    check('Schwelle: 4 minus Creatures, mindestens 1', [0, 1, 2, 3, 4, 7].map(n => Math.max(1, CROC_S.BASIS_ZIELE - n)).join() === '4,3,2,1,1,1');

    // 1 Creature beim Helden → 3 Kills noetig
    const t = await fresh();
    const boot = t.stelle(t.A, CROC, 0, 2);
    t.stelle(t.A, 'Barkeeper', 0, 0);
    const feinde = ['Archer', 'Baby Spider', 'Cute Bunny', 'Barkeeper', 'Archer'].map((n, i) => t.stelle(t.B, n, i % 3, Math.floor(i / 3)));
    const quelle = { name: 'Fireball', owner: t.A, heroIdx: 0 };
    const toete = async (inst, q = quelle, typ = 'destruction_spell') => t.engine.actionDealCreatureDamage(q, inst, 9999, typ, { sourceOwner: t.A, canBeNegated: true });
    await toete(feinde[0]); await toete(feinde[1]);
    check('1 Creature beim Helden: nach 2 Kills noch keine Zusatzaktion', heldenAktionen(t).length === 0 && !t.gs.players[t.A].actionLocked);
    await toete(feinde[2]);
    check('…der DRITTE Kill (4 − 1) loest sie sofort aus: der Held bekommt die Zusatzaktion', heldenAktionen(t).length === 1 && heldenAktionen(t)[0].d.heroIdx === 0, heldenAktionen(t).length);
    check('…danach: keine weiteren Aktionen in dieser Runde (auch wenn die Zusatzaktion abgelehnt wurde)', t.gs.players[t.A].actionLocked === true);
    await toete(feinde[3]);
    check('einmal pro Zug: der naechste Kill loest nichts mehr aus', heldenAktionen(t).length === 1);
    // naechster Zug: Zaehler faengt neu an
    t.gs.players[t.A].actionLocked = false; t.gs.turn += 2;
    const neu = ['Archer', 'Baby Spider', 'Cute Bunny'].map((n, i) => t.stelle(t.B, n, i, 2));
    await toete(neu[0]); await toete(neu[1]);
    check('naechster Zug: die Kills zaehlen von vorn (2 Kills reichen nicht)', heldenAktionen(t).length === 1);
    await toete(neu[2]);
    check('…der dritte Kill des neuen Zuges loest wieder aus', heldenAktionen(t).length === 2);
  }
  {
    // 3 Creatures → ein Kill genuegt; fremde Quellen und fremde Helden zaehlen nicht
    const t = await fresh();
    t.stelle(t.A, CROC, 0, 2);
    for (let i = 0; i < 2; i++) t.stelle(t.A, 'Barkeeper', 0, i);
    t.stelle(t.A, 'Baby Spider', 0, 3);                               // Bonus-Zone: die dritte Creature
    const f = ['Archer', 'Baby Spider', 'Cute Bunny', 'Barkeeper'].map((n, i) => t.stelle(t.B, n, i % 3, 0 + (i > 2 ? 1 : 0)));
    const toete = async (inst, q, typ = 'destruction_spell') => t.engine.actionDealCreatureDamage(q, inst, 9999, typ, { sourceOwner: t.A, canBeNegated: true });
    await toete(f[0], { name: 'Fireball', owner: t.A, heroIdx: 1 });
    check('ein ANDERER Held tötet: zählt nicht', heldenAktionen(t).length === 0);
    await toete(f[1], { name: 'Cute Bunny', owner: t.A, heroIdx: 0, zone: 'support' });
    check('Schaden einer CREATURE des Helden zählt nicht', heldenAktionen(t).length === 0);
    const eigene = t.stelle(t.A, 'Archer', 1, 1);
    await toete(eigene, { name: 'Fireball', owner: t.A, heroIdx: 0 });
    check('eine EIGENE Creature zu töten zählt nicht („target your opponent controls")', heldenAktionen(t).length === 0);
    t.gs.activePlayer = t.B;
    await toete(f[2], { name: 'Fireball', owner: t.A, heroIdx: 0 });
    check('nur WÄHREND DEINES ZUGES („during your turn")', heldenAktionen(t).length === 0);
    t.gs.activePlayer = t.A;
    await toete(f[3], { name: 'Fireball', owner: t.A, heroIdx: 0 });
    check('3 Creatures (inkl. Bonus-Zone): EIN Kill genügt', heldenAktionen(t).length === 1);
  }
  {
    // Flächenschaden: 2 Kills gleichzeitig gegen eine Schwelle von 2
    const t = await fresh();
    t.stelle(t.A, CROC, 0, 2);
    t.stelle(t.A, 'Barkeeper', 0, 0); t.stelle(t.A, 'Archer', 0, 1);      // 2 Creatures → Schwelle 2
    const z = [t.stelle(t.B, 'Archer', 0, 0), t.stelle(t.B, 'Baby Spider', 1, 0)];
    await t.engine.dealDamageToTargets({ name: 'Boiling Oil', owner: t.A, heroIdx: 0 },
      z.map(inst => ({ type: 'creature', inst })), { damage: 9999, damageType: 'destruction_spell', sourceName: 'Boiling Oil', istFlaeche: true, hitDelay: 0 });
    check('Boiling-Oil-Fall: zwei Creatures GLEICHZEITIG getötet zählen als zwei Ziele — die Zusatzaktion kommt sofort', heldenAktionen(t).length === 1, heldenAktionen(t).length);
  }
  {
    // Das Boot verschwindet, bevor die Zusatzaktion möglich ist → sie verfällt (samt Nachteil)
    const t = await fresh();
    const boot = t.stelle(t.A, CROC, 0, 2);
    for (let i = 0; i < 3; i++) t.stelle(t.A, 'Barkeeper', 0, i < 2 ? i : 3);
    const orig = t.engine.announceHookActivation.bind(t.engine);
    t.engine.announceHookActivation = async (...a) => {
      const r = await orig(...a);
      t.engine._untrackCard(boot.id); t.gs.players[t.A].supportZones[0][2] = [];   // z. B. durch einen Gegner-Effekt entfernt
      return r;
    };
    const opfer = t.stelle(t.B, 'Archer', 0, 0);
    await t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: t.A, heroIdx: 0 }, opfer, 9999, 'destruction_spell', { sourceOwner: t.A, canBeNegated: true });
    check('Boot vor der Zusatzaktion entfernt: sie VERFÄLLT (keine Aktion, kein Nachteil)', heldenAktionen(t).length === 0 && !t.gs.players[t.A].actionLocked);
  }

  console.log('Frog Race Boat');
  {
    const t = await fresh();
    t.stelle(t.A, FROG, 0, 2);
    t.stelle(t.A, 'Barkeeper', 0, 0); t.stelle(t.A, 'Archer', 0, 1); t.stelle(t.A, 'Baby Spider', 0, 3);   // 3 Creatures (eine in der Bonus-Zone)
    const q = { name: 'Fireball', owner: t.A, heroIdx: 0 };
    const ziel = t.gs.players[t.B].heroes[0];
    const vor = ziel.hp;
    await t.engine.actionDealDamage(q, ziel, 100, 'destruction_spell');
    check('der ERSTE Einzelzielschaden der Runde: +50 je Creature (3) → 100 + 150', vor - ziel.hp === 250, vor - ziel.hp);
    const v2 = ziel.hp;
    await t.engine.actionDealDamage(q, ziel, 100, 'destruction_spell');
    check('der zweite Treffer derselben Runde bleibt unverändert', v2 - ziel.hp === 100, v2 - ziel.hp);
    t.gs.turn += 1;
    const v3 = ziel.hp;
    await t.engine.actionDealDamage(q, ziel, 100, 'destruction_spell');
    check('in der nächsten Runde wieder der erste Treffer: Bonus wieder da', v3 - ziel.hp === 250, v3 - ziel.hp);
  }
  {
    const t = await fresh();
    t.stelle(t.A, FROG, 0, 2);
    t.stelle(t.A, 'Barkeeper', 0, 0); t.stelle(t.A, 'Archer', 0, 1);                    // 2 Creatures → +100
    const q = { name: 'Fireball', owner: t.A, heroIdx: 0 };
    const h = t.gs.players[t.B].heroes;
    // Flächenschlag auf zwei Helden: kein Einzelziel — kein Bonus, nichts verbraucht
    const v0 = h[0].hp, v1 = h[1].hp;
    await t.engine.dealDamageToTargets(q, [{ type: 'hero', owner: t.B, heroIdx: 0 }, { type: 'hero', owner: t.B, heroIdx: 1 }],
      { damage: 100, damageType: 'destruction_spell', sourceName: 'Fireball', istFlaeche: true, hitDelay: 0 });
    check('Flächenschaden auf 2+ Ziele zählt NICHT als Einzelziel: kein Bonus', v0 - h[0].hp === 100 && v1 - h[1].hp === 100, [v0 - h[0].hp, v1 - h[1].hp]);
    const v2 = h[2].hp;
    await t.engine.actionDealDamage(q, h[2], 100, 'destruction_spell');
    check('…und er verbraucht den Bonus nicht: der folgende Einzelzielschaden bekommt ihn (100 + 100)', v2 - h[2].hp === 200, v2 - h[2].hp);
    // Status-Tick und Creature-Quelle bekommen nichts
    const t2 = await fresh();
    t2.stelle(t2.A, FROG, 0, 2); t2.stelle(t2.A, 'Barkeeper', 0, 0);
    const ziel = t2.gs.players[t2.B].heroes[0];
    const a = ziel.hp;
    await t2.engine.actionDealDamage({ name: 'Burn' }, ziel, 50, 'burn');
    await t2.engine.actionDealDamage({ name: 'Barkeeper', owner: t2.A, heroIdx: 0, zone: 'support' }, ziel, 50, 'creature');
    check('Status-Ticks und der Schaden einer Creature bekommen den Bonus nicht (und verbrauchen ihn nicht)', a - ziel.hp === 100, a - ziel.hp);
    const b = ziel.hp;
    await t2.engine.actionDealDamage({ name: 'Fireball', owner: t2.A, heroIdx: 1 }, ziel, 100, 'destruction_spell');
    check('Schaden eines ANDEREN Helden bekommt ihn nicht', b - ziel.hp === 100, b - ziel.hp);
    const c = ziel.hp;
    await t2.engine.actionDealDamage({ name: 'Fireball', owner: t2.A, heroIdx: 0 }, ziel, 100, 'destruction_spell');
    check('…der Schaden des ausgerüsteten Helden bekommt ihn (1 Creature: +50)', c - ziel.hp === 150, c - ziel.hp);
  }
  {
    // Creature als Ziel: ein Eintrag = Einzelziel
    const t = await fresh();
    t.stelle(t.A, FROG, 0, 2); t.stelle(t.A, 'Barkeeper', 0, 0); t.stelle(t.A, 'Archer', 0, 1);
    const opfer = t.stelle(t.B, 'Archer', 0, 0);
    const vor = opfer.counters.currentHp ?? t.engine._getCardDB()['Archer'].hp;
    await t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: t.A, heroIdx: 0 }, opfer, 10, 'destruction_spell', { sourceOwner: t.A, canBeNegated: true });
    const nach = opfer.counters.currentHp;
    check('auch ein Creature-Ziel bekommt den Bonus (10 + 100 = 110, ggf. tot)', !lebt(t, opfer) || vor - nach === 110, [vor, nach]);
  }

  console.log('Whale Race Boat');
  {
    const t = await fresh();
    const boot = t.stelle(t.A, WHALE, 0, 2);
    t.stelle(t.A, 'Barkeeper', 0, 0); t.stelle(t.A, 'Archer', 0, 1);                          // 2 Creatures beim Wal-Helden
    const eigeneAndere = t.stelle(t.A, 'Cute Bunny', 1, 0);
    const feind = t.stelle(t.B, 'Archer', 0, 0);
    const hooks = { actionType: 'spell', playerIdx: t.A, heroIdx: 0, playedCardName: 'Fireball', isAdditional: false, isInherent: false, isFree: false };
    const h = (pi, i) => t.gs.players[pi].heroes[i].hp;
    const vorher = { a0: h(t.A, 0), a1: h(t.A, 1), b0: h(t.B, 0), b1: h(t.B, 1), b2: h(t.B, 2) };
    // Eine Aktion eines ANDEREN Helden löst nichts aus
    await t.engine.runHooks('onAnyActionResolved', { ...hooks, heroIdx: 1 });
    check('die Aktion eines ANDEREN Helden löst nicht aus', h(t.B, 0) === vorher.b0 && t.events.every(e => !(e.data && e.data.type === 'tidal_wave')));
    await t.engine.runHooks('onAnyActionResolved', hooks);
    const schaden = 40 + 30 * 2;
    check('erste Aktion des Helden: 40 + 30 je Creature (2) = 100 auf ALLE Helden der Gegenseite', [0, 1, 2].every(i => vorher['b' + i] - h(t.B, i) === schaden), [0, 1, 2].map(i => vorher['b' + i] - h(t.B, i)));
    check('…auch auf die EIGENEN anderen Helden', vorher.a1 - h(t.A, 1) === schaden, vorher.a1 - h(t.A, 1));
    check('…nur der ausgerüstete Held selbst bleibt unberührt („all OTHER targets")', h(t.A, 0) === vorher.a0);
    check('…und auf Creatures beider Seiten, auch die des Wal-Helden (Archer 50 HP fällt, Cute Bunny fällt)', !lebt(t, feind) && !lebt(t, eigeneAndere));
    const aoe = t.events.filter(e => e.ev === 'AOE').map(e => e.data);
    check('EIN Flächenschlag mit Schaden 100', aoe.length === 1 && aoe[0].amount === 100 && aoe[0].n >= 2, aoe);
    const w = t.events.filter(e => e.ev === 'play_zone_animation' && e.data.type === 'tidal_wave').map(e => e.data);
    check('Animation: brettweite Pixelart-Welle (`tidal_wave`) über die komplette GEGNERSEITE, Ursprung = der Wal-Held',
      w.length === 1 && w[0].zoneType === 'board' && w[0].regionOwner === t.B && w[0].originOwner === t.A && w[0].originHeroIdx === 0, w);
    check('…alle getroffenen Ziele stehen als {owner, heroIdx, zoneSlot} darin (der Wal-Held nicht)',
      w[0].targets.length >= 5 && !w[0].targets.some(x => x.owner === t.A && x.heroIdx === 0 && x.zoneSlot === -1), w[0].targets.length);
    check('die Welle kommt VOR dem Schaden', t.events.findIndex(e => e.data && e.data.type === 'tidal_wave') >= 0 && t.events.findIndex(e => e.data && e.data.type === 'tidal_wave') < t.events.findIndex(e => e.ev === 'AOE'));
    // einmal pro Zug
    const nach = h(t.B, 0);
    await t.engine.runHooks('onAnyActionResolved', hooks);
    check('einmal pro Zug: die zweite Aktion löst nicht mehr aus', h(t.B, 0) === nach);
    t.gs.turn += 1;
    await t.engine.runHooks('onAnyActionResolved', hooks);
    const rest = RB.kreaturenAmHeld(t.engine, t.A, 0);
    check('in der nächsten Runde wieder (frischer Zähler) — mit den Creatures, die noch stehen', h(t.B, 0) === nach - (40 + 30 * rest), [rest, nach - h(t.B, 0)]);
  }
  {
    // Die Beschwörung einer Creature ist die Aktion: die NEUE Creature zählt schon für den Schaden.
    const t = await fresh();
    t.stelle(t.A, WHALE, 0, 2);
    t.stelle(t.A, 'Barkeeper', 0, 0);                                                     // 1 Creature, mit der neuen 2
    t.gs.currentPhase = 3;
    t.gs.players[t.A].hand = ['Baby Spider'];
    t.gs.players[t.A].gold = 99;
    const b0 = t.gs.players[t.B].heroes[0].hp;
    const ok = await t.host.doPlayCreature(t.room, t.A, { cardName: 'Baby Spider', handIndex: 0, heroIdx: 0, zoneSlot: 1 });
    check('Beschwörung einer Creature mit dem Wal-Helden gelingt (die Spinne fällt danach selbst der Welle zum Opfer: „all other targets")', ok !== false && !t.gs.players[t.A].hand.includes('Baby Spider') && t.gs.players[t.A].discardPile.includes('Baby Spider'), [ok, t.gs.players[t.A].hand, t.gs.players[t.A].discardPile]);
    check('…sie ist die erste Aktion: der Schaden zählt die NEUE Creature mit (40 + 30 × 2 = 100)', b0 - t.gs.players[t.B].heroes[0].hp === 100, b0 - t.gs.players[t.B].heroes[0].hp);
  }

  console.log('Snake Race Boat');
  {
    const S = loadCardEffect(SNAKE);
    const t = await fresh();
    const boot = t.stelle(t.A, SNAKE, 0, 2);
    boot.turnPlayed = t.gs.turn;                                                           // gerade erst angelegt: keine Summoning Sickness
    const ctx = () => t.engine._createContext(boot, { event: 'canEquipEffectCheck' });
    const ps = t.gs.players[t.A];
    ps.mainDeck = ['Archer', 'Archer', 'Archer', 'Barkeeper', 'Baby Spider', 'Fireball', 'Heal'];
    check('0 Creatures beim Helden: nicht aktivierbar', S.canActivateEquipEffect(ctx()) === false);
    t.stelle(t.A, 'Cute Bunny', 0, 0); t.stelle(t.A, 'Cute Bunny', 0, 1); t.stelle(t.A, 'Baby Spider', 0, 3);   // 3 Creatures (Bonus-Zone mitgezählt)
    check('3 Creatures, Deck hat 3 verschiedene Creature-Namen (Archer ×3 zählt EINMAL): aktivierbar', S.canActivateEquipEffect(ctx()) === true);
    ps.mainDeck = ['Archer', 'Archer', 'Archer', 'Barkeeper', 'Fireball'];
    check('nur 2 verschiedene Creature-Namen im Deck (Archer ×3, Barkeeper): NICHT aktivierbar — exakt, nicht „up to"', S.canActivateEquipEffect(ctx()) === false);
    ps.mainDeck = ['Fireball', 'Heal'];
    check('0 legale Ziele im Deck: nicht aktivierbar', S.canActivateEquipEffect(ctx()) === false);
    ps.mainDeck = ['Archer', 'Archer', 'Barkeeper', 'Baby Spider', 'Fireball', 'Heal'];

    // Abbruch verbraucht nichts
    t.antwort = () => ({ cancelled: true });
    const abbruch = await S.onEquipEffect(t.engine._createContext(boot, {}));
    check('Abbrechen: Rückgabe false (die Engine rollt die Sperre zurück), nichts geschieht', abbruch === false && ps.hand.length === 0 && ps.mainDeck.length === 6);
    // zu wenige gewählt → nicht „up to"
    t.antwort = (pi, d) => (d.type === 'cardGalleryMulti' ? { selectedCards: ['Archer', 'Barkeeper'] } : undefined);
    const zuWenig = await S.onEquipEffect(t.engine._createContext(boot, {}));
    check('weniger als X gewählt: wird NICHT ausgeführt (exakt X)', zuWenig === false && ps.hand.length === 0);
    // doppelter Name zählt nur einmal → ebenfalls zu wenige
    t.antwort = (pi, d) => (d.type === 'cardGalleryMulti' ? { selectedCards: ['Archer', 'Archer', 'Barkeeper'] } : undefined);
    const doppelt = await S.onEquipEffect(t.engine._createContext(boot, {}));
    check('derselbe Name zweimal gewählt zählt nur einmal → nicht exakt X, nichts geschieht', doppelt === false && ps.hand.length === 0);
    // richtig
    t.prompts.length = 0;
    t.antwort = (pi, d) => (d.type === 'cardGalleryMulti' ? { selectedCards: ['Archer', 'Barkeeper', 'Baby Spider'] } : undefined);
    const ok = await S.onEquipEffect(t.engine._createContext(boot, {}));
    const galerie = t.prompts.find(p => p.d.type === 'cardGalleryMulti').d;
    check('Galerie: GENAU X (3) verschiedene Namen, Bestätigen erst bei X (`minSelect = selectCount = 3`), abbrechbar',
      galerie.selectCount === 3 && galerie.minSelect === 3 && galerie.cancellable === true && galerie.cards.length === 3 && new Set(galerie.cards.map(c => c.name)).size === 3, [galerie.selectCount, galerie.minSelect, galerie.cards.length]);
    check('…die drei kommen auf die Hand, aus dem Deck (je eine Kopie), und die Aktivierung ist verbraucht (true)',
      ok === true && ps.hand.slice().sort().join() === 'Archer,Baby Spider,Barkeeper' && ps.mainDeck.filter(n => n === 'Archer').length === 1 && ps.mainDeck.length === 3, [ok, ps.hand, ps.mainDeck]);
  }

  console.log(fails === 0 ? '\n✓ Race-Boat-Tests grün' : `\n✗ ${fails} Fehler`);
  process.exit(fails === 0 ? 0 : 1);
})();
