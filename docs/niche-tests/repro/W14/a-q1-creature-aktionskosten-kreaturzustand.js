'use strict';
// W14a · Rückfrage 1 (Welle 13 / W13a): Creature-Effekte mit Action-Kosten (The Spawn Mother, Plant Golem, The Creepy Clown of Heaven …) · Al, 16.10.2026:
//   „Nein, diese sind stattdessen gesperrt, wenn die Creature selbst Frozen/Stunned/Negated ist!"
// Erwartet: NICHT der Zustand des Wirtsheldens (gefroren/betäubt) sperrt den Kreatureneffekt, sondern der Zustand der KREATUR SELBST
//   (Frozen / Stunned / Negated). Ist die Kreatur gesund, wirkt der Effekt auch bei gefrorenem/betäubtem Wirtsheld; ist sie selbst gefroren/
//   betäubt/negiert, ruht er (und es wird keine Aktion verbraucht).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  // ── The Spawn Mother (Aktionskosten: sich selbst auf die Hand zurückspringen lassen) ──
  const spawn = async (modus) => {
    const t = await H.fresh({ hand: [[], []] });
    const sm = t.put(0, 0, 0, 'The Spawn Mother'); sm.turnPlayed = 1;
    if (modus === 'wirt-frozen') t.heroStatus(0, 0, 'frozen');
    if (modus === 'wirt-stunned') t.heroStatus(0, 0, 'stunned');
    if (modus === 'kreatur-frozen') await t.engine.applyCreatureStatus(sm, 'frozen', { sourceOwner: 1, duration: 9 });
    if (modus === 'kreatur-stunned') await t.engine.applyCreatureStatus(sm, 'stunned', { sourceOwner: 1, duration: 9 });
    if (modus === 'kreatur-negated') await t.engine.actionNegateCreature(sm, 'Test Source');
    t.gs.currentPhase = 3; t.gs.activePlayer = 0;
    const ps = t.gs.players[0]; ps._actionsPlayedThisPhase = 0; ps.heroesActedThisTurn = [];
    await t.activateCreature(0, 0, 0);
    const aufHand = t.pile(0, 'hand').includes('The Spawn Mother');
    return { t, aufHand, zug: (ps.heroesActedThisTurn || []).length };
  };
  R.section('The Spawn Mother');
  for (const [modus, soll] of [['gesund', true], ['wirt-frozen', true], ['wirt-stunned', true], ['kreatur-frozen', false], ['kreatur-stunned', false], ['kreatur-negated', false]]) {
    const r = await spawn(modus);
    R.check(`${modus}: Effekt ${soll ? 'wirkt (Spawn Mother springt auf die Hand)' : 'ruht (bleibt auf dem Brett)'}`, r.aufHand === soll, { aufHand: r.aufHand });
    if (!soll) R.check(`${modus}: keine Aktion verbraucht`, r.zug === 0, r.zug);
    R.check(`${modus}: keine Engine-Fehler`, r.t.errors.length === 0, r.t.errors);
  }

  // ── Plant Golem (Aktionskosten + 1 Handkarte: den Golem besiegen); der Golem steht beim Gegner (Controller = Sitz 1) ──
  const golem = async (modus) => {
    const t = await H.fresh({ hand: [[], ['Fireball']] });
    const g = t.put(1, 0, 0, 'Plant Golem', { controller: 1 }); g.turnPlayed = 1; g.owner = 0; g.controller = 1;
    if (modus === 'wirt-frozen') t.heroStatus(1, 0, 'frozen');
    if (modus === 'wirt-stunned') t.heroStatus(1, 0, 'stunned');
    if (modus === 'kreatur-frozen') await t.engine.applyCreatureStatus(g, 'frozen', { sourceOwner: 0, duration: 9 });
    if (modus === 'kreatur-stunned') await t.engine.applyCreatureStatus(g, 'stunned', { sourceOwner: 0, duration: 9 });
    if (modus === 'kreatur-negated') await t.engine.actionNegateCreature(g, 'Test Source');
    t.gs.currentPhase = 3; t.gs.activePlayer = 1;
    const ps = t.gs.players[1]; ps._actionsPlayedThisPhase = 0; ps.heroesActedThisTurn = [];
    t.script.push({ match: d => d && d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball' }) });
    await t.activateCreature(1, 0, 0);
    const lebt = !!t.find('Plant Golem', 'support');
    return { t, tot: !lebt, zug: (ps.heroesActedThisTurn || []).length };
  };
  R.section('Plant Golem (Controller = Sitz 1, Wirt = Held 0 von Sitz 1)');
  for (const [modus, soll] of [['gesund', true], ['wirt-frozen', true], ['wirt-stunned', true], ['kreatur-frozen', false], ['kreatur-stunned', false], ['kreatur-negated', false]]) {
    const r = await golem(modus);
    R.check(`${modus}: Golem-Kill ${soll ? 'wirkt (Golem besiegt)' : 'ruht (Golem bleibt)'}`, r.tot === soll, { tot: r.tot });
    R.check(`${modus}: keine Engine-Fehler`, r.t.errors.length === 0, r.t.errors);
  }
  // ── The Creepy Clown of Heaven (eigener Clown besiegen: Aktion, Rückfrage) ──
  const clown = async (modus) => {
    const t = await H.fresh({ hand: [[], []] });
    const c = t.put(0, 0, 0, 'The Creepy Clown of Heaven'); c.turnPlayed = 1;
    if (modus === 'wirt-frozen') t.heroStatus(0, 0, 'frozen');
    if (modus === 'wirt-stunned') t.heroStatus(0, 0, 'stunned');
    if (modus === 'kreatur-frozen') await t.engine.applyCreatureStatus(c, 'frozen', { sourceOwner: 1, duration: 9 });
    if (modus === 'kreatur-stunned') await t.engine.applyCreatureStatus(c, 'stunned', { sourceOwner: 1, duration: 9 });
    if (modus === 'kreatur-negated') await t.engine.actionNegateCreature(c, 'Test Source');
    t.gs.currentPhase = 3; t.gs.activePlayer = 0;
    const ps = t.gs.players[0]; ps._actionsPlayedThisPhase = 0; ps.heroesActedThisTurn = [];
    t.policy.confirm = true;
    await t.activateCreature(0, 0, 0);
    return { t, tot: !t.find('The Creepy Clown of Heaven', 'support') };
  };
  R.section('The Creepy Clown of Heaven (eigener Clown)');
  for (const [modus, soll] of [['gesund', true], ['wirt-frozen', true], ['wirt-stunned', true], ['kreatur-frozen', false], ['kreatur-stunned', false], ['kreatur-negated', false]]) {
    const r = await clown(modus);
    R.check(`${modus}: Clown-Aktion ${soll ? 'wirkt (Clown besiegt)' : 'ruht (Clown bleibt)'}`, r.tot === soll, { tot: r.tot });
    R.check(`${modus}: keine Engine-Fehler`, r.t.errors.length === 0, r.t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
