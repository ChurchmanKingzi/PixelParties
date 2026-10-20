'use strict';
// W20b-2 · Pinta, the Singing Ship: bei voller Aufstellung und Opferkosten gilt die allgemeine Opfer-Zonen-Regel (Al, Welle 19/20)
//
// Kartentext: „… You may once per turn reveal the top card of your Potion Deck and immediately summon it with this Hero as an additional Action, if possible.
//   Shuffle your Potion Deck afterwards. …"
// Allgemeinregel (Al, Welle 19): „Es ist jede Zone ein Ziel, die durch Opfern für die Beschwörung leer wird. Wählt man also eine Zone mit 2 Creatures darin,
//   müssen beide geopfert werden, bei mehr Creatures als benötigten Opfern ist eine Zone nicht viable." W20b (Al: „nicht sicher, was du hier meinst" -> die
//   beschlossene Allgemeinregel auch für Pinta): Pintas Zonenwahl bietet bei voller Aufstellung nur Zonen an, die die geforderten Opfer (Blue-Ice Dragon: 2)
//   ganz leeren können; ALLE Insassen der gewählten Zone werden Pflicht-Opfer; sind keine Zonen viable, beschwört Pinta nicht, das Potion Deck wird trotzdem gemischt.
// Szene: Pinta (Held 0, Starthero) mit Alice-Stapeln: A = 2 Karten, B = 1 Karte, C = 3 Karten; oberste Karte des Potion Decks: Blue-Ice Dragon.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const PINTA = 'Pinta, the Singing Ship', BID = 'Blue-Ice Dragon';
const BIG = H.INERT.big;

async function brett(zonen, frisch = {}) {
  const t = await H.fresh({ heroes: [[PINTA, 'Rick, the Trigger Happy Undertaker', 'Tushu, the Knowledge Keeper'], null], potionDeck: [[BID, 'Healing Potion', 'Healing Potion', 'Healing Potion', 'Healing Potion'], []] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.gs.players[0]._aliceShareActive = true;
  t.grantFor(0, 0, BID);
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
const dragonIn = (t, z) => t.inst(c => c.name === BID && c.zone === 'support' && c.owner === 0 && c.heroIdx === 0 && c.zoneSlot === z).length === 1;
const insgesamt = (t) => [0, 1, 2].reduce((n, z) => n + imZone(t, z).length, 0);
const zonenWahl = (t) => t.prompts.filter(p => p.d.type === 'zonePick');
function skript(t, land) {
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones.find(z => z.slotIdx === land) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  // freies Zusatz-Opfer: bevorzugt aus Zone C (so bleiben die Zonen A/B für die Zonen-Prüfungen unberührt), sonst das erste wählbare
  t.targetFn = (valid) => { const v = valid.find(x => !x.ineligible && x.slotIdx === 2) || valid.find(x => !x.ineligible); return v ? [v.id] : null; };
}

(async () => {
  const R = H.runner();

  R.section('Zonen A=2, B=1, C=3 Karten: viable sind A und B (nicht C)');
  { const t = await brett([[BIG, BIG], [BIG], [BIG, BIG, BIG]]);
    const pinta = require('../../../../cards/effects/pinta-the-singing-ship.js');
    const z = pinta._test.opferZonen(t.engine, 0, 0, 0, BID);
    R.check('opferZonen bietet A und B an, C nicht', JSON.stringify(z.map(e => e.slotIdx)) === '[0,1]', z.map(e => e.slotIdx));
    R.check('A: beide Insassen sind Pflicht-Opfer, B: der eine Insasse', z[0]?.opferInstIds?.length === 2 && z[1]?.opferInstIds?.length === 1, z.map(e => e.opferInstIds));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Wahl A (Stapel aus 2): BEIDE werden geopfert, der Dragon steht in A');
  { const t = await brett([[BIG, BIG], [BIG], [BIG, BIG, BIG]]); skript(t, 0);
    const r = await t.activateHero(0, 0);
    R.check('Zonenwahl bot A und B an', zonenWahl(t).length === 1 && zonenWahl(t)[0].d.zones.map(z => z.slotIdx).join() === '0,1', zonenWahl(t).map(p => p.d.zones.map(z => z.slotIdx)));
    R.check('Dragon steht in A, A hält nur ihn', dragonIn(t, 0) && imZone(t, 0).length === 1, { r, z0: imZone(t, 0) });
    R.check('B und C unberührt (genau 2 Opfer insgesamt)', imZone(t, 1).length === 1 && imZone(t, 2).length === 3 && insgesamt(t) === 5, [0, 1, 2].map(z => imZone(t, z).length));
    R.check('beide Opfer liegen in der Ablage', t.pile(0, 'discardPile').filter(n => n === BIG).length === 2, t.pile(0, 'discardPile'));
    R.check('Potion Deck gemischt/ohne den Dragon oben (Dragon beschworen, 4 Karten übrig)', t.pile(0, 'potionDeck').length === 4 && !t.pile(0, 'potionDeck').includes(BID), t.pile(0, 'potionDeck'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber (bis auf die Alice-Stapel)', auditOhneStapel(t).length === 0, auditOhneStapel(t)); }

  R.section('Wahl B (Einzelzone): der Insasse + ein weiteres Opfer, der Dragon steht in B');
  { const t = await brett([[BIG, BIG], [BIG], [BIG, BIG, BIG]]); skript(t, 1);
    const r = await t.activateHero(0, 0);
    R.check('Dragon steht in B, B hält nur ihn', dragonIn(t, 1) && imZone(t, 1).length === 1, { r, z1: imZone(t, 1) });
    R.check('genau 2 Opfer (6 Karten -> 4 + Dragon = 5 insgesamt)', insgesamt(t) === 5 && t.pile(0, 'discardPile').filter(n => n === BIG).length === 2, { n: insgesamt(t), ablage: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Nur EINE viable Zone (A hält eine frische Kreatur, C hat 3): keine Zonenwahl, Dragon steht in B');
  { const t = await brett([[BIG, BIG], [BIG], [BIG, BIG, BIG]], { 0: 1 }); skript(t, 0);
    const r = await t.activateHero(0, 0);
    R.check('keine Zonenwahl', zonenWahl(t).length === 0, zonenWahl(t).length);
    R.check('Dragon steht in B, A (mit der frischen Kreatur) unberührt', dragonIn(t, 1) && imZone(t, 0).length === 2, { r, z: [0, 1, 2].map(z => imZone(t, z).length) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('KEINE viable Zone (A=3, B=3, C=3): Pinta beschwört nicht, das Potion Deck wird trotzdem gemischt, der Einsatz ist verbraucht');
  { const t = await brett([[BIG, BIG, BIG], [BIG, BIG, BIG], [BIG, BIG, BIG]]); skript(t, 0);
    const vorher = t.pile(0, 'potionDeck').slice();
    const r = await t.activateHero(0, 0);
    R.check('kein Dragon auf dem Brett, nichts geopfert', t.inst(c => c.name === BID && c.zone === 'support').length === 0 && insgesamt(t) === 9 && t.pile(0, 'discardPile').length === 0, { r, n: insgesamt(t) });
    R.check('keine Zonenwahl, kein Opfer-Picker', zonenWahl(t).length === 0 && t.targets.length === 0, { z: zonenWahl(t).length, tg: t.targets.length });
    R.check('Potion Deck noch vollständig (5 Karten, Dragon wieder im Deck)', t.pile(0, 'potionDeck').length === 5 && t.pile(0, 'potionDeck').includes(BID), t.pile(0, 'potionDeck'));
    R.check('Einsatz verbraucht (Engine-HOPT) und Deck gemischt', JSON.stringify(t.pile(0, 'potionDeck')) !== JSON.stringify(vorher) || t.logs.some(l => /shuffle/i.test(JSON.stringify(l))), { vorher, nachher: t.pile(0, 'potionDeck') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Gegenprobe Einzelzonen (je 1 Karte): wie bisher - Zonenwahl A/B/C, Insasse + ein weiteres Opfer');
  { const t = await brett([[BIG], [BIG], [BIG]]); skript(t, 2);
    const r = await t.activateHero(0, 0);
    R.check('Zonenwahl bot alle drei Zonen an', zonenWahl(t).length === 1 && zonenWahl(t)[0].d.zones.length === 3, zonenWahl(t).map(p => p.d.zones.length));
    R.check('Dragon steht in C, genau 2 Opfer', dragonIn(t, 2) && insgesamt(t) === 2, { r, n: insgesamt(t) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
