'use strict';
// W75 · Darion (Audit P3a) — Overcharge sieht ALLE Equips eines Stapels, nicht nur das unterste.
// Kartentext Overcharge: „Choose an Artifact equipped to a Hero you control and send it to the discard pile. Then, choose an equippable Artifact with a Cost between 1 and 10 Gold higher
// than the discarded one from your deck and equip it to the same Hero."
// Erwartet: Stapel Club (4) / Blade (5) / Crown (8) bei Darion. Gewaehlt wird per Rueckfrage die MITTLERE Karte (Blade): nur sie geht in die Ablage, Club und Crown bleiben, die neue Ausruestung
//   landet im selben Stapel (kein Zonenwahl-Prompt, kein zweiter Platz). Die Crown (oberste) ist ebenfalls waehlbar. Nur Karten mit Aufwertung im Deck stehen zur Wahl.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-01-overcharge-waehlt-karte-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite) {
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  return NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
}
async function szene(wahlIdx, deck) {
  const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Overcharge', F], [F]], gold: 500, deck: [deck || ['Hat of Madness', 'Mana-Consuming Blade', ...Array(10).fill(F)], Array(15).fill(F)] });
  const insts = stapel(t, 0);
  const fragen = [];
  t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { fragen.push(d.instances.map(i => i.name)); return wahlIdx == null ? { instId: d.instances[d.instances.length - 1].instId } : { instId: insts[wahlIdx].id }; } });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Overcharge', answer: (d) => ({ cardName: d.cards[0].name, source: 'deck' }) });
  t.policy.confirm = true;
  await t.play(0, 'Overcharge', { hero: 0 });
  await t.drain();
  return { t, insts, fragen, ps: t.gs.players[0] };
}
(async () => {
  const R = H.runner();

  R.section('Overcharge: mittlere Karte (Blade) gewaehlt');
  {
    const { t, ps, fragen } = await szene(1);
    R.note('lauf', JSON.stringify({ fragen, zone: ps.supportZones[0], ablage: t.pile(0, 'discardPile'), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    const z = ps.supportZones[0][1];
    R.check('Blade liegt in der Ablage, Club und Crown bleiben im Stapel', t.pile(0, 'discardPile').includes(NAMEN[1]) && z.includes(NAMEN[0]) && z.includes(NAMEN[2]) && !z.includes(NAMEN[1]), [z, t.pile(0, 'discardPile')]);
    R.check('die neue Ausruestung liegt im selben Stapel (3 Karten, ein Platz)', z.length === 3 && ps.supportZones[0].filter(s => s.length).length === 1, ps.supportZones[0]);
    R.check('Rueckfrage nannte alle Equips mit Aufwertung', fragen.length >= 1 && fragen[0].length >= 2, fragen);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Overcharge: oberste Karte (Crown, Aufwertung 9–18 Gold) gewaehlt');
  {
    const { t, ps } = await szene(2);
    const z = ps.supportZones[0][1];
    R.check('Crown in der Ablage, Club und Blade bleiben', t.pile(0, 'discardPile').includes(NAMEN[2]) && z.includes(NAMEN[0]) && z.includes(NAMEN[1]), [z, t.pile(0, 'discardPile')]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Overcharge: nur Karten mit Aufwertung im Deck stehen zur Wahl');
  {
    // Deck nur mit einer Karte fuer 9–18 Gold: nur die Crown (8) hat eine Aufwertung ausser Club (4 → 5..14) und Blade (5 → 6..15), die diese Karte ebenfalls erlaubt -> alle drei. Mit 5-Gold-Karte: nur Club.
    const { fragen, t, ps } = await szene(null, ['Blade of the Swamp Witch', ...Array(10).fill(F)]);
    const z = ps.supportZones[0][1];
    R.note('lauf', JSON.stringify({ fragen, zone: z, ablage: t.pile(0, 'discardPile') }));
    R.check('nur Club hat eine Aufwertung (5 Gold) -> Club in der Ablage, Blade und Crown bleiben', t.pile(0, 'discardPile').includes(NAMEN[0]) && z.includes(NAMEN[1]) && z.includes(NAMEN[2]), [z, t.pile(0, 'discardPile')]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
