'use strict';
// W13c · Rückfrage 3 (Sandy Blob bei Cute Cat) · Al, 15.10.2026: „Ja, löst aus." → Ist-Zustand, keine Änderung (Absicherung).
//   Cute Cat: „When you summon this Creature, immediately send it to the discard pile. …" — das ist ein On-Summon-Effekt im Kartentext, der wirkt;
//   Sandy Blob: „Up to 3 times per turn, when the on-summon effect of a Creature you control activates, you may choose a target your opponent controls and deal 50 damage to it."
// Erwartung: Cute Cat wird beschworen (landet sofort in der Ablage), der Blob bietet seine 50 Schaden an (Gegner-Held verliert 50), keine Engine-Fehler. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Cute Cat'], []], deck: [Array(10).fill(H.INERT.filler), []], gold: 100 });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.put(0, 0, 2, 'Sandy Blob').turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  let fenster = 0;
  t.targetFn = (valid, cfg) => { if (cfg && cfg.title === 'Sandy Blob') fenster++; return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; };
  t.policy.confirm = true;
  const h0 = t.hp(1, 0);
  const r = await t.play(0, 'Cute Cat', { hero: 0, slot: 0, extra: 3 });
  R.check('Cute Cat gespielt', r === true, r);
  R.check('Cute Cat liegt sofort in der Ablage (nicht auf dem Brett)', t.pile(0, 'discardPile').includes('Cute Cat') && !t.find('Cute Cat', 'support'), { disc: t.pile(0, 'discardPile') });
  R.check('Sandy-Blob-Fenster öffnet sich (Cute Cat löst aus)', fenster >= 1, fenster);
  R.check('Gegner-Held verliert 50', h0 - t.hp(1, 0) === 50, h0 - t.hp(1, 0));
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
