'use strict';
// M02-08 · Toughness: HP-Bonus wird bei negiertem / gefrorenem / betäubtem Helden weder vergeben noch zurückgenommen
// Kartentext Toughness: „The Hero's current and max HP are increased by 100/200/400. This Ability cannot be negated."
// Erwartung: (a) Wird Toughness an einen Helden gelegt, steigen HP und Max-HP – auch wenn der Held gerade negiert ist („cannot be negated").
//   (b) Verlässt eine Toughness-Kopie den Helden, wird ihr Bonus wieder abgezogen – in JEDEM Heldenzustand (sonst bleibt der Bonus dauerhaft stehen, obwohl die Karte weg ist).
// Beobachtet: `runHooks` filtert die Hooks von Abilities negierter/gefrorener/betäubter Helden heraus (_engine.js ~3191); Toughness trägt kein `bypassStatusFilter`
//   (Resistance hat es, resistance.js:30). Folge: `onPlay` (Bonus) und `onCardLeaveZone` (Rücknahme) feuern dann nicht.
//   (a) Anlegen an negierten/gefrorenen/betäubten Helden: kein Bonus (800 statt 900). (b) Abwurf der obersten Kopie bei solchem Helden: Max-HP/HP bleiben auf 1000
//   (die Rücknahme fehlt) – der Bonus einer nicht mehr vorhandenen Karte bleibt dauerhaft. Gleiches gilt für Fighting (ATK 50 → bleibt 50 statt 40).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  R.section('(a) Anlegen');
  for (const st of [null, 'negated', 'frozen', 'stunned']) {
    const t = await H.fresh({ hand: [['Toughness'], []], hp: 800 });
    if (st) t.heroStatus(0, 0, st);
    const h = t.hero(0, 0);
    const r = await t.play(0, 'Toughness', { hero: 0, zoneSlot: 0 });
    R.check(`Toughness angelegt an Held (${st}) → Max-HP 900`, r === true && h.maxHp === 900 && h.hp === 900, { r, maxHp: h.maxHp, hp: h.hp });
  }
  R.section('(b) Abwurf der obersten Kopie');
  for (const ab of ['Toughness', 'Fighting']) {
    for (const st of [null, 'negated', 'frozen', 'stunned']) {
      const t = await H.fresh({ hand: [[], []], hp: 800 });
      t.setAbilities(1, 0, [[ab, ab], [], []]);
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      const h = t.hero(1, 0);
      const vorher = ab === 'Toughness' ? h.maxHp : h.atk;
      if (st) t.heroStatus(1, 0, st);
      const e = t.engine.getAbilityTargets(1, { heroIdx: 0 }).find(x => x.cardName === ab);
      await t.run(() => t.engine.discardAbilityTopCopy(e));
      const nachher = ab === 'Toughness' ? h.maxHp : h.atk;
      const erwartet = ab === 'Toughness' ? vorher - 100 : vorher - 10;
      R.check(`${ab}: oberste Kopie abgeworfen bei Held (${st}) → ${ab === 'Toughness' ? 'Max-HP' : 'ATK'} ${erwartet}`, nachher === erwartet, { vorher, nachher });
    }
  }
  R.finish();
})();
