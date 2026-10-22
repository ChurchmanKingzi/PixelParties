'use strict';
// W62a-03 · Alle Beschwörungs-/Platzierungswege kennen die Alice-Teilung (Bug-Klasse zu Pintas Befund, Al 22.10.2026)
//
// Kartentext Alice, the Transfer Student: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone. This effect persists even when this
//   Hero is defeated and cannot be negated."
// Der Hand-Weg (`validateActionPlay`/`doPlayCreature` + `canShareInto`) legt eine gleichnamige Kreatur auch auf ein volles Brett in die geteilte Zone. Viele Effekte, die eine Kreatur
//   „place"n/„summon"n, fragten dagegen nach EINER FREIEN Zone (eigene Schleife, `getFreeSupportZones` ohne Teilung, `eligibleSummonZones` nur leere Plätze) — Pinta, die Slimes der
//   Beschwörungs-Reihe, Skeleton Necromancer, Drill Sergeant … Jetzt EINE Zonenfrage (`engine.beschwoerZonenFuer`, Ergänzung in `getFreeSupportZones`/`eligibleSummonZones`) und EIN
//   Eintrags-Helfer (`engine.zoneEintragen`: dazustapeln statt überschreiben).
// Szene (je Sitz): Alice = Held 1; alle Zonen voll (andere Kreaturen), Zone A (Held 0, Slot 0) = Stapel aus 2 GLEICHNAMIGEN Kreaturen X. Die Karte unter Test legt ein X ein.
// Mit Alice: Zone A hält danach 3 X (nirgends sonst eine neue Kreatur). Gegenprobe ohne Alice-Teilung: nichts wird gelegt (Brett voll).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student', BIG = H.INERT.big;

/**
 * Brett bauen. `x` = Name der Stapel-Kreatur (Zone A), `held0` = Held 0, `eigene` = [Name, Zone] weitere Karten (ersetzen die BIG-Füller dort),
 * `alice` = false → keine Alice-Teilung (Held 1 ein neutraler Held). `frei` = [heroIdx, slot] bleibt frei.
 */
async function brett(seat, x, o = {}) {
  const alice = o.alice !== false;
  const eigene = [o.held0 || 'Tushu, the Knowledge Keeper', alice ? ALICE : 'Rick, the Trigger Happy Undertaker', o.held2 || 'Zwei, the Lucky Thief'];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const t = await H.fresh({ heroes, hand: o.hand && (seat === 0 ? [o.hand, []] : [[], o.hand]), discard: o.discard && (seat === 0 ? [o.discard, []] : [[], o.discard]),
    deck: o.deck && (seat === 0 ? [o.deck, []] : [[], o.deck]), gold: o.gold });
  const ps = t.gs.players[seat];
  for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) {
    if (o.frei && o.frei[0] === h && o.frei[1] === z) continue;
    const i = t.put(seat, h, z, BIG); i.turnPlayed = 1;
  }
  for (const i of t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0)) t.engine._untrackCard(i.id);
  ps.supportZones[0][0] = [];
  for (let k = 0; k < (o.stapel ?? 2); k++) { ps.supportZones[0][0].push(x); const i = t.engine._trackCard(x, seat, 'support', 0, 0); i.turnPlayed = 1; }
  for (const [name, h, z] of (o.eigene || [])) {
    for (const i of t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === h && c.zoneSlot === z)) t.engine._untrackCard(i.id);
    ps.supportZones[h][z] = [];
    const i = t.put(seat, h, z, name); i.turnPlayed = 1;
  }
  t.gs.turn = 5; t.gs.activePlayer = seat;
  if (o.vor) await o.vor(t, seat);
  return t;
}
const zoneA = (t, seat) => t.gs.players[seat].supportZones[0][0].slice();
const instA = (t, seat, x) => t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0 && c.name === x).length;
const ohneStapel = (t) => t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m));
const gesamt = (t, seat) => t.inst(c => c.zone === 'support' && c.owner === seat).length;
const sicher = (r) => r && (r.threw ? 'WARF ' + r.threw : r.hung ? 'hung ' + (r.pending || '') : r.runaway ? 'runaway' : r);

/** Antworten, die fast jede dieser Karten braucht. */
function antworten(t, x, o = {}) {
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { const e = d.cards.find(c => (o.quelle ? c.source === o.quelle : true) && c.name === x) || d.cards.find(c => c.name === x) || d.cards[0]; return { cardName: e.name, source: e.source }; } });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: Array(o.anzahl || 1).fill(x), selectedIndices: d.cards.map((c, i) => c.name === x ? i : -1).filter(i => i >= 0).slice(0, o.anzahl || 1) }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones.find(q => q.slotIdx === 0 && q.heroIdx === 0 && (q.owner == null || q.owner === t._seat)) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: (d.options.find(op => /skip|no/i.test(op.id)) || d.options[0]).id }) });
}

/** Die Tabelle: je Karte ein Szenario. `lauf` startet den Effekt; `erwartet` = zusätzliche X in Zone A. */
const FAELLE = [
  { name: 'Skeleton Necromancer (Kreatureneffekt: Skelett aus der Ablage platzieren)', x: 'Burning Skeleton',
    opts: { eigene: [['Skeleton Necromancer', 0, 1]], discard: ['Burning Skeleton'], hand: [H.INERT.filler] },
    lauf: async (t, s) => { t.phase(2); return t.activateCreature(s, 0, 1); } },
  { name: 'Raise the Minions! (Zauber: Skelette aus der Ablage platzieren)', x: 'Burning Skeleton',
    opts: { discard: ['Burning Skeleton'], hand: ['Raise the Minions!'] },
    lauf: async (t, s) => t.play(s, 'Raise the Minions!', { hero: 0 }), mehrfach: true },
  { name: 'Guardian\'s Appearance (Zauber: Guardian Beast platzieren)', x: 'Guardian Beast Gou',
    opts: { hand: ['Guardian Beast Gou', "Guardian's Appearance"] },
    lauf: async (t, s) => t.play(s, "Guardian's Appearance", { hero: 0 }) },
  { name: 'Layn, Master of Deri\'s Relic (Heldeneffekt: Lv1-Kreaturen aus der Ablage)', x: 'Burning Skeleton', held0: 'Layn, Master of Deri\'s Relic',
    opts: { discard: ['Burning Skeleton'] },
    lauf: async (t, s) => t.activateHero(s, 0) },
  { name: 'Cardinal Beast Xuanwu (Kreatureneffekt: Kreatur aus der Ablage wiederbeleben)', x: 'Burning Skeleton',
    opts: { eigene: [['Cardinal Beast Xuanwu', 0, 1]], discard: ['Burning Skeleton'] },
    lauf: async (t, s) => { t.phase(2); return t.activateCreature(s, 0, 1); } },
  { name: 'Damus, the Prophet of Apocalypse (Heldeneffekt: Ifrit aus der Hand platzieren)', x: 'Ifrit', held0: 'Damus, the Prophet of Apocalypse',
    opts: { hand: ['Ifrit'] },
    lauf: async (t, s) => t.activateHero(s, 0) },
  { name: 'Omikron, the Faceless Illusionist (Heldeneffekt: Illusion einer beliebigen Kreatur)', x: 'Burning Skeleton', held0: 'Omikron, the Faceless Illusionist',
    opts: {},
    lauf: async (t, s) => t.activateHero(s, 0) },
  { name: 'Army of the Cute (Zauber: Cute-Kreaturen platzieren)', x: 'Cute Bunny',
    opts: { hand: ['Army of the Cute', 'Cute Bunny'] },
    lauf: async (t, s) => t.play(s, 'Army of the Cute', { hero: 0 }) },
  { name: 'Forceful Revival (Zauber: Kreatur aus der Ablage auf den Nutzer)', x: 'Burning Skeleton',
    opts: { discard: ['Burning Skeleton'], hand: ['Forceful Revival'] },
    lauf: async (t, s) => t.play(s, 'Forceful Revival', { hero: 0 }) },
  { name: 'Monster in a Bottle (Trank: Kreatur aus Hand/Ablage setzen)', x: 'Cute Bunny',
    opts: { hand: ['Monster in a Bottle', 'Cute Bunny'] },
    lauf: async (t, s) => t.play(s, 'Monster in a Bottle', {}) },
  { name: 'Create Illusion (Zauber: Deck-Kreatur als Illusion legen, nur auf den Nutzer)', x: 'Burning Skeleton',
    opts: { deck: ['Burning Skeleton', H.INERT.creature, H.INERT.creature], hand: ['Create Illusion'] },
    lauf: async (t, s) => t.play(s, 'Create Illusion', { hero: 0 }) },
  { name: 'Staff of Illusions (Artefakt: Kreatur aus Deck/Hand als Illusion legen)', x: 'Burning Skeleton',
    opts: { deck: ['Burning Skeleton', H.INERT.creature, H.INERT.creature], hand: ['Staff of Illusions'], gold: 100 },
    lauf: async (t, s) => t.play(s, 'Staff of Illusions', { hero: 0 }) },
  { name: 'Deepsea Bats (Beschwörungseffekt: Deepsea-Kreatur aus der Ablage platzieren)', x: 'Deepsea Primordium', frei: [0, 2],
    opts: { discard: ['Deepsea Primordium'], hand: ['Deepsea Bats'] },
    lauf: async (t, s) => t.play(s, 'Deepsea Bats', { hero: 0, slot: 2 }), bats: true },
];

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    for (const f of FAELLE) {
      R.section(`Sitz ${seat}: ${f.name} — Zone A = 2 × ${f.x}, Brett sonst voll`);
      for (const mitAlice of [true, false]) {
        const t = await brett(seat, f.x, { ...f.opts, held0: f.held0, alice: mitAlice, frei: f.frei });
        t._seat = seat;
        antworten(t, f.x);
        const vorher = gesamt(t, seat), vorherA = zoneA(t, seat).length;
        const r = await f.lauf(t, seat);
        const nachA = zoneA(t, seat).length;
        const kein = t.errors.length === 0;
        const label = mitAlice ? 'mit Alice' : 'GEGENPROBE ohne Alice';
        if (mitAlice) {
          R.check(`${label}: ein ${f.x} mehr in Zone A (Stapel ${vorherA} → ${nachA})`, nachA >= vorherA + 1 && instA(t, seat, f.x) === nachA, { r: sicher(r), nachA, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
          R.check(`${label}: genau diese Kreatur kam dazu, nirgends sonst`, gesamt(t, seat) === vorher + (nachA - vorherA) - (f.bats ? 0 : 0) + (f.bats ? 0 : 0) || f.bats || f.name.startsWith('Omikron'), { vorher, jetzt: gesamt(t, seat) });
        } else {
          R.check(`${label}: nichts wird in die volle Aufstellung gelegt (Zone A bleibt bei ${vorherA})`, nachA === vorherA, { r: sicher(r), nachA });
        }
        R.check(`${label}: keine Engine-Fehler`, kein, t.errors);
        R.check(`${label}: Zustand sauber (bis auf die Alice-Stapel)`, ohneStapel(t).length === 0, ohneStapel(t));
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
