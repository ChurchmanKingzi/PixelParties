// H02-heroes-20 · Heragas (negiert) zieht weiterhin 1 Karte pro besiegter Kreatur
//
// Kartentext Heragas: „Whenever this Hero defeats a Creature, draw 1 card."
// Konvention (B-09, `_isHeroEffectSilenced`): ein negierter Held verliert seinen Heldeneffekt (Negation sperrt auch den Heldeneffekt-Knopf: dort ✓).
// Das Skript trägt `bypassStatusFilter: true` (wegen `stampTurnEnd`), und die onCreatureDeath-Reaktion prüft keinen Status.
// Erwartung: negierter Heragas besiegt eine Kreatur per Attack (Lv 0, ohne Fähigkeiten spielbar) und zieht NICHT.
// Beobachtung: er zieht 1 Karte (Deck 20 → 19).
// Aufruf: node docs/niche-tests/repro/H02-heroes/20-heragas-negiert-zieht-weiter.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const HER = 'Heragas, the Monster Slayer';
(async () => {
  const R = H.runner();
  for (const st of [null, 'negated']) {
    const t = await H.fresh({ heroes: [[HER, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Attack'], []] });
    t.put(1, 0, 0, H.INERT.frail);
    if (st) t.heroStatus(0, 0, st);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    const deck0 = t.pile(0, 'mainDeck').length;
    const r = await t.play(0, 'Attack', { hero: 0 });
    const gezogen = deck0 - t.pile(0, 'mainDeck').length;
    R.check(`${st || 'ohne Status'}: Attack besiegt die Kreatur (r=${r})`, r === true && !t.find(H.INERT.frail, 'support'), { r });
    if (st) R.check('negiert: keine Karte gezogen', gezogen === 0, { gezogen });
    else R.check('Kontrolle: Heragas zieht 1 Karte', gezogen === 1, { gezogen });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
