'use strict';
// W75 · Darion — Audit P3b: Anhaengsel (Spells mit Untertyp „Attachment") an einen Helden mit Equip-Stapel.
// Kartentexte: je Anhaengsel „Attach this card to …" — ein Anhaengsel ist KEIN Artefakt und gehoert nie in den Equip-Stapel; es liegt in einer eigenen freien Zone.
// Erwartet: Darion (eigene Seite oder Gegnerseite) traegt Club / Blade / Crown im Platz 2. Jedes Anhaengsel landet in Platz 1 oder 3 (nie im Stapel), der Stapel bleibt unveraendert
//          (drei Karten, Namen + Instanzen), Zustand sauber. Danach folgt ein weiteres Equip: es geht in den Stapel, nicht in die Zone des Anhaengsels.
// Aufruf: node docs/niche-tests/repro/W75/h-P3b-06-anhaengsel-an-darion-mit-stapel.js [Kartenname,…]   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
// Karte -> true: Wirt ist ein GEGNERISCHER Held (Overheal Shock, Curse-Wahl frei, The Master's Orders), sonst eigener Held (Wirker waehlt den Wirt)
const KARTEN = {
  'Alliance': false, 'Castling': false, 'Curse': true, 'Dichotomy of Luna and Tempeste': false, 'Energy Aura': false, 'Gathering Storm': false, 'Guardian Angel': false,
  'Overheal Shock': true, 'Polymorph': true, 'Prayer': false, 'Redirecting Aura': false, 'Royal Treasury': false, "The Master's Orders": true,
};
const nurDiese = process.argv[2] ? process.argv[2].split(',') : null;
async function lauf(karte, gegner) {
  const heroes = gegner ? [['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief', null], [D, 'Tushu, the Knowledge Keeper', null]] : [[D, 'Zwei, the Lucky Thief', null], ['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', null]];
  const t = await H.fresh({ active: 0, heroes, hand: [[karte, F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const seite = gegner ? 1 : 0;
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
  if (karte === 'Alliance' || karte === 'Prayer' || karte === 'Gathering Storm') { /* Wirt = Wirker: Held 0 des Sitzes 0 */ }
  t.targetFn = (valid) => {
    const zone = valid.find(v => v.type === 'equip' && v.owner === seite && v.heroIdx === 0 && v.slotIdx !== 1);
    const held = valid.find(v => v.type === 'hero' && v.owner === seite && v.heroIdx === 0);
    return [(zone || held || valid[0]).id];
  };
  t.policy.confirm = true;
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = (d.zones || []).find(x => (x.slotIdx ?? x.zoneSlot) !== 1 && (x.heroIdx ?? 0) === 0) || (d.zones || [])[0]; return z || undefined; } });
  const insts0 = insts.map(i => i.id);
  await t.play(0, karte, { hero: 0 });
  await t.drain();
  const tragende = t.gs.players[seite].heroes;
  // wo liegt die Karte?
  let ort = null;
  for (let hi = 0; hi < 3; hi++) for (let z = 0; z < 3; z++) for (const s of [0, 1]) {
    if ((t.gs.players[s].supportZones[hi][z] || []).includes(karte)) ort = { seite: s, hi, z };
  }
  const stapelOk = JSON.stringify(ps.supportZones[0][1]) === JSON.stringify(NAMEN) && insts.every(i => i.zone === 'support');
  const imStapel = ps.supportZones[0][1].includes(karte);
  // danach ein weiteres Equip (eigener Darion): es geht in den Stapel, auch wenn der Spieler die Zone des Anhaengsels meint
  let weiteres = null;
  if (!gegner && ort) {
    t.addHand(0, 'Glass Sword');
    await t.play(0, 'Glass Sword', { hero: 0, slot: ort.z });
    await t.drain();
    weiteres = { stapel: [...ps.supportZones[0][1]], anhaengselZone: [...ps.supportZones[0][ort.z]] };
  }
  return { t, ps, insts, ort, seite, weiteres, stapelOk, imStapel };
}
(async () => {
  const R = H.runner();
  const falsch = [], keinLauf = [];
  for (const [karte, fremd] of Object.entries(KARTEN)) {
    if (nurDiese && !nurDiese.includes(karte)) continue;
    for (const gegner of [false, true]) {
      if (fremd !== gegner && !['Curse', 'Dichotomy of Luna and Tempeste', 'Guardian Angel'].includes(karte)) continue;
      R.section(`${karte} -> ${gegner ? 'gegnerischer' : 'eigener'} Darion mit Stapel`);
      let r;
      try { r = await lauf(karte, gegner); } catch (e) { R.check('Lauf ohne Ausnahme', false, e.message); continue; }
      const { stapelOk, imStapel } = r;
      R.note('ort', JSON.stringify({ ort: r.ort, stapel: r.ps.supportZones[0][1] }));
      if (!r.ort) { keinLauf.push(karte + (gegner ? ' (gegn.)' : '')); R.note('Karte nicht gelegt (Wirt/Voraussetzung im Test nicht erfuellt)', karte); continue; }
      R.check('Stapel unveraendert (Namen + Instanzen)', stapelOk, r.ps.supportZones[0]);
      R.check('Anhaengsel liegt nicht im Stapel', !imStapel, r.ps.supportZones[0]);
      if (r.weiteres) R.check('ein weiteres Equip (Glass Sword) liegt im Stapel, die Zone des Anhaengsels bleibt bei ihm', r.weiteres.stapel.includes('Glass Sword') && r.weiteres.stapel.length === 4 && r.weiteres.anhaengselZone.join() === karte, r.weiteres);
      R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);
    }
  }
  R.note('nicht gelegt', keinLauf);
  R.finish();
})();
