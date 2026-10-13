'use strict';
// R02-04 · Prophecy of Tempeste: „Damage this Hero takes cannot be reduced or negated by other cards or effects" – Reduktionen wirken trotzdem
// Kartentext: „Attach this card to a Hero you control. Once per turn, when another target you control would take damage, you may redirect that damage to this Hero.
//   Damage this Hero would take cannot exceed 100. Damage this Hero takes cannot be reduced or negated by other cards or effects."
// Skriptkopf (prophecy-of-tempeste.js): „`cannotBeNegated: true` … which the engine reads to skip Cloudy / buff multipliers." und „the rule keeps board effects from cancelling the redirect".
// Aufbau: Sitz 0, Held 0 trägt Prophecy of Tempeste. Variante A: Held 0 hat den Buff „cloudy" („Takes half damage from all sources"). Variante B: Held 0 trägt zusätzlich Petrification Break
//   („any damage it would take is halved"). Gegner (Sitz 1) trifft (a) Held 0 direkt mit 300, (b) Held 1 mit 300 (Umleitung auf Held 0, Sitz 0 sagt „ja").
// Erwartet: (a) 100 (Deckel), (b) 100 – die Reduktion (Cloudy / Petrification Break) darf Tempestes Schaden nicht verringern.
// Beobachtet: (a) 50, (b) 50 – Cloudy bzw. Petrification Break halbieren den gedeckelten Betrag.
// Ursache: `actionDealDamage(…, { cannotBeNegated: true })` (prophecy-of-tempeste.js, Umleitung) wird in `_actionDealDamageImpl` (_engine.js ~8045 ff.) nirgends in `hookCtx.cannotBeNegated/cannotBeReduced` übernommen
//   (gelesen wird `opts.cannotBeNegated` nur für `heroSpellWardBlocks`, ~9799); der Deckel am Wirt (`beforeDamage`) setzt ebenfalls keine `cannotBeReduced`-Klammer. Das Heldenpassiv-Gegenstück
//   (`heroDamageCannotBeReducedOrNegated`, `_isHeroDamageUnstoppable`, ~7081) gibt es nur für den HELDEN Tempeste, nicht für die Karte.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const variante of ['A cloudy', 'B Petrification Break']) {
    const t = await H.fresh({ hand: [['Prophecy of Tempeste', 'Petrification Break'], []], hp: 800 });
    t.grantFor(0, 0, 'Prophecy of Tempeste');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(0, 'Prophecy of Tempeste', { hero: 0 });
    if (variante.startsWith('A')) await t.engine.actionAddBuff(t.hero(0, 0), 0, 0, 'cloudy');
    else {
      t.grantFor(0, 0, 'Petrification Break');
      await t.engine.addHeroStatus(0, 0, 'stunned', { duration: 3, appliedBy: 1 });
      await t.play(0, 'Petrification Break', { hero: 0, noGrant: true });
    }
    R.check(`${variante}: Aufbau – Tempeste liegt am Helden 0`, t.gs.players[0].supportZones.flat(2).includes('Prophecy of Tempeste'));
    let hp = t.hp(0, 0);
    await t.engine.actionDealDamage({ name: 'Test', owner: 1 }, t.hero(0, 0), 300, 'normal');
    R.check(`${variante}: (a) direkter Treffer 300 → 100 Schaden`, hp - t.hp(0, 0) === 100, hp - t.hp(0, 0));
    t.policy.confirm = true;
    hp = t.hp(0, 0);
    await t.engine.actionDealDamage({ name: 'Test', owner: 1 }, t.hero(0, 1), 300, 'normal');
    R.check(`${variante}: (b) umgeleiteter Treffer 300 → 100 Schaden am Wirt, Held 1 unversehrt`, hp - t.hp(0, 0) === 100 && t.hp(0, 1) === 800, { wirt: hp - t.hp(0, 0), held1: t.hp(0, 1) });
    R.check(`${variante}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
