'use strict';
// W10b · Q55 (A08-19) · Waflav-Formen: „any target on the board" = nur Helden und Creatures; Zählregeln für Burn (nur initial) und Poison (jeder neue Stapel)
//
// Kartentexte: Flamebathed „On Ascension: Choose any target on the board and Burn it. Whenever a target is Burned, place 1 Evolution Counter onto this Hero.";
//   Swampborne „… apply 1 Stack of Poison to it. Whenever a target is Poisoned, place 1 Evolution Counter onto this Hero."; Thunderstruck „… Stun it for 1 turn…".
// ENTSCHIEDEN (Al, Welle 10, Q55): (1) „Nur Heroes und Creatures, inklusive Artifact Creatures" – keine Ausrüstung/Tokens (ohne Creature-Typ) als Ziel.
//   (2) „Bei Gift zählt in beiden Fällen das Hinzufügen eines neuen Stacks, bei Burn nur das initiale Hinzufügen des Burned-Status" – für Helden UND Kreaturen.
// Geprüft: (a) die Zielwahl der Aufstiegs-Vergiftung bietet Club of Gobbo (Ausrüstung) und Pollution Token nicht an, wohl aber Held und Kreatur;
//   (b) Swampborne: jeder neue Gift-Stapel zählt (Held: 2× +1; Kreatur mit addStacks: 2× +1; Aufstieg auf schon vergiftetes Ziel fügt einen Stapel hinzu und zählt);
//   (c) Flamebathed: Burn zählt nur beim ersten Mal (Held 1,0; Kreatur 1,0).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, F = H.INERT.filler;
  const WAF = 'Waflav, the Metamorphing Monstrosity';
  const szene = (o = {}) => H.fresh(Object.assign({
    heroes: [[WAF, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null],
    gold: [100, 100], hand: [[], []], deck: [Array(30).fill(F), Array(30).fill(F)] }, o));
  const alsForm = (t, form) => { t.hero(0, 0).name = form; for (const i of t.engine.cardInstances) if (i.zone === 'hero' && i.owner === 0 && i.heroIdx === 0) { i.name = form; i.script = null; } };

  R.section('(a) Zielliste der Aufstiegs-Vergiftung');
  {
    const t = await szene();
    t.hero(0, 0)._evolutionCounters = 3;
    const club = t.put(1, 0, 0, 'Club of Gobbo'); club.turnPlayed = 1;
    const tok = t.put(1, 0, 1, 'Pollution Token'); tok.turnPlayed = 1;
    const kre = t.put(1, 0, 2, D); kre.turnPlayed = 1;
    let angeboten = null;
    t.targetFn = (v) => { angeboten = v.map(x => x.cardName); return [v.find(x => x.cardName === D).id]; };
    t.gs.activePlayer = 0; t.phase(2);
    t.engine.handZugangSync(0, 'Swampborne Waflav');
    await t.run(() => t.engine.performAscension(0, 0, 'Swampborne Waflav', t.pile(0, 'hand').indexOf('Swampborne Waflav'), {}));
    R.note('angeboten', angeboten);
    R.check('(a) Club of Gobbo (Ausrüstung) steht nicht zur Wahl', !!angeboten && !angeboten.includes('Club of Gobbo'), angeboten);
    R.check('(a) Pollution Token (kein Creature) steht nicht zur Wahl', !!angeboten && !angeboten.includes('Pollution Token'), angeboten);
    R.check('(a) die Kreatur und ein Held stehen zur Wahl', !!angeboten && angeboten.includes(D) && angeboten.length >= 2, angeboten);
    R.check('(a) die Kreatur wurde vergiftet, Waflav bekam den Counter (3 − 2 + 1)', !!kre.counters.poisoned && t.hero(0, 0)._evolutionCounters === 2, { evo: t.hero(0, 0)._evolutionCounters, p: kre.counters.poisoned });
    R.check('(a) Ausrüstung/Token unbehelligt', !club.counters.poisoned && !tok.counters.poisoned);
    R.check('(a) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('(b) Gift: jeder neue Stapel zählt (Held und Kreatur)');
  {
    const t = await szene({ hp: 800 });
    alsForm(t, 'Swampborne Waflav');
    const evo = () => t.hero(0, 0)._evolutionCounters || 0;
    const c = t.put(1, 0, 0, D); c.turnPlayed = 1;
    const dH = [], dC = [];
    for (let i = 0; i < 2; i++) { const e0 = evo(); await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { appliedBy: 0, duration: 1 })); dH.push(evo() - e0); }
    for (let i = 0; i < 2; i++) { const e0 = evo(); await t.run(() => t.engine.applyCreatureStatus(c, 'poisoned', { sourceOwner: 0, addStacks: true, stacks: 1 })); dC.push(evo() - e0); }
    R.note('Gift: Held, Kreatur', { dH, dC });
    R.check('(b) Held: beide Stapel zählen', dH[0] === 1 && dH[1] === 1, dH);
    R.check('(b) Kreatur: beide Stapel zählen', dC[0] === 1 && dC[1] === 1 && c.counters.poisonStacks === 2, { dC, stacks: c.counters.poisonStacks });
  }
  {
    // Aufstieg auf ein SCHON vergiftetes Ziel: „apply 1 Stack of Poison" fügt einen Stapel hinzu und zählt
    for (const art of ['kreatur', 'held']) {
      const t = await szene({ hp: 800 });
      t.hero(0, 0)._evolutionCounters = 3;
      let ziel; const c = t.put(1, 0, 0, D); c.turnPlayed = 1;
      if (art === 'kreatur') { await t.run(() => t.engine.applyCreatureStatus(c, 'poisoned', { sourceOwner: 0, addStacks: true, stacks: 1 })); }
      else { await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { appliedBy: 0, stacks: 2 })); }
      t.targetFn = (v) => [art === 'kreatur' ? v.find(x => x.cardName === D).id : v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
      t.gs.activePlayer = 0; t.phase(2);
      t.engine.handZugangSync(0, 'Swampborne Waflav');
      await t.run(() => t.engine.performAscension(0, 0, 'Swampborne Waflav', t.pile(0, 'hand').indexOf('Swampborne Waflav'), {}));
      const stapel = art === 'kreatur' ? c.counters.poisonStacks : t.hero(1, 0) && t.gs.players[1].heroes[0].statuses.poisoned?.stacks;
      const erwartet = art === 'kreatur' ? 2 : 3;
      R.check(`(b) Aufstieg auf schon vergiftete${art === 'kreatur' ? ' Kreatur' : 'n Helden'}: Stapel ${erwartet - 1} → ${erwartet}`, stapel === erwartet, stapel);
      R.check(`(b) Aufstieg (${art}): Waflav bekam den Counter für den neuen Stapel (3 − 2 + 1)`, t.hero(0, 0)._evolutionCounters === 2, t.hero(0, 0)._evolutionCounters);
      R.check(`(b) Aufstieg (${art}): keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }

  R.section('(c) Burn: nur das initiale Hinzufügen zählt');
  {
    const t = await szene({ hp: 800 });
    alsForm(t, 'Flamebathed Waflav');
    const evo = () => t.hero(0, 0)._evolutionCounters || 0;
    const c = t.put(1, 0, 0, D); c.turnPlayed = 1;
    const dH = [], dC = [];
    for (let i = 0; i < 2; i++) { const e0 = evo(); await t.run(() => t.engine.addHeroStatus(1, 0, 'burned', { appliedBy: 0, duration: 1 })); dH.push(evo() - e0); }
    for (let i = 0; i < 2; i++) { const e0 = evo(); await t.run(() => t.engine.applyCreatureStatus(c, 'burned', { sourceOwner: 0 })); dC.push(evo() - e0); }
    const e1 = evo(); await t.run(() => t.engine.applyCreatureStatus(c, 'burned', { sourceOwner: 0, addStacks: true })); const dC3 = evo() - e1;
    R.note('Burn: Held, Kreatur', { dH, dC, dC3 });
    R.check('(c) Held: erstes Burn +1, zweites +0', dH[0] === 1 && dH[1] === 0, dH);
    R.check('(c) Kreatur: erstes Burn +1, zweites +0 (auch mit addStacks)', dC[0] === 1 && dC[1] === 0 && dC3 === 0, { dC, dC3 });
    R.check('(c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
