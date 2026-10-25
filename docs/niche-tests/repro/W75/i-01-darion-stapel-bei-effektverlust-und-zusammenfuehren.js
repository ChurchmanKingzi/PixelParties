'use strict';
// W75 · Darion — Verliert er seinen Effekt (Frozen/Stunned/Negated), bleibt sein Stapel liegen, neue Equips landen in anderen Zonen; ist der Effekt wieder frei, werden ALLE Equips
// in den groessten (bei Gleichstand aeltesten) Stapel zusammengefuehrt, sichtbar per Flug (Al, 25.10.2026).
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: (1) Stumm: Stapel bleibt, neues Equip in freier Zone (Stapel waechst nicht). (2) Frei: alles im groessten Stapel, ein Flug (`play_card_transfer`) je verschobener Karte, Quellplaetze leer.
//   (3) Gleichstand: der aeltere Stapel gewinnt. (4) Alle drei Stummschaltungen. (5) Kein Zusammenfuehren, solange der Effekt aus ist.
// Aufruf: node docs/niche-tests/repro/W75/i-01-darion-stapel-bei-effektverlust-und-zusammenfuehren.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const zone = (t, s) => JSON.stringify(t.gs.players[0].supportZones[0][s]);
function leg(t, slot, name) {
  const ps = t.gs.players[0];
  ps.supportZones[0][slot].push(name);
  const i = t.engine._trackCard(name, 0, 'support', 0, slot); i.turnPlayed = 1;
  t.engine._stempleStapelNr(i);
  return i;
}
async function szene(hand) { return H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [hand || [F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] }); }
(async () => {
  const R = H.runner();

  for (const status of ['frozen', 'stunned', 'negated']) {
    R.section('Stumm (' + status + '): Stapel bleibt, neue Equips in andere Zonen; danach alles zusammen');
    const t = await szene(['Cute Crown', 'Heart of Ice']);
    leg(t, 1, 'Club of Gobbo'); leg(t, 1, 'Blade of the Frostbringer');
    const hero = t.gs.players[0].heroes[0];
    hero.statuses = { ...(hero.statuses || {}), [status]: { duration: 2 } };
    t.engine.sync(); await t.drain();
    R.check('Stumm: bestehender Stapel liegt unveraendert', zone(t, 1) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer']), zone(t, 1));
    // Ein eingefrorener Held ist nicht ausruestbar (Spielweg gesperrt): dann liegt das Equip per Aufbau in der anderen Zone.
    if (status === 'frozen') leg(t, 0, 'Cute Crown'); else await t.play(0, 'Cute Crown', { hero: 0, slot: 0 });
    await t.drain();
    R.check('Stumm: das neue Equip liegt in einer ANDEREN Zone (Stapel waechst nicht)', zone(t, 0) === JSON.stringify(['Cute Crown']) && zone(t, 1) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer']), [zone(t, 0), zone(t, 1)]);
    const fluege = [];
    const bc0 = t.engine._broadcastEvent.bind(t.engine);
    t.engine._broadcastEvent = (n, d, ...r) => { if (n === 'play_card_transfer') fluege.push(d.cardName + ':' + d.sourceZoneSlot + '>' + d.targetZoneSlot); return bc0(n, d, ...r); };
    delete hero.statuses[status];
    t.engine.sync(); await t.drain();
    R.note('fluege', JSON.stringify(fluege) + ' ' + JSON.stringify(t.gs.players[0].supportZones[0]));
    R.check('Frei: alles im groessten Stapel (Zone 1), Zone 0 leer', zone(t, 1) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown']) && zone(t, 0) === '[]', [zone(t, 0), zone(t, 1)]);
    R.check('sichtbare Bewegung: ein Flug von Zone 0 nach Zone 1', fluege.join() === 'Cute Crown:0>1', fluege);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Gleichstand (je 1 Karte): der aeltere Stapel gewinnt');
  for (const [erst, zweit] of [[0, 2], [2, 0]]) {
    const t = await szene();
    const hero = t.gs.players[0].heroes[0];
    hero.statuses = { frozen: { duration: 2 } };
    leg(t, erst, 'Club of Gobbo'); leg(t, zweit, 'Blade of the Frostbringer');
    t.engine.sync(); await t.drain();
    R.check(`Stumm: nichts bewegt (Zone ${erst} und ${zweit} getrennt)`, zone(t, erst) === JSON.stringify(['Club of Gobbo']) && zone(t, zweit) === JSON.stringify(['Blade of the Frostbringer']));
    delete hero.statuses.frozen; t.engine.sync(); await t.drain();
    R.check(`aelter war Zone ${erst} → dort liegen beide`, zone(t, erst) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer']) && zone(t, zweit) === '[]', [zone(t, erst), zone(t, zweit)]);
  }

  R.section('Drei Zonen, groesster Stapel gewinnt vor dem aelteren');
  {
    const t = await szene();
    const hero = t.gs.players[0].heroes[0];
    hero.statuses = { stunned: { duration: 2 } };
    leg(t, 0, 'Cute Crown');                                       // aelteste Einzelkarte
    leg(t, 2, 'Club of Gobbo'); leg(t, 2, 'Blade of the Frostbringer');   // groesserer, juengerer Stapel
    t.engine.sync(); await t.drain();
    delete hero.statuses.stunned; t.engine.sync(); await t.drain();
    R.check('alles in Zone 2', zone(t, 2) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown']) && zone(t, 0) === '[]', [zone(t, 0), zone(t, 2)]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Effekt bleibt aus → nichts wird zusammengefuehrt; tot → auch nicht');
  {
    const t = await szene();
    const hero = t.gs.players[0].heroes[0];
    hero.statuses = { negated: { duration: 2 } };
    leg(t, 0, 'Club of Gobbo'); leg(t, 1, 'Blade of the Frostbringer');
    t.engine.sync(); await t.drain(); t.engine.sync(); await t.drain();
    R.check('nichts bewegt, solange stumm', zone(t, 0) === JSON.stringify(['Club of Gobbo']) && zone(t, 1) === JSON.stringify(['Blade of the Frostbringer']));
  }
  R.finish();
})();
