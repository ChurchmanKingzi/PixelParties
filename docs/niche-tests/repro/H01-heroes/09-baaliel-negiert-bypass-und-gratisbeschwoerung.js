'use strict';
// H01-heroes-09 · Baaliel NEGIERT: Level-Bypass und Gratis-Beschwörung (ohne Once-per-turn-Stempel) bleiben aktiv
//
// Kartentext: „This Hero can summon "Horned Demon" Creatures regardless of their level. Once per turn, summoning a "Horned Demon"
//   with this Hero counts as an additional Action."
// Konvention: negierte Helden verlieren ihre Effekte (`_isHeroEffectSilenced`, zentrales Tor im Hook-Verteiler); die Hook-Seite von Baaliel
//   (Dämonenzähler, Stempel `onAnyActionResolved`) ruht dann – die ENGINE-gelesenen Verträge `canBypassLevelReqForCard` /
//   `grantsInherentActionForCard` aber nicht.
// Erwartet: negierter Baaliel (ohne Summoning Magic) kann Horned Demon nicht beschwören (wie jeder andere Held ohne Schule).
//   Ausdrücklich NICHT erwartbar: unbegrenzt viele Gratis-Beschwörungen pro Zug.
// Beobachtet: negiert → Horned Demon (Summoning Magic Lv2) wird trotzdem ohne Schule beschworen, und zwar beliebig oft in derselben
//   Aktionsphase, ohne dass eine Aktion verbraucht wird (der Stempel `gs.hoptUsed['baaliel-free-summon:…']` wird vom ruhenden Hook nie
//   gesetzt, `grantsInherentActionForCard` bleibt für immer wahr).
// Ursache: `_engine.js` `cardHasInherentAction` (~43547, prüft nur `hp > 0`) und `heroMeetsLevelReq` (~43819, ruft `canBypassLevelReqForCard`
//   ohne Statusprüfung); `baaliel-the-demon-general.js` `canBypassLevelReqForCard` / `grantsInherentActionForCard` fragen den Status nicht ab.
const H = require('../../lib/h.js');
const BA = 'Baaliel, the Demon General', HD = 'Horned Demon';
(async () => {
  const R = H.runner();
  async function lauf(status, anzahl) {
    const t = await H.fresh({ heroes: [[BA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [Array(anzahl).fill(HD), []] });
    if (status) t.heroStatus(0, 0, status);
    t.resetActions(0);
    const rs = [];
    for (let i = 0; i < anzahl; i++) rs.push(await t.play(0, HD, { hero: 0, noGrant: true, slot: i, keepActions: true }));
    const gesetzt = [0, 1, 2].map(i => t.zone(0, 0, i)).filter(Boolean).length;
    return { t, rs, gesetzt, tu: t.gs.players[0]._actionsPlayedThisTurn };
  }
  R.section('Kontrolle: gesund – 1. Beschwörung gratis, 2. kostet die Aktion, 3. geht nicht mehr');
  const g = await lauf(null, 3);
  R.check('gesund: genau 2 von 3 Horned Demons beschworen', g.gesetzt === 2, [g.rs, g.gesetzt]);

  R.section('Negiert (Level-Bypass): Horned Demon (Summoning Magic Lv2) ohne Schule');
  const n = await lauf('negated', 3);
  R.check('negiert: Level-Bypass darf NICHT mehr gelten (0 Beschwörungen)', n.gesetzt === 0, [n.rs, n.gesetzt]);
  R.check('negiert: höchstens 2 Beschwörungen in der Aktionsphase (nie unbegrenzt)', n.gesetzt <= 2, [n.rs, n.gesetzt]);
  R.check('keine Engine-Fehler', g.t.errors.length === 0 && n.t.errors.length === 0, [g.t.errors, n.t.errors]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
