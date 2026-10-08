'use strict';
// Kein Zug ohne mögliche Aktion: ein Sitz, dessen Heroes alle gehandelt haben und dessen Creatures nichts (mehr) tun können
// (kein legales Ziel, Kartenbedingung nicht erfüllt), bekommt keinen Zug mehr. Ein ungenutzter aktiver Hero-Effekt (Broghan) ist dagegen
// eine Aktion. Leere Rounds beenden die Partie erst nach EMPTY_ROUNDS_LIMIT Rounds in Folge.
//   node scripts/skilltest-e2e/auto-skip.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const rounds = require('../../skilltest/rounds');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const BROGHAN = 'Broghan, the Frozen Guardian of the North';
const quiet = async (fn) => { const oL = console.log, oE = console.error, oW = console.warn; console.log = () => {}; console.error = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.log = oL; console.error = oE; console.warn = oW; } };

// Sitz leerräumen: keine Creatures, alle lebenden Heroes erschöpft
function stripSeat(game, seat) {
  const { gs, engine } = game, st = gs.skillTest, ps = gs.players[seat];
  for (const i of engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat)) engine._untrackCard(i.id);
  ps.supportZones = ps.supportZones.map(() => [[], [], []]);
  ps.heroes.forEach((h, hi) => { if (h && h.name && h.hp > 0) st.exhaustedHeroes[rounds.heroKey(seat, hi)] = true; });
}
// Hero-Effekte der Heroes dieses Sitzes für diese Round als benutzt eintragen
function useUpHeroEffects(game, seat) {
  const { gs, engine } = game;
  gs.players[seat].heroes.forEach(h => { if (h && h.name) gs.hoptUsed[engine.heroHoptKey(h.name, seat)] = gs.turn; });
}
const place = (game, seat, name, hi, slot) => {
  const { gs, engine } = game;
  gs.players[seat].supportZones[hi][slot] = [name];
  return engine._trackCard(name, seat, 'support', hi, slot);
};

(async () => {
  // ── 1. Creature ohne legales Ziel ──
  console.log('Creature ohne nutzbaren Effekt');
  const g1 = await quiet(() => runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 21 }));
  {
    const { gs, engine } = g1, st = gs.skillTest;
    const seat = 0, others = [1, 2];
    gs.hoptUsed = gs.hoptUsed || {};
    stripSeat(g1, seat); useUpHeroEffects(g1, seat);
    const inst = place(g1, seat, 'Burning Skeleton', 0, 0);       // „Burn an enemy Hero or Creature“ — braucht ein nicht brennendes Ziel
    // alle Ziele der anderen Sitze brennen schon
    for (const o of others) for (const h of gs.players[o].heroes) if (h && h.name) { h.statuses = h.statuses || {}; h.statuses.burned = { duration: 9 }; }
    for (const i of engine.cardInstances.filter(c => c.zone === 'support' && others.includes(c.owner))) { i.counters = i.counters || {}; i.counters.burned = 1; }
    gs.activePlayer = seat; gs.currentPhase = 3;
    const entry = (engine.getActivatableCreatures(seat) || []).find(c => c.instId === inst.id);
    check('Vorbedingung: Burning Skeleton steht in der Liste, aber mit canActivate: false', !!entry && entry.canActivate === false, entry);
    check('keine Creature zählt als Akteur', rounds.creatureActors(engine, seat).length === 0);
    check('kein Hero-Effekt, kein ready Hero → keine mögliche Aktion', rounds.heroActors(engine, seat).length === 0 && rounds.heroEffectActors(engine, seat).length === 0);
    gs.currentPhase = 2;
    check('der Sitz hat keinen Akteur', rounds.seatHasActor(engine, seat) === false);
    check('… und die Prüfung lässt die Phase unverändert', gs.currentPhase === 2, gs.currentPhase);
    check('der Sitz ist nicht „gepasst“, er wird nur übersprungen', !st.passed[seat]);
    const logged = [];
    const origLog = engine.log.bind(engine);
    engine.log = (n, d) => { if (n === 'skilltest_no_actions') logged.push(d); return origLog(n, d); };
    const next = rounds.pickNextSeat(engine, others[1]);          // nach Sitz 2 käme Sitz 0 — er wird übergangen
    check('der nächste Zug geht an einen anderen Sitz', next != null && next !== seat, next);
    rounds.pickNextSeat(engine, others[1]);
    check('das Protokoll vermerkt „keine Aktion“ einmal je Sitz und Round', logged.length === 1 && logged[0].seat === seat, logged);
    // Ziel taucht auf (ein Gegner-Hero brennt nicht mehr) → die Creature zählt wieder
    gs.players[1].heroes.find(h => h && h.name).statuses = {};
    gs.activePlayer = seat; gs.currentPhase = 3;
    const entry2 = (engine.getActivatableCreatures(seat) || []).find(c => c.instId === inst.id);
    check('mit legalem Ziel: canActivate ist wahr', !!entry2 && entry2.canActivate === true, entry2);
    check('… die Creature ist wieder ein Akteur', rounds.creatureActors(engine, seat).length === 1);
    gs.currentPhase = 2;
    check('… der Sitz bekommt wieder einen Zug (auch aus der Main Phase heraus geprüft)', rounds.seatHasActor(engine, seat) === true);
    st.exhaustedCreatures[inst.id] = true;
    check('benutzt → wieder kein Akteur', rounds.seatHasActor(engine, seat) === false);
  }

  // ── 2. Hero-Effekt ist eine Aktion ──
  console.log('Aktiver Hero-Effekt (Broghan)');
  const g2 = await quiet(() => runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 21,
    mutatePrep: (prep) => { prep.players[0].heroes[0] = BROGHAN; } }));
  {
    const { gs, engine } = g2, st = gs.skillTest;
    const seat = 0;
    gs.hoptUsed = gs.hoptUsed || {};
    stripSeat(g2, seat);
    gs.activePlayer = seat; gs.currentPhase = 3;
    check('Broghan steht auf dem Brett und ist erschöpft', gs.players[0].heroes[0].name === BROGHAN && rounds.heroActors(engine, seat).length === 0);
    check('sein Effekt ist verfügbar (kostet den Zug, nicht den Hero)', rounds.heroEffectActors(engine, seat).some(e => e.heroName === BROGHAN), engine.getActiveHeroEffects(seat));
    check('der Sitz hat damit noch eine Aktion', rounds.seatHasActor(engine, seat) === true);
    useUpHeroEffects(g2, seat);
    check('Effekt benutzt → keine Aktion mehr', rounds.seatHasActor(engine, seat) === false);
    // Betäubt: der Effekt ist gesperrt
    delete gs.hoptUsed[engine.heroHoptKey(BROGHAN, seat)];
    gs.players[0].heroes[0].statuses = { stunned: true };
    check('betäubter Hero: kein Effekt, keine Aktion', rounds.seatHasActor(engine, seat) === false);
  }

  // ── 3. Bot nutzt Broghans Effekt ──
  console.log('Der Bot nutzt Broghans Effekt');
  const g3 = await quiet(() => runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 21,
    mutatePrep: (prep) => { prep.players[0].heroes[0] = BROGHAN; } }));
  {
    const { room, host, gs, engine } = g3;
    const policy = require('../../skilltest/policy');
    const seat = 0;
    gs.activePlayer = seat; gs.currentPhase = 3;
    await rounds.beginTurn(engine, seat);
    const ranked = policy.rankActions(room, seat, host);
    const iEff = ranked.findIndex(a => a.kind === 'heroEffect' && a.key.includes('Broghan'));
    const iAtk = ranked.findIndex(a => a.kind === 'attack');
    check('Broghans Effekt steht in der Liste', iEff >= 0, ranked.map(a => a.key));
    // Rauschen mittelt sich heraus: über viele Ziehungen liegt der Effekt im Mittel nicht hinter dem Basisangriff
    let better = 0, N = 200;
    for (let k = 0; k < N; k++) {
      const r = policy.rankActions(room, seat, host);
      const e = r.find(a => a.kind === 'heroEffect' && a.key.includes('Broghan')), a = r.find(a => a.kind === 'attack');
      if (e && a && e.score >= a.score) better++;
    }
    check('der Effekt liegt in mindestens zwei Dritteln der Ziehungen vor dem Basisangriff', better >= N * 2 / 3, { better, N, iEff, iAtk });
  }

  // ── 4. Leere Rounds ──
  console.log('Rounds ohne jeden Akteur');
  const makeFrozenTable = async () => {
    const g = await quiet(() => runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 21 }));
    const { gs } = g;
    gs.hoptUsed = gs.hoptUsed || {};
    for (let s = 0; s < 3; s++) {
      for (const i of g.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === s)) g.engine._untrackCard(i.id);
      gs.players[s].supportZones = gs.players[s].supportZones.map(() => [[], [], []]);
      for (const h of gs.players[s].heroes) if (h && h.name && h.hp > 0) h.statuses = { stunned: true };
    }
    return g;
  };
  {
    // a) die Betäubung hält ewig: nach drei leeren Rounds in Folge endet die Partie als Patt
    const g = await makeFrozenTable();
    const { host, gs, engine } = g, st = gs.skillTest;
    engine.processStatusExpiry = async () => {};
    const r0 = st.round;
    const ran = await quiet(() => rounds.advance(engine, host, null));
    check('Partie endet als Patt („no_actors“)', ran === false && gs.result && gs.result.reason === 'no_actors', gs.result && gs.result.reason);
    check('… nach genau drei leeren Rounds, nicht sofort', st.round === r0 + 3, { r0, round: st.round });
  }
  {
    // b) die Betäubung endet mit der Round: das Spiel läuft weiter
    const g = await makeFrozenTable();
    const { host, gs, engine } = g, st = gs.skillTest;
    const r0 = st.round;
    engine.processStatusExpiry = async () => {
      if (st.round >= r0 + 2) for (const p of gs.players) for (const h of p.heroes) if (h && h.name) h.statuses = {};   // Ablauf zu Beginn der dritten Round — Round 2 bleibt leer
    };
    const ran = await quiet(() => rounds.advance(engine, host, null));
    check('Partie läuft weiter, sobald die Heroes wieder handeln können', ran === true && !gs.result, gs.result && gs.result.reason);
    check('… in der Round nach dem Ablauf, mit zurückgesetztem Zähler', st.round === r0 + 2 && !st.emptyRounds, { r0, round: st.round, empty: st.emptyRounds });
  }

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Auto-Überspringen-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
