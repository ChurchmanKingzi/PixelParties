'use strict';
// W12a · Rückfrage 2 („Beschwörer muss agieren können" vs. Negation) · Al, 15.10.2026:
//   „Nein, ein effekt-negierter Held kann ganz normal Aktionen ausführen und also beschwören. Anders sieht es aus, wenn seine *Abilities* negiert sind -
//    dann kann er nur noch Lv-0-Creatures beschwören, weil ja seine Summoning Magic weg ist."
// Erwartet:
//   * Leichte Form (`effectOnly`: Decisive Defeat, Weakening Crystal): der Held beschwört normal (alle Stufen, soweit er die Schule hat) und blockiert „summon" nicht.
//   * Harte Form („Abilities negiert", Standard-`negated`): nur noch Stufe-0-Kreaturen — die frühere Hipdall-Stack-Ausnahme „Negated + Lv0" gilt wieder.
//   * Frozen / Stunned / Webbed / Bound sperren jede Beschwörung wie bisher.
// Geprüft: der zentrale Helfer `canHeroSummon`/`heroAgiert`/`beschwoerStufeOk`, dazu die Wege Elven Rider (Lv1, Reaction), Hipdall (Lv0) / Wildur (Lv1) vom
//   Coolness Stack, Grave Worm (Lv0, aus der Ablage), Gigantisaur Raptoren (Lv3, zweite Beschwörung) und Bomblebee Cluster.
const H = require('../../lib/h.js');
const { canHeroSummon, heroAgiert, beschwoerStufeOk } = require('../../../../cards/effects/_summon-eligibility');
const gefragt = (t, n) => t.prompts.some(p => p.d && p.d.type === 'confirm' && new RegExp(n).test(JSON.stringify(p.d)));
const FORMEN = [
  ['gesund', (t, h) => {}],
  ['Effekt negiert (leicht)', (t, h) => t.heroStatus(0, h, 'negated', { appliedTurn: 0, effectOnly: true })],
  ['Abilities negiert (hart)', (t, h) => t.heroStatus(0, h, 'negated')],
  ['gefroren', (t, h) => t.heroStatus(0, h, 'frozen')],
  ['betäubt', (t, h) => t.heroStatus(0, h, 'stunned')],
  ['gefesselt (bound)', (t, h) => t.heroStatus(0, h, 'bound')],
  ['verwebt (webbed)', (t, h) => t.heroStatus(0, h, 'webbed')],
];
const ERLAUBT = { 'gesund': { l0: true, l1: true }, 'Effekt negiert (leicht)': { l0: true, l1: true }, 'Abilities negiert (hart)': { l0: true, l1: false } };
const erlaubt = (form, stufe) => (ERLAUBT[form] || { l0: false, l1: false })[stufe === 0 ? 'l0' : 'l1'];
(async () => {
  const R = H.runner();

  R.section('(1) zentrale Helfer: canHeroSummon / heroAgiert / beschwoerStufeOk');
  for (const [form, apply] of FORMEN) {
    const t = await H.fresh({});
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    apply(t, 0);
    const db = t.engine._getCardDB();
    const l0 = db['Cute Bunny'], l1 = db['Psychic Scout'];
    R.check(`${form}: canHeroSummon Stufe 0 = ${erlaubt(form, 0)}`, canHeroSummon(t.engine, 0, 0, l0) === erlaubt(form, 0), canHeroSummon(t.engine, 0, 0, l0));
    R.check(`${form}: canHeroSummon Stufe 1 = ${erlaubt(form, 1)}`, canHeroSummon(t.engine, 0, 0, l1) === erlaubt(form, 1), canHeroSummon(t.engine, 0, 0, l1));
    const agiert = !/gefroren|betäubt|gefesselt|verwebt/.test(form);
    R.check(`${form}: heroAgiert = ${agiert}`, heroAgiert(t.hero(0, 0)) === agiert, heroAgiert(t.hero(0, 0)));
    if (agiert) {
      R.check(`${form}: beschwoerStufeOk Stufe 0 immer, Stufe 1 nur ohne harte Form`, beschwoerStufeOk(t.engine, 0, 0, l0) === true && beschwoerStufeOk(t.engine, 0, 0, l1) === erlaubt(form, 1));
    }
  }

  R.section('(2) Elven Rider (Stufe 1, Reaction): ein Elven stirbt bei Held 0');
  for (const [form, apply] of FORMEN) {
    const t = await H.fresh({ hand: [['Elven Rider'], []] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    const e = t.put(0, 0, 0, 'Elven Archer'); e.turnPlayed = 1;
    apply(t, 0);
    t.policy.confirm = true;
    await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: 1 }, e));
    const rider = !!t.find('Elven Rider', 'support');
    R.check(`Elven Rider / ${form}: ${erlaubt(form, 1) ? 'angeboten und beschworen' : 'kein Angebot'}`, erlaubt(form, 1) ? (gefragt(t, 'Elven Rider') && rider) : (!gefragt(t, 'Elven Rider') && !rider), { gefragt: gefragt(t, 'Elven Rider'), rider });
    R.check(`Elven Rider / ${form}: keine Engine-Fehler`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(3) Hipdall (Stufe 0) und Wildur (Stufe 1) vom Coolness Stack');
  for (const [form, apply] of FORMEN) {
    for (const [name, stufe] of [['Hipdall, Protector of Coolness', 0], ['Wildur, the Shining Coolness', 1]]) {
      const t = await H.fresh({ deck: [[H.INERT.creature, H.INERT.creature], []] });
      t.putArea(0, 'Wowhalla, the Hall of the Cool');
      for (let h = 0; h < 3; h++) t.setAbilities(0, h, [['Summoning Magic'], [], []]);
      const ps = t.gs.players[0];
      ps.coolnessStack.push(name); t.engine._trackCard(name, 0, 'coolnessStack');
      t.gs.activePlayer = 0; t.phase(3);
      for (let h = 0; h < 3; h++) apply(t, h);
      t.targetFn = (v) => [v.find(x => x.type === 'hero').id];
      const r = await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
      const da = !!t.find(name, 'support');
      R.check(`${name.split(',')[0]} (Stufe ${stufe}) / alle Helden ${form}: ${erlaubt(form, stufe) ? 'beschworen' : 'abgelehnt'}`, erlaubt(form, stufe) ? (da && r?.played === true) : (!da && r?.aborted === true), r);
      R.check(`${name.split(',')[0]} / ${form}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }

  R.section('(4) Grave Worm (Stufe 0, aus der Ablage): eine eigene Kreatur wird besiegt');
  for (const [form, apply] of FORMEN) {
    const t = await H.fresh({ discard: [['Grave Worm'], []], deck: [Array(10).fill(H.INERT.filler), []] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    const opfer = t.put(0, 0, 0, H.INERT.creature); opfer.turnPlayed = 1;
    apply(t, 0);
    t.policy.confirm = true;
    await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: 1 }, opfer));
    const worm = !!t.find('Grave Worm', 'support');
    R.check(`Grave Worm / Held ${form}: ${erlaubt(form, 0) ? 'angeboten und beschworen' : 'kein Angebot'}`, erlaubt(form, 0) ? (gefragt(t, 'Grave Worm') && worm) : (!gefragt(t, 'Grave Worm') && !worm), { gefragt: gefragt(t, 'Grave Worm'), worm });
    R.check(`Grave Worm / ${form}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('(5) Gigantisaur Raptoren (Stufe 3): zweite Beschwörung mit einem anderen Helden');
  for (const [form, apply] of FORMEN) {
    const t = await H.fresh({ hand: [['Gigantisaur Brachion'], []], deck: [Array(10).fill(H.INERT.filler), []] });
    t.setAbilities(0, 1, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: d => ({ cardName: d.cards[0].name }) });
    t.script.push({ match: d => d.type === 'pickHandCard', answer: d => ({ handIndex: d.eligibleIndices[0] }) });
    // Raptoren landet bei Held 0, der zweite Gigantisaurier kommt nur bei Held 1 in Frage (Held 0 trägt schon einen); Held 1 hat den Status
    apply(t, 1);
    await t.run(() => t.engine.summonCreatureWithHooks('Gigantisaur Raptoren', 0, 0, 0, { source: 'Test' }));
    const zweiter = !!t.find('Gigantisaur Brachion', 'support');
    R.check(`Raptoren / Held 1 ${form}: zweiter Gigantisaurier (Stufe 3) ${erlaubt(form, 1) ? 'kommt' : 'kommt nicht'}`, zweiter === erlaubt(form, 1), { zweiter, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
    R.check(`Raptoren / ${form}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('(6) Bomblebee Cluster (Stufe-1-Bomblebees): „Summon … with the same Hero" über den Wirt der auslösenden Bomblebee');
  for (const [form, apply] of FORMEN) {
    const t = await H.fresh({ hand: [['Bomblebee Cluster', 'Time Bomblebee', 'Dive Bomblebee'], []], deck: [Array(10).fill(H.INERT.filler), []] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    const ausloeser = t.put(0, 0, 0, 'Bomblebee'); ausloeser.turnPlayed = 1;
    apply(t, 0);
    t.script.push({ match: d => d.type === 'cardGallery', answer: d => ({ cardName: d.cards[0].name }) });
    t.policy.confirm = true;
    const cluster = require('../../../../cards/effects/_loader').loadCardEffect('Bomblebee Cluster');
    await t.run(() => cluster.postSummonReactionResolve(t.engine, 0, ausloeser));
    const neu = t.inst(c => c.zone === 'support' && /Bomblebee$/.test(c.name) && c.id !== ausloeser.id).length;
    R.check(`Bomblebee Cluster / Wirt ${form}: ${erlaubt(form, 1) ? 'beschwört weitere Bomblebees' : 'keine weitere Bomblebee'}`, erlaubt(form, 1) ? neu >= 1 : neu === 0, neu);
    R.check(`Bomblebee Cluster / ${form}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
