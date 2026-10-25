'use strict';
// W75 · Audit P4a · Sky Archeologist × Darion (geteilte Equip-Zone)
// Kartentext: „You may once per turn reveal the top card of your deck. If it is an Artifact, you may immediately play it without paying its Cost. Otherwise, put it on top or bottom of your deck (your choice)."
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Die oberste Karte ist eine Ausruestung (Cute Crown). Darion hat den Stapel [Club, Blade] und KEINE freie Zone (alle anderen Zonen belegt):
//   (a) Nur Darion ist Ziel: die Crown ist spielbar und kommt oben auf den Stapel (keine Zonenwahl).
//   (b) Ein zweiter Held hat noch eine freie Zone: Zonenwahl (zonePick), Darions Stapel ist eine der Optionen; gewaehlt -> Crown im Stapel.
// Aufruf: node docs/niche-tests/repro/W75/h-P4a-04-sky-archeologist-darion-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, SA = 'Sky Archeologist', DUMMY = H.INERT.creature, CROWN = 'Cute Crown';
function stapel(t, seite, hi, slot, namen) {
  const ps = t.gs.players[seite]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();
  for (const zweiterHeld of [false, true]) {
    R.section(zweiterHeld ? '(b) Darion-Stapel + freie Zone bei einem zweiten Helden: Zonenwahl' : '(a) Darion-Stapel, sonst keine freie Zone');
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], ['Tushu, the Knowledge Keeper', null, null]], hand: [[F], [F]], gold: 500, deck: [[CROWN, ...Array(15).fill(F)], Array(15).fill(F)] });
    stapel(t, 0, 0, 0, ['Club of Gobbo', 'Blade of the Frostbringer']);
    t.put(0, 0, 1, DUMMY); t.put(0, 0, 2, DUMMY);
    const sa = t.put(0, 1, 0, SA); sa.turnPlayed = 1;
    t.put(0, 1, 1, DUMMY); if (!zweiterHeld) t.put(0, 1, 2, DUMMY);
    for (let s = 0; s < 3; s++) t.put(1, 0, s, DUMMY);
    let zonePicks = 0;
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { zonePicks++; const z = d.zones.find(x => x.heroIdx === 0 && x.slotIdx === 0) || d.zones[0]; return { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
    t.policy.confirm = true;
    t.phase(2); t.gs.activePlayer = 0;
    const res = await t.activateCreature(0, 1, 0);
    await t.drain();
    const z = t.gs.players[0].supportZones[0][0];
    R.note('lauf', JSON.stringify({ res, darion: z, zonePicks, deck0: t.pile(0, 'mainDeck')[0], prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || p.d.message || '')) }));
    R.check('Die Crown liegt oben auf Darions Stapel', JSON.stringify(z) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer', CROWN]), z);
    R.check('Die Crown ist nicht mehr im Deck', t.pile(0, 'mainDeck')[0] !== CROWN, t.pile(0, 'mainDeck').slice(0, 2));
    R.check(zweiterHeld ? 'Es gab eine Zonenwahl' : 'Keine Zonenwahl', zweiterHeld ? zonePicks >= 1 : zonePicks === 0, zonePicks);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
