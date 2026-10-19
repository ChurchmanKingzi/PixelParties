'use strict';
// W15a · R2 (Rückfrage 2 aus W14a) · Al, 16.10.2026: „Soll Toughness (Max-HP-Gewinn beim normalen Anlegen) von Resistance ungeblockt bleiben?" — „Ja, bleibt ungeblockt."
// Erwartet: Toughness, als Standard-Spielaktion („Ability per turn", aus der Hand) auf einen Held mit Resistance Lv3 gelegt, gibt seinen Max-HP-Gewinn (+100/+100/+200 je Stufe)
//   NORMAL — Resistance blockt die Standard-Spielaktion nicht (a-q5). Auch Toughness als Startability bleibt unberührt. Gegenprobe: dieselbe Ability PER EFFEKT (Pressed Skill) wird geblockt. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const RES = (lv) => Array(lv).fill('Resistance');
  const hat = (t, hi, name) => (t.gs.players[0].abilityZones[hi] || []).some(z => (z || []).includes(name));
  const ok = (t) => t.errors.length === 0 && t.audit().length === 0;

  R.section('Toughness als Standard-Spielaktion (aus der Hand) auf einen Resistance-Helden');
  for (const [label, lv] of [['Resistance Lv3', 3], ['Resistance Lv1', 1], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ hand: [['Toughness'], []], hp: 800 });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    const max0 = t.hero(0, 0).maxHp, hp0 = t.hp(0, 0);
    const r = await t.play(0, 'Toughness', { hero: 0 });
    R.check(`${label}: Toughness wird angelegt`, r === true && hat(t, 0, 'Toughness'), { r, zonen: t.gs.players[0].abilityZones[0] });
    R.check(`${label}: +100 Max-HP und +100 aktuelle HP (ungeblockt)`, t.hero(0, 0).maxHp - max0 === 100 && t.hp(0, 0) - hp0 === 100, { max: t.hero(0, 0).maxHp, hp: t.hp(0, 0), max0, hp0 });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, ok(t), { e: t.errors, a: t.audit() });
  }

  R.section('Toughness als Startability (Resistance Lv3 am selben Helden)');
  {
    const t = await H.fresh({ abilities: { 0: { 0: [RES(3), ['Toughness'], []] } }, hp: 400 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    R.check('Startability: Toughness-Bonus +100 liegt (Max-HP ≥ 500)', t.hero(0, 0).maxHp >= 500, t.hero(0, 0).maxHp);
  }

  R.section('Gegenprobe: Toughness PER EFFEKT (Pressed Skill) prallt an Resistance Lv3 ab');
  {
    const t = await H.fresh({ hand: [['Pressed Skill'], []], hp: 800, deck: [['Toughness', 'ZZ Dummy'], []] });
    t.setAbilities(0, 0, [RES(3), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Toughness', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 0 }) });
    const max0 = t.hero(0, 0).maxHp;
    await t.play(0, 'Pressed Skill', { hero: 0 });
    R.check('Pressed Skill → Toughness auf Resistance-Helden: nicht angelegt, kein Max-HP-Gewinn', !hat(t, 0, 'Toughness') && t.hero(0, 0).maxHp === max0, { max: t.hero(0, 0).maxHp, max0 });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
