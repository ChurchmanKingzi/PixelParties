'use strict';
// H04-20 · Xal: Abilities in Support Zones verbrauchen den Zusatzplatz von Divine Gift of Skill nicht  [Stufe B]
//
// Kartentext Divine Gift of Skill: „You can attach up to 4 additional Abilities to that Hero this turn."  (Xal: „You may place Abilities into the Support Zones of this Hero.")
// Erwartung: Jede zusätzlich angelegte Ability (egal ob in eine Ability Zone oder eine Support Zone von Xal) kostet einen Zusatzplatz (`ps._bonusAbilityAttachments[hi]--`).
//   Mit genau 1 Zusatzplatz und bereits verbrauchtem Standardplatz darf Xal in diesem Zug genau EINE weitere Ability bekommen.
// Beobachtet: Der Support-Zweig von `doPlayAbility` (server.js ~Z. 7222–7262 und der Rest-Zweig ~Z. 7278) setzt `abilityGivenThisTurn[hi] = true` direkt,
//   ohne `engine.verbraucheAbilityAnlegen` (Zähler-Abzug + Blessed-Buff). Der Zusatzplatz bleibt stehen – Xal bekommt drei Abilities in die Support Zones
//   (jede weitere Ability-Zone-Ablage verbraucht dann nochmal), also bis zu 3 Anlagen mit 1 Zusatzplatz.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const XAL = 'Xal, the Animated Armor';
  const abil = ['Fighting', 'Leadership', 'Wisdom', 'Training'];
  const t = await H.fresh({ heroes: [[XAL, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [abil.slice(), []], deckSize: 20 });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  const ps = t.gs.players[0];
  t.setAbilities(0, 0, [[], [], []]);
  ps.abilityGivenThisTurn = [true, false, false];   // Standardplatz verbraucht
  ps._bonusAbilityAttachments = { 0: 1 };           // genau ein Zusatzplatz (Divine Gift of Skill)
  t.gs.activePlayer = 0; t.gs.currentPhase = 2;
  let ok = 0;
  for (let i = 0; i < 3; i++) {
    const hi = ps.hand.indexOf(abil[i]);
    const r = await t.run(() => t.host.doPlayAbility(t.room, 0, { cardName: abil[i], handIndex: hi, heroIdx: 0, zoneSlot: i, supportSlot: i }));
    if (r === true) ok++;
  }
  R.check('mit 1 Zusatzplatz genau 1 weitere Ability in die Support Zones', ok === 1, { angelegt: ok, bonusRest: ps._bonusAbilityAttachments[0], support: ps.supportZones[0] });
  R.check('Zusatzplatz verbraucht', (ps._bonusAbilityAttachments?.[0] || 0) === 0, ps._bonusAbilityAttachments);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
