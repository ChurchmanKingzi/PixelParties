'use strict';
// Gemeinsamer Szenenbau fuer die Repros W63/a-* (Alice-Teilung: Reihenfolge, "free Support Zone", Surprise Party, Bewegen, Reincarnation).
//
// Szene (je Sitz): Held 0 (neutral oder `held0`), Held 1 = "Alice, the Transfer Student" (oder ein neutraler Held ohne Alice), Held 2 neutral.
//   `zonen`   = Inhalte der drei Zonen von Held 0: [[Name, Name], [], [Name]] (mehrere Namen = Stapel gleichnamiger Kreaturen);
//               nicht genannte Zonen bleiben leer, wenn `leer: true`, sonst werden sie mit BIG gefuellt.
//   `fuellen` = Held 1 und 2 werden mit BIG gefuellt (volles Brett), ausser `frei1`/`frei2` nennen Zonen, die frei bleiben.
//   `alice`   = true (Standard, lebend) | false (kein Alice-Held) | 'tot' (hp 0) | 'flagge' (nur der Schalter) | 'gegner' (Alice nur beim Gegner)
const H = require('./h.js');
const ALICE = 'Alice, the Transfer Student', BIG = H.INERT.big, CRE = H.INERT.creature;

function stapeln(t, seat, hi, slot, namen, opts = {}) {
  const ps = t.gs.players[seat];
  ps.supportZones[hi][slot] = [];
  for (const n of namen) {
    ps.supportZones[hi][slot].push(n);
    const i = t.engine._trackCard(n, seat, 'support', hi, slot);
    i.turnPlayed = opts.turnPlayed ?? 1;
    if (opts.controller != null) i.controller = opts.controller;
  }
}
function leeren(t, seat, hi, slot) {
  for (const i of t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === hi && c.zoneSlot === slot)) t.engine._untrackCard(i.id);
  t.gs.players[seat].supportZones[hi][slot] = [];
}

async function brett(seat, o = {}) {
  const alice = o.alice === undefined ? true : o.alice;
  const hatAlice = alice === true || alice === 'tot';
  const eigene = [o.held0 || 'Tushu, the Knowledge Keeper', hatAlice ? ALICE : 'Rick, the Trigger Happy Undertaker', o.held2 || 'Zwei, the Lucky Thief'];
  const heroes = seat === 0 ? [eigene, o.gegnerHelden || null] : [o.gegnerHelden || null, eigene];
  const pro = (v) => v && (seat === 0 ? [v, []] : [[], v]);
  const t = await H.fresh({
    heroes, hand: pro(o.hand), deck: pro(o.deck), discard: pro(o.discard), potionDeck: pro(o.potionDeck), gold: o.gold, hp: o.hp,
  });
  t._seat = seat;
  const ps = t.gs.players[seat];
  if (alice === 'tot') ps.heroes[1].hp = 0;
  if (alice === 'flagge') ps._aliceShareActive = true;
  if (alice === 'gegner') t.gs.players[1 - seat].heroes[0] = { ...t.gs.players[1 - seat].heroes[0], name: ALICE };
  if (o.fuellen) for (const h of [1, 2]) for (let z = 0; z < 3; z++) {
    if ((h === 1 && o.frei1 === z) || (h === 2 && o.frei2 === z)) continue;
    const i = t.put(seat, h, z, BIG); i.turnPlayed = 1;
  }
  const zonen = o.zonen || [];
  for (let z = 0; z < 3; z++) {
    const namen = zonen[z];
    if (namen === undefined) { if (!o.leer) { const i = t.put(seat, 0, z, BIG); i.turnPlayed = 1; } continue; }
    if (namen.length) stapeln(t, seat, 0, z, namen);
  }
  for (const [name, h, z] of (o.eigene || [])) { leeren(t, seat, h, z); const i = t.put(seat, h, z, name); i.turnPlayed = 1; }
  // `extra`: [[heldIdx, slot, [Namen…]], …] — beliebige Zonen (auch fremde Helden) neu belegen; leere Liste = frei.
  for (const [h, z, namen] of (o.extra || [])) { leeren(t, seat, h, z); if (namen.length) stapeln(t, seat, h, z, namen); }
  t.gs.turn = 5; t.gs.activePlayer = seat;
  // Ablage-Eintraege gelten als „schon zu Zugbeginn dort“ (Teal Fishing Rod, Thep: „not sent there this turn“).
  ps._discardNamesAtTurnStart = new Set(ps.discardPile);
  if (o.vor) await o.vor(t, seat);
  return t;
}

const zoneA = (t, seat, hi = 0, z = 0) => t.gs.players[seat].supportZones[hi][z].slice();
const instIn = (t, seat, hi, z, name) => t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === hi && c.zoneSlot === z && (name == null || c.name === name)).length;
const ohneStapel = (t) => t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m));
const gesamt = (t, seat) => t.inst(c => c.zone === 'support' && c.owner === seat).length;
const sicher = (r) => r && (r.threw ? 'WARF ' + r.threw : r.hung ? 'hung ' + (r.pending || '') : r.runaway ? 'runaway' : r);
const slotsVon = (zs) => zs.map(z => z.slotIdx + (z.shared ? 's' : ''));

/** Standardantworten fuer Galerien/Zonenwahl: nimmt Karte `x` (falls vorhanden), Zone `zone` = [heroIdx, slotIdx] (sonst die ERSTE angebotene). */
function antworten(t, x, o = {}) {
  t.zonenAngebote = [];
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { const e = d.cards.find(c => c.name === x) || d.cards[0]; return { cardName: e.name, source: e.source }; } });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: Array(o.anzahl || 1).fill(x), selectedIndices: d.cards.map((c, i) => c.name === x ? i : -1).filter(i => i >= 0).slice(0, o.anzahl || 1) }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => {
    t.zonenAngebote.push(d.zones.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner, shared: !!z.shared })));
    const z = (o.zone && d.zones.find(q => q.heroIdx === o.zone[0] && q.slotIdx === o.zone[1])) || d.zones[0];
    return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner };
  } });
  t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: (d.options.find(op => /skip|no/i.test(op.id)) || d.options[0]).id }) });
}

module.exports = { H, ALICE, BIG, CRE, brett, stapeln, leeren, zoneA, instIn, ohneStapel, gesamt, sicher, slotsVon, antworten };
