'use strict';
// W21a · Frage 2 aus W20c · Al, 20.10.2026: „Soll der Besitzer eines abgegebenen Helden auch nicht mit Platzier-Karten (‚place‘, z. B. Deepsea-Tausch) in dessen Zonen platzieren dürfen?“
// — „doch“. Klarstellung von Al (wörtlich): „Das ‚doch‘ heißt, dass der ursprüngliche Besitzer bei temporärer (aber nicht bei permanenter!) Kontrolle weiter in diesen Zonen placen darf.“
//
// Regel (`engine.zonenRechtAmHeld`):
//   • Der KONTROLLEUR eines Helden platziert in dessen Zonen wie bisher — Zustand des Helden egal (tot/gefroren/negiert; Rulings Welle 5/11: „place“ braucht keinen aktionsfähigen Helden).
//   • Der BESITZER eines abgegebenen Helden platziert bei TEMPORÄRER Kontrolle (Charme, Styx, Golden Apple, Love Shot — endet zeitlich) weiter, bei DAUERHAFTER (`permaControlBy`,
//     Paraseed Control) nicht mehr.
//   • BESCHWÖREN (nicht „place“) in die Zonen eines abgegebenen Helden darf der Besitzer in keinem der beiden Fälle (nur der aktuelle Kontrolleur; W20c/W21a Frage 4).
//   • Normalspiel unverändert; Helden der Gegenspalte, die niemand übernommen hat, bleiben für Karten, die bewusst auf die gegnerische Seite legen, wie bisher zulässig.
// Geprüft über die zentralen Wege: `actionPlaceCreature` (alle Platzier-Skripte), `summonCreatureWithHooks` mit/ohne `isPlacement` (Cycling Demons & Co.), `getFreeSupportZones` (Zonenwahl),
// die Hand-Platzier-Karten (Deepsea-Tausch: `validateActionPlay`, `getHeroPlayableCards`, `getBouncePlacementTargets`, echter Spielweg `t.play`).
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);
const D = H.INERT.creature;
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
async function uebernehmen(t, v, ctrl, besitzer, hi) {
  if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(ctrl, besitzer, hi);
  else if (v === 'temporaer') t.engine.actionStealHero(ctrl, besitzer, hi);
  await sleep(150);   // Harness-Falle: onTakeControl läuft asynchron nach
}
const steht = (t, seite, hi, z, name = D) => (t.gs.players[seite].supportZones[hi][z] || []).includes(name);

(async () => {
  const R = H.runner();

  // ═══ Teil 1 · actionPlaceCreature (zentraler Platzier-Weg) ═══
  for (const v of ['normal', 'temporaer', 'dauerhaft']) {
    R.section(`Teil 1 (${v}): actionPlaceCreature durch den Besitzer (Sitz 0) in die Zone des Helden 0:0${v === 'normal' ? '' : ', den Sitz 1 kontrolliert'}`);
    const t = await H.fresh({ hand: [[D, D, D], [D]], deckSize: 30, active: 0 });
    await uebernehmen(t, v, 1, 0, 0);
    const erwartet = v !== 'dauerhaft';
    const r = await t.run(() => t.engine.actionPlaceCreature(D, 0, 0, 0, { source: 'hand' }));
    R.check(`${v}: Besitzer platziert → ${erwartet ? 'ja' : 'abgelehnt (dauerhaft abgegeben)'}`, erwartet ? (!!r && steht(t, 0, 0, 0)) : (!r && !steht(t, 0, 0, 0)), [!!r, t.gs.players[0].supportZones[0]]);
    const r2 = await t.run(() => t.engine.actionPlaceCreature(D, 0, 1, 0, { source: 'hand' }));
    R.check(`${v}: derselbe Besitzer platziert beim NICHT abgegebenen Helden 0:1 normal`, !!r2 && steht(t, 0, 1, 0), t.gs.players[0].supportZones[1]);
    if (v !== 'normal') {
      const rk = await t.run(() => t.engine.actionPlaceCreature(D, 1, 0, 1, { source: 'hand', heldSeite: 0 }));
      const inst = t.inst(c => c.zone === 'support' && c.heroIdx === 0 && c.zoneSlot === 1 && c.name === D)[0];
      R.check(`${v}: der Kontrolleur (Sitz 1) platziert in die Zone des übernommenen Helden 0:0 wie bisher`, !!rk && steht(t, 0, 0, 1) && !!inst && (inst.controller ?? inst.owner) === 1, [!!rk, t.gs.players[0].supportZones[0]]);
    }
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Teil 1: Zustand des Helden egal — toter/gefrorener Held, Kontrolle bzw. Besitz zählt');
  {
    // Kontrolleur platziert in die Zone eines toten übernommenen Helden
    const t = await H.fresh({ hand: [[D], [D]], deckSize: 30, active: 1 });
    await uebernehmen(t, 'dauerhaft', 1, 0, 0);
    t.gs.players[0].heroes[0].hp = 0;
    const rk = await t.run(() => t.engine.actionPlaceCreature(D, 1, 0, 0, { source: 'hand', heldSeite: 0 }));
    R.check('Kontrolleur platziert in die Zone eines TOTEN übernommenen Helden → ja', !!rk && steht(t, 0, 0, 0), [!!rk, t.gs.players[0].supportZones[0]]);
    // Besitzer: toter Held, temporär übernommen → ja; dauerhaft → nein
    for (const v of ['temporaer', 'dauerhaft']) {
      const u = await H.fresh({ hand: [[D], []], deckSize: 30, active: 0 });
      await uebernehmen(u, v, 1, 0, 0);
      u.gs.players[0].heroes[0].hp = 0;
      u.heroStatus(0, 0, 'frozen');
      const ro = await u.run(() => u.engine.actionPlaceCreature(D, 0, 0, 0, { source: 'hand' }));
      R.check(`Besitzer, toter+gefrorener Held, ${v} übernommen → ${v === 'temporaer' ? 'ja' : 'nein'}`, v === 'temporaer' ? (!!ro && steht(u, 0, 0, 0)) : (!ro && !steht(u, 0, 0, 0)), [!!ro]);
    }
    // Normalspiel: eigener toter Held → Platzieren wie immer
    const n = await H.fresh({ hand: [[D], []], deckSize: 30, active: 0 });
    n.gs.players[0].heroes[0].hp = 0;
    const rn = await n.run(() => n.engine.actionPlaceCreature(D, 0, 0, 0, { source: 'hand' }));
    R.check('Normalspiel: eigener toter Held → Platzieren ja', !!rn && steht(n, 0, 0, 0), [!!rn]);
  }

  // ═══ Teil 2 · summonCreatureWithHooks: Beschwören nie, Platzieren (isPlacement) temporär ja / dauerhaft nein ═══
  for (const v of ['normal', 'temporaer', 'dauerhaft']) {
    R.section(`Teil 2 (${v}): summonCreatureWithHooks durch den Besitzer — beschwören vs. platzieren (isPlacement)`);
    const t = await H.fresh({ hand: [[D], []], deckSize: 30, active: 0 });
    await uebernehmen(t, v, 1, 0, 0);
    const rb = await t.run(() => t.engine.summonCreatureWithHooks(D, 0, 0, 0, { source: 'Test' }));
    R.check(`${v}: BESCHWÖREN in die eigene Spalte, Held 0:0 → ${v === 'normal' ? 'ja' : 'nein (nur der Kontrolleur)'}`, v === 'normal' ? (!!rb && steht(t, 0, 0, 0)) : (!rb && !steht(t, 0, 0, 0)), [!!rb, t.gs.players[0].supportZones[0]]);
    const rp = await t.run(() => t.engine.summonCreatureWithHooks(D, 0, 0, 1, { source: 'Test', isPlacement: true }));
    R.check(`${v}: PLATZIEREN (isPlacement) → ${v === 'dauerhaft' ? 'nein' : 'ja'}`, v === 'dauerhaft' ? (!rp && !steht(t, 0, 0, 1)) : (!!rp && steht(t, 0, 0, 1)), [!!rp, t.gs.players[0].supportZones[0]]);
    if (v !== 'normal') {
      const rk = await t.run(() => t.engine.summonCreatureWithHooks(D, 0, 0, 2, { source: 'Test', controller: 1 }));
      R.check(`${v}: der Kontrolleur (Sitz 1) beschwört in die Zone des übernommenen Helden → ja, gehört ihm`, !!rk && steht(t, 0, 0, 2) && (rk.inst.controller ?? rk.inst.owner) === 1, [!!rk]);
    }
    R.check(`${v}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ═══ Teil 3 · Zonenwahl getFreeSupportZones ═══
  for (const v of ['normal', 'temporaer', 'dauerhaft']) {
    R.section(`Teil 3 (${v}): getFreeSupportZones (Zonenwahl der Platzier-Effekte)`);
    const t = await H.fresh({ hand: [[], []], deckSize: 30, active: 0 });
    await uebernehmen(t, v, 1, 0, 0);
    const own = t.engine.getFreeSupportZones(0).filter(z => z.heroIdx === 0 && z.slotIdx < 3).length;
    R.check(`${v}: freie Zonen des Helden 0:0 in der Zonenwahl des Besitzers: ${v === 'dauerhaft' ? 'keine' : 'alle drei'}`, own === (v === 'dauerhaft' ? 0 : 3), own);
    R.check(`${v}: die Zonen der Helden 0:1 und 0:2 bleiben (6 Stück)`, t.engine.getFreeSupportZones(0).filter(z => z.heroIdx !== 0 && z.slotIdx < 3).length === 6, null);
    const ctl = t.engine.getFreeSupportZones(1, { nachKontrolle: true }).filter(z => z.owner === 0 && z.heroIdx === 0).length;
    R.check(`${v}: Kontrollsicht des Sitzes 1 (nachKontrolle): Zonen des Helden 0:0 → ${v === 'normal' ? 'keine' : 'alle drei'}`, ctl === (v === 'normal' ? 0 : 3), ctl);
  }

  // ═══ Teil 4 · Deepsea-Tausch (Hand-Platzier-Karte) ═══
  for (const v of ['normal', 'temporaer', 'dauerhaft']) {
    R.section(`Teil 4 (${v}): Deepsea-Tausch des Besitzers auf eine eigene Deepsea Mummy unter dem Helden 0:0${v === 'normal' ? '' : ' (von Sitz 1 kontrolliert)'}`);
    const t = await H.fresh({ hand: [['Deepsea Pirate'], []], deckSize: 30, active: 0 });
    t.put(0, 0, 0, 'Deepsea Mummy');
    for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0;
    await uebernehmen(t, v, 1, 0, 0);
    t.targetFn = (val) => { const e = val.filter(x => !x.ineligible); return e.slice(0, 1).map(x => x.id); };
    const erwartet = v !== 'dauerhaft';
    const ziele = (t.engine.getBouncePlacementTargets(0)['Deepsea Pirate'] || []).filter(z => z.heroIdx === 0 && (z.owner ?? 0) === 0 && z.slotIdx === 0).length;
    R.check(`${v}: der Wurfplatz auf der Mummy wird dem Besitzer ${erwartet ? 'angeboten' : 'NICHT angeboten'}`, ziele === (erwartet ? 1 : 0), ziele);
    const val = t.engine.validateActionPlay(0, 'Deepsea Pirate', 0, 0, ['Creature'], { zoneSlot: 0 });
    R.check(`${v}: validateActionPlay (Platzier-Karte auf Held 0:0) ${erwartet ? 'erlaubt' : 'lehnt ab'}`, erwartet ? !!val : val === null, !!val);
    const own = t.engine.getHeroPlayableCards(0).own[0] || [];
    R.check(`${v}: Spielbarkeitsliste für 0:0 ${erwartet ? 'enthält' : 'enthält nicht'} die Platzier-Karte`, own.includes('Deepsea Pirate') === erwartet, own);
    const r = await t.play(0, 'Deepsea Pirate', { hero: 0, slot: 0, noGrant: true });
    const pirate = t.inst(c => c.name === 'Deepsea Pirate' && c.zone === 'support').length;
    R.check(`${v}: Spielweg → ${erwartet ? 'Pirate steht in der Zone, Mummy auf der Hand' : 'abgelehnt, Pirate bleibt auf der Hand, Mummy bleibt'}`,
      erwartet ? (pirate === 1 && t.pile(0, 'hand').includes('Deepsea Mummy') && !t.pile(0, 'hand').includes('Deepsea Pirate'))
        : (pirate === 0 && t.pile(0, 'hand').includes('Deepsea Pirate') && t.inst(c => c.name === 'Deepsea Mummy' && c.zone === 'support').length === 1), { r, hand: t.pile(0, 'hand') });
    R.check(`${v}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.section('Teil 4: der KONTROLLEUR (Sitz 1) bekommt den Wurfplatz in der Zone des übernommenen Helden 0:0 (eigene Mummy dort) angeboten — wie bisher');
  for (const v of ['temporaer', 'dauerhaft']) {
    const t = await H.fresh({ hand: [[], ['Deepsea Pirate']], deckSize: 30, active: 1 });
    await uebernehmen(t, v, 1, 0, 0);
    const m = t.engine._trackCard('Deepsea Mummy', 0, 'support', 0, 0);
    t.gs.players[0].supportZones[0][0] = ['Deepsea Mummy'];
    m.controller = 1; m.turnPlayed = 0;
    t.engine.markiereSeitenfremd?.(m, 1);
    const ziele = (t.engine.getBouncePlacementTargets(1)['Deepsea Pirate'] || []).filter(z => z.owner === 0 && z.heroIdx === 0 && z.slotIdx === 0).length;
    R.check(`${v}: der Wurfplatz wird dem Kontrolleur angeboten`, ziele === 1, ziele);
    const zOwner = (t.engine.getBouncePlacementTargets(0)['Deepsea Pirate'] || []).length;
    R.check(`${v}: dem Besitzer (Sitz 0, hält die Karte nicht) wird nichts angeboten`, zOwner === 0, zOwner);
    R.check(`${v}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
