'use strict';
// W75 · Darion — Afflicted Pests schickt aus einem Equip-Stapel genau die gewaehlte Karte in die Ablage (Befund Al: „entfernt wird IMMER das oberste Equip").
// Kartentext Afflicted Pests: „Activate this Surprise when your opponent equips or attaches a card into a Hero's Support Zone. Choose a card in any Hero's Support Zone and send it to the discard pile, then place this Creature into one of the user's free Support Zones. …"
// Erwartet: gewaehlt wird die MITTLERE Karte des Stapels (Darion beim Gegner bzw. bei Pests-Besitzer selbst). Aufruf: node docs/niche-tests/repro/W75/g-04-afflicted-pests-waehlt-gewaehlte-karte.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();
  for (const stapelSeite of [1, 0]) {
    R.section('Stapel bei Sitz ' + stapelSeite + ' (Darion), Gegner legt Equip an');
    const heroes = [[F, null, null], [F, null, null]]; heroes[stapelSeite] = [D, null, null];
    // Sitz 1 legt an (Sitz 0 besitzt die Pests); Sitz 1 hat bei stapelSeite 0 ein eigenes Equip auf der Hand
    const t = await H.fresh({ active: 1, heroes, hand: [[F], ['Heart of Ice', F]], gold: 500 });
    t.putSurprise(0, 0, 'Afflicted Pests');
    const ps = t.gs.players[stapelSeite];
    ps.supportZones[0][1] = [];
    const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, stapelSeite, 'support', 0, 1); i.turnPlayed = 1; return i; });
    const mitte = insts[1];
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: mitte.id }) });
    t.policy.confirm = true;
    t.targetFn = (valid) => {
      const eq = valid.find(v => v.type === 'equip' && v.owner === stapelSeite && v.heroIdx === 0 && v.slotIdx === 1);
      return [(eq || valid[0]).id];
    };
    await t.play(1, 'Heart of Ice', { hero: 0 });
    await t.drain();
    R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
    R.note('zonen', JSON.stringify(ps.supportZones[0]) + ' | Ablage ' + JSON.stringify(t.pile(stapelSeite, 'discardPile')));
    const rest = ps.supportZones[0][1];
    const weg = NAMEN.filter(n => !rest.includes(n));
    R.check('Pests wurde angeboten/aktiviert', t.prompts.some(p => /Afflicted Pests/.test(JSON.stringify(p.d))) || t.inst(c => c.name === 'Afflicted Pests' && c.zone === 'support').length > 0);
    R.check('nur die gewaehlte (mittlere) Karte ist weg', weg.length === 1 && weg[0] === NAMEN[1], weg);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
