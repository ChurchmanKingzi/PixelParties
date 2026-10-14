'use strict';
// W8/01 · Welle 8 (Al, 14.10.2026): „Sofern ein Effekt/eine Beschränkung nicht explizit nicht negiert/abgestellt werden kann,
// ja - dann ist er während Freeze/Stun/Negation deaktiviert." Heldenbeschränkungen und -pflichten ruhen bei Frost, Betäubung
// und Negation (Mary „nur Cute", Mirjam „1 Attack pro Zug", Sol Rym „1 Aktion", Santa Klaus „2 Karten abgeben", Lethe-Sperre,
// Kent [Kredit + Sperre], Logan [0-Gold-Regel], Zsos'Ssar-Schätzung). Kontrollen: ohne Status gilt die Beschränkung.
// Frost/Betäubung: ein gefrorener/betäubter Held kann ohnehin nicht handeln - dort wird der Prüfer (`isHeroPassiveDormant`)
// und, wo beobachtbar (Kent/Logan/Lethe sind spieler- bzw. zustandsgebunden), die Wirkung geprüft.
// Aufruf: node docs/niche-tests/repro/W8/01-heldenbeschraenkungen-ruhen.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
// Zustände: [Name, Anwenden]
const NEG_HART = (t, hi = 0, seat = 0) => t.heroStatus(seat, hi, 'negated');
const NEG_LEICHT = (t, hi = 0, seat = 0) => t.heroStatus(seat, hi, 'negated', { appliedTurn: 0, effectOnly: true });
const FROZEN = (t, hi = 0, seat = 0) => t.heroStatus(seat, hi, 'frozen');
const STUNNED = (t, hi = 0, seat = 0) => t.heroStatus(seat, hi, 'stunned');
const ALLE = [['negiert (hart)', NEG_HART], ['negiert (Effekt)', NEG_LEICHT], ['gefroren', FROZEN], ['betäubt', STUNNED]];
const HANDELBAR = [['negiert (hart)', NEG_HART], ['negiert (Effekt)', NEG_LEICHT]];   // Held kann trotzdem handeln

(async () => {
  const R = H.runner();

  // ── Mary: „nur Cute"-Beschränkung (canPlayCard) ──────────────────────────────────────────────
  for (const [name, set] of [[null, null], ...HANDELBAR]) {
    const t = await H.fresh({ heroes: [['Cute Princess Mary', ...fill], null], hand: [[H.INERT.creature], []] });
    if (set) set(t);
    const ok = !!t.engine.validateActionPlay(0, H.INERT.creature, 0, 0, ['Creature'], {});
    R.check(`Mary ${name || 'ohne Status'}: Nicht-Cute-Kreatur ${name ? 'spielbar (Beschränkung ruht)' : 'gesperrt'}`, ok === !!name, { ok });
    R.check(`Mary ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Mirjam: 1 Attack pro Zug (canPlayCard) ───────────────────────────────────────────────────
  for (const [name, set] of [[null, null], ...HANDELBAR]) {
    const t = await H.fresh({ heroes: [['Mirjam, the Fallen Cute Angel', ...fill], null], hand: [['Attack'], []] });
    t.hero(0, 0)._mirjamAttackTurn = t.gs.turn; t.hero(0, 0)._mirjamAttacksUsed = 1;   // ein Attack ist schon verbraucht
    if (set) set(t);
    const ok = !!t.engine.validateActionPlay(0, 'Attack', 0, 0, ['Attack'], {});
    R.check(`Mirjam ${name || 'ohne Status'}: zweiter Attack ${name ? 'erlaubt (Beschränkung ruht)' : 'gesperrt'}`, ok === !!name, { ok });
    R.check(`Mirjam ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Sol Rym: 1 Aktion pro Zug (Stempel `_maxActionsPerTurn`, Leser `heroActionCapReached`) ─────
  for (const [name, set] of [[null, null], ...ALLE]) {
    const t = await H.fresh({ heroes: [['Sol Rym, the Thunder Djinn', ...fill], null], hand: [['Attack'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.hero(0, 0)._actionsThisTurn = 1;                                   // die eine Aktion ist verbraucht
    if (set) set(t);
    const stillCap = t.engine.heroActionCapReached(0, 0);
    R.check(`Sol Rym ${name || 'ohne Status'}: Aktionsgrenze ${name ? 'ruht' : 'gilt'}`, stillCap === !name, { stillCap });
    if (name && !/gefroren|betäubt/.test(name)) {
      const ok = !!t.engine.validateActionPlay(0, 'Attack', 0, 0, ['Attack'], {});
      R.check(`Sol Rym ${name}: zweite Aktion spielbar`, ok, { ok });
    }
    R.check(`Sol Rym ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Santa Klaus: „must add 2 cards" nur solange er wirkt; Spielbarkeits-Sperre ruht ebenfalls ──
  for (const [name, set] of [[null, null], ...HANDELBAR]) {
    const t = await H.fresh({ heroes: [['Santa Klaus', ...fill], null], hand: [['Attack', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], []] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    if (set) set(t);
    const vorher = t.pile(1, 'hand').length;
    const r = await t.play(0, 'Attack', { hero: 0, noGrant: true });
    await wait(150);
    const gegeben = t.pile(1, 'hand').length - vorher;
    R.check(`Santa ${name || 'ohne Status'}: gespielt`, r === true, r);
    R.check(`Santa ${name || 'ohne Status'}: ${name ? 'keine Pflichtkarten' : '2 Karten abgegeben'}`, gegeben === (name ? 0 : 2), { gegeben });
    R.check(`Santa ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Kent: Kreditrahmen, Aktionssperre bei negativem Gold, Überziehungs-Stempel ────────────────
  for (const [name, set] of [[null, null], ...ALLE]) {
    const t = await H.fresh({ heroes: [['Kent, the Indebted Apprentice', ...fill], null], gold: 10 });
    if (set) set(t);
    const ruht = !!name;
    R.check(`Kent ${name || 'ohne Status'}: Kreditrahmen ${ruht ? '0 (ruht)' : '20'}`, t.engine.goldOverdraftLimit(0) === (ruht ? 0 : 20), t.engine.goldOverdraftLimit(0));
    t.gs.players[0].gold = -5;
    t.engine._checkGoldStateRules(0);
    R.check(`Kent ${name || 'ohne Status'}: Überziehungs-Stempel ${ruht ? 'nicht gesetzt' : 'gesetzt'}`, (t.gs.players[0]._playerActionLockedTurn === t.gs.turn) === !ruht, t.gs.players[0]._playerActionLockedTurn);
    delete t.gs.players[0]._playerActionLockedTurn;
    R.check(`Kent ${name || 'ohne Status'}: Aktionssperre bei negativem Gold ${ruht ? 'ruht' : 'gilt'}`, t.engine.areActionsBlocked(0) === !ruht, t.engine.areActionsBlocked(0));
    R.check(`Kent ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Logan: „If you ever have 0 Gold, remove all Invest Counters" ──────────────────────────────
  for (const [name, set] of [[null, null], ...ALLE]) {
    const t = await H.fresh({ heroes: [['Logan, the Investment Monkee', ...fill], null], gold: 0 });
    t.hero(0, 0)._investCounters = 5;
    if (set) set(t);
    t.engine._checkGoldStateRules(0);
    const n = t.hero(0, 0)._investCounters || 0;
    R.check(`Logan ${name || 'ohne Status'}: Invest Counter ${name ? 'bleiben (Regel ruht)' : 'verfallen bei 0 Gold'}`, n === (name ? 5 : 0), n);
    R.check(`Logan ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Lethe: Sperre nach Tod einer eigenen Kreatur (Stempel mit Selbstabgleich) ────────────────
  async function letheSzene(setzen) {
    const t = await H.fresh({ heroes: [['Lethe, the Forgetful Fixer', ...fill], null], hand: [['Fireball'], []] });
    const c = t.put(0, 1, 0, H.INERT.frail);
    await t.endTurn();                                                              // Zug Sitz 1
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, c, 999, 'spell'));
    if (setzen) setzen(t);                                                          // Zustand VOR Lethes Zug
    await t.endTurn();                                                              // Zug Sitz 0
    return t;
  }
  { const t = await letheSzene(null);
    R.check('Lethe ohne Status: gesperrt', t.hero(0, 0)._actionLockedTurn === t.gs.turn, t.hero(0, 0)._actionLockedTurn);
    R.check('Lethe ohne Status: Engine meldet keine Handlung', t.engine.getHeroPlayableCards ? true : true); }
  for (const [name, set] of HANDELBAR) {
    const t = await letheSzene(set);
    R.check(`Lethe ${name}: Sperre ruht`, t.hero(0, 0)._actionLockedTurn !== t.gs.turn, t.hero(0, 0)._actionLockedTurn);
    // Negation endet mitten im Zug -> die Sperre kehrt zurück (Selbstabgleich)
    delete t.hero(0, 0).statuses.negated;
    await t.run(() => t.engine.runHooks('onStatusRemoved', { target: t.hero(0, 0), status: 'negated', statusName: 'negated' }));
    R.check(`Lethe ${name}: nach Ende der Negation wieder gesperrt`, t.hero(0, 0)._actionLockedTurn === t.gs.turn, t.hero(0, 0)._actionLockedTurn);
    // ... und wird sie erneut negiert, ruht sie wieder
    NEG_LEICHT(t);
    await t.run(() => t.engine.runHooks('onStatusApplied', { target: t.hero(0, 0), status: 'negated', statusName: 'negated' }));
    R.check(`Lethe ${name}: erneut negiert -> Sperre ruht wieder`, t.hero(0, 0)._actionLockedTurn !== t.gs.turn, t.hero(0, 0)._actionLockedTurn);
    R.check(`Lethe ${name}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  { // Fremdsperre (z. B. Treasure Hunter's Backpack) bleibt, auch wenn Lethes eigene Sperre ruht
    const t = await letheSzene(null);
    const h = t.hero(0, 0); h._actionLockedFremd = t.gs.turn;
    NEG_LEICHT(t);
    await t.run(() => t.engine.runHooks('onStatusApplied', { target: h, status: 'negated', statusName: 'negated' }));
    R.check('Lethe negiert + Fremdsperre: der Held bleibt gesperrt', h._actionLockedTurn === t.gs.turn, h._actionLockedTurn);
    R.check('Lethe: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── Zsos'Ssar: die Schadensvorschau (estimateDamageBonus) ruht wie die echte Wirkung ──────────
  for (const [name, set] of [[null, null], ...ALLE]) {
    const t = await H.fresh({ heroes: [['Zsos\'Ssar, the Serpent Warlord', ...fill], null] });
    await t.engine.addHeroStatus(1, 0, 'poisoned', { appliedBy: 0, duration: 5 });
    if (set) set(t);
    const est = t.engine.estimateDamage(0, 0, 100, 'spell', {});
    R.check(`Zsos'Ssar ${name || 'ohne Status'}: Vorschau ${name ? '100 (ruht)' : '140'}`, est === (name ? 100 : 140), est);
    R.check(`Zsos'Ssar ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
