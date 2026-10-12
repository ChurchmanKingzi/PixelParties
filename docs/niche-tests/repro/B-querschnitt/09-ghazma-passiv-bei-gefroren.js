'use strict';
// Ghazma, the Worm Feeder (Hero): „Creatures that are defeated are deleted. At the end of every turn, the turn player's deleted Creatures that were not deleted this turn are shuffled back into their
// owner's deck. Then, the turn player draws that many cards (max 2)."
// Konvention (CARD_API/Engine, _engine.js ~3190 „Frozen / Stunned silence hero + ability passives"; `_isHeroEffectSilenced`): ein gefrorener, betäubter, negierter oder toter Held verliert seine Heldeneffekte.
// Erwartung: nur bei arbeitendem Ghazma werden besiegte Kreaturen gelöscht; sonst gehen sie wie gewohnt in die Ablage.
// Beobachtung: bei gefrorenem/betäubtem Ghazma landen besiegte Kreaturen weiterhin im Gelöscht-Stapel (die tote und die negierte Variante sind korrekt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const mode of ['normal', 'dead', 'negated', 'frozen', 'stunned']) {
    const t = await H.fresh({ heroes: [['Ghazma, the Worm Feeder', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'], null] });
    const c = t.put(1, 0, 0, H.INERT.creature);
    if (mode === 'dead') t.hero(0, 0).hp = 0;
    else if (mode !== 'normal') await t.engine.addHeroStatus(0, 0, mode, { duration: 99, appliedBy: 1 });
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 0 }, c));
    const geloescht = t.pile(1, 'deletedPile').includes(H.INERT.creature), abgelegt = t.pile(1, 'discardPile').includes(H.INERT.creature);
    if (mode === 'normal') R.check('normal: besiegte Kreatur wird gelöscht', geloescht && !abgelegt, { geloescht, abgelegt });
    else R.check(`${mode}: Ghazma stumm ⇒ besiegte Kreatur geht in die Ablage`, abgelegt && !geloescht, { geloescht, abgelegt, status: Object.keys(t.hero(0, 0).statuses), hp: t.hp(0, 0) });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
