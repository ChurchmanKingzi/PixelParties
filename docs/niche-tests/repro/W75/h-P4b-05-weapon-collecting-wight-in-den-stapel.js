'use strict';
// W75 · Darion — Weapon Collecting Wight rüstet eine Ausruestung aus der Ablage in den Equip-Stapel (Audit P4b, Klasse C).
// Kartentext: „You may once per turn choose an equippable Artifact from your discard pile with a Cost of 15 or less and equip it to one of your Heroes without paying its Cost."
// Fehler vorher: die Platzwahl stellte die sinnlose Rueckfrage „welches Equip meinst du?" (der Stapelplatz ist ein Platz, keine Karte).
// Erwartet: auch ohne freie Zone aktivierbar, die Ausruestung landet oben im Stapel, keine Kartenrueckfrage. Aufruf: node docs/niche-tests/repro/W75/h-P4b-05-weapon-collecting-wight-in-den-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, WIGHT = 'Weapon Collecting Wight';
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();
  for (const mitFreierZone of [false, true]) {
    R.section(`Weapon Collecting Wight — Darion mit 3-Karten-Stapel, ${mitFreierZone ? 'eine Zone frei' : 'KEINE Zone frei'}`);
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[F], [F]], discard: [['Glass Sword'], []], gold: 100 });
    const w = t.put(0, 0, 0, WIGHT); w.turnPlayed = 1;
    if (!mitFreierZone) { const c = t.put(0, 0, 2, H.INERT.creature); c.turnPlayed = 1; }
    stapel(t, 0, NAMEN, 1, 0);
    const ps = t.gs.players[0];
    t.phase(2);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Glass Sword', source: 'discard' }) });
    let angebot = null;
    t.targetFn = (valid) => { angebot = valid.map(v => v.id); const v = valid.find(x => x.type === 'equip') || valid[0]; return [v.id]; };
    const r = await t.activateCreature(0, 0, 0);
    R.note('ergebnis', JSON.stringify({ r, zonen: ps.supportZones[0], angebot, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('Aktivierung gelang', r === true, r);
    R.check('Glass Sword liegt oben im Stapel', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify([...NAMEN, 'Glass Sword']), ps.supportZones[0]);
    R.check('angeboten wurde nur der Stapelplatz (+ Held)', JSON.stringify(angebot) === '["equip-0-0-1","hero-0-0"]', angebot);
    R.check('keine Kartenrueckfrage (instancePick)', !t.prompts.some(p => p.d.type === 'instancePick'), t.prompts.map(p => p.d.type));
    R.check('Glass Sword aus der Ablage', !t.pile(0, 'discardPile').includes('Glass Sword'), t.pile(0, 'discardPile'));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
