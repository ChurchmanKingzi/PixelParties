'use strict';
// W10b · Q47 (A07-07) · „Erste Kreatur, die du beschwörst" (Harpyformer-Gratisaktion): JEDE Platzierung/Beschwörung zählt
//
// Kartentexte: Harpyformer: „If this is the first Creature you summon during your turn, summoning it counts as an additional Action."
//   Vullary: „… summon a level 3 or lower Creature …"; Xuanwu: „… place a level 3 or lower Creature from your discard pile …"
// ENTSCHIEDEN (Al, Welle 10, Q47): „Alles sollte zählen, inklusive Xuanwu" ("place" ist eine Subform von "summon"). Der Zähler
//   `ps._creaturesSummonedThisTurn` wird zentral geführt (`engine.zaehleBeschwoerung`: `_placeCard` und `actionPlaceCreature`, dazu die Selbst-
//   Platzierungen/Effektwege ohne diese Primitive).
// Geprüft (Zähler 0 → 1, `harpyformerInherentAction` danach false): (a) normale Beschwörung, (b) Xuanwu (place aus der Ablage), (c) Vullary,
//   (d) direkte Platzierung mit `countAsSummon:false` (Muster Stellin/Stellan/Klaus/Master's Key), (e) Cloudy Slime (Platzierung von der Hand),
//   (f) Jede Platzierung zählt GENAU einmal (kein Doppelzählen bei `countAsSummon:true`).
const H = require('../../lib/h.js');
const { harpyformerInherentAction } = require('../../../../cards/effects/_harpyformer-shared.js');
const D = H.INERT.creature;

(async () => {
  const R = H.runner();
  const zaehler = (t) => t.gs.players[0]._creaturesSummonedThisTurn || 0;
  const frei = (t) => harpyformerInherentAction(t.gs, 0);

  let t = await H.fresh({ hand: [[D], []], deckSize: 10 });
  R.check('Aufbau: Zähler 0, Harpyformer gratis', zaehler(t) === 0 && frei(t), zaehler(t));
  await t.play(0, D, { hero: 0 });
  R.check('(a) normale Beschwörung zählt', zaehler(t) === 1 && !frei(t), zaehler(t));

  t = await H.fresh({ discard: [[D], []], deckSize: 10 });
  let x = t.put(0, 0, 0, 'Cardinal Beast Xuanwu'); x.turnPlayed = 1;
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cardName: D, source: 'discard' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('(b) Xuanwu („place") zählt', zaehler(t) === 1 && !frei(t), { zaehler: zaehler(t) });
  R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);

  t = await H.fresh({ hand: [['Cute Princess Mary', D], []], deckSize: 10 });
  const v = t.put(0, 0, 0, 'Unsettling Opportunist Vullary'); v.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cardName: D }) });
  t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('(c) Vullary zählt', zaehler(t) >= 1 && !frei(t), { zaehler: zaehler(t) });

  t = await H.fresh({ hand: [[D], []], deckSize: 10 });
  const res = await t.run(() => t.engine.actionPlaceCreature(D, 0, 0, 0, { source: 'hand', sourceName: 'Test', countAsSummon: false, animationType: 'summon' }));
  R.check('(d) Platzierung mit `countAsSummon:false` zählt trotzdem (genau einmal)', zaehler(t) === 1 && !frei(t), { zaehler: zaehler(t), res: !!res });

  t = await H.fresh({ hand: [[D], []], deckSize: 10 });
  await t.run(() => t.engine.actionPlaceCreature(D, 0, 0, 0, { source: 'hand', sourceName: 'Test', countAsSummon: true, animationType: 'summon' }));
  R.check('(f) `countAsSummon:true` zählt genau einmal', zaehler(t) === 1, zaehler(t));

  t = await H.fresh({ hand: [['Cloudy Slime', D], []], deckSize: 10 });
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: D }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  await t.play(0, 'Cloudy Slime', { hero: 0 });
  const slimeOk = t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === D).length === 1;
  R.check('(e) Cloudy Slime: die platzierte Kreatur zählt zusätzlich zur Slime (Zähler 2)', slimeOk && zaehler(t) === 2, { zaehler: zaehler(t), slimeOk });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  // (g) Selbst-Platzierung durch Opfer-Tausch (Suspicious Monster / Teocuilatl-Karten): zählt wie die Beschwörung selbst
  for (const name of ['Suspicious Monster', 'Warrior of Teocuilatl']) {
    t = await H.fresh({ hand: [[name], []] });
    t.put(0, 0, 0, D);
    for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0;
    t.policy.confirm = true;
    t.targetFn = (v) => v.filter(x => !x.ineligible).slice(0, 1).map(x => x.id);
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, ...(d.zones[0].owner != null ? { owner: d.zones[0].owner } : {}) }) });
    await t.play(0, name, { hero: 0, slot: 0 });
    const da = t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === name).length === 1;
    R.check(`(g) ${name}: Selbst-Platzierung per Opfer-Tausch zählt (genau einmal)`, da && zaehler(t) === 1, { da, zaehler: zaehler(t) });
    R.check(`(g) ${name}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
