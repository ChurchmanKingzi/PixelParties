'use strict';
// Pinta, the Singing Ship (Potion-Deck-Klausel + Beschwoeren aus dem Potion Deck) und das gemeinsame Geruest
// `_potion-deck-hero-shared.js` (Starthelden-Stempel, Zieh-Sperre), das auch Chaos-Diamond nutzt.
//   node scripts/skilltest-e2e/pinta.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
const { GameEngine } = require('../../cards/effects/_engine');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const PINTA = 'Pinta, the Singing Ship';
const CHAOS = 'Chaos-Diamond, the Cracked Keeper';

/** Ein Spiel mit Pinta (Held 0) auf BEIDEN Sitzen; getestet wird am Sitz am Zug. */
async function fresh({ heroes = [PINTA], potion = ['Barkeeper', 'Baby Spider', 'Archer'], abilities = null } = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try {
    out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11,
      mutatePrep: (prep) => {
        for (const p of prep.players) {
          heroes.forEach((h, i) => { p.heroes[i] = h; });
          p.abilityZones[0] = [{ n: 'Navigation', s: 1, c: false }, { n: 'Singing', s: 1, c: false }, null];
        }
      } });
  } finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  const seat = gs.activePlayer, ps = gs.players[seat];
  gs.turn = 5; gs.currentPhase = 2;                     // Main Phase: freie Heldeneffekte
  // Das Brett des Sitzes leeren: Pintas drei Zonen sollen frei sein.
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat)) engine._untrackCard(c.id);
  for (const hz of ps.supportZones) for (let i = 0; i < hz.length; i++) hz[i] = [];
  ps.potionDeck = potion.slice();
  if (abilities) ps.abilityZones[0] = abilities;
  return { room, host, engine, gs, seat, ps, other: gs.players[seat === 0 ? 1 : 0] };
}
const onPinta = (t) => t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === t.seat && c.heroIdx === 0).map(c => c.name);
const activate = (t) => t.host.doActivateHeroEffect(t.room, t.seat, { heroIdx: 0 });
const angebot = (t) => t.engine.getActiveHeroEffects(t.seat).some(e => e.heroName === PINTA);
// Ability-Zonen im Spielzustand: je Zone ein Stapel von Kartennamen (Stapelhoehe = Stufe).
const SUMMONING = [['Navigation'], ['Singing'], ['Summoning Magic']];

(async () => {
  console.log('Starthelden-Stempel und Zieh-Sperre (gemeinsames Geruest)');
  {
    const t = await fresh();
    const hero = t.ps.heroes[0];
    check('Pinta ist als Starthelden ihres Besitzers gestempelt', hero._startingHeroOf === t.seat, hero._startingHeroOf);
    check('der Besitzer kann NIE aus dem Potion Deck ziehen (ps.potionDrawBanned)', t.ps.potionDrawBanned === true);
    // Die Engine selbst fragen, nicht den Skill-Test-Mantel (der leert die Potion Decks nach jedem Zug-Versuch).
    const gezogen = await GameEngine.prototype.actionDrawFromPotionDeck.call(t.engine, t.seat, 1);
    check('Ziehen aus dem Potion Deck liefert nichts', Array.isArray(gezogen) && gezogen.length === 0 && t.ps.potionDeck.length === 3, { gezogen, deck: t.ps.potionDeck });
    // Sperre haengt am Spieler: bleibt, wenn der Held faellt.
    hero.hp = 0;
    check('…auch nach dem Fall des Helden („never")', (await GameEngine.prototype.actionDrawFromPotionDeck.call(t.engine, t.seat, 1)).length === 0);
  }
  {
    const t = await fresh({ heroes: ['Reiza, the Chief Tormentor'] });
    // Nur dieser Sitz hat keinen Klausel-Helden: er zieht normal weiter.
    t.ps.potionDeck = ['Planet in a Bottle'];
    const normal = await GameEngine.prototype.actionDrawFromPotionDeck.call(t.engine, t.seat, 1);
    check('ohne Held mit Klausel: Ziehen aus dem Potion Deck bleibt moeglich', normal.length === 1, normal);
    check('ohne Held mit Klausel: keine Sperre, keine Stempel', !t.ps.potionDrawBanned && !t.ps.heroes[0]._startingHeroOf, [t.ps.potionDrawBanned, t.ps.heroes[0]._startingHeroOf]);
  }
  {
    const t = await fresh({ heroes: [CHAOS], potion: [] });
    check('Chaos-Diamond nutzt dasselbe Geruest: gestempelt + Sperre', t.ps.heroes[0]._startingHeroOf === t.seat && t.ps.potionDrawBanned === true);
    const chaosScript = loadCardEffect(CHAOS);
    const chaosCtx = (t2) => t2.engine._createContext(t2.engine.cardInstances.find(c => c.zone === 'hero' && c.owner === t2.seat && c.heroIdx === 0), { event: 'canHeroEffectCheck' });
    check('…Chaos-Diamond ohne Karten im Potion Deck: Effekt nicht aktivierbar', chaosScript.canActivateHeroEffect(chaosCtx(t)) === false);
    t.ps.potionDeck = ['Fire Bolts', 'Cure'];
    check('…mit Karten im Potion Deck: aktivierbar', chaosScript.canActivateHeroEffect(chaosCtx(t)) === true);
    delete t.ps.heroes[0]._startingHeroOf;
    check('…ohne Starthelden-Stempel (spaeter ins Spiel gekommen): nicht aktivierbar', chaosScript.canActivateHeroEffect(chaosCtx(t)) === false);
  }

  console.log('Pinta: aufdecken und beschwoeren');
  {
    const t = await fresh();
    check('Effekt ist anbietbar (Starthero, Potion Deck gefuellt)', angebot(t));
    const aktionen = [];
    const orig = t.engine.runHooks.bind(t.engine);
    t.engine.runHooks = async (name, ctx, ...r) => { if (name === 'onAnyActionResolved') aktionen.push({ ...ctx }); return orig(name, ctx, ...r); };
    const res = await activate(t);
    const steht = onPinta(t);
    check('die OBERSTE Karte (Barkeeper) steht auf einer Zone Pintas', steht.length === 1 && steht[0] === 'Barkeeper', { res, steht });
    check('sie hat das Potion Deck verlassen, die Reihenfolge der uebrigen bleibt', JSON.stringify(t.ps.potionDeck) === JSON.stringify(['Baby Spider', 'Archer']), t.ps.potionDeck);
    check('die Beschwoerung meldet sich als Zusatzaktion (isAdditional, actionType creature)', aktionen.some(a => a.actionType === 'creature' && a.isAdditional === true && a.cardName === 'Barkeeper' && a.playerIdx === t.seat), aktionen.map(a => [a.actionType, a.cardName, a.isAdditional]));
    const inst = t.engine.cardInstances.find(c => c.name === 'Barkeeper' && c.zone === 'support' && c.owner === t.seat);
    check('Signal „aus dem Potion Deck" statt „aus dem Deck" (Cosmic Manipulation bleibt aus)', inst && !(inst.counters && inst.counters._summonedFromDeck), inst && inst.counters);
    check('einmal pro Zug: der Effekt wird nicht mehr angeboten', !angebot(t));
    t.gs.turn++; t.gs.hoptUsed = {};
    check('…im naechsten Zug wieder', angebot(t));
  }

  console.log('Pinta: „if possible" — die Karte bleibt oben liegen');
  {
    // Level 1, Pinta hat KEINE Summoning Magic.
    const t = await fresh({ potion: ['Arcane Eyes', 'Barkeeper'] });
    const res = await activate(t);
    check('Arcane Eyes (Level 1) kann Pinta nicht beschwoeren', onPinta(t).length === 0, onPinta(t));
    check('…sie bleibt OBEN im Potion Deck', JSON.stringify(t.ps.potionDeck) === JSON.stringify(['Arcane Eyes', 'Barkeeper']), t.ps.potionDeck);
    check('…der Effekt ist trotzdem verbraucht (aufgedeckt ist aufgedeckt)', !angebot(t) && res !== false, { res });
    // Mit Summoning Magic klappt dieselbe Karte.
    t.gs.turn++; t.gs.hoptUsed = {};
    t.ps.abilityZones[0] = SUMMONING;
    await activate(t);
    check('mit Summoning Magic (Level 1) steht Arcane Eyes danach auf dem Brett', onPinta(t).includes('Arcane Eyes'), onPinta(t));
  }
  {
    const t = await fresh();
    t.ps.supportZones[0] = [['Barkeeper'], ['Archer'], ['Baby Spider']];
    for (let z = 0; z < 3; z++) t.engine._trackCard(t.ps.supportZones[0][z][0], t.seat, 'support', 0, z);
    const vorher = t.ps.potionDeck.slice();
    await activate(t);
    check('alle drei Zonen Pintas belegt: nichts wird beschworen, Karte bleibt oben', JSON.stringify(t.ps.potionDeck) === JSON.stringify(vorher), t.ps.potionDeck);
  }
  {
    const t = await fresh();
    t.ps.heroes[0].statuses = { frozen: { duration: 2 } };
    const vorher = t.ps.potionDeck.slice();
    await activate(t);
    check('Pinta ist Frozen („if possible"): keine Beschwoerung', onPinta(t).length === 0 && JSON.stringify(t.ps.potionDeck) === JSON.stringify(vorher), { auf: onPinta(t), deck: t.ps.potionDeck });
  }
  {
    const t = await fresh();
    t.ps.heroes[0]._actionLockedTurn = t.gs.turn;     // Aktionssperre des Helden: die Zusatzaktion ist gesperrt
    const vorher = t.ps.potionDeck.slice();
    await activate(t);
    check('Aktionssperre des Helden: Zusatzaktion gesperrt, Karte bleibt oben', onPinta(t).length === 0 && JSON.stringify(t.ps.potionDeck) === JSON.stringify(vorher), { auf: onPinta(t), deck: t.ps.potionDeck });
  }
  {
    const t = await fresh({ potion: ['Blue-Ice Dragon', 'Barkeeper'], abilities: [['Navigation'], ['Singing'], ['Summoning Magic', 'Summoning Magic', 'Summoning Magic']] });
    const bid = t.engine._getCardDB()['Blue-Ice Dragon'];
    check('(Gegenprobe: Pintas Level reicht fuer Blue-Ice Dragon, nur ihre eigene Bedingung fehlt)', t.engine.heroMeetsLevelReq(t.seat, 0, bid) && !t.engine.isCreatureSummonable('Blue-Ice Dragon', t.seat, 0, { beschwoerer: t.seat }));
    await activate(t);
    check('eigene Bedingung der Karte (Blue-Ice Dragon braucht Opfer): nicht beschworen, bleibt oben', onPinta(t).length === 0 && t.ps.potionDeck[0] === 'Blue-Ice Dragon', { auf: onPinta(t), deck: t.ps.potionDeck });
  }
  for (const [name, warum] of [['Ifrit', 'nur aus der Hand beschwoerbar'], ['Powder Keg', 'Artifact Creature (nie aus einem Stapel auf die eigene Seite)']]) {
    const t = await fresh({ potion: [name, 'Barkeeper'], abilities: [['Navigation'], ['Singing'], ['Summoning Magic', 'Summoning Magic', 'Summoning Magic']] });
    const zonenFuer = (n) => loadCardEffect(PINTA)._test.moeglicheZonen(t.engine, t.seat, t.seat, 0, n).length;
    check(`${name}: schon VOR dem Beschwoeren als unmoeglich erkannt (keine Flug-Animation fuer nichts), Barkeeper dagegen moeglich`, zonenFuer(name) === 0 && zonenFuer('Barkeeper') > 0, [zonenFuer(name), zonenFuer('Barkeeper')]);
    await activate(t);
    check(`${name} (${warum}): nicht beschworen, bleibt oben`, onPinta(t).length === 0 && t.ps.potionDeck[0] === name, { auf: onPinta(t), deck: t.ps.potionDeck });
  }
  {
    // Scheitert die Beschwoerung NACH dem Aufdecken (negiert, Sperre), liegt die Karte wieder OBEN.
    const t = await fresh();
    t.engine.summonCreatureWithHooks = async () => ({ inst: null });
    await activate(t);
    check('Beschwoerung scheitert nach dem Aufdecken: Karte wieder an IHREM Platz (oben)', JSON.stringify(t.ps.potionDeck) === JSON.stringify(['Barkeeper', 'Baby Spider', 'Archer']), t.ps.potionDeck);
  }

  console.log('Pinta: nur als Starthelden');
  {
    const t = await fresh();
    delete t.ps.heroes[0]._startingHeroOf;     // wie ein spaeter ins Spiel gekommener Pinta
    check('ohne Starthelden-Stempel: Effekt nicht anbietbar', !angebot(t));
    check('…cpuShouldUseHeroEffect sagt ebenfalls nein', loadCardEffect(PINTA).cpuShouldUseHeroEffect(t.engine, t.seat, 0) === false);
  }
  {
    const t = await fresh();
    t.ps.heroes[0]._startingHeroOf = undefined;
    check('eigener Pinta, der spaeter ins Spiel kam (kein Stempel), obwohl das Potion Deck passt: nicht anbietbar', !angebot(t));
  }

  console.log('Uebernommene Pinta (Charme): nur mit zugeschnittenem Potion Deck');
  /** Spieler am Zug uebernimmt die Pinta des Gegners; die eigene Pinta (Held 0) verliert den Stempel, damit nur die geliehene zaehlt. */
  async function geliehen(eigenesPotionDeck, gegnerPotionDeck = ['Archer', 'Cute Bunny']) {
    const t = await fresh({ potion: eigenesPotionDeck });
    const oi = t.seat === 0 ? 1 : 0;
    for (const hz of t.other.supportZones) for (let i = 0; i < hz.length; i++) hz[i] = [];
    t.other.potionDeck = gegnerPotionDeck.slice();
    delete t.ps.heroes[0]._startingHeroOf;
    t.other.heroes[0].charmedBy = t.seat;
    t.oi = oi;
    t.geliehenAngebot = () => t.engine.getActiveHeroEffects(t.seat).some(e => e.heroName === PINTA && e.charmedOwner === oi);
    return t;
  }
  {
    const t = await geliehen(['Barkeeper', 'Baby Spider']);
    check('Uebernehmer ist selbst mit Pinta gestartet (Potion Deck aus Creatures): die geliehene Pinta ist anbietbar', t.geliehenAngebot());
    const res = await t.host.doActivateHeroEffect(t.room, t.seat, { heroIdx: 0, charmedOwner: t.oi });
    const steht = t.engine.cardInstances.find(c => c.name === 'Barkeeper' && c.zone === 'support');
    check('…sie deckt das Potion Deck des UEBERNEHMERS auf (nicht das des Besitzers)', JSON.stringify(t.ps.potionDeck) === JSON.stringify(['Baby Spider']) && JSON.stringify(t.other.potionDeck) === JSON.stringify(['Archer', 'Cute Bunny']), { eigenes: t.ps.potionDeck, besitzer: t.other.potionDeck, res });
    check('…beschwoert auf Pintas Zone (Brettseite des Besitzers), die Kreatur gehoert dem Uebernehmer', !!steht && steht.owner === t.oi && (steht.controller ?? steht.owner) === t.seat, steht && [steht.owner, steht.controller]);
  }
  {
    const t = await geliehen(['Planet in a Bottle', 'Planet in a Bottle']);
    check('normales Potion Deck aus Potions (nicht zugeschnitten): die geliehene Pinta ist NICHT anbietbar', !t.geliehenAngebot());
  }
  {
    const t = await geliehen(['Fire Bolts', 'Arms Trade']);
    check('Potion Deck aus Spells (auf Chaos-Diamond zugeschnitten, nicht auf Pinta): nicht anbietbar', !t.geliehenAngebot());
  }
  {
    const t = await geliehen(['Barkeeper', 'Barkeeper']);
    check('Potion Deck mit doppeltem Namen (nicht nach der Klausel gebaut): nicht anbietbar', !t.geliehenAngebot());
  }
  {
    const t = await geliehen([]);
    check('leeres Potion Deck: nicht anbietbar', !t.geliehenAngebot());
  }

  console.log('Uebernommener Chaos-Diamond: dieselbe Regel');
  {
    const chaosScript = loadCardEffect(CHAOS);
    const mk = async (potion) => {
      const t = await fresh({ heroes: [CHAOS], potion });
      const oi = t.seat === 0 ? 1 : 0;
      delete t.ps.heroes[0]._startingHeroOf;                   // der eigene Chaos zaehlt nicht: nur der geliehene
      t.other.heroes[0].charmedBy = t.seat;
      const inst = t.engine.cardInstances.find(c => c.zone === 'hero' && c.owner === oi && c.heroIdx === 0);
      const ctx = t.engine._createContext(inst, { event: 'canHeroEffectCheck' });
      return { t, ok: chaosScript.canActivateHeroEffect(ctx), ctx };
    };
    let r = await mk(['Fire Bolts', 'Arms Trade']);
    check('Uebernehmer mit Spell-Potion-Deck (selbst mit Chaos-Diamond gestartet): geliehener Chaos-Diamond aktivierbar', r.ok === true && r.ctx.cardOwner === r.t.seat, [r.ok, r.ctx.cardOwner]);
    r = await mk(['Barkeeper', 'Baby Spider']);
    check('Uebernehmer mit Creature-Potion-Deck (Pinta): geliehener Chaos-Diamond nicht aktivierbar', r.ok === false);
    r = await mk(['Planet in a Bottle']);
    check('Uebernehmer mit normalem Potion Deck: nicht aktivierbar', r.ok === false);
  }
  {
    const t = await fresh({ potion: [] });
    check('leeres Potion Deck: nichts aufzudecken, nicht anbietbar', !angebot(t));
  }
  {
    const t = await fresh();
    t.ps.heroes[0].hp = 0;
    check('gefallener Pinta: nicht anbietbar', !angebot(t));
  }

  console.log('CPU-Gate');
  {
    const script = loadCardEffect(PINTA);
    let t = await fresh();
    check('summonbare oberste Karte → die CPU deckt auf', script.cpuShouldUseHeroEffect(t.engine, t.seat, 0) === true);
    t = await fresh({ potion: ['Arcane Eyes'] });
    check('nicht summonbare oberste Karte (Level 1, keine Summoning Magic) → die CPU spart sich den Effekt', script.cpuShouldUseHeroEffect(t.engine, t.seat, 0) === false);
  }

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Pinta-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
