'use strict';
// W20b-4 · Opfer-Zonen-Regel für JEDE Beschwörung/Platzierung, die über das Entfernen/Opfern/Zurückgeben EINER Karte eine Zone freimacht (Al, 20.10.2026:
//   „Ja, die Regel gilt allgemein für jede Opfer-Beschwörung.")
// Regel (Al, Welle 19): „Es ist jede Zone ein Ziel, die durch Opfern für die Beschwörung leer wird. … bei mehr Creatures als benötigten Opfern ist eine Zone nicht viable."
//   Karten mit festem „1 Karte entfernen" (Piranha-Muster) bleiben bei Zonen mit genau einer Karte: ein Alice-Stapel aus 2 Karten ist kein Ziel/keine gültige Aktivierung.
// Vorher (Basis 2e329bd) zahlten diese Karten ihr Opfer und fizzelten (Hive's Crown, Garius, Rook of Kings [W], Rottweiler …) oder überschrieben den Mitbewohner
//   (Creepy Villager, Shapeshift: Geister-Instanz) bzw. wichen auf eine andere Zone aus (Steam Dwarf Engineer).
// Je Karte: Gegenprobe Zone mit 1 Karte (funktioniert) und Alice-Stapel aus 2 Karten (nicht aktivierbar/kein Ziel, nichts bezahlt, Zustand sauber). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student';
const BIG = H.INERT.big;
const auditOhneStapel = (t) => t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m));

async function base(o = {}) {
  const t = await H.fresh({ heroes: [[ALICE, 'Rick, the Trigger Happy Undertaker', 'Tushu, the Knowledge Keeper'], null], ...o });
  t.gs.players[0]._aliceShareActive = true;
  return t;
}
function stack(t, hi, z, name, n) {
  const ps = t.gs.players[0];
  const i0 = t.put(0, hi, z, name); i0.turnPlayed = 1;
  for (let k = 1; k < n; k++) { ps.supportZones[hi][z].push(name); const i = t.engine._trackCard(name, 0, 'support', hi, z); i.turnPlayed = 1; }
}
const zone = (t, hi, z) => t.gs.players[0].supportZones[hi][z].slice();
const auto = (t) => {
  t.targetFn = (valid) => { const v = valid.find(x => !x.ineligible); return v ? [v.id] : null; };
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: (d) => ({ cardName: (d.cards[0].name || d.cards[0]), source: d.cards[0].source || 'deck' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => { const z = d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  t.script.push({ match: d => d && d.type === 'pickHandCard', answer: (d) => ({ cardName: t.gs.players[0].hand[d.eligibleIndices[0]], handIndex: d.eligibleIndices[0] }) });
};
const main = (t) => { t.gs.activePlayer = 0; t.phase(2); };
const sauber = (R, t, was) => R.check(`${was}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && auditOhneStapel(t).length === 0, { e: t.errors, a: auditOhneStapel(t) });

(async () => {
  const R = H.runner();

  // ── Hive's Crown: Opfer = ein Sparkfly, die Queen kommt in dessen Zone ──
  R.section('Hive\'s Crown (Sparkfly Worker): Zone mit 1 Karte ok, Alice-Stapel aus 2 kein Opfer-Ziel');
  for (const n of [1, 2]) {
    const t = await base({ hand: [['Hive\'s Crown', 'Sparkfly Queen'], []] }); stack(t, 0, 0, 'Sparkfly Worker', n); auto(t); t.grantFor(0, 0, 'Hive\'s Crown');
    const r = await t.play(0, 'Hive\'s Crown', { hero: 0 });
    if (n === 1) R.check('1 Karte: Queen steht in der Zone des Opfers, Worker in der Ablage', zone(t, 0, 0).join() === 'Sparkfly Queen' && t.pile(0, 'discardPile').includes('Sparkfly Worker'), { r, z: zone(t, 0, 0) });
    else R.check('Stapel aus 2: nicht spielbar - nichts geopfert, Crown und Queen auf der Hand, Stapel unberührt', zone(t, 0, 0).length === 2 && t.pile(0, 'hand').includes('Hive\'s Crown') && !t.pile(0, 'discardPile').includes('Sparkfly Worker'), { r, z: zone(t, 0, 0), hand: t.pile(0, 'hand') });
    sauber(R, t, `Hive's Crown n=${n}`);
  }

  // ── Garius: Opfer, Ersatz aus dem Deck in dieselbe Zone ──
  R.section('Garius, the Great Reformer: Zone mit 1 Karte ok, Alice-Stapel aus 2 kein Opfer-Ziel');
  for (const n of [1, 2]) {
    const t = await base({ deck: [['ZZ Dummy'], []] }); t.setHero(0, 1, 'Garius, the Great Reformer', 800); stack(t, 0, 2, BIG, n); auto(t);
    const r = await t.activateHero(0, 1);
    if (n === 1) R.check('1 Karte: Opfer in der Ablage, Ersatz (ZZ Dummy) steht in der Zone', zone(t, 0, 2).join() === 'ZZ Dummy' && t.pile(0, 'discardPile').includes(BIG), { r, z: zone(t, 0, 2) });
    else R.check('Stapel aus 2: nichts geopfert, Stapel unberührt', zone(t, 0, 2).length === 2 && !t.pile(0, 'discardPile').includes(BIG), { r, z: zone(t, 0, 2), d: t.pile(0, 'discardPile') });
    sauber(R, t, `Garius n=${n}`);
  }

  // ── Kasperov [B]: Pawn opfern, "of Kings" aus Hand/Deck in dessen Zone ──
  R.section('Kasperov, the King of Kings [B]: Zone mit 1 Pawn ok, Alice-Stapel aus 2 Pawns kein Ziel');
  for (const n of [1, 2]) {
    const t = await base({ deck: [['Rook of Kings [B]'], []] }); t.setHero(0, 1, 'Kasperov, the King of Kings [B]', 800); t.put(0, 2, 0, 'Board of Kings'); stack(t, 0, 1, 'Pawn of Kings [B]', n); auto(t);
    const r = await t.activateHero(0, 1);
    if (n === 1) R.check('1 Pawn: geopfert, Ersatz steht in der Zone', zone(t, 0, 1).join() === 'Rook of Kings [B]' && t.pile(0, 'discardPile').includes('Pawn of Kings [B]'), { r, z: zone(t, 0, 1) });
    else R.check('Stapel aus 2 Pawns: nichts geopfert, Stapel unberührt', zone(t, 0, 1).length === 2 && !t.pile(0, 'discardPile').includes('Pawn of Kings [B]'), { r, z: zone(t, 0, 1), d: t.pile(0, 'discardPile') });
    sauber(R, t, `Kasperov n=${n}`);
  }

  // ── Loyal Rottweiler / Steam Dwarf Engineer: opfern sich selbst, Ersatz aus dem Deck in die eigene Zone ──
  for (const [name, deck, erwartet] of [['Loyal Rottweiler', ['Loyal Terrier', 'ZZ Dummy'], 'Loyal Terrier'], ['Steam Dwarf Engineer', ['Pollution Piranha', 'ZZ Dummy'], 'Pollution Piranha']]) {
    R.section(`${name}: Zone mit 1 Karte ok, Alice-Stapel aus 2 nicht aktivierbar (Opfer wäre umsonst bzw. wiche in eine andere Zone aus)`);
    for (const n of [1, 2]) {
      const t = await base({ deck: [deck, []] }); stack(t, 0, 0, name, n); auto(t); main(t);
      const r = await t.activateCreature(0, 0, 0);
      if (n === 1) R.check('1 Karte: sich selbst geopfert, Ersatz steht in der Zone', zone(t, 0, 0).join() === erwartet && t.pile(0, 'discardPile').includes(name), { r, z: zone(t, 0, 0) });
      else R.check('Stapel aus 2: nicht aktivierbar, nichts geopfert, nichts platziert', zone(t, 0, 0).length === 2 && zone(t, 0, 1).length === 0 && !t.pile(0, 'discardPile').includes(name), { r, z: [0, 1, 2].map(z => zone(t, 0, z)), d: t.pile(0, 'discardPile') });
      sauber(R, t, `${name} n=${n}`);
    }
  }

  // ── Creepy Villager: sich selbst auf die Hand, Dark Deepsea God in dieselbe Zone ──
  R.section('Creepy Villager: Zone mit 1 Karte ok, Alice-Stapel aus 2 nicht aktivierbar (sonst überschrieb der Gott den Mitbewohner)');
  for (const n of [1, 2]) {
    const t = await base({ hand: [['Dark Deepsea God'], []] }); stack(t, 0, 0, 'Creepy Villager', n); auto(t); main(t);
    const r = await t.activateCreature(0, 0, 0);
    if (n === 1) R.check('1 Karte: Gott steht in der Zone, Villager auf der Hand', zone(t, 0, 0).join() === 'Dark Deepsea God' && t.pile(0, 'hand').includes('Creepy Villager'), { r, z: zone(t, 0, 0), h: t.pile(0, 'hand') });
    else R.check('Stapel aus 2: nicht aktivierbar - Villager bleiben, Gott auf der Hand, keine Geister-Instanz', zone(t, 0, 0).length === 2 && t.pile(0, 'hand').includes('Dark Deepsea God') && auditOhneStapel(t).length === 0, { r, z: zone(t, 0, 0), a: auditOhneStapel(t) });
    sauber(R, t, `Villager n=${n}`);
  }

  // ── Shapeshift / Divine Gift of the Deepsea: Kreatur zurück auf die Hand, Ersatz in dieselbe Zone ──
  R.section('Shapeshift: Zone mit 1 Karte ok, Alice-Stapel aus 2 nicht tauschbar (sonst Geister-Instanz)');
  for (const n of [1, 2]) {
    const t = await base({ hand: [['Shapeshift', 'Deepsea Zombie'], []] }); stack(t, 0, 0, 'Deepsea Reaper', n); auto(t); t.grantFor(0, 0, 'Shapeshift');
    const r = await t.play(0, 'Shapeshift', { hero: 0 });
    if (n === 1) R.check('1 Karte: Zombie steht in der Zone, Reaper auf der Hand', zone(t, 0, 0).join() === 'Deepsea Zombie' && t.pile(0, 'hand').includes('Deepsea Reaper'), { r, z: zone(t, 0, 0) });
    else R.check('Stapel aus 2: nicht spielbar, Stapel unberührt, Karte auf der Hand', zone(t, 0, 0).length === 2 && t.pile(0, 'hand').includes('Shapeshift'), { r, z: zone(t, 0, 0), h: t.pile(0, 'hand') });
    sauber(R, t, `Shapeshift n=${n}`);
  }
  R.section('Divine Gift of the Deepsea: Zone mit 1 Karte ok, Alice-Stapel aus 2 kein Ziel (das „1 pro Spiel" wird nicht für ein Fizzle verbrannt)');
  for (const n of [1, 2]) {
    const t = await base({ hand: [['Divine Gift of the Deepsea'], []], deck: [['Deepsea Zombie'], []] }); stack(t, 0, 0, 'Deepsea Reaper', n); auto(t); t.grantFor(0, 0, 'Divine Gift of the Deepsea');
    const r = await t.play(0, 'Divine Gift of the Deepsea', { hero: 0 });
    if (n === 1) R.check('1 Karte: Zombie steht in der Zone, Reaper auf der Hand', zone(t, 0, 0).join() === 'Deepsea Zombie' && t.pile(0, 'hand').includes('Deepsea Reaper'), { r, z: zone(t, 0, 0) });
    else R.check('Stapel aus 2: nicht spielbar, Stapel unberührt, Karte auf der Hand', zone(t, 0, 0).length === 2 && t.pile(0, 'hand').includes('Divine Gift of the Deepsea') && !t.pile(0, 'hand').includes('Deepsea Reaper'), { r, z: zone(t, 0, 0), h: t.pile(0, 'hand') });
    sauber(R, t, `Divine Gift n=${n}`);
  }

  // ── Deepsea Castle (Area): Aktivierbarkeit ──
  R.section('Deepsea Castle: Alice-Stapel aus 2 ist kein Tauschziel (nur 1 Karte: aktivierbar)');
  { const castle = require('../../../../cards/effects/deepsea-castle.js');
    for (const n of [1, 2]) {
      const t = await base({ hand: [['Deepsea Zombie'], []] }); stack(t, 0, 0, 'Deepsea Reaper', n);
      const ok = !!castle.canActivateAreaEffect({ _engine: t.engine, _activator: 0 });
      R.check(`Castle ${n === 1 ? 'aktivierbar (1 Karte)' : 'NICHT aktivierbar (Stapel aus 2)'}`, ok === (n === 1), ok);
    } }

  // ── Deepsea Encounter (Reaktion): Ziel im Alice-Stapel zählt nicht ──
  R.section('Deepsea Encounter: Reaktion nur, wenn die Rückgabe die Zone leert');
  { const enc = require('../../../../cards/effects/deepsea-encounter.js');
    for (const n of [1, 2]) {
      const t = await base({ hand: [['Deepsea Encounter', 'Deepsea Zombie'], []] }); stack(t, 0, 0, 'Deepsea Reaper', n);
      const inst = t.inst(c => c.name === 'Deepsea Reaper' && c.zone === 'support')[0];
      const tgt = { id: `equip-0-0-0`, type: 'equip', owner: 0, heroIdx: 0, slotIdx: 0, cardName: 'Deepsea Reaper', cardInstance: inst };
      const ok = !!enc.postTargetCondition(t.gs, 0, t.engine, [tgt], { name: 'Fireball', controller: 1, owner: 1 }, {});
      R.check(`Encounter ${n === 1 ? 'bietet sich an (1 Karte)' : 'bietet sich NICHT an (Stapel aus 2)'}`, ok === (n === 1), ok);
    } }

  // ── Rook of Kings [W]: zweites Opfer ersetzen ──
  R.section('Rook of Kings [W]: ein Alice-Stapel aus 2 ist kein zweites Opfer (wird nicht angeboten)');
  for (const n of [1, 2]) {
    const t = await base({ deck: [['Rook of Kings [B]'], []] });
    t.setHero(0, 1, 'Kasperov, the King of Kings [B]', 800); t.putArea(0, 'Board of Kings'); t.put(0, 0, 0, 'Rook of Kings [W]').turnPlayed = 1;
    t.put(0, 1, 0, 'Pawn of Kings [B]').turnPlayed = 1;           // Opfer 1 (Kasperov)
    stack(t, 0, 1, 'Bishop of Kings [W]', n);                      // Kandidat für das zweite Opfer: Einzelkarte bzw. Alice-Stapel
    auto(t);
    const angeboten = [];
    t.targetFn = (valid) => { valid.forEach(v => angeboten.push(v.cardName)); const v = valid.find(x => !x.ineligible && /Bishop/.test(x.cardName)) || valid.find(x => !x.ineligible); return v ? [v.id] : null; };
    t.script.unshift({ match: d => d && d.type === 'confirm' && /Rook of Kings/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    const r = await t.activateHero(0, 1);
    if (n === 1) R.check('Einzelkarte: Bishop wird als zweites Opfer angeboten und geopfert', angeboten.includes('Bishop of Kings [W]') && t.pile(0, 'discardPile').includes('Bishop of Kings [W]'), { r, angeboten, d: t.pile(0, 'discardPile') });
    else R.check('Stapel aus 2: Bishop nicht angeboten, Stapel unberührt (nichts bezahlt und verfizzelt)', !angeboten.includes('Bishop of Kings [W]') && zone(t, 0, 1).length === 2 && !t.pile(0, 'discardPile').includes('Bishop of Kings [W]'), { r, angeboten, d: t.pile(0, 'discardPile'), z: zone(t, 0, 1) });
    R.check(`Rook of Kings W n=${n}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
