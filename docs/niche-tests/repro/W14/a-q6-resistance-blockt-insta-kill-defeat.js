'use strict';
// W14a · Rückfrage 6 (Welle 13 / W13b; M02-11 Resistance) · Al, 16.10.2026: „Ja, die prallen ab!" —
//   Insta-Kill-„Defeat"-Effekte ohne Schaden (Midnight Assault, Decapitating Strike, `actionDefeatHero` ohne Schaden) werden von Resistance geblockt.
//   Der Opfer-Defeat als Kostenpunkt (Divine Gift of Sacrifice, Pharaoh, Teocuilatl, HP-Kosten Foresta) ist KEIN Effekt gegen den Helden: keine Blockade.
// Erwartet: Resistance (Lv3 bzw. Lv1 erster Effekt) lässt den Helden überleben; ohne Resistance stirbt er; Opfer/Kosten gehen auch gegen Resistance durch. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const RES = (lv) => Array(lv).fill('Resistance');
  const lebt = (t, seat, hi) => t.hero(seat, hi).hp > 0;
  const quelle = { name: 'Test Source', owner: 0, controller: 0, heroIdx: 0 };

  R.section('actionDefeatHero ohne Schaden (generischer Insta-Kill)');
  for (const [label, lv, soll] of [['Resistance Lv3', 3, true], ['ohne Resistance (Kontrolle)', 0, false]]) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    if (lv) t.setAbilities(1, 0, [RES(lv), [], []]);
    const r = await t.run(() => t.engine.actionDefeatHero(quelle, t.hero(1, 0), { reason: 'Test' }));
    R.check(`${label}: Held ${soll ? 'überlebt (Defeat prallt ab)' : 'wird besiegt'}`, lebt(t, 1, 0) === soll, { hp: t.hp(1, 0), r });
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(1, 0, [RES(1), [], []]);
    await t.run(() => t.engine.actionDefeatHero(quelle, t.hero(1, 0), { reason: 'Test' }));
    const nach1 = lebt(t, 1, 0);
    await t.run(() => t.engine.actionDefeatHero(quelle, t.hero(1, 0), { reason: 'Test' }));
    R.check('Lv1: erster Defeat geblockt, zweiter im selben Zug wirkt', nach1 && !lebt(t, 1, 0), { nach1, nach2: lebt(t, 1, 0) });
  }

  R.section('Midnight Assault (Attack, „unaufhaltsam") auf einen Helden mit 100 HP');
  for (const [label, lv, soll] of [['Resistance Lv3', 3, true], ['ohne Resistance (Kontrolle)', 0, false]]) {
    const t = await H.fresh({ hand: [['Midnight Assault'], []], hp: 800 });
    t.hero(1, 0).hp = 100;
    if (lv) t.setAbilities(1, 0, [RES(lv), [], []]);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Midnight Assault', { hero: 0 });
    R.check(`${label}: Midnight Assault gespielt, Held ${soll ? 'überlebt' : 'wird besiegt'}`, r === true && lebt(t, 1, 0) === soll, { r, hp: t.hp(1, 0) });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Decapitating Strike (Reaktion: Ziel bei ≤ 50 HP nach Schaden) auf einen Resistance-Helden');
  // Die Reaktion gehört dem Besitzer des getroffenen Helden (Sitz 1; der Gegner-Pass wird CPUs nie angeboten); Wirker: Sitz-1-Held 1 mit Fighting Lv1.
  for (const [label, lv, soll] of [['Resistance Lv3', 3, true], ['ohne Resistance (Kontrolle)', 0, false]]) {
    const t = await H.fresh({ hand: [[], ['Decapitating Strike']], hp: 800, abilities: { 1: { 1: [['Fighting'], [], []] } } });
    t.hero(1, 0).hp = 90;
    if (lv) t.setAbilities(1, 0, [RES(lv), [], []]);
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0 }, t.hero(1, 0), 60, 'destruction_spell'));
    const angeboten = t.prompts.some(p => p.d.title === 'Decapitating Strike');
    R.check(`${label}: Decapitating Strike wurde angeboten (Aufbau trägt)`, angeboten, t.prompts.map(p => p.d.title));
    R.check(`${label}: Held ${soll ? 'lebt (Defeat prallt ab, 30 HP)' : 'wird besiegt'}`, lebt(t, 1, 0) === soll, { hp: t.hp(1, 0) });
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('Opfer / HP-Kosten sind KEIN Effekt gegen den Helden — keine Blockade');
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(0, 0, [RES(3), [], []]);
    await t.run(() => t.engine.actionDefeatHero({ name: 'Divine Gift of Sacrifice', owner: 0 }, t.hero(0, 0), { reason: 'Divine Gift of Sacrifice', respectFirstTurnProtection: false, isSacrifice: true }));
    R.check('freiwilliges Opfer des eigenen Resistance-Helden (isSacrifice) gelingt', !lebt(t, 0, 0), t.hp(0, 0));
  }
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(0, 0, [RES(3), [], []]);
    await t.run(() => t.engine.actionDefeatHero({ name: 'Foresta', owner: 0, heroIdx: 0 }, t.hero(0, 0), { reason: 'Foresta', isSacrifice: true, hpKosten: true, respectFirstTurnProtection: false }));
    R.check('HP-Kosten-Tod (Foresta-Form) gelingt gegen Resistance', !lebt(t, 0, 0), t.hp(0, 0));
  }
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(0, 0, [RES(3), [], []]);
    await t.run(() => t.engine.actionDefeatHero(null, t.hero(0, 0), { reason: 'descend', respectFirstTurnProtection: false }));
    R.check('Buchführungs-Tod (Waflav-Abstieg, Puppet ohne Token) gelingt gegen Resistance', !lebt(t, 0, 0), t.hp(0, 0));
  }
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(0, 0, [RES(3), [], []]);
    await t.run(() => t.engine.actionDefeatHero({ name: 'Gobbo', owner: 0, heroIdx: 0 }, t.hero(0, 0), { reason: 'Gobbo', eigenerAbgang: true }));
    R.check('Eigenfolge am eigenen Helden (Gobbo-HP-Verlust, Companion-Bruch) gelingt gegen Resistance', !lebt(t, 0, 0), t.hp(0, 0));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
