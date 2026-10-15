'use strict';
// W13a · Q137 (M01-11, Adventurousness) · Al, 15.10.2026: „Nein! Karian ist wegen seines Effekts eine Ausnahme, aber andere Heroes können gar keine
//   Actions durch *irgendwas* konsumieren, wenn sie Frozen/Stunned sind!"
// Erwartet: Ein gefrorener/betäubter (auch verwebter) Held außer Karian kann KEINE Aktion verbrauchen: weder durch Spells/Attacks/Creatures (wie bisher)
//   noch durch eine Ability mit Action-Kosten (Adventurousness) noch durch einen Heldeneffekt mit Action-Kosten (Zi, Champion …) — nicht aktivierbar
//   und nicht in den Aktivierungslisten (ausgegraut). Auch Chilly Dog („but Frozen Heroes still can't perform Actions") ändert das nicht.
//   Ausnahme Karian (`ignoresHaltStatuses`). Freie (nicht Action-kostende) Effekte bleiben unberührt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ZI = 'Timeless King Zi';
  const ST = ['frozen', 'stunned', 'webbed'];

  R.section('(1) Adventurousness (Ability mit Action-Kosten): gesperrt, nicht gelistet; gesund aktivierbar');
  {
    const t = await H.fresh({ gold: 50, abilities: { 0: { 0: [['Adventurousness'], [], []] } } });
    const r = await t.activateAbility(0, 0, 0, { phase: 3 });
    R.check('Kontrolle gesund: aktivierbar, +10 Gold', r === true && t.gs.players[0].gold === 60, { r, gold: t.gs.players[0].gold });
  }
  for (const s of ST) {
    for (const chilly of [false, true]) {
      const t = await H.fresh({ gold: 50, abilities: { 0: { 0: [['Adventurousness'], [], []] } } });
      if (chilly) t.put(0, 1, 0, 'Mischief Militia - Chilly Dog').turnPlayed = 1;
      t.hero(0, 0).statuses[s] = { appliedTurn: 0 };
      t.gs.activePlayer = 0; t.phase(3);
      const gelistet = t.engine.getActivatableAbilities(0).some(a => a.abilityName === 'Adventurousness');
      const r = await t.activateAbility(0, 0, 0, { phase: 3 });
      R.check(`${s}${chilly ? ' + Chilly Dog' : ''}: Adventurousness nicht aktivierbar, kein Gold`, r !== true && t.gs.players[0].gold === 50, { r, gold: t.gs.players[0].gold });
      R.check(`${s}${chilly ? ' + Chilly Dog' : ''}: Adventurousness steht nicht in der Aktivierungsliste (ausgegraut)`, gelistet === false, gelistet);
      R.check(`${s}${chilly ? ' + Chilly Dog' : ''}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }

  R.section('(2) Heldeneffekt mit Action-Kosten (Zi): gesperrt, nicht gelistet; gesund aktivierbar');
  const mk = async () => {
    const t = await H.fresh({ heroes: [[ZI, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []], deck: [['Haste', 'Heal', 'Fireball', ...Array(12).fill(H.INERT.filler)], Array(10).fill(H.INERT.filler)] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === ZI, answer: () => ({ selectedCards: ['Haste', 'Heal', 'Fireball'] }), once: true });
    t.script.push({ match: d => d.type === 'birthdayPresentPick', answer: () => ({ cardName: 'Haste' }), once: true });
    return t;
  };
  {
    const t = await mk();
    const r = await t.activateHero(0, 0, { effect: ZI, phase: 3 });
    R.check('Kontrolle gesund: Zi aktivierbar', r === true && t.lg('timeless_king_zi_perform').length === 1, { r });
  }
  for (const s of ST) {
    for (const chilly of [false, true]) {
      const t = await mk();
      if (chilly) t.put(0, 1, 0, 'Mischief Militia - Chilly Dog').turnPlayed = 1;
      t.hero(0, 0).statuses[s] = { appliedTurn: 0 };
      t.gs.activePlayer = 0; t.phase(3);
      const gelistet = t.engine.getActiveHeroEffects(0, { onlyActionCost: true }).length;
      const r = await t.activateHero(0, 0, { effect: ZI, phase: 3 });
      R.check(`${s}${chilly ? ' + Chilly Dog' : ''}: Zi nicht aktivierbar (kein Aktionsverbrauch)`, r !== true && t.lg('timeless_king_zi_perform').length === 0 && !t.gs.hoptUsed?.[`hero-effect:${ZI}:0`], { r, hopt: t.gs.hoptUsed });
      R.check(`${s}${chilly ? ' + Chilly Dog' : ''}: Zi steht nicht in der Liste der Action-kostenden Heldeneffekte`, gelistet === 0, gelistet);
      R.check(`${s}${chilly ? ' + Chilly Dog' : ''}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }

  R.section('(3) Ausnahme Karian: gefroren/betäubt gesetzt – kann trotzdem Aktionen verbrauchen (Adventurousness)');
  for (const s of ['frozen', 'stunned']) {
    const t = await H.fresh({ heroes: [['Grand Inquisitor Karian', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], gold: 50, abilities: { 0: { 0: [['Adventurousness'], [], []] } } });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.hero(0, 0).statuses[s] = { appliedTurn: 0 };   // direkt geschrieben (das Karian-Skript legt sie über `addHeroStatus` gar nicht erst an)
    const r = await t.activateAbility(0, 0, 0, { phase: 3 });
    R.check(`Karian ${s}: Adventurousness bleibt nutzbar (+10 Gold)`, r === true && t.gs.players[0].gold === 60, { r, gold: t.gs.players[0].gold });
    R.check(`Karian ${s}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
