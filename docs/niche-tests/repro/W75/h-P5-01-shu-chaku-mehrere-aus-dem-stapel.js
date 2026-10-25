'use strict';
// W75 · Audit P5 · Darion × Shu'Chaku, the Blood Moon Projection — „return any number of Artifacts from your side of the board to your hand" muss auch MEHRERE Karten aus demselben Equip-Stapel nehmen.
// Kartentext: „Once per turn: return any number of Artifacts from your side of the board to your hand. The next Artifact you play this turn has its Cost reduced by the combined Costs of the returned Artifacts."
// Befund (vorher): ein Stapel war EIN Ziel je Karte mit derselben ID; gelesen wurde nur `cardInstance` des ersten Treffers → je Stapel hoechstens EINE Karte kam zurueck, die zweite gewaehlte Karte blieb liegen und der Rabatt war zu klein.
// Erwartet: Stapel Club / Blade / Crown (Seite 0, Darion). Wahl Mitte (Blade) + oberste (Crown): beide auf der Hand, Club bleibt; Rabatt = Kosten(Blade) + Kosten(Crown); nur Blade gewaehlt: nur Blade; ohne Darion (zwei getrennte Equips) bleiben beide waehlbar.
// Aufruf: node docs/niche-tests/repro/W75/h-P5-01-shu-chaku-mehrere-aus-dem-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, SC = "Shu'Chaku, the Blood Moon Projection";
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, hi, slot) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return NAMEN.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();
  const kosten = (n) => H.DB[n].cost || 0;

  for (const [titel, wahlIdx] of [['Mitte + oberste', [1, 2]], ['nur die Mitte', [1]], ['alle drei', [0, 1, 2]]]) {
    R.section(`Shu'Chaku, Darion-Stapel eigene Seite: ${titel}`);
    const t = await H.fresh({ active: 0, heroes: [[SC, D, null], [F, null, null]], hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, 0, 1, 1);
    const wahl = wahlIdx.map(i => insts[i]);
    let n = 0;
    const gefragt = [];
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { gefragt.push(d.instances.length); const a = wahl[n++]; return a ? { instId: a.id } : { done: true }; } });
    let ziele = null;
    t.targetFn = (valid) => { ziele = valid.map(v => v.id); return [valid[0].id]; };
    const r = await t.activateHero(0, 0);
    await t.drain();
    const zone = t.gs.players[0].supportZones[1][1];
    const hand = t.pile(0, 'hand');
    const rest = NAMEN.filter((_, i) => !wahlIdx.includes(i));
    R.note('lauf', JSON.stringify({ r, ziele, gefragt, zone, hand, rabatt: t.gs.players[0]._nextArtifactCostReduction }));
    R.check('der Stapel ist EIN Ziel (nicht drei mit derselben ID)', ziele && ziele.length === 1, ziele);
    R.check('genau die gewaehlten Karten liegen auf der Hand', wahlIdx.every(i => hand.includes(NAMEN[i])) && NAMEN.filter((_, i) => !wahlIdx.includes(i)).every(x => !hand.includes(x)), hand);
    R.check('die uebrigen bleiben im Stapel (Reihenfolge erhalten)', JSON.stringify(zone) === JSON.stringify(rest), zone);
    R.check('Rabatt = Summe der Kosten der zurueckgegebenen Artefakte', t.gs.players[0]._nextArtifactCostReduction === wahlIdx.reduce((s, i) => s + kosten(NAMEN[i]), 0), t.gs.players[0]._nextArtifactCostReduction);
    R.check('Instanzen passen zu den Namen im Platz', t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 1).length === rest.length);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section("Shu'Chaku ohne Darion: zwei getrennte Equips bleiben einzeln waehlbar (Gegenprobe)");
  {
    const t = await H.fresh({ active: 0, heroes: [[SC, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    t.put(0, 1, 0, NAMEN[0]); t.put(0, 1, 1, NAMEN[1]);
    let ziele = null;
    t.targetFn = (valid) => { ziele = valid.map(v => v.id); return valid.map(v => v.id); };
    await t.activateHero(0, 0);
    await t.drain();
    const hand = t.pile(0, 'hand');
    R.check('zwei Ziele, beide Karten kommen zurueck', ziele.length === 2 && hand.includes(NAMEN[0]) && hand.includes(NAMEN[1]), [ziele, hand]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
