'use strict';
// W13a · A2 (Regel v619 „ein negierter Held castet keine Surprise/Hand-Reaktion", `_canHeroActivateSurprise`) · Al, 15.10.2026:
//   „Nein, ein Held, der *nur* seinen Effekt negiert hat, darf ganz normal beschwören. Sind seine *Abilities* negiert, ist er auf Lv 0
//    beschränkt, genau wie bei anderen Beschwörungen auch."
// Erwartet:
//   * leichte Form (`effectOnly`): Surprises und Hand-Reaktionen (Spells/Attacks/Creatures) werden normal aktiviert/beschworen — v619 entfällt;
//   * harte Form (Abilities negiert): nur Stufe 0 ohne Schule (Summoning Magic / Zauberschule weg) — `heroMeetsLevelReq`;
//   * Frozen / Stunned / Webbed sperren wie bisher.
// Geprüft: die Engine-Prüfung (`_canHeroActivateSurprise`, `_rxHandCastingHero`) an Surprise/Reaction-Spells und die Reaction-/Surprise-Creatures
//   Doomed Town Guard, Enhanced Guard Dog, Explosive Drone, Chaorc Rider Warg und Ethan (Stufe 0 / 1 / 2) im echten Spielweg.
const H = require('../../lib/h.js');
const FORMEN = [
  ['gesund', () => {}],
  ['Effekt negiert (leicht)', (t, h) => t.heroStatus(0, h, 'negated', { appliedTurn: 0, effectOnly: true })],
  ['Abilities negiert (hart)', (t, h) => t.heroStatus(0, h, 'negated')],
  ['gefroren', (t, h) => t.heroStatus(0, h, 'frozen')],
  ['betäubt', (t, h) => t.heroStatus(0, h, 'stunned')],
  ['verwebt', (t, h) => t.heroStatus(0, h, 'webbed')],
];
// Beschwörungen (Abschnitt 2/3) kennen zusätzlich Bound („Bound sperrt Aktionen"), dieselbe Menge wie `canHeroSummon`
const FORMEN_BESCHWOERUNG = FORMEN.concat([['gefesselt (bound)', (t, h) => t.heroStatus(0, h, 'bound')]]);
const KANN = { 'gesund': { l0: true, l1: true }, 'Effekt negiert (leicht)': { l0: true, l1: true }, 'Abilities negiert (hart)': { l0: true, l1: false } };
const kann = (form, stufe) => (KANN[form] || { l0: false, l1: false })[stufe === 0 ? 'l0' : 'l1'];
(async () => {
  const R = H.runner();

  R.section('(1) Engine-Prüfung: Surprise vom Brett und Hand-Reaktion (Spell) — Held 0 trägt die Form');
  const SPELLS = [['Sculpture Guards', 0, 'Support Magic'], ['Misfire', 1, 'Decay Magic'], ['Glass Wall', 1, 'Magic Arts']];
  for (const [form, apply] of FORMEN) {
    const t = await H.fresh({});
    for (const [n, , schule] of SPELLS) t.setAbilities(0, 0, [[schule], [], []]);
    t.setAbilities(0, 0, [['Support Magic', 'Decay Magic'], ['Magic Arts'], []]);
    apply(t, 0);
    for (const [name, stufe] of SPELLS) {
      const wert = t.engine._canHeroActivateSurprise(0, 0, name);
      // harte Form: Stufe 0 bleibt möglich (auch mit Schule: 0 Stufen verlangt), Stufe ≥ 1 nicht — wie bei jeder Beschwörung
      const erwartet = kann(form, stufe);
      R.check(`${form}: _canHeroActivateSurprise(${name}, Stufe ${stufe}) = ${erwartet}`, wert === erwartet, wert);
    }
    R.check(`${form}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('(2) Reaction-/Surprise-Creatures im echten Spielweg (alle drei Helden tragen die Form)');
  const ZAEHLEN = [
    // [Name, Stufe, Aufbau der Szene, Auslöser]
    ['Doomed Town Guard', 0, async (t) => { const c = t.put(0, 0, 0, H.INERT.creature); c.turnPlayed = 1; await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: 1 }, c)); }],
    ['Explosive Drone', 0, async (t) => { const c = t.put(0, 0, 0, H.INERT.creature); c.turnPlayed = 1; t.put(1, 0, 0, H.INERT.big); await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: 1 }, c)); }],
    ['Enhanced Guard Dog', 1, async (t) => { const c = t.put(0, 0, 0, H.INERT.creature); c.turnPlayed = 1; await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: 1 }, c)); }],
    ['Chaorc Rider Warg', 2, async (t) => { const c = t.put(0, 0, 0, H.INERT.creature); c.turnPlayed = 1; await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: 1 }, c)); }],
  ];
  for (const [form, apply] of FORMEN_BESCHWOERUNG) {
    for (const [name, stufe, szene] of ZAEHLEN) {
      const t = await H.fresh({ hand: [[name], []], deck: [Array(10).fill(H.INERT.filler), Array(10).fill(H.INERT.filler)] });
      for (let h = 0; h < 3; h++) t.setAbilities(0, h, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
      for (let h = 0; h < 3; h++) apply(t, h);
      t.policy.confirm = true;
      t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
      t.targetFn = (v) => [v[0].id];
      await szene(t);
      const da = !!t.find(name, 'support');
      const soll = kann(form, stufe);
      R.check(`${name} (Stufe ${stufe}) / alle Helden ${form}: ${soll ? 'beschworen' : 'nicht beschworen'}`, da === soll, { da });
      R.check(`${name} / ${form}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }

  R.section('(3) Ethan (Stufe 1, Hand): ein Spell mit Originalstufe ≥ 4 wurde eingesetzt');
  for (const [form, apply] of FORMEN_BESCHWOERUNG) {
    const t = await H.fresh({ hand: [['Ethan, the Prodigy'], []] });
    for (let h = 0; h < 3; h++) t.setAbilities(0, h, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    for (let h = 0; h < 3; h++) apply(t, h);
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    const cd = H.DB['Hymn of Rebirth'];
    await t.run(() => t.engine.runHooks('afterSpellResolved', { spellName: 'Hymn of Rebirth', spellCardData: cd, heroIdx: 0, heroOwner: 0, casterIdx: 0, damageTargets: [], isSecondCast: false, _skipReactionCheck: true }));
    const da = !!t.find('Ethan, the Prodigy', 'support');
    const soll = kann(form, 1);
    R.check(`Ethan / alle Helden ${form}: ${soll ? 'beschworen' : 'nicht beschworen'}`, da === soll, { da });
    R.check(`Ethan / ${form}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.section('(4) Reaktionskarten mit eigenem Wirker-Tor (reactionCondition): Silence, Shamanic Curse, Divine Punishment, Rusty Touch, The Master\'s Plan');
  const { loadCardEffect } = require('../../../../cards/effects/_loader');
  const KARTEN = [['Silence', 'Spell'], ['Shamanic Curse', 'Spell'], ['Divine Punishment', 'Hero'], ['Rusty Touch', 'Artifact'], ["The Master's Plan", 'Spell']];
  for (const [form, apply] of FORMEN.filter(f => f[0] !== 'verwebt')) {   // „verwebt" kennen diese Einzeltore seit jeher nicht (nicht Teil von A2)
    for (const [name, glied] of KARTEN) {
      const t = await H.fresh({});
      t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []]);
      apply(t, 0);
      const chain = { chain: [{ owner: 1, cardType: glied, cardName: 'X', fromBoard: false }] };
      let wert;
      try { wert = !!loadCardEffect(name).reactionCondition(t.gs, 0, t.engine, chain); } catch (e) { wert = 'FEHLER ' + e.message; }
      const soll = kann(form, 1);
      R.check(`${name} / Held ${form}: Reaktion ${soll ? 'möglich' : 'nicht möglich'}`, wert === soll, wert);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
