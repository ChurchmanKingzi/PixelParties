'use strict';
// W20b-1 · Dark Deepsea God: der Tribut darf EINZELNE Kreaturen aus einer Zone mit mehreren Kreaturen (Alice-Stapel) zurückgeben (Al, 20.10.2026)
//
// Frage an Al (W19-Rückfrage 6): „Darf der Spieler auch nur eine von zwei Kreaturen eines Alice-Stapels als Tribut zurückgeben? Die Zone wäre dann kein
//   Landeplatz." - Al: „ja, auch einzelne aus einer Zone sollten möglich sein."
// Kartentext: „You can only play this Creature by returning 2 or more Creatures (not summoned this turn) with combined Levels of 4 or more to your hand."
// Regel bleibt (W19a): eine Zone ist erst dann ein gültiger Landeplatz, wenn ALLE ihre Insassen zurückgegeben werden; Level-Summe >= 4 und >= 2 Rückgaben
//   bleiben Bedingungen.
//
// Umsetzung: Zonen-Picker wie bisher (der Client klickt Zonen); wird eine Zone mit mehreren Kreaturen gewählt, kommt eine Folgewahl:
//   „alle zurückgeben?" (Ja = alle) / Nein -> je eine Kreatur über `instancePick` (HP/Status sichtbar), bis nichts mehr gewünscht ist.
// Szene: Held 0 (Alice teilt), je Abschnitt eigene Belegung der Zonen A/B/C aus Deepsea Succubus (Lv 2), Reaper (Lv 2), Zombie (Lv 1).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student';
const SUC = 'Deepsea Succubus', REA = 'Deepsea Reaper', ZOM = 'Deepsea Zombie';   // Level 2, 2, 1
const DDG = 'Dark Deepsea God';

async function brett(zonen, frisch = {}) {
  const t = await H.fresh({ hand: [[DDG], []], heroes: [[ALICE, 'Rick, the Trigger Happy Undertaker', 'Tushu, the Knowledge Keeper'], null] });
  t.gs.players[0]._aliceShareActive = true;
  t.grantFor(0, 0, DDG);
  zonen.forEach((namen, z) => namen.forEach((n, k) => {
    let i;
    if (k === 0) i = t.put(0, 0, z, n);
    else { t.gs.players[0].supportZones[0][z].push(n); i = t.engine._trackCard(n, 0, 'support', 0, z); }
    i.turnPlayed = (frisch[z] === k) ? t.gs.turn : 1;
  }));
  t.gs.turn = 5;
  return t;
}
const auditOhneStapel = (t) => t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m));
const imZone = (t, z) => t.gs.players[0].supportZones[0][z].slice();
const steht = (t, z) => t.inst(c => c.name === DDG && c.zone === 'support' && c.owner === 0 && c.heroIdx === 0 && c.zoneSlot === z).length === 1;
const handN = (t, n) => t.pile(0, 'hand').filter(x => x === n).length;
const zonenWahl = (t) => t.prompts.filter(p => p.d.type === 'zonePick');
// Skript: Zonen anklicken (Held 0), Tribut-Folgewahl: `allesZurueck` = Antwort auf „alle zurückgeben?", `einzeln` = Reihenfolge der Instanz-Positionen je instancePick,
// `mehr` = Antworten auf „noch eine?"
function wahl(t, { zonen, allesZurueck = true, einzeln = [], mehr = [], land = 0 }) {
  t.targetFn = (valid) => valid.filter(x => x.heroIdx === 0 && zonen.includes(x.slotIdx) && x.owner === 0).map(x => x.id);
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones.find(z => z.slotIdx === land) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  t.script.push({ match: d => d.type === 'confirm' && /Return all of them/.test(d.message || ''), answer: () => (allesZurueck ? { confirmed: true } : null) });
  t.script.push({ match: d => d.type === 'instancePick', answer: (d) => ({ instId: d.instances[Math.min(einzeln.shift() ?? 0, d.instances.length - 1)].instId }) });
  t.script.push({ match: d => d.type === 'confirm' && /another Creature/.test(d.message || ''), answer: () => ((mehr.shift() ?? false) ? { confirmed: true } : null) });
}

(async () => {
  const R = H.runner();

  R.section('Gegenprobe: Einzelzonen unverändert (A = 1 Succubus, B = 1 Reaper)');
  { const t = await brett([[SUC], [REA], []]);
    wahl(t, { zonen: [0, 1], land: 1 });
    const r = await t.play(0, DDG, { hero: 0, slot: 0, noGrant: true });
    R.check('gespielt, DDG steht in B, beide Kreaturen auf der Hand', r === true && steht(t, 1) && handN(t, SUC) === 1 && handN(t, REA) === 1, { r, hand: t.pile(0, 'hand') });
    R.check('keine Folgewahl für Einzelzonen', t.prompts.filter(p => p.d.type === 'instancePick' || (p.d.type === 'confirm' && /Return all/.test(p.d.message || ''))).length === 0);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Stapel A (2 Succubi) + Einzelzone B (Reaper): nur EIN Succubus zurück');
  { const t = await brett([[SUC, SUC], [REA], []]);
    wahl(t, { zonen: [0, 1], allesZurueck: false, einzeln: [0], land: 1 });
    const r = await t.play(0, DDG, { hero: 0, slot: 0, noGrant: true });
    R.check('gespielt (Level 2 + 2 = 4, 2 Rückgaben), DDG steht in B', r === true && steht(t, 1), { r, z: [0, 1].map(z => imZone(t, z)) });
    R.check('ein Succubus + der Reaper auf der Hand', handN(t, SUC) === 1 && handN(t, REA) === 1, t.pile(0, 'hand'));
    R.check('Zone A bleibt belegt (ein Succubus) und ist kein Landeplatz', imZone(t, 0).length === 1 && imZone(t, 0)[0] === SUC && t.inst(c => c.zone === 'support' && c.heroIdx === 0 && c.zoneSlot === 0).length === 1, imZone(t, 0));
    const zp = zonenWahl(t);
    R.check('Landeplatz-Wahl bietet nur B an (A ist kein Landeplatz)', zp.every(p => p.d.zones.length === 1 && p.d.zones[0].slotIdx === 1), zp.map(p => p.d.zones));
    R.check('genau eine Instanzwahl (keine doppelte „welche Kopie?"-Rückfrage der Engine)', t.prompts.filter(p => p.d.type === 'instancePick').length === 1, t.prompts.filter(p => p.d.type === 'instancePick').length);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber (bis auf die Alice-Stapel)', auditOhneStapel(t).length === 0, auditOhneStapel(t)); }

  R.section('Stapel A (2 Succubi): beide zurück -> A ist Landeplatz');
  { const t = await brett([[SUC, SUC], [REA], []]);
    wahl(t, { zonen: [0], allesZurueck: true, land: 0 });
    const r = await t.play(0, DDG, { hero: 0, slot: 0, noGrant: true });
    R.check('gespielt, DDG steht in A, beide Succubi auf der Hand, B unberührt', r === true && steht(t, 0) && handN(t, SUC) === 2 && imZone(t, 1).length === 1, { r, hand: t.pile(0, 'hand'), z: [0, 1].map(z => imZone(t, z)) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Stapel A (2 Succubi): einzeln, ABER beide nacheinander gewählt wäre „alle" (Stapel aus 3: 2 von 3)');
  { const t = await brett([[SUC, SUC, SUC], [REA], []]);
    wahl(t, { zonen: [0, 1], allesZurueck: false, einzeln: [0, 0], mehr: [true], land: 1 });
    const r = await t.play(0, DDG, { hero: 0, slot: 0, noGrant: true });
    R.check('gespielt, DDG steht in B; zwei von drei Succubi + Reaper auf der Hand', r === true && steht(t, 1) && handN(t, SUC) === 2 && handN(t, REA) === 1, { r, hand: t.pile(0, 'hand') });
    R.check('Zone A hält noch genau einen Succubus', imZone(t, 0).length === 1 && t.inst(c => c.zone === 'support' && c.heroIdx === 0 && c.zoneSlot === 0).length === 1, imZone(t, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber (bis auf die Alice-Stapel)', auditOhneStapel(t).length === 0, auditOhneStapel(t)); }

  R.section('Bedingungen bleiben: Teilmenge verfehlt Level 4 (1 Succubus + 1 Zombie = 3) -> nicht bezahlt');
  { const t = await brett([[SUC, SUC], [ZOM], []]);
    wahl(t, { zonen: [0, 1], allesZurueck: false, einzeln: [0], land: 1 });
    const r = await t.play(0, DDG, { hero: 0, slot: 0, noGrant: true });
    R.check('DDG nicht gespielt, nichts zurückgegeben, Karte auf der Hand', !steht(t, 1) && handN(t, SUC) === 0 && handN(t, ZOM) === 0 && t.pile(0, 'hand').includes(DDG) && imZone(t, 0).length === 2, { r, hand: t.pile(0, 'hand'), z: [0, 1].map(z => imZone(t, z)) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Bedingungen bleiben: Level 4 erreicht, aber KEINE Zone vollständig zurückgegeben (je 1 von 2 aus A und C) -> nicht bezahlt');
  { const t = await brett([[SUC, SUC], [], [REA, REA]]);
    wahl(t, { zonen: [0, 2], allesZurueck: false, einzeln: [0, 0], land: 0 });
    const r = await t.play(0, DDG, { hero: 0, slot: 0, noGrant: true });
    R.check('DDG nicht gespielt, nichts zurückgegeben', !steht(t, 0) && !steht(t, 2) && handN(t, SUC) === 0 && handN(t, REA) === 0 && imZone(t, 0).length === 2 && imZone(t, 2).length === 2, { r, hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Bedingungen bleiben: nur 1 Rückgabe (Teilmenge aus einem einzelnen Stapel) -> nicht bezahlt');
  { const t = await brett([[SUC, SUC], [], []]);
    wahl(t, { zonen: [0], allesZurueck: false, einzeln: [0], land: 0 });
    const r = await t.play(0, DDG, { hero: 0, slot: 0, noGrant: true });
    R.check('DDG nicht gespielt, nichts zurückgegeben', !steht(t, 0) && handN(t, SUC) === 0 && imZone(t, 0).length === 2, { r, hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
