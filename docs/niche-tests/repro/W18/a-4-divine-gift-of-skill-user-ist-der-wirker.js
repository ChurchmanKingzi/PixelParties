'use strict';
// W18a · Punkt 4 · Al, 19.10.2026 (S01-04): „The user ist der Zauberwirker." — „unless the user has at least Magic Arts 1": die (aktuelle)
//   Magic-Arts-Stufe des Helden, der Divine Gift of Skill WIRKT, entscheidet über die Sperre des gewählten Helden; die Stufe des gewählten Helden zählt nicht.
// Erwartet: Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const GIFT = 'Divine Gift of Skill';
  const wahl1 = (t) => { t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 1).id]; };
  const sauber = (t, w) => R.check(w + ': keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  const lock = (t, hi) => t.engine.isHeroSkillLocked(0, hi);
  const anzeige = (t, hi) => t.hero(0, hi).buffs?.blessed_skill?.locked;

  R.section('Nutzer mit Magic Arts, Gewählter ohne → nicht gesperrt');
  {
    const t = await H.fresh({ hand: [[GIFT], []], abilities: { 0: { 0: [['Magic Arts'], [], []], 1: [['Destruction Magic'], [], []] } } });
    wahl1(t);
    await t.play(0, GIFT, { hero: 0, noGrant: true });
    R.check('Gift gewirkt (4 Bonus-Anhänge auf Held 1)', (t.gs.players[0]._bonusAbilityAttachments || {})[1] === 4, t.gs.players[0]._bonusAbilityAttachments);
    R.check('Held 1 nicht gesperrt', lock(t, 1) === false);
    R.check('Anzeige-Marke (Buff) zeigt „nicht gesperrt"', anzeige(t, 1) === false, anzeige(t, 1));
    // Nutzer verliert Magic Arts (Abilities weg) → Sperre greift
    t.setAbilities(0, 0, [[], [], []]);
    R.check('Nutzer verliert Magic Arts → Held 1 jetzt gesperrt', lock(t, 1) === true);
    t.engine.sync();
    R.check('Anzeige-Marke zieht nach', anzeige(t, 1) === true, anzeige(t, 1));
    sauber(t, 'Nutzer mit MA');
  }
  R.section('Nutzer ohne Magic Arts, Gewählter mit Magic Arts 2 → gesperrt; Nutzer legt Magic Arts an → frei');
  {
    const t = await H.fresh({ hand: [[GIFT], []], abilities: { 0: { 1: [['Magic Arts', 'Magic Arts'], ['Destruction Magic'], []] } } });
    wahl1(t);
    await t.play(0, GIFT, { hero: 0, noGrant: true });
    R.check('Held 1 gesperrt (Nutzer ohne Magic Arts)', lock(t, 1) === true);
    R.check('Anzeige-Marke: gesperrt', anzeige(t, 1) === true, anzeige(t, 1));
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    t.engine.sync();
    R.check('Nutzer legt Magic Arts an → Held 1 frei', lock(t, 1) === false);
    R.check('Anzeige-Marke zieht nach: frei', anzeige(t, 1) === false, anzeige(t, 1));
    R.check('Held 0 (Nutzer) war nie gesperrt', lock(t, 0) === false);
    sauber(t, 'Nutzer ohne MA');
  }
  R.section('Selbstwahl und Zugende');
  {
    const t = await H.fresh({ hand: [[GIFT], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, GIFT, { hero: 0, noGrant: true });
    R.check('Selbstwahl, Nutzer = Gewählter mit Magic Arts 1 → nicht gesperrt', lock(t, 0) === false);
    sauber(t, 'Selbstwahl');
  }
  {
    const t = await H.fresh({ hand: [[GIFT], []] });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, GIFT, { hero: 0, noGrant: true });
    R.check('Selbstwahl, Nutzer ohne Magic Arts → gesperrt', lock(t, 0) === true);
    await t.endTurn(); await t.endTurn();
    R.check('Zug später: Sperre abgelaufen', lock(t, 0) === false);
    sauber(t, 'Selbstwahl ohne MA');
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
