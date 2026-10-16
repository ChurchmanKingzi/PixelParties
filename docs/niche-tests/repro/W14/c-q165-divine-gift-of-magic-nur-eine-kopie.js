'use strict';
// W14c · Q165 (S01-24) Divine Gift of Magic: „that Spell's level in your hand is reduced by 3" gilt NUR für die eine offenbarte Kopie (Al 16.10.2026: „Nur die eine Kopie")
// Aufbau: Held 0 ohne Destruction Magic; Hand: Divine Gift of Magic, Fireball (Lv2) ×2 (+ später gezogene dritte Kopie). Offenbart wird die ZWEITE Kopie (Handindex 2).
// Erwartet: nur diese Kopie ist gesenkt (spielbar ohne Destruction Magic); die erste und eine später dazugekommene Kopie bleiben auf Lv2 (nicht spielbar);
//   die Senkung hängt an der Kopie (Hand-Splice durch das Ausspielen des Gifts verschiebt sie mit) und verfällt am Zugbeginn.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of Magic', 'Fireball', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
  const ps = t.gs.players[0];
  t.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => { const i = d.eligibleIndices[d.eligibleIndices.length - 1]; return { cardName: ps.hand[i], handIndex: i }; } });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Divine Gift of Magic', { hero: 0, noGrant: true });
  t.addHand(0, 'Fireball');                                   // später gezogene Kopie desselben Namens
  const cd = t.engine._getCardDB()['Fireball'];
  const lvl = (idx) => t.engine.effectiveCardLevel(cd, 0, { heroIdx: 0, handIdx: idx });   // Stufe GENAU dieser Kopie
  const kann = (idx) => lvl(idx) === 0;                                                      // Fireball Lv2 − 3 = 0: nur die gesenkte Kopie
  R.note('Hand nach dem Gift', ps.hand);
  const idxs = ps.hand.map((n, i) => n === 'Fireball' ? i : -1).filter(i => i >= 0);
  R.check('drei Fireballs auf der Hand', idxs.length === 3, ps.hand);
  R.check('die erste Kopie bleibt auf Lv2 (Stufe 2)', lvl(idxs[0]) === 2, idxs);
  R.check('die offenbarte (zweite) Kopie ist gesenkt (Stufe 0)', kann(idxs[1]), idxs);
  R.check('die später dazugekommene dritte Kopie bleibt auf Lv2', lvl(idxs[2]) === 2, idxs);
  const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true });
  R.check('Fireball spielbar über den echten Spielweg (nur die offenbarte Kopie ging durch)', r === true, r);
  R.check('es bleiben zwei Fireballs auf der Hand', ps.hand.filter(n => n === 'Fireball').length === 2, ps.hand);
  const idx2 = ps.hand.map((n, i) => n === 'Fireball' ? i : -1).filter(i => i >= 0);
  R.check('die übrigen Kopien sind nicht gesenkt', idx2.every(i => lvl(i) === 2), idx2);
  R.check('Stempel/Offset aufgeräumt, wenn die Kopie die Hand verlässt', Object.keys(ps._handLevelOffsetsTransient || {}).length === 0, ps._handLevelOffsetsTransient);
  // Verfall: Gift offenbart die zweite Kopie, das Zugende räumt die Senkung ab
  const t2 = await H.fresh({ hand: [['Divine Gift of Magic', 'Fireball', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
  const p2 = t2.gs.players[0];
  t2.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => { const i = d.eligibleIndices[d.eligibleIndices.length - 1]; return { cardName: p2.hand[i], handIndex: i }; } });
  await t2.play(0, 'Divine Gift of Magic', { hero: 0, noGrant: true });
  await t2.endTurn(); await t2.endTurn();
  const cd2 = t2.engine._getCardDB()['Fireball'];
  const l2 = p2.hand.map((n, i) => n === 'Fireball' ? t2.engine.effectiveCardLevel(cd2, 0, { heroIdx: 0, handIdx: i }) : -1).filter(x => x >= 0);
  R.check('„until the end of this turn": nach dem Zugwechsel sind beide Kopien wieder Stufe 2', l2.length >= 2 && l2.every(x => x === 2), l2);
  R.check('keine Engine-Fehler', t.errors.length === 0 && t2.errors.length === 0, [t.errors, t2.errors]);
  R.finish();
})();
