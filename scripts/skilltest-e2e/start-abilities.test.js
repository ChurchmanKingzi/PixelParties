'use strict';
// Pillage ist als Start-Ability gesperrt: Heroes, die sie tragen (Codumbus, Gobbo, Rool, Jean), beginnen im Skill Test ohne sie — im Aufbau,
// im Kampf und in der Bewertung des Bots. Ihre übrige Start-Ability bleibt.
//   node scripts/skilltest-e2e/start-abilities.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { getCardDB } = require('../../cards/effects/_card-db');
const Rules = require('../../public/skilltest-rules.js');
const policy = require('../../skilltest/policy');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const cards = getCardDB();
  const env = { cards, areaLimitOf: () => undefined };
  const names = (ps, hi) => ps.abilityZones[hi].filter(Boolean).map(z => z.n);

  console.log('Aufbau (Rules.installStartAbilities)');
  check('Pillage steht auf der Sperrliste', Rules.NO_START_ABILITIES.includes('Pillage'), Rules.NO_START_ABILITIES);
  const expect = {
    'Gobbo, Chief of Goblin': ['Fighting'],            // Fighting + Pillage
    'Codumbus, the Clueless Voyager': ['Luck'],        // Luck + Pillage
    'Rool, the Troll Guard': ['Wealth'],               // Pillage + Wealth
    'Jean, the Pillaging Knight': [],                  // Pillage + Pillage
  };
  for (const [hero, want] of Object.entries(expect)) {
    const ps = Rules.emptyPlayer();
    Rules.installStartAbilities(env, ps, 0, hero);
    check(`${hero}: Start-Abilities ${JSON.stringify(want)}, kein Pillage`, JSON.stringify(names(ps, 0)) === JSON.stringify(want) && ps.abilityZones[0].every(z => !z || (z.n !== 'Pillage' && z.s === 3)), names(ps, 0));
    const stacks = Rules.abilityStacks(ps)[0].filter(st => st.length);
    check('… die Engine-Stapel enthalten kein Pillage', stacks.every(st => st[0] !== 'Pillage'), stacks);
  }
  check('Einzelne Start-Ability bleibt mittig (Gobbo: Fighting in Zone 1)', (() => { const ps = Rules.emptyPlayer(); Rules.installStartAbilities(env, ps, 0, 'Gobbo, Chief of Goblin'); return ps.abilityZones[0][1] && ps.abilityZones[0][1].n === 'Fighting' && !ps.abilityZones[0][0]; })());
  check('Andere Heroes unverändert (Hero mit zwei verschiedenen Abilities)', (() => {
    const h = Object.values(cards).find(c => c.cardType === 'Hero' && c.startingAbility1 && c.startingAbility2 && c.startingAbility1 !== c.startingAbility2 && !Rules.NO_START_ABILITIES.includes(c.startingAbility1) && !Rules.NO_START_ABILITIES.includes(c.startingAbility2));
    const ps = Rules.emptyPlayer(); Rules.installStartAbilities(env, ps, 0, h.name);
    return names(ps, 0).length === 2;
  })());

  console.log('Kampf');
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 21,
    mutatePrep: (prep) => {
      prep.players[0].heroes[0] = 'Gobbo, Chief of Goblin';
      const ps = prep.players[0];
      ps.abilityZones[0] = [null, null, null];
      Rules.installStartAbilities({ cards, areaLimitOf: () => undefined }, ps, 0, 'Gobbo, Chief of Goblin');
    } });
  console.log = oL; console.error = oE;
  const { gs, engine } = out;
  const hero = gs.players[0].heroes[0];
  check('Gobbo steht auf dem Brett', hero.name === 'Gobbo, Chief of Goblin', hero.name);
  check('seine Ability-Zonen enthalten kein Pillage, aber Fighting auf Stufe 3', gs.players[0].abilityZones[0].every(z => !z.length || z[0] !== 'Pillage') && gs.players[0].abilityZones[0].some(z => z.length === 3 && z[0] === 'Fighting'), gs.players[0].abilityZones[0]);
  check('der Hero trägt Pillage auch nicht als ability1/ability2', hero.ability1 !== 'Pillage' && hero.ability2 !== 'Pillage', [hero.ability1, hero.ability2]);
  check('es gibt keine aktivierbare Pillage-Ability', !(engine.getActivatableAbilities ? (() => { try { gs.activePlayer = 0; return (engine.getActivatableAbilities(0, { ownSideOnly: true }) || []).some(a => a.abilityName === 'Pillage'); } catch { return false; } })() : false));

  console.log('Bewertung des Bots');
  const gobbo = cards['Gobbo, Chief of Goblin'];
  const fighting = Object.values(cards).find(c => (c.cardType === 'Spell' || c.cardType === 'Attack') && c.spellSchool1 === 'Fighting' && c.level > 0 && !c.spellSchool2);
  check('castableInHand zählt Pillage nicht als Schule (nur Fighting)', fighting ? policy.castableInHand(cards, [fighting.name], gobbo) >= 0 : true);

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Start-Ability-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
