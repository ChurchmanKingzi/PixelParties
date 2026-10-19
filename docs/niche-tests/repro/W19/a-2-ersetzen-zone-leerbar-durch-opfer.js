'use strict';
// W19a-2 · Ersetzen-Regel, neu gefasst (Al, 19.10.2026): eine Zone ist Wurf-/Beschwörungsziel genau dann, wenn die geforderten Opfer sie VOLLSTÄNDIG leeren können
//
// Frage an Al: „Soll ein Wurf mit einer Mehr-Opfer-Karte (Blue-Ice Dragon, Foresta the Guard, Steam Dwarf Dragon Pilot, The Egg of God) auf einen Alice-Stapel
//   gar kein Wurfziel sein?" - Al: „Es ist jede Zone ein Ziel, die durch Opfern für die Beschwörung leer wird. Wählt man also eine Zone mit 2 Creatures darin,
//   müssen beide geopfert werden, bei mehr Creatures als benötigten Opfern ist eine Zone nicht viable."
// Das ersetzt die W17a-Regel „Alice-Stapel kein Ziel" bei Mehr-Opfer-Karten. Für Karten mit EINEM Opfer (Egg of God - opfert 1 -, Teocuilatl-Trio,
// Suspicious Monster, Pollution Piranha: 1 Token, Gigantisaur King Trex: 1 Gigantisaur, Deepsea-Linie: 1 Rückgabe) bleibt es bei „nur Zonen mit genau einer Karte" (Al, Welle 17).
//
// Szene: Held 0 hat volle Zonen (Alice teilt: gleiche Kreatur mehrfach in einer Zone), die anderen Helden leer. Je Karte:
//   Zone A = 2 Karten, Zone B = 1 Karte, Zone C = 3 Karten  (Opferzahl n: Blue-Ice/Foresta 2, Pilot 2+ (Max-HP >= 300), DDG 2+ (Level >= 4), 1-Opfer-Karten 1)
//   n = 2 : A und B sind Ziele (Wahl von A: BEIDE geopfert, Karte landet in A; Wahl von B: der Insasse + ein weiteres Opfer, Karte landet in B), C nicht (3 > 2).
//   n >= 2 offen (Pilot, DDG): auch C ist ein Ziel (alle 3 werden geopfert/zurückgegeben).
//   n = 1 : nur B ist ein Ziel; A und C sind es nicht.
//   Gegenprobe: ein Insasse, der nicht geopfert werden darf („in diesem Zug beschworen"), macht die Zone nicht viable.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student';
const FX = require('path').join(__dirname, '../../../../cards/effects/');
const BIG = H.INERT.big;
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// zonen: Besatzungs-Namen je Zone von Held 0 (Platz 0, 1, 2); `frisch`: Zonen-Platz -> Instanz #k in DIESEM Zug beschworen
async function brett(karte, zonen, frisch = {}) {
  const t = await H.fresh({ hand: [[karte], []], heroes: [[ALICE, 'Rick, the Trigger Happy Undertaker', 'Tushu, the Knowledge Keeper'], null] });
  t.gs.players[0]._aliceShareActive = true;
  t.grantFor(0, 0, karte);   // Stufe/Schulen des Helden (sonst meldet die Wurfzielliste nichts)
  zonen.forEach((namen, z) => namen.forEach((n, k) => {
    let i;
    if (k === 0) i = t.put(0, 0, z, n);
    else { t.gs.players[0].supportZones[0][z].push(n); i = t.engine._trackCard(n, 0, 'support', 0, z); }
    i.turnPlayed = (frisch[z] === k) ? t.gs.turn : 1;
  }));
  t.gs.turn = 5;
  return t;
}
// Alice-Stapel kennt der Zustandsprüfer nicht ("hält N Karten"/"N Instanzen") - nur diese Meldungen sind hier erwartet
const auditOhneStapel = (t) => t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m));
const imZone = (t, z) => t.gs.players[0].supportZones[0][z].slice();
const steht = (t, name, z) => t.inst(c => c.name === name && c.zone === 'support' && c.owner === 0 && c.heroIdx === 0 && c.zoneSlot === z).length === 1;
const ziele = (sc, t) => (typeof sc.getBouncePlacementTargets === 'function' ? (sc.getBouncePlacementTargets(t.gs, 0, t.engine) || []) : []).filter(z => z.heroIdx === 0).map(z => z.slotIdx).sort();
const erlaubt = (sc, t, z) => typeof sc.canPlaceOnOccupiedSlot === 'function' && !!sc.canPlaceOnOccupiedSlot(t.gs, 0, 0, z, t.engine, 0);
// Zusatz-Opfer: erstes wählbares, nicht „ineligible" (die Pflicht-Opfer der Zielzone werden gar nicht gefragt)
function freiOpfer(t) { t.targetFn = (valid) => { const v = valid.find(x => !x.ineligible); return v ? [v.id] : null; }; }

(async () => {
  const R = H.runner();

  // ── Mehr-Opfer-Karten mit fester Opferzahl 2 ──
  for (const name of ['Blue-Ice Dragon', 'Foresta, the Guard']) {
    const sc = require(FX + slug(name) + '.js');
    const B = () => [[BIG, BIG], [BIG], [BIG, BIG, BIG]];
    R.section(`${name} (2 Opfer) - Zonen A=2, B=1, C=3 Karten`);
    { const t = await brett(name, B());
      R.check('Wurfziele: A und B, nicht C', JSON.stringify(ziele(sc, t)) === '[0,1]', ziele(sc, t));
      R.check('canPlaceOnOccupiedSlot: A ja, B ja, C nein', erlaubt(sc, t, 0) && erlaubt(sc, t, 1) && !erlaubt(sc, t, 2));
      R.check('Handkarte spielbar (Bypass für den vollen Helden)', sc.canBypassFreeZoneRequirement(t.gs, 0, 0, null, t.engine) === true); }
    { const t = await brett(name, B()); freiOpfer(t);
      const r = await t.play(0, name, { hero: 0, slot: 2 });
      R.check('Wurf auf C (3 Karten): abgelehnt, nichts geopfert, Karte bleibt auf der Hand',
        r === false && t.pile(0, 'hand').includes(name) && imZone(t, 2).length === 3 && imZone(t, 0).length === 2 && imZone(t, 1).length === 1, { r, z: [0, 1, 2].map(z => imZone(t, z).length) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
    { const t = await brett(name, B()); freiOpfer(t);
      const hp0 = t.hp(0, 0);
      const r = await t.play(0, name, { hero: 0, slot: 0 });
      R.check('Wurf auf A (2 Karten): gespielt, BEIDE geopfert, die Karte steht in A', r === true && steht(t, name, 0) && imZone(t, 0).length === 1, { r, z0: imZone(t, 0) });
      R.check('B und C unberührt (genau 2 Opfer insgesamt)', imZone(t, 1).length === 1 && imZone(t, 2).length === 3, [1, 2].map(z => imZone(t, z).length));
      R.check('Opfer liegen in der Ablage (2x)', t.pile(0, 'discardPile').filter(n => n === BIG).length === 2, t.pile(0, 'discardPile'));
      if (name.startsWith('Foresta')) R.check('Foresta: HP des Helden halbiert', t.hp(0, 0) === Math.floor(hp0 / 2), { hp0, hp: t.hp(0, 0) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
      R.check('Zustand sauber (bis auf die Alice-Stapel)', auditOhneStapel(t).length === 0, auditOhneStapel(t)); }
    { const t = await brett(name, B()); freiOpfer(t);
      const r = await t.play(0, name, { hero: 0, slot: 1 });
      R.check('Wurf auf B (1 Karte): gespielt, der Insasse + ein weiteres Opfer, die Karte steht in B', r === true && steht(t, name, 1) && imZone(t, 1).length === 1, { r, z1: imZone(t, 1) });
      const rest = [0, 1, 2].reduce((n, z) => n + imZone(t, z).length, 0);
      R.check('genau 2 Opfer (6 Dummies -> 4 + die neue Karte)', rest === 5, rest);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
    { const t = await brett(name, [[BIG, BIG], [BIG], [BIG]], { 0: 1 });   // A: zweiter Insasse in diesem Zug beschworen
      R.check('Gegenprobe A enthält eine frische Kreatur (nicht opferbar): A ist kein Ziel, B und C schon', JSON.stringify(ziele(sc, t)) === '[1,2]', ziele(sc, t));
      const r = await t.play(0, name, { hero: 0, slot: 0 });
      R.check('Wurf auf A abgelehnt', r === false && t.pile(0, 'hand').includes(name) && imZone(t, 0).length === 2, { r }); }
  }

  // ── Steam Dwarf Dragon Pilot: 2 oder mehr Opfer (Max-HP >= 300) ──
  { const name = 'Steam Dwarf Dragon Pilot', sc = require(FX + slug(name) + '.js');
    R.section(`${name} (2+ Opfer, Max-HP >= 300) - Zonen A=2, B=1, C=3 Karten`);
    const B = () => [[BIG, BIG], [BIG], [BIG, BIG, BIG]];
    { const t = await brett(name, B());
      R.check('Wurfziele: alle drei Zonen (offene Opferzahl)', JSON.stringify(ziele(sc, t)) === '[0,1,2]', ziele(sc, t)); }
    { const t = await brett(name, B()); freiOpfer(t);
      const r = await t.play(0, name, { hero: 0, slot: 0 });
      R.check('Wurf auf A (2 Karten): gespielt, beide Insassen geopfert, die Karte steht in A', r === true && steht(t, name, 0), { r, z0: imZone(t, 0) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
    { const t = await brett(name, B()); freiOpfer(t);
      const r = await t.play(0, name, { hero: 0, slot: 2 });
      R.check('Wurf auf C (3 Karten): gespielt, alle 3 geopfert, die Karte steht in C', r === true && steht(t, name, 2), { r, z2: imZone(t, 2) });
      R.check('C ist leer geopfert (nur die neue Karte steht dort), Opfer in der Ablage', imZone(t, 2).length === 1 && t.pile(0, 'discardPile').filter(n => n === BIG).length >= 3, { z2: imZone(t, 2), abl: t.pile(0, 'discardPile').length });   // weitere Opfer wären frei wählbar (2 oder mehr)
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
    { const t = await brett(name, B()); freiOpfer(t);
      const r = await t.play(0, name, { hero: 0, slot: 1 });
      R.check('Wurf auf B (1 Karte): gespielt (Insasse + mindestens ein weiteres Opfer), die Karte steht in B', r === true && steht(t, name, 1), { r, z1: imZone(t, 1) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
    { const t = await brett(name, [[BIG, BIG], [BIG], [BIG]], { 0: 1 });
      R.check('Gegenprobe A enthält eine frische Kreatur: A ist kein Ziel', !ziele(sc, t).includes(0) && ziele(sc, t).includes(1), ziele(sc, t)); } }

  // ── Karten mit EINEM Opfer: nur Zonen mit genau einer Karte ──
  const EIN = [
    { n: 'The Egg of God' }, { n: 'Guardian of Teocuilatl' }, { n: 'Archer of Teocuilatl' }, { n: 'Warrior of Teocuilatl' }, { n: 'Suspicious Monster' },
    { n: 'Deepsea Bats', bew: 'Deepsea Zombie' }, { n: 'Gigantisaur King Trex', bew: 'Gigantisaur Ankylos' },
  ];
  for (const k of EIN) {
    const sc = require(FX + slug(k.n) + '.js');
    const b = k.bew || BIG;
    R.section(`${k.n} (1 Opfer) - Zonen A=2, B=1, C=3 Karten`);
    { const t = await brett(k.n, [[b, b], [b], [b, b, b]]);
      R.check('Wurfziele: nur B (Einzelzone)', JSON.stringify(ziele(sc, t)) === '[1]', ziele(sc, t));
      R.check('A und C sind keine Wurfziele', !erlaubt(sc, t, 0) && !erlaubt(sc, t, 2)); }
    { const t = await brett(k.n, [[b, b], [b], [b, b, b]]);
      const r = await t.play(0, k.n, { hero: 0, slot: 0 });
      R.check('Wurf auf A (2 Karten): abgelehnt, nichts geopfert', r === false && t.pile(0, 'hand').includes(k.n) && imZone(t, 0).length === 2 && imZone(t, 2).length === 3, { r }); }
    { const t = await brett(k.n, [[b, b], [b], [b, b, b]]);
      t.targetFn = (valid) => { const w = valid.find(v => v.heroIdx === 0 && v.slotIdx === 1 && v.owner === 0); return [(w || valid[0]).id]; };
      const r = await t.play(0, k.n, { hero: 0, slot: 1 });
      R.check('Wurf auf B (1 Karte): gespielt, die Karte steht in B, A und C unberührt', r === true && steht(t, k.n, 1) && imZone(t, 0).length === 2 && imZone(t, 2).length === 3, { r, z: [0, 1, 2].map(z => imZone(t, z).length) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  }

  // ── Pollution Piranha: 1 Token ──
  { const name = 'Pollution Piranha', TOK = 'Pollution Token', sc = require(FX + 'pollution-piranha.js');
    R.section(`${name} (1 Token) - Token allein = Ziel, Token + zweite Karte = kein Ziel`);
    const t = await brett(name, [[BIG], [BIG], [BIG]]);
    const setze = (z, namen) => { const arr = t.gs.players[0].supportZones[0][z]; for (const i of t.inst(c => c.zone === 'support' && c.heroIdx === 0 && c.zoneSlot === z)) t.engine._untrackCard(i.id); arr.length = 0;
      namen.forEach((n, k) => { arr.push(n); const i = t.engine._trackCard(n, 0, 'support', 0, z); i.turnPlayed = 1; if (n === TOK) i.counters.placedOnTurn = 1; }); };
    setze(0, [TOK, BIG]); setze(1, [TOK]); setze(2, [BIG, BIG]);
    R.check('Wurfziele: nur die Einzelzone mit dem Token', JSON.stringify(ziele(sc, t)) === '[1]', ziele(sc, t));
    const r = await t.play(0, name, { hero: 0, slot: 1 });
    R.check('Wurf auf den einzelnen Token: gespielt, Piranha dort, Token weg', r === true && steht(t, name, 1), { r, z1: imZone(t, 1) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  // ── Dark Deepsea God: 2+ Kreaturen zurückgeben (Summe der Levels >= 4) ──
  { const name = 'Dark Deepsea God', sc = require(FX + 'dark-deepsea-god.js');
    const SUC = 'Deepsea Succubus', ZOM = 'Deepsea Zombie', REA = 'Deepsea Reaper';   // Level 2, 1, 2
    R.section(`${name} (2+ Rückgaben, Level-Summe >= 4) - Zonen A=2 Succubus, B=1 Zombie (frisch), C=2 Reaper`);
    const plan = () => [[SUC, SUC], [ZOM], [REA, REA]];
    { const t = await brett(name, plan(), { 1: 0 });
      R.check('Wurfziele: A und C (B enthält eine frische Kreatur: nicht zurückgebbar)', JSON.stringify(ziele(sc, t)) === '[0,2]', ziele(sc, t));
      R.check('canPlaceOnOccupiedSlot: A ja, B nein', erlaubt(sc, t, 0) && !erlaubt(sc, t, 1)); }
    { const t = await brett(name, plan(), { 1: 0 });
      t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
      t.targetFn = (valid) => { const v = valid.find(x => x.heroIdx === 0 && x.slotIdx === 0 && x.owner === 0); return v ? [v.id] : null; };   // der Stapel A als ein Ziel
      const r = await t.play(0, name, { hero: 0, slot: 0, noGrant: true });
      R.check('Wahl des Stapels A: DDG gespielt und steht in A', r === true && steht(t, name, 0), { r, z0: imZone(t, 0) });
      R.check('beide Succubi sind zurück auf der Hand, C und B unberührt', t.pile(0, 'hand').filter(n => n === SUC).length === 2 && imZone(t, 2).length === 2 && imZone(t, 1).length === 1, { hand: t.pile(0, 'hand'), z: [0, 1, 2].map(z => imZone(t, z).length) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
      R.check('Zustand sauber (bis auf die Alice-Stapel)', auditOhneStapel(t).length === 0, auditOhneStapel(t)); }
    { const t = await brett(name, plan(), { 1: 0 });
      t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
      t.targetFn = (valid) => valid.filter(x => x.heroIdx === 0 && (x.slotIdx === 0 || x.slotIdx === 2) && x.owner === 0).map(x => x.id);   // beide Stapel A und C
      const r = await t.play(0, name, { hero: 0, slot: 2, noGrant: true });
      R.check('Wahl von A und C: DDG gespielt; beide Zonen waren Landeplätze (4 Rückgaben), DDG steht in einer davon', r === true && (steht(t, name, 0) || steht(t, name, 2)), { r });
      R.check('alle 4 Kreaturen auf der Hand', t.pile(0, 'hand').filter(n => n === SUC || n === REA).length === 4, t.pile(0, 'hand'));
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); } }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
