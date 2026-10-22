'use strict';
// W49a · Punkt 6 · Al, 22.10.2026: Thalia, the Fun Fairy bekommt den Satz „You can only activate 1 copy of each Support Spell per turn."
// Regel: solange Thalia aktiv ist (lebt; kein Frost/Betäubung/Negierung — wie alle Helden-Passiven), darf ihr Besitzer pro Zug von jedem Support-Magic-Spell (nach Kartenname)
//   nur EINE Kopie wirken. Zwei verschiedene Support Spells: ja; Nicht-Support-Spell (Fireball): beliebig oft; ohne Thalia / mit ruhender Thalia / Thalia beim Gegner: keine Sperre;
//   nächster Zug: wieder frei; Abbruch der Zielwahl stempelt nicht; Support-Reaktion aus der Hand (Cure) wird bei gesperrtem Namen nicht angeboten; Sofort-Guss geprüft.
// Beide Sitze. Exit 0 = korrekt.
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const THALIA = 'Thalia, the Fun Fairy';
const HEAL = 'Heal', HASTE = 'Haste', FB = 'Fireball';
(async () => {
  const R = H.runner();
  const karten = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'data', 'cards.json'), 'utf8'));
  const th = (Array.isArray(karten) ? karten : (karten.cards || Object.values(karten))).find(c => c.name === THALIA);
  R.check('Kartentext wörtlich', th && th.effect === "The levels of all Support Magic Spells in your hand are reduced by this Hero's Friendship level. You do not draw cards through the effect of Friendship. You can only activate 1 copy of each Support Spell per turn.", th && th.effect);

  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const aufbau = async (hand, opts = {}) => {
      const heroes = [null, null];
      if (!opts.ohneThalia) heroes[opts.thaliaBeiGegner ? op : me] = [THALIA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
      const t = await H.fresh({ hand: me === 0 ? [hand, []] : [[], hand], gold: [500, 500], ...(heroes[0] || heroes[1] ? { heroes } : {}), ...(me ? { active: 1 } : {}), deckSize: 30 });
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 1) || v.find(y => y.owner === me) || v[0]; return x ? [x.id] : null; };
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: false }), once: false });
      for (const n of [HEAL, HASTE, FB, 'Brilliant Idea']) { try { t.grantFor(me, 1, n); t.grantFor(me, 0, n); } catch { /* egal */ } }
      return t;
    };
    const zahl = (t, n) => t.pile(me, 'hand').filter(x => x === n).length;

    { const t = await aufbau([HEAL, HEAL, HASTE, FB, FB, 'Cure']);
      const heroIdx = 1;
      const r1 = await t.play(me, HEAL, { hero: heroIdx });
      R.check('Heal #1 gespielt', r1 === true && zahl(t, HEAL) === 1, { r1, hand: t.pile(me, 'hand') });
      R.check('Sperre meldet „Heal" jetzt gesperrt', t.engine.thaliaSupportSperre(me, t.engine._getCardDB()[HEAL]) === true);
      const r2 = await t.play(me, HEAL, { hero: heroIdx });
      R.check('Heal #2 im selben Zug: nicht spielbar (bleibt auf der Hand)', zahl(t, HEAL) === 1, { r2, hand: t.pile(me, 'hand') });
      const r3 = await t.play(me, HASTE, { hero: heroIdx });
      R.check('anderer Support Spell (Haste): erlaubt', r3 === true && zahl(t, HASTE) === 0, { r3, hand: t.pile(me, 'hand') });
      const r4 = await t.play(me, FB, { hero: heroIdx }); const r5 = await t.play(me, FB, { hero: heroIdx });
      R.check('Nicht-Support-Spell (Fireball) beliebig oft: beide gespielt', zahl(t, FB) === 0, { r4, r5, hand: t.pile(me, 'hand') });
      // Support-Reaktion aus der Hand: gleicher Name gesperrt, anderer nicht
      const cureSc = H.loadCardEffect('Cure');
      const kandHeal = t.engine._rxCastKandidaten(t.gs.players[me], 'Cure', cureSc, {});
      R.check('Support-Reaktion (Cure, anderer Name) bleibt anbietbar', Array.isArray(kandHeal) && kandHeal.length > 0, kandHeal);
      t.gs.hoptUsed = t.gs.hoptUsed || {}; t.gs.hoptUsed[`thalia-support:Cure:${me}`] = t.gs.turn;
      const kandCure = t.engine._rxCastKandidaten(t.gs.players[me], 'Cure', cureSc, {});
      R.check('Support-Reaktion mit schon gewirktem Namen wird nicht angeboten', Array.isArray(kandCure) && kandCure.length === 0, kandCure);
      delete t.gs.hoptUsed[`thalia-support:Cure:${me}`];
      R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
      // nächster eigener Zug
      await t.endTurn(); await t.endTurn();
      t.addHand(me, HEAL);
      R.check('nächster Zug: Heal wieder frei', t.engine.thaliaSupportSperre(me, t.engine._getCardDB()[HEAL]) === false);
      const r6 = await t.play(me, HEAL, { hero: heroIdx });
      R.check('nächster Zug: Heal spielbar', r6 === true, { r6, hand: t.pile(me, 'hand') });
      R.check('Folgezug: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }

    // Gegenproben
    { const t = await aufbau([HEAL, HEAL], { ohneThalia: true });
      await t.play(me, HEAL, { hero: 1 }); await t.play(me, HEAL, { hero: 1 });
      R.check('ohne Thalia: beide Heal spielbar', zahl(t, HEAL) === 0, t.pile(me, 'hand')); }
    { const t = await aufbau([HEAL, HEAL], { thaliaBeiGegner: true });
      await t.play(me, HEAL, { hero: 1 }); await t.play(me, HEAL, { hero: 1 });
      R.check('Thalia nur beim Gegner: keine Sperre für mich', zahl(t, HEAL) === 0, t.pile(me, 'hand')); }
    for (const st of ['frozen', 'stunned', 'negated']) {
      const t = await aufbau([HEAL, HEAL]);
      t.heroStatus(me, 0, st);
      await t.play(me, HEAL, { hero: 1 }); await t.play(me, HEAL, { hero: 1 });
      R.check(`Thalia ${st}: Regel ruht, beide Heal spielbar`, zahl(t, HEAL) === 0, t.pile(me, 'hand'));
    }
    { const t = await aufbau([HEAL, HEAL]);   // Abbruch der Zielwahl stempelt nicht
      t.targetFn = () => null;
      await t.play(me, HEAL, { hero: 1 });
      R.check('abgebrochener Heal: nichts gestempelt', t.engine.thaliaSupportSperre(me, t.engine._getCardDB()[HEAL]) === false && zahl(t, HEAL) === 2, { hand: t.pile(me, 'hand') });
      t.targetFn = (v) => { const x = v.find(y => y.owner === me) || v[0]; return x ? [x.id] : null; };
      await t.play(me, HEAL, { hero: 1 });
      R.check('danach spielbar', zahl(t, HEAL) === 1, t.pile(me, 'hand')); }
    { const t = await aufbau([HEAL]);   // Sofort-Guss (Zusatzaktion): zweiter Heal-Guss gesperrt
      t.gs.hoptUsed = t.gs.hoptUsed || {}; t.gs.hoptUsed[`thalia-support:${HEAL}:${me}`] = t.gs.turn;
      const k = t.engine.kannSofortWirken(me, 1, HEAL);
      R.check('Sofort-Guss mit gesperrtem Namen nicht möglich', k === false, k);
      delete t.gs.hoptUsed[`thalia-support:${HEAL}:${me}`];
      R.check('Sofort-Guss ohne Stempel möglich', t.engine.kannSofortWirken(me, 1, HEAL) === true); }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
