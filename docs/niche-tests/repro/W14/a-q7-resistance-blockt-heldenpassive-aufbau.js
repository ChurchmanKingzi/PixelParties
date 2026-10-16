'use strict';
// W14a · Rückfrage 7 (Welle 13 / W13b; M02-11 Resistance) · Al, 16.10.2026: „Ja, die prallen auch ab." —
//   Resistance blockt auch Heldenpassive, die den Träger aufbauen (Max-HP-Gewinn: Styx, Rha'Bi, Maya, Luna Kiai [Kreatur: Helden, die du kontrollierst],
//   Chaorc Pyre Grill Master [alle Helden]). Kreaturen-Passive, die die KREATUR selbst aufbauen (Goff, Wolflesia, Stellin, Clausss …: „it gains 200 HP"),
//   betreffen keinen Helden — Resistance (Held-Ability) ist dafür nicht zuständig und bleibt ohne Wirkung.
// Erwartet: Mit Resistance Lv3 bleibt der Träger bei seinen Max-HP; ohne Resistance (Kontrolle) wächst er. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const RES = (lv) => Array(lv).fill('Resistance');

  R.section('Styx: „Whenever another Hero is defeated … +100 current and max HP"');
  for (const [label, res, soll] of [['Resistance Lv3', true, 800], ['ohne Resistance (Kontrolle)', false, 900]]) {
    const t = await H.fresh({ heroes: [['Styx, the Gate to the Spirit World', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[], []], hp: 800 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    if (res) t.setAbilities(0, 0, [RES(3), [], []]);
    t.policy.confirm = true;
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 1), 9999, 'destruction_spell'));
    R.check(`${label}: Styx hat ${soll} Max-HP`, t.hero(0, 0).maxHp === soll, { maxHp: t.hero(0, 0).maxHp, hp: t.hp(0, 0) });
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('Maya: „Whenever a Creature is placed … +50 current and max HP" auf einen Helden (Maya selbst)');
  for (const [label, res, soll] of [['Resistance Lv3', true, 800], ['ohne Resistance (Kontrolle)', false, 850]]) {
    const t = await H.fresh({ heroes: [['Maya, the Nature Fairy', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[H.INERT.creature], []], hp: 800 });
    if (res) t.setAbilities(0, 0, [RES(3), [], []]);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(0, H.INERT.creature, { hero: 1, slot: 0 });
    R.check(`${label}: Maya hat ${soll} Max-HP`, t.hero(0, 0).maxHp === soll, { maxHp: t.hero(0, 0).maxHp, angeboten: t.targets.length });
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('Luna Kiai: „max HP of Heroes you control are increased by 60 every time they take Burn damage"');
  for (const [label, res, soll] of [['Resistance Lv3', true, 800], ['ohne Resistance (Kontrolle)', false, 860]]) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.put(0, 1, 0, 'Luna Kiai');
    if (res) t.setAbilities(0, 0, [RES(3), [], []]);
    await t.run(() => t.engine.actionDealDamage({ name: 'Burn', owner: 1, heroIdx: 0 }, t.hero(0, 0), 30, 'fire'));
    R.check(`${label}: Brandschaden landet (770 + ${soll === 800 ? 0 : 60})`, t.hp(0, 0) === 770 + (soll === 800 ? 0 : 60), t.hp(0, 0));
    R.check(`${label}: Max-HP ${soll}`, t.hero(0, 0).maxHp === soll, t.hero(0, 0).maxHp);
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('Chaorc Pyre Grill Master: „+80 current and max HP to every Hero" – je Held geprüft (eigener Resistance-Held und fremder)');
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    const chaorc = t.put(0, 0, 0, 'Chaorc Pyre Grill Master'); chaorc.turnPlayed = 1;
    const opfer = t.put(0, 0, 1, H.INERT.creature); opfer.turnPlayed = 1;
    t.setAbilities(0, 0, [RES(3), [], []]);   // eigener Held 0 trägt Resistance
    t.setAbilities(1, 1, [RES(3), [], []]);   // gegnerischer Held 1 auch
    t.gs.currentPhase = 2; t.gs.activePlayer = 0;
    t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Chaorc Pyre Grill Master', answer: () => ({ optionId: 'hp' }) });
    t.policy.confirm = true;
    await t.activateCreature(0, 0, 0);
    const werte = [t.hero(0, 0).maxHp, t.hero(0, 1).maxHp, t.hero(0, 2).maxHp, t.hero(1, 0).maxHp, t.hero(1, 1).maxHp, t.hero(1, 2).maxHp];
    R.check('Resistance-Helden (0/0 und 1/1) bleiben bei 800, die übrigen vier bekommen 880', werte.join() === '800,880,880,880,800,880', werte);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
