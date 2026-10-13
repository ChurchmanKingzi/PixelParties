'use strict';
// A07-30 · Lizbeth: das geliehene Fighting zählt auch von gefrorenen/betäubten Gegnerhelden
//
// Kartentext Lizbeth: „During your turn, this Hero may use the Abilities of all Heroes your opponent controls — both active effects
//   and passive benefits — as if they were attached to it. … For Fighting, only the highest-level opponent Fighting contributes ATK,
//   replacing this Hero's own Fighting ATK if greater."
// Konvention im selben Skript (lizbeth-the-reaper-of-the-light.js `maxOpponentAbilityLevel`): „capable hosts only — dead / frozen /
//   stunned / negated opponents contribute nothing"; dieselbe Lage über `heroMeetsLevelReq` (Schulstufe) zählt einen gefrorenen
//   Gegnerhelden nicht (gemessen, Szene C).
// Beobachtet: `recomputeFighting` (Zeile ~140-170) filtert nur auf `hp > 0` (über `fightingTotalForHero`), nicht auf Frost/Betäubung (negiert hält nicht bis in Lizbeths Zug, deshalb hier nicht geprüft)
//   ⇒ Lizbeth bekommt +40 ATK von einem eingefrorenen Gegnerhelden; wird der Gegner erst MITTEN im Zug eingefroren, bleibt der Bonus
//   bis zum Zugwechsel stehen (neu berechnet wird nur an Zuggrenzen und beim Tod).
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const LIZ = 'Lizbeth, the Reaper of the Light';
  let lebt = null;
  async function szene(zustand, mitten) {
    const t = await H.fresh({ heroes: [[LIZ, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], deckSize: 20,
      abilities: { 1: { 0: [['Fighting', 'Fighting', 'Fighting'], [], []] } } });
    // Fighting-Stapel des Gegners wie im echten Spiel: +10/+10/+20 ATK je Kopie
    t.inst(c => c.zone === 'ability' && c.name === 'Fighting' && c.owner === 1).forEach((c, i) => { c.counters.atkGranted = [10, 10, 20][i]; });
    const setze = async () => { if (zustand) await t.engine.addHeroStatus(1, 0, zustand, { duration: 4, appliedBy: 0 }); };
    if (!mitten) await setze();   // mehrzügig (duration 4), damit der Status Lizbeths Zug erreicht
    await t.endTurn();   // Gegnerzug
    await t.endTurn();   // Lizbeths Zug
    if (mitten) await setze();
    if (zustand && !mitten) lebt = !!t.hero(1, 0).statuses[zustand];
    return t.hero(0, 0).atk;
  }
  R.check('Kontrolle: arbeitender Gegnerheld ⇒ +40 ATK (140)', await szene(null, false) === 140);
  for (const z of ['frozen', 'stunned']) {
    const atk = await szene(z, false);
    R.check(`(Aufbau) Status ${z} steht noch in Lizbeths Zug`, lebt === true, { lebt });
    R.check(`Gegnerheld ${z} (vor Lizbeths Zug) ⇒ kein geliehenes Fighting (ATK 100)`, atk === 100, { atk });
  }
  const atkMitten = await szene('frozen', true);
  R.check('Gegnerheld wird MITTEN in Lizbeths Zug eingefroren ⇒ Bonus entfällt (ATK 100)', atkMitten === 100, { atk: atkMitten });
  R.finish();
})();
