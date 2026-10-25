'use strict';
// W75 · Darion — Criminal Monkee rüstet ein „Non-Fungible Monkee" aus dem Deck in den Equip-Stapel des corresponding Hero (Audit P4b, Klasse C).
// Kartentext: „You may once per turn remove 4 Invest Counters from a Hero you control to choose a "Non-Fungible Monkee" from your deck and equip it to the corresponding Hero without paying its Cost."
// Fehler vorher: der Effekt suchte eine FREIE Zone (`freeSlotOn`) — Darion mit Stapel und ohne freie Zone: nicht aktivierbar; mit freier Zone: das NFM kam per Zufall doch in den Stapel (Platzierung der Engine), aber die Voraussetzung war falsch.
// Erwartet: das NFM liegt oben im Stapel; die Aktivierung braucht keine freie Zone. Aufruf: node docs/niche-tests/repro/W75/h-P4b-04-criminal-monkee-nfm-in-den-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, NFM = 'Non-Fungible Monkee', CM = 'Criminal Monkee';
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();
  for (const mitFreierZone of [false, true]) {
    R.section(`Criminal Monkee bei Darion, 3-Karten-Stapel, ${mitFreierZone ? 'eine Zone frei' : 'KEINE Zone frei'}`);
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[F], [F]], deck: [[NFM, F, F], []], gold: 100 });
    const m = t.put(0, 0, 0, CM); m.turnPlayed = 1;
    if (!mitFreierZone) { const c = t.put(0, 0, 2, H.INERT.creature); c.turnPlayed = 1; }
    stapel(t, 0, NAMEN, 1, 0);
    t.hero(0, 0)._investCounters = 4;
    const ps = t.gs.players[0];
    t.phase(2);
    const r = await t.activateCreature(0, 0, 0);
    R.note('ergebnis', JSON.stringify({ r, zonen: ps.supportZones[0], invest: t.hero(0, 0)._investCounters, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('Aktivierung gelang', r === true, r);
    R.check('NFM liegt oben im Stapel (Platz 1)', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify([...NAMEN, NFM]), ps.supportZones[0]);
    R.check('keine zweite Equip-Zone entstanden', ps.supportZones[0][2].every(n => n !== NFM) && ps.supportZones[0][0].length === 1, ps.supportZones[0]);
    R.check('4 Invest Counter bezahlt', !t.hero(0, 0)._investCounters, t.hero(0, 0)._investCounters);
    R.check('NFM aus dem Deck weg', !ps.mainDeck.includes(NFM), ps.mainDeck);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
