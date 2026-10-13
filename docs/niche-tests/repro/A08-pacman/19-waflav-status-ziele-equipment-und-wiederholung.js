// A08-19 · Flamebathed/Swampborne/Thunderstruck Waflav: (a) „any target on the board" bietet auch Ausrüstung/Tokens an, deren Status wirkungslos ist, aber Evolution Counter gibt;
//                                                         (b) erneutes Verbrennen/Vergiften zählt bei Helden, bei Kreaturen nicht
//
// Kartentexte: Flamebathed „Whenever a target is Burned, place 1 Evolution Counter onto this Hero."; Swampborne „Whenever a target is Poisoned, place 1 Evolution Counter onto this Hero.";
//   beide „On Ascension: Choose any target on the board and Burn/Poison it." Rulings im Skriptkopf: „EVERY target on the board counts, both sides, mine included."
// (a) Aufbau: Waflav (3 Counter) steigt zu Swampborne auf (kostet 2) und wählt „Club of Gobbo" (Ausrüstung auf einer Support Zone des Gegners) bzw. „Pollution Token".
//     Beobachtet: Der Status „poisoned" hängt an der Ausrüstung/am Token, tickt nie (kein Schaden, kein Ablauf auch nach 3 Zugwechseln), Waflav bekommt trotzdem 1 Evolution Counter.
//     `collectBoardTargets` (_waflav-shared.js ~Z. 425-445) nimmt jede offene Karte der Support Zones auf – auch Nicht-Kreaturen. (Trial of Coolness: „'Target' in card-text terms covers Heroes
//     and Creatures — never Equipment".)
// (b) Aufbau: Waflav-Form direkt aufgestellt, Gegner-Held 0 und Gegner-Kreatur „ZZ Dummy"; derselbe Status zweimal nacheinander.
//     Beobachtet: Held: beide Male +1 Counter (Gift stapelt auf 2). Kreatur: nur beim ersten Mal +1, beim zweiten +0 (Gift bleibt bei 1 Stapel). Brennen analog.
// Aufruf: node docs/niche-tests/repro/A08-pacman/19-waflav-status-ziele-equipment-und-wiederholung.js   (✗ = Lesart „Equipment ist kein Ziel" bzw. „Wiederholung zählt gleich" verletzt)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, F = H.INERT.filler;
  const WAF = 'Waflav, the Metamorphing Monstrosity';
  const szene = (o = {}) => H.fresh(Object.assign({
    heroes: [[WAF, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null],
    gold: [100, 100], hand: [[], []], deck: [Array(30).fill(F), Array(30).fill(F)] }, o));
  const alsForm = (t, form) => { t.hero(0, 0).name = form; for (const i of t.engine.cardInstances) if (i.zone === 'hero' && i.owner === 0 && i.heroIdx === 0) { i.name = form; i.script = null; } };

  R.section('(a) Ausrüstung/Token als Ziel der Aufstiegs-Vergiftung');
  for (const name of ['Club of Gobbo', 'Pollution Token']) {
    const t = await szene();
    t.hero(0, 0)._evolutionCounters = 3;
    const c = t.put(1, 0, 0, name); c.turnPlayed = 1;
    t.targetFn = (v) => [v.find(x => x.cardName === name).id];
    t.gs.activePlayer = 0; t.phase(2);
    t.engine.handZugangSync(0, 'Swampborne Waflav');
    await t.run(() => t.engine.performAscension(0, 0, 'Swampborne Waflav', t.pile(0, 'hand').indexOf('Swampborne Waflav'), {}));
    R.note(name, JSON.stringify({ evo: t.hero(0, 0)._evolutionCounters, poisoned: !!c.counters.poisoned }));
    R.check(`${name} (keine Kreatur) steht nicht als Ziel zur Wahl / gibt keinen Counter`, !c.counters.poisoned && t.hero(0, 0)._evolutionCounters === 1, { evo: t.hero(0, 0)._evolutionCounters, poisoned: c.counters.poisoned });
  }

  R.section('(b) Wiederholung desselben Status');
  for (const [form, st] of [['Flamebathed Waflav', 'burned'], ['Swampborne Waflav', 'poisoned']]) {
    const t = await szene({ hp: 800 });
    alsForm(t, form);
    const evo = () => t.hero(0, 0)._evolutionCounters || 0;
    const c = t.put(1, 0, 0, D); c.turnPlayed = 1;
    const dH = [], dC = [];
    for (let i = 0; i < 2; i++) { const e0 = evo(); await t.run(() => t.engine.addHeroStatus(1, 0, st, { appliedBy: 0, duration: 1 })); dH.push(evo() - e0); }
    for (let i = 0; i < 2; i++) { const e0 = evo(); await t.run(() => t.engine.applyCreatureStatus(c, st, { sourceOwner: 0 })); dC.push(evo() - e0); }
    R.note(`${form}: Held ${dH}, Kreatur ${dC}`);
    R.check(`${form}: zweite Anwendung zählt bei Held und Kreatur gleich`, (dH[1] > 0) === (dC[1] > 0), { dH, dC });
  }
  R.finish();
})();
