'use strict';
// W75 · Darion · P6 (Engine `getCrossSidePlayableArtifacts`, `getActivatableEquipsCrossSide`) — Gegnerseiten-Ausruestung (Future Tech Control Device: „Equip this card to a Hero your opponent controls")
// gegen einen Darion: (a) sein Equip-Stapel nimmt sie auch bei VOLLEM Brett auf (es braucht keine freie Zone), (b) liegen zwei Control Devices im Stapel, ist JEDE einzeln aktivierbar
// (Eintrag mit eigener `instId`); ist die erste verbraucht, bleibt die zweite angeboten.
// Kartentext Control Device: „Equip this card to a Hero your opponent controls. Your opponent may once per turn, during their turn, take control of this Hero for the rest of the turn. …"
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: (a) 'Future Tech Control Device' steht in `crossSidePlayableArtifacts`, obwohl alle drei Zonen von Darion belegt sind (Stapel + 2 Kreaturen); (b) zwei Eintraege mit verschiedenen
// instId; nach dem Verbrauch der ersten bleibt genau die zweite.
// Aufruf: node docs/niche-tests/repro/W75/h-P6-03-gegner-darion-volles-brett-und-control-device-kopien.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, T = 'Tushu, the Knowledge Keeper', CD = 'Future Tech Control Device';
function stapel(t, seite, namen, hi = 0, slot = 1) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  R.section('a) Gegner-Darion mit vollem Brett: Control Device ist weiter spielbar');
  {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [[CD, F], [F]] });
    stapel(t, 1, ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'], 0, 0);
    t.put(1, 0, 1, H.INERT.creature); t.put(1, 0, 2, H.INERT.creature);
    // die beiden anderen Gegnerhelden fehlen (null) — Darion ist der einzige Wirt
    const liste = t.engine.getCrossSidePlayableArtifacts(0);
    R.check('Control Device in crossSidePlayableArtifacts', liste.includes(CD), liste);
    // Gegenprobe: ohne Stapel und mit vollem Brett (3 Kreaturen) ist es nicht spielbar
    const t2 = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [[CD, F], [F]] });
    for (let s = 0; s < 3; s++) t2.put(1, 0, s, H.INERT.creature);
    R.check('Gegenprobe: 3 Kreaturen, kein Stapel -> nicht spielbar', !t2.engine.getCrossSidePlayableArtifacts(0).includes(CD), t2.engine.getCrossSidePlayableArtifacts(0));
  }

  R.section('b) Zwei Control Devices im Stapel des Gegner-Darion: jede einzeln aktivierbar');
  {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [[F], [F]] });
    const ins = stapel(t, 1, [CD, 'Club of Gobbo', CD], 0, 1);
    for (const i of ins) if (i.name === CD) i.originalOwner = 0;
    t.phase(2);
    const alle = t.engine.getActivatableEquipsCrossSide(0);
    R.note('liste', JSON.stringify(alle));
    R.check('zwei Eintraege mit verschiedener instId', alle.length === 2 && alle[0].instId && alle[1].instId && alle[0].instId !== alle[1].instId, alle);
    R.check('die instIds gehoeren den beiden Devices', alle.every(e => ins.some(i => i.id === e.instId && i.name === CD)), alle);
    t.gs.hoptUsed = t.gs.hoptUsed || {};
    t.gs.hoptUsed['equip-effect:' + ins[0].id] = t.gs.turn;   // die erste Kopie ist verbraucht
    const rest = t.engine.getActivatableEquipsCrossSide(0);
    R.check('nach dem Verbrauch der ersten bleibt genau die zweite angeboten', rest.length === 1 && rest[0].instId === ins[2].id, rest);
    const voll = t.engine.getActivatableEquips(0).filter(e => e.crossSide);
    R.check('getActivatableEquips traegt die instId des Cross-Side-Eintrags', voll.length === 1 && voll[0].instId === ins[2].id, voll);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
