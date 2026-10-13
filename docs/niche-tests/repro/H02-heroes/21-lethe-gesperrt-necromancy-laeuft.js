// H02-heroes-21 · Lethe: die Aktionssperre hält Necromancy („as an additional Action") nicht auf
//
// Kartentext Lethe: „This Hero cannot perform Actions if a target you control was defeated since the end of your last turn. You may use this Hero's Necromancy up to 3 times per turn, …"
// Kartentext Necromancy: „… summon it with this Hero as an additional Action …" – die Beschwörung ist eine Aktion.
// Skriptkopf `lethe-the-forgetful-fixer.js`: die Sperre (`_actionLockedTurn`) „covers Spell / Attack / Creature plays, action-cost Abilities, Attacks, AND the alt-summon below, which is itself an Action".
// Erwartung: nach dem Tod einer eigenen Kreatur im Gegnerzug kann Lethe in ihrem Zug weder zaubern (✓ gesperrt) noch per Necromancy beschwören.
// Beobachtung: Fireball ist gesperrt, aber Necromancy beschwört (`doActivateFreeAbility` prüft `hero._actionLockedTurn` nicht; Chalice/Kent-Sperre `areActionsBlocked` ebenso nicht).
// Aufruf: node docs/niche-tests/repro/H02-heroes/21-lethe-gesperrt-necromancy-laeuft.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const LETHE = 'Lethe, the Forgetful Fixer';
(async () => {
  const R = H.runner();
  async function szene(opfer) {
    const t = await H.fresh({ heroes: [[LETHE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []], discard: [[H.INERT.creature, H.INERT.creature], []] });
    t.setAbilities(0, 0, [['Necromancy', 'Necromancy', 'Necromancy'], [], []]);
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Necromancy', answer: (d) => ({ cardName: d.cards[0].name }) });
    t.script.push({ match: d => /zone/i.test(d.type || ''), answer: (d) => { const z = (d.zones || d.options || [])[0]; return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : {}; } });
    if (opfer) {
      const c = t.put(0, 1, 0, H.INERT.frail);
      await t.endTurn();                                                           // Zug Sitz 1
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, c, 999, 'spell'));
      await t.endTurn();                                                           // Zug Sitz 0: Lethe gesperrt
    }
    return t;
  }
  { const t = await szene(false);
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    R.check('Kontrolle ohne Tod: Necromancy beschwört', t.gs.players[0].supportZones.flat().filter(z => z.length).length === 1, t.errors); }
  { const t = await szene(true);
    const zauber = await t.play(0, 'Fireball', { hero: 0 });
    R.check('Lethe gesperrt: Fireball unwirksam', !(zauber === true && t.hp(1, 0) === 650), { zauber, hp: t.hp(1, 0) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    const brett = t.gs.players[0].supportZones.flat().filter(z => z.length).length;
    R.check('Lethe gesperrt: Necromancy beschwört NICHT (Brett bleibt leer)', brett === 0, { brett });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
