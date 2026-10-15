'use strict';
// W9a · Q9 (A02-deepsea-10) · Al, 15.10.2026: „Doch, place ist auch eine Subform von Beschwörung (summon)!“
// Erwartet (Absicherung, keine Codeänderung): Cosmic Manipulation reagiert schon auf das PLATZIEREN der 1. Hälfte von Arrival (Fenster „Analyzer … was summoned!“)
//   UND weiterhin auf die echte Beschwörung der 2. Hälfte (HOPT wird nur durch eine Annahme verbraucht). Lehnt man das 1. Fenster ab, läuft Arrival komplett
//   (Gatherer steht auf dem Brett) und das 2. Fenster wird angeboten. Nimmt man das 1. Fenster an und zieht CM dabei den Aufwertungskandidaten (Gatherer = oberste Karte),
//   fizzelt Arrival ehrlich mit `no_upgrade` (Folge der Spielerwahl, kein Absturz, keine Kartenvermehrung).
const H = require('../../lib/h.js');
async function lauf(antworten) {
  const AN = 'Analyzer from the Cosmic Depths', GA = 'Gatherer from the Cosmic Depths', LS = 'Life-Searcher from the Cosmic Depths', INV = 'Invader from the Cosmic Depths';
  const deck = [AN, GA, LS, INV, ...Array(10).fill(H.INERT.creature)];
  const t = await H.fresh({ hand: [['Arrival from the Cosmic Depths', 'Cosmic Manipulation', H.INERT.filler], []], deck: [deck] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic']]);
  let n = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Cosmic Manipulation', answer: () => (antworten[n++] ? { confirmed: true } : null), once: false });
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = t.pile(0, 'hand').indexOf(H.INERT.filler); return { cardName: H.INERT.filler, handIndex: i, selectedCards: [{ cardName: H.INERT.filler, handIndex: i }] }; } });
  t.targetFn = (valid) => [valid[0].id];
  const vorher = t.census();
  await t.play(0, 'Arrival from the Cosmic Depths', { hero: 0 });
  return { t, GA, AN, fenster: t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === 'Cosmic Manipulation').map(p => String(p.d.message)), vorher };
}
(async () => {
  const R = H.runner();
  let r = await lauf([false, false]);
  R.check('(1) Fenster beim PLATZIEREN der 1. Hälfte (Analyzer) wird angeboten', r.fenster.length >= 1 && /Analyzer/.test(r.fenster[0]), r.fenster);
  R.check('(1) abgelehnt: Arrival läuft komplett (Gatherer auf meinem Brett)', r.t.gs.players[0].supportZones[0].some(z => z[0] === r.GA), r.t.gs.players[0].supportZones[0]);
  R.check('(1) 2. Fenster (echte Beschwörung, Gatherer) wird danach angeboten', r.fenster.length === 2 && /Gatherer/.test(r.fenster[1]), r.fenster);
  R.check('(1) keine Engine-Fehler', r.t.errors.length === 0, r.t.errors);
  r = await lauf([false, true]);
  R.check('(2) 1. abgelehnt, 2. angenommen: CM zieht 2 Karten (Gatherer Lv2) und wirkt', r.t.gs.hoptUsed && r.t.gs.hoptUsed['cosmic-manipulation:0'] === r.t.gs.turn && !r.t.pile(0, 'hand').includes('Cosmic Manipulation'), { hopt: r.t.gs.hoptUsed, hand: r.t.pile(0, 'hand') });
  R.check('(2) keine Engine-Fehler', r.t.errors.length === 0, r.t.errors);
  r = await lauf([true, true]);
  R.check('(3) 1. angenommen (zieht den Gatherer): Arrival fizzelt mit no_upgrade, kein Absturz', r.t.logs.some(l => l.type === 'arrival_fizzle') && r.t.errors.length === 0, r.t.logs.map(l => l.type).filter(x => /arrival/.test(x)));
  R.finish();
})();
