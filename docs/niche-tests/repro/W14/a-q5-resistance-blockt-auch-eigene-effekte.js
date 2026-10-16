'use strict';
// W14a · Rückfrage 5 (Welle 13 / W13b; M02-11 Resistance, Q144-Folge) · Al, 16.10.2026:
//   „Ja, Resistance blockt ausdrücklich auch einen eigenen Effekt ab (allerdings z.B. beim Anlegen von Abilities NICHT die normale Ability per turn, sondern nur eine per Effekt
//    angelegte)."
// Erwartet: Resistance blockt auch EIGENE Effekte des Spielers auf den Träger — Ausrüsten per Effekt, Ability-Anlegen per Effekt (Pressed Skill), Buffs (Elixir of Strength),
//   Max-HP-Gewinn (Life Serum). NICHT geblockt: das normale Anlegen einer Ability als Standard-Spielaktion („Ability per turn") und das normale Ausspielen einer Ausrüstung von der Hand.
//   Lv1 blockt nur den ersten Effekt je Zug; Ruhe bei Frost (Welle 7) bleibt. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const { equipArtifactToHero } = require('../../../../cards/effects/_orchestra-shared');
(async () => {
  const R = H.runner();
  const RES = (lv) => Array(lv).fill('Resistance');
  const hat = (t, seat, hi, name) => (t.gs.players[seat].abilityZones[hi] || []).some(z => (z || []).includes(name));

  R.section('Buff aus eigener Hand (Elixir of Strength) auf den eigenen Resistance-Helden');
  for (const [lv, soll] of [[3, false], [0, true]]) {
    const t = await H.fresh({ hand: [['Elixir of Strength'], []], hp: 800 });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(0, 'Elixir of Strength', { hero: 0 });
    const hatBuff = Object.keys(t.hero(0, 0).buffs || {}).length > 0;
    R.check(`${lv ? 'mit Resistance Lv' + lv : 'Kontrolle ohne Resistance'}: Buff ${soll ? 'liegt auf dem Helden' : 'wird geblockt'}`, hatBuff === soll, { buffs: Object.keys(t.hero(0, 0).buffs || {}) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Ability-Anlegen per Effekt (Pressed Skill) vs. Standard-Spielaktion (Wealth von der Hand)');
  {
    const t = await H.fresh({ hand: [['Pressed Skill'], []], hp: 800, deck: [['Wealth', 'ZZ Dummy'], []] });
    t.setAbilities(0, 0, [RES(3), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 0 }) });
    const r = await t.play(0, 'Pressed Skill', { hero: 0 });
    R.check('Pressed Skill auf den eigenen Resistance-Helden Lv3: Ability wird NICHT angelegt', !hat(t, 0, 0, 'Wealth'), t.gs.players[0].abilityZones[0]);
    R.check('… die Potion ist verbraucht (gespielt), Wealth bleibt im Deck', r === true && !t.pile(0, 'hand').includes('Pressed Skill') && t.pile(0, 'mainDeck').includes('Wealth'), { r, deck: t.pile(0, 'mainDeck'), hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await H.fresh({ hand: [['Pressed Skill'], []], hp: 800, deck: [['Wealth', 'ZZ Dummy'], []] });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 0 }) });
    await t.play(0, 'Pressed Skill', { hero: 0 });
    R.check('Kontrolle ohne Resistance: Pressed Skill legt Wealth an', hat(t, 0, 0, 'Wealth'), t.gs.players[0].abilityZones[0]);
  }
  {
    const t = await H.fresh({ hand: [['Wealth'], []], hp: 800 });
    t.setAbilities(0, 0, [RES(3), [], []]);
    const r = await t.play(0, 'Wealth', { hero: 0 });
    R.check('Standard-Spielaktion „Ability per turn": Wealth wird auch bei Resistance Lv3 NORMAL angelegt', r === true && hat(t, 0, 0, 'Wealth'), { r, zonen: t.gs.players[0].abilityZones[0] });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Lv1: nur der ERSTE Effekt je Zug – Pressed Skill (blockt), danach ein zweiter Effekt (wirkt)
    const t = await H.fresh({ hand: [['Pressed Skill', 'Pressed Skill'], []], hp: 800, deck: [['Wealth', 'Wealth', 'ZZ Dummy'], []] });
    t.setAbilities(0, 0, [RES(1), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 0 }) });
    await t.play(0, 'Pressed Skill', { hero: 0 });
    const nach1 = hat(t, 0, 0, 'Wealth');
    await t.play(0, 'Pressed Skill', { hero: 0 });
    R.check('Resistance Lv1: erstes Pressed Skill geblockt, zweites im selben Zug wirkt', !nach1 && hat(t, 0, 0, 'Wealth'), { nach1, nach2: hat(t, 0, 0, 'Wealth') });
  }

  R.section('Ausrüsten per Effekt (Helfer der Orchester-/Lolek-/Free-Artifact-Karten) vs. normales Ausspielen');
  {
    const t = await H.fresh({ hand: [['Club of Gobbo'], []], hp: 800 });
    t.setAbilities(0, 0, [RES(3), [], []]);
    const inst = await t.run(() => equipArtifactToHero(t.engine, 0, 'Club of Gobbo', 0, 0, 0, { from: 'hand', source: 'Test' }));
    R.check('Ausrüsten per Effekt auf den eigenen Resistance-Helden: geblockt (keine Instanz), Karte bleibt auf der Hand', !inst && t.pile(0, 'hand').includes('Club of Gobbo') && t.zone(0, 0, 0) == null, { inst: !!inst, hand: t.pile(0, 'hand'), zone: t.zone(0, 0, 0) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [['Club of Gobbo'], []], hp: 800 });
    const inst = await t.run(() => equipArtifactToHero(t.engine, 0, 'Club of Gobbo', 0, 0, 0, { from: 'hand', source: 'Test' }));
    R.check('Kontrolle ohne Resistance: Ausrüsten per Effekt klappt', !!inst && t.zone(0, 0, 0) === 'Club of Gobbo', { inst: !!inst, zone: t.zone(0, 0, 0) });
  }
  {
    const t = await H.fresh({ hand: [['Club of Gobbo'], []], hp: 800 });
    t.setAbilities(0, 0, [RES(3), [], []]);
    const r = await t.play(0, 'Club of Gobbo', { hero: 0, zoneSlot: 0 });
    R.check('normales Ausspielen einer Ausrüstung (Standard-Spielaktion) bei Resistance Lv3: NICHT geblockt', r === true && !t.pile(0, 'hand').includes('Club of Gobbo'), { r, hand: t.pile(0, 'hand'), zone: t.zone(0, 0, 0) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Gegenprobe: Resistance ruht bei Frost (Welle 7)');
  {
    const t = await H.fresh({ hand: [['Pressed Skill'], []], hp: 800, deck: [['Wealth', 'ZZ Dummy'], []] });
    t.setAbilities(0, 0, [RES(3), [], []]);
    t.hero(0, 0).statuses.frozen = { duration: 2, appliedBy: 1 };
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 0 }) });
    await t.play(0, 'Pressed Skill', { hero: 1 });
    R.check('gefrorener Resistance-Held: Resistance ruht, Pressed Skill legt an', hat(t, 0, 0, 'Wealth'), t.gs.players[0].abilityZones[0]);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
