'use strict';
// W17b · A01-pollution-25 · Golden Wings: „unaffected by your OPPONENT'S cards and effects" – NUR gegnerische Quellen prallen ab.
// Marke: `counters._gwImmune` (quellenbewusst, `engine.kreaturGegnerEffektImmun`), NICHT `_cardinalImmune` (bleibt Cardinal Beasts, quellenblind).
// (A) Gegenprobe: Quelle = Gegner (Sitz 1) → Schaden, Status, Zerstören, Stehlen, Übernahme, Buff hinzufügen/entfernen, Negieren, Zonenwechsel wirkungslos wie bisher.
// (B) Quelle unbekannt (String-Quelle ohne Besitzer, sourceOwner -1) → geschützt wie bisher.
// (C) Quelle = Besitzer (Sitz 0): Schaden, Status, Buff hinzufügen/entfernen, Negieren, Bounce, Zerstören wirken normal.
// (D) Cardinal Beast unverändert quellenblind; Ablauf am Zugende räumt `_gwImmune` ab, danach trifft auch der Gegner.
// Aufruf: node docs/niche-tests/repro/W17/b-golden-wings-nur-gegner.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const pickOwn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 0 && y.slotIdx === 0); return x ? [x.id] : [v[0].id]; };
  const S0 = { name: 'Eigene Quelle', owner: 0, controller: 0 };
  const S1 = { name: 'Gegner-Quelle', owner: 1, controller: 1 };

  async function szene() {
    const t = await H.fresh({ hand: [['Golden Wings'], []] });
    const c = t.put(0, 0, 0, H.INERT.creature); c.turnPlayed = 1;
    t.policy.confirm = true; t.targetFn = pickOwn;
    await t.play(0, 'Golden Wings', { hero: 0 });
    return { t, c };
  }
  const hp = (c) => c.counters.currentHp ?? 200;

  // ── (A) Gegner ──
  R.section('(A) gegnerische Quellen prallen ab');
  {
    const { t, c } = await szene(); const e = t.engine;
    R.check('Aufbau: _gwImmune gesetzt, _cardinalImmune NICHT', c.counters._gwImmune === true && !c.counters._cardinalImmune, c.counters);
    const h0 = hp(c);
    await e.actionDealCreatureDamage(S1, c, 50, 'spell', { sourceOwner: 1 });
    R.check('Gegner-Schaden wirkungslos', hp(c) === h0, [h0, hp(c)]);
    await e.applyCreatureStatus(c, 'frozen', { sourceOwner: 1, source: S1 });
    R.check('Gegner-Freeze haftet nicht', !c.counters.frozen, c.counters);
    await e.applyCreatureStatus(c, 'poisoned', { sourceOwner: 1, source: 'Gegner-Gift', stacks: 1 });
    R.check('Gegner-Gift haftet nicht', !c.counters.poisoned, c.counters);
    await e.actionDestroyCard(S1, c);
    R.check('Gegner-Zerstören wirkungslos', c.zone === 'support', c.zone);
    R.check('Gegner-Diebstahl (actionStealCreature) prallt ab', e.actionStealCreature(1, c) === false && (c.controller ?? c.owner) === 0, c.controller);
    const tr = await e.actionTransferCreature(c, 1, 0, 1, { sourceOwner: 1, sourceName: 'Gegner' });
    R.check('Gegner-Übernahme (actionTransferCreature) prallt ab', tr?.success === false && (c.controller ?? c.owner) === 0, tr);
    const b = await e.actionAddCreatureBuff(c, 'zz_test_buff', { source: S1 });
    R.check('Gegner-Buff wird nicht hinzugefügt', b === false && !c.counters.buffs?.zz_test_buff, c.counters.buffs);
    await e.actionRemoveCreatureBuff(c, 'golden_wings', { source: S1 });
    R.check('Gegner entfernt den Golden-Wings-Buff nicht', !!c.counters.buffs?.golden_wings, c.counters.buffs);
    await e.actionNegateCreature(c, 'Gegner-Negation', { sourceOwner: 1 });
    R.check('Gegner-Negation wirkungslos', !c.counters.negated, c.counters);
    await e.actionMoveCard(c, 'hand', undefined, undefined, { source: S1 });
    R.check('Gegner-Zonenwechsel (Bounce) wirkungslos', c.zone === 'support', c.zone);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── (B) unbekannte Quelle ──
  R.section('(B) Quelle unbekannt → geschützt (wie bisher)');
  {
    const { t, c } = await szene(); const e = t.engine;
    const h0 = hp(c);
    await e.actionDealCreatureDamage('irgendwas', c, 50, 'spell');
    R.check('Schaden ohne Quelle (sourceOwner -1) wirkungslos', hp(c) === h0, [h0, hp(c)]);
    await e.actionDestroyCard('String-Quelle', c);
    R.check('Zerstören mit String-Quelle wirkungslos', c.zone === 'support', c.zone);
    const b = await e.actionAddCreatureBuff(c, 'zz_test_buff', {});
    R.check('Buff ohne Quelle wird nicht hinzugefügt', b === false, c.counters.buffs);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── (C) Besitzer ──
  R.section('(C) eigene Quellen wirken');
  {
    const { t, c } = await szene(); const e = t.engine;
    const h0 = hp(c);
    await e.actionDealCreatureDamage(S0, c, 50, 'spell', { sourceOwner: 0 });
    R.check('eigener Schaden trifft (150 HP)', hp(c) === h0 - 50, [h0, hp(c)]);
    const b = await e.actionAddCreatureBuff(c, 'zz_test_buff', { source: S0 });
    R.check('eigener Buff wird hinzugefügt', b === true && !!c.counters.buffs?.zz_test_buff, c.counters.buffs);
    await e.actionRemoveCreatureBuff(c, 'zz_test_buff', { source: S0 });
    R.check('eigener Buff wird entfernt', !c.counters.buffs?.zz_test_buff, c.counters.buffs);
    await e.applyCreatureStatus(c, 'frozen', { sourceOwner: 0, source: S0 });
    R.check('eigener Freeze haftet', !!c.counters.frozen, c.counters);
    await e.actionNegateCreature(c, 'Eigene Negation', { sourceOwner: 0 });
    R.check('eigene Negation wirkt', !!c.counters.negated, c.counters);
    R.check('Golden-Wings-Schutz bleibt dabei bestehen', c.counters._gwImmune === true, c.counters);
    await e.actionMoveCard(c, 'hand', undefined, undefined, { source: S0 });
    R.check('eigener Bounce (Zonenwechsel) wirkt', c.zone !== 'support', c.zone);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const { t, c } = await szene(); const e = t.engine;
    await e.actionDestroyCard(S0, c);
    R.check('eigenes Zerstören wirkt', c.zone !== 'support', c.zone);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── (C2) echter Gegner-Zauber und eigene Heilung/Buff über echte Wege ──
  R.section('(C2) echte Spielwege');
  {
    const { t, c } = await szene();
    t.setHand(1, ['Fireball']); t.gs.activePlayer = 1;
    t.targetFn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 0); return x ? [x.id] : (v[0] ? [v[0].id] : null); };
    const h0 = hp(c);
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('Gegner-Fireball auf die geschützte Kreatur: kein Schaden', hp(c) === h0 && c.zone === 'support', [h0, hp(c)]);
    // Kontrolle: dieselbe Zauberwahl trifft eine UNgeschützte Kreatur
    const u = t.put(0, 1, 0, H.INERT.creature);
    t.setHand(1, ['Fireball']); t.gs.activePlayer = 1;
    t.targetFn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 0 && y.heroIdx === 1); return x ? [x.id] : null; };
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('Kontrolle: Fireball trifft eine ungeschützte Kreatur', hp(u) < 200 || u.zone !== 'support', hp(u));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── (D) Cardinal Beast unverändert, Ablauf ──
  R.section('(D) Cardinal unverändert, Ablauf');
  {
    const t = await H.fresh({ hand: [[], []] });
    const b = t.put(0, 0, 0, 'Cardinal Beast Baihu'); b.counters._cardinalImmune = true;
    const max = b.counters.maxHp ?? 500;
    await t.engine.actionDealCreatureDamage(S0, b, 50, 'spell', { sourceOwner: 0 });
    R.check('Cardinal Beast: auch EIGENER Schaden prallt ab (quellenblind wie bisher)', (b.counters.currentHp ?? max) === max, [max, b.counters.currentHp]);
    const ok = await t.engine.actionAddCreatureBuff(b, 'zz_test_buff', { source: S0 });
    R.check('Cardinal Beast: eigener Buff wird nicht hinzugefügt', ok === false, b.counters.buffs);
  }
  {
    const { t, c } = await szene(); const e = t.engine;
    await t.endTurn();   // Ablauf: Ende des laufenden Halbzugs
    R.check('nach Zugende: _gwImmune und Buff weg', !c.counters._gwImmune && !c.counters.buffs?.golden_wings && !c.counters.untargetable_by_opponent, c.counters);
    const h0 = hp(c);
    await e.actionDealCreatureDamage(S1, c, 50, 'spell', { sourceOwner: 1 });
    R.check('danach trifft der Gegner wieder', hp(c) === h0 - 50, [h0, hp(c)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
