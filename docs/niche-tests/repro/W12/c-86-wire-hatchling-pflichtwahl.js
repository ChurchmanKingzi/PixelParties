'use strict';
// W12 / Q86 (C05-09) · Wire Hatchling: die Einsatz-Zielwahl ist PFLICHT (Al: „Sobald er in einer Zone liegt, MUSS man ein Ziel wählen,
//   man kommt da nicht raus.") – Exit 0 = korrekt.
// Kartentext: „When you summon this Creature, choose any target on the board and deal damage to it equal to half its current HP (rounded up)."
// Erwartung: (a) die Zielwahl wird nicht abbrechbar angeboten (`cancellable: false`); (b) ein „Abbruch" (null) bringt die Karte NICHT zurück
//   auf die Hand: die Kreatur bleibt, die Aktion bleibt verbraucht (die Harness kann „null" liefern, der Client kann es bei einer
//   Pflichtwahl nicht); ohne Wahl fizzelt der Effekt (kein Schaden).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {   // (a)+(b) Mensch bricht ab
    const t = await H.fresh({ hand: [['Wire Hatchling', H.INERT.filler], []] });
    let cfgSeen = null;
    t.targetFn = (valid, config) => { cfgSeen = config; return null; };
    const r = await t.play(0, 'Wire Hatchling', { hero: 0 });
    R.check('Spielweg behandelt', r === true, r);
    R.check('(a) Zielwahl nicht abbrechbar angeboten', cfgSeen && cfgSeen.cancellable === false, cfgSeen && cfgSeen.cancellable);
    R.check('(b) Beschwörung nicht zurückgenommen: Hatchling auf dem Brett', !!t.find('Wire Hatchling', 'support'), t.zone(0, 0, 0));
    R.check('(b) Hatchling nicht auf der Hand', !t.pile(0, 'hand').includes('Wire Hatchling'), t.pile(0, 'hand'));
    R.check('(b) Aktion verbraucht', (t.gs.players[0].heroesActedThisTurn || []).length === 1, t.gs.players[0].heroesActedThisTurn);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {   // normal gewählt: halber aktueller Wert, aufgerundet
    const t = await H.fresh({ hand: [['Wire Hatchling'], []] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Wire Hatchling', { hero: 0 });
    R.check('Held 800 HP → 400', t.hp(1, 0) === 400, t.hp(1, 0));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
