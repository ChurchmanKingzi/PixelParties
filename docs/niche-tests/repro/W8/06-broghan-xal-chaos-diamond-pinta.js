'use strict';
// W8/06 · Nachtrag Welle 8 (Al, 14.10.2026):
//  • Broghan „cannot be Frozen": die Immunität (eigener Stempel `freeze_immune`) entfällt, solange Broghan negiert/betäubt ist,
//    und ist danach wieder da; bereits angewandter Frost bleibt; fremde Quellen (Heart of Ice …) bleiben unberührt.
//  • Xal „may place Abilities into the Support Zones": die Erlaubnis ruht NICHT - vorhandene Support-Zone-Abilities bleiben,
//    neue dürfen auch bei negiertem/gefrorenem/betäubtem Xal angelegt werden („Xal nein").
//  • Chaos-Diamond / Pinta „you can never draw cards from your Potion Deck": das Verbot ruht NICHT („Nein, das Verbot bleibt").
// Aufruf: node docs/niche-tests/repro/W8/06-broghan-xal-chaos-diamond-pinta.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
const ZUST = [
  ['negiert (hart)', (t) => t.heroStatus(0, 0, 'negated'), 'negated'],
  ['negiert (Effekt)', (t) => t.heroStatus(0, 0, 'negated', { appliedTurn: 0, effectOnly: true }), 'negated'],
  ['betäubt', (t) => t.heroStatus(0, 0, 'stunned'), 'stunned'],
  ['gefroren', (t) => t.heroStatus(0, 0, 'frozen'), 'frozen'],
];
const hooks = async (t, art, st) => t.run(() => t.engine.runHooks(art, { target: t.hero(0, 0), status: st, statusName: st, heroOwner: 0, heroIdx: 0 }));

(async () => {
  const R = H.runner();
  const BRO = 'Broghan, the Frozen Guardian of the North';

  // ── Broghan ────────────────────────────────────────────────────────────────────────────────
  { const t = await H.fresh({ heroes: [[BRO, ...fill], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    R.check('Broghan ohne Status: Stempel da', !!t.hero(0, 0).statuses.freeze_immune);
    await t.engine.addHeroStatus(0, 0, 'frozen', { duration: 2, appliedBy: 1 });
    R.check('Broghan ohne Status: nicht einfrierbar', !t.hero(0, 0).statuses.frozen, Object.keys(t.hero(0, 0).statuses)); }
  for (const [name, set, st] of ZUST.filter(z => z[2] !== 'frozen')) {
    const t = await H.fresh({ heroes: [[BRO, ...fill], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    set(t); await hooks(t, 'onStatusApplied', st);
    R.check(`Broghan ${name}: Immunität ruht (Stempel weg)`, !t.hero(0, 0).statuses.freeze_immune, t.hero(0, 0).statuses);
    await t.engine.addHeroStatus(0, 0, 'frozen', { duration: 2, appliedBy: 1 });
    R.check(`Broghan ${name}: kann eingefroren werden`, !!t.hero(0, 0).statuses.frozen, Object.keys(t.hero(0, 0).statuses));
    delete t.hero(0, 0).statuses[st]; await hooks(t, 'onStatusRemoved', st);
    R.check(`Broghan ${name}: bereits angewandter Frost bleibt nach Ende des Zustands`, !!t.hero(0, 0).statuses.frozen, Object.keys(t.hero(0, 0).statuses));
    delete t.hero(0, 0).statuses.frozen; await hooks(t, 'onStatusRemoved', 'frozen');
    R.check(`Broghan ${name}: nach Abtauen ist die Immunität wieder da`, !!t.hero(0, 0).statuses.freeze_immune?.source, t.hero(0, 0).statuses);
    R.check(`Broghan ${name}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }
  for (const [name, set, st] of ZUST.filter(z => z[2] !== 'frozen')) {   // ohne Frost: Immunität kehrt mit dem Ende des Zustands zurück
    const t = await H.fresh({ heroes: [[BRO, ...fill], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    set(t); await hooks(t, 'onStatusApplied', st);
    delete t.hero(0, 0).statuses[st]; await hooks(t, 'onStatusRemoved', st);
    R.check(`Broghan ${name}: nach Ende des Zustands Immunität wieder da`, !!t.hero(0, 0).statuses.freeze_immune?.source, t.hero(0, 0).statuses); }
  { // echter Weg: Negation über addHeroStatus, Ablauf zum Phasenbeginn
    const t = await H.fresh({ heroes: [[BRO, ...fill], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    await t.engine.addHeroStatus(0, 0, 'negated', { duration: 1, appliedBy: 1 });
    R.check('Broghan (echt negiert): Stempel weg', !t.hero(0, 0).statuses.freeze_immune, Object.keys(t.hero(0, 0).statuses));
    for (let i = 0; i < 4 && t.hero(0, 0).statuses.negated; i++) await t.endTurn();
    await t.run(() => t.engine.runHooks('onPhaseStart', {}));
    R.check('Broghan (Negation abgelaufen): Immunität wieder da', !!t.hero(0, 0).statuses.freeze_immune && !t.hero(0, 0).statuses.negated, Object.keys(t.hero(0, 0).statuses));
    R.check('Broghan (echt): keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { // fremder Stempel (Heart of Ice) bleibt bei negiertem Broghan
    const t = await H.fresh({ heroes: [[BRO, ...fill], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.hero(0, 0).statuses.freeze_immune = { source: 'Heart of Ice' };
    ZUST[0][1](t); await hooks(t, 'onStatusApplied', 'negated');
    R.check('Broghan negiert: fremde freeze_immune (Heart of Ice) bleibt', t.hero(0, 0).statuses.freeze_immune?.source === 'Heart of Ice', t.hero(0, 0).statuses.freeze_immune); }

  // ── Xal: Erlaubnis ruht nicht ──────────────────────────────────────────────────────────────
  for (const [name, set] of [[null, null], ...ZUST]) {
    const t = await H.fresh({ heroes: [['Xal, the Animated Armor', ...fill], null], hand: [['Fighting', 'Leadership'], []], deckSize: 20 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setAbilities(0, 0, [[], [], []]);
    const ps = t.gs.players[0];
    ps.supportZones[0][0] = ['Wisdom'];                                  // schon liegende Ability in einer Support Zone
    t.engine._trackCard('Wisdom', 0, 'support', 0, 0);
    if (set) set(t);
    R.check(`Xal ${name || 'ohne Status'}: Erlaubnis gilt`, t.engine.heroAcceptsAbilitiesInSupport(0, 0) === true);
    R.check(`Xal ${name || 'ohne Status'}: liegende Support-Zone-Ability bleibt (Stapel gefunden)`, t.engine.heroAbilityStackOf(0, 0, 'Wisdom')?.zoneKind === 'support' && t.engine.heroSupportAbilityStacks(0, 0).length === 1, t.engine.heroSupportAbilityStacks(0, 0));
    t.gs.activePlayer = 0; t.gs.currentPhase = 2;
    const hi = ps.hand.indexOf('Fighting');
    const r = await t.run(() => t.host.doPlayAbility(t.room, 0, { cardName: 'Fighting', handIndex: hi, heroIdx: 0, zoneSlot: 1, supportSlot: 1 }));
    R.check(`Xal ${name || 'ohne Status'}: neue Ability in eine Support Zone angelegt`, r === true && (ps.supportZones[0][1] || []).includes('Fighting'), { r, support: ps.supportZones[0] });
    R.check(`Xal ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }

  // ── Chaos-Diamond / Pinta: Ziehverbot gilt weiter ──────────────────────────────────────────
  for (const held of ['Chaos-Diamond, the Cracked Keeper', 'Pinta, the Singing Ship']) {
    for (const [name, set] of [[null, null], ...ZUST]) {
      const t = await H.fresh({ heroes: [[held, ...fill], null], potionDeck: [['Healing Potion', 'Healing Potion', 'Healing Potion'], []] });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      if (set) set(t);
      const n0 = t.pile(0, 'potionDeck').length;
      const r = await t.run(() => t.engine.actionDrawFromPotionDeck(0, 1));
      R.check(`${held.split(',')[0]} ${name || 'ohne Status'}: Ziehen aus dem Potion Deck bleibt verboten`, t.pile(0, 'potionDeck').length === n0 && !(r?.value?.length), { n0, nach: t.pile(0, 'potionDeck').length, r });
      R.check(`${held.split(',')[0]} ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
