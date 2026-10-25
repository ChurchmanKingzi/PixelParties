'use strict';
// W75 · Darion — Analyzer / Gatherer from the Cosmic Depths bewegen Change Counter auf bzw. von EINEM bestimmten Equip eines Stapels (Audit P4b, Klasse A).
// Kartentext Analyzer: „Move any number of Change Counters from this Creature to ANOTHER card on the board" (Ziel: jede Karte des Bretts, auch ein Equip).
// Kartentext Gatherer: „Move any number of Change Counters from a card you control onto a "Cosmic Depths" Creature you control" (Quelle: jede eigene Karte mit Countern).
// Fehler vorher: alle Equips des Stapels teilen die Ziel-ID, das Skript fand das Ziel per ID in seiner eigenen Liste wieder → immer die ERSTE Karte des Stapels bekam/verlor die Counter.
// Erwartet: nur die gewaehlte (mittlere bzw. letzte) Karte. Aufruf: node docs/niche-tests/repro/W75/h-P4b-01-analyzer-gatherer-change-counter-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const cc = (i) => i.counters.changeCounter || 0;
(async () => {
  const R = H.runner();
  for (const stSeat of [0, 1]) {
    R.section('Analyzer — Stapel bei Sitz ' + stSeat + ' (Darion), Counter auf die MITTLERE Karte');
    const heroes = [[F, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], [F, null, null]];
    heroes[stSeat][0] = D;
    const t = await H.fresh({ active: 0, heroes, hand: [[F], [F]], gold: 100 });
    const an = t.put(0, 1, 0, 'Analyzer from the Cosmic Depths'); an.turnPlayed = 1; an.counters.changeCounter = 3;
    const insts = stapel(t, stSeat, NAMEN);
    t.phase(2);
    let pick = null;
    t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options.some(o => o.id === 'move') ? 'move' : '2' }) });
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { pick = d.instances.map(i => i.name); return { instId: insts[1].id }; } });
    t.targetFn = (valid) => { const v = valid.find(x => x.id === `equip-${stSeat}-0-1`); return v ? [v.id] : undefined; };
    const r = await t.activateCreature(0, 1, 0);
    R.note('ergebnis', JSON.stringify({ r, counters: insts.map(cc), analyzer: cc(an), pick }));
    R.check('Rueckfrage nannte alle drei Equips', JSON.stringify(pick) === JSON.stringify(NAMEN), pick);
    R.check('nur die mittlere Karte bekommt 2 Counter', JSON.stringify(insts.map(cc)) === '[0,2,0]', insts.map(cc));
    R.check('Analyzer behaelt 1', cc(an) === 1, cc(an));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Gatherer — Counter VON der letzten Karte des Stapels (zwei Karten tragen Counter)');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], [F, null, null]], hand: [[F], [F]], gold: 100 });
    const g = t.put(0, 1, 0, 'Gatherer from the Cosmic Depths'); g.turnPlayed = 1;
    const ziel = t.put(0, 1, 2, 'Analyzer from the Cosmic Depths'); ziel.turnPlayed = 1;
    const insts = stapel(t, 0, NAMEN);
    insts[1].counters.changeCounter = 2; insts[2].counters.changeCounter = 3;
    t.phase(2);
    let pick = null;
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { pick = d.instances.map(i => i.name); return { instId: insts[2].id }; } });
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: '1' }) });
    t.targetFn = (valid) => {
      const st = valid.find(x => x.id === 'equip-0-0-1');
      if (st) return [st.id];                                  // Quelle: der Stapel
      const dst = valid.find(x => x.id === 'equip-0-1-2');      // Ziel: der Analyzer
      return dst ? [dst.id] : undefined;
    };
    const r = await t.activateCreature(0, 1, 0);
    R.note('ergebnis', JSON.stringify({ r, counters: insts.map(cc), analyzer: cc(ziel), pick }));
    R.check('Rueckfrage bot nur die Karten MIT Counter an', JSON.stringify(pick) === JSON.stringify([NAMEN[1], NAMEN[2]]), pick);
    R.check('1 Counter von der letzten Karte genommen, die mittlere unberuehrt', JSON.stringify(insts.map(cc)) === '[0,2,2]', insts.map(cc));
    R.check('Analyzer bekam 1', cc(ziel) === 1, cc(ziel));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
