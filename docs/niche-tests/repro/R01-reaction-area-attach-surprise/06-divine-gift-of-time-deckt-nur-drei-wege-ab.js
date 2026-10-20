'use strict';
// W21a (Al, 20.10.2026): umgestellt — Divine Gift of Time braucht jetzt einen Wirker-Helden mit Magic Arts 2 (hier Sitz 0, Held 2 mit Magic Arts x2); vorher prüfte die Karte keinen Helden.
// R01-06 · Divine Gift of Time reagiert nur auf Mill, Abwurf und Kreaturentod – nicht auf andere Wege in die Ablage
// Kartentext: „You can only activate 1 "Divine Gift" card per game. Play this card immediately when 1 or more cards are sent to your discard pile from anywhere.
//   Add those cards to your hand instead."
// Skriptkopf (divine-gift-of-time.js): „Triggering paths covered: Mill, Discard, Creature death" – `hooks.onMill / onDiscard / onCreatureDeath`.
// Aufbau: Sitz 0 hält Divine Gift of Time + ZZ Filler auf der Hand. (a) Mill 2 → Kontrolle. (b) ein Attachment (Curse) im Support von Held 0 wird zerstört.
//   (c) eine verdeckte Booby Trap von Sitz 0 wird ausgelöst und geht in die Ablage.
// Erwartet (Wortlaut „from anywhere"): auch (b) und (c) öffnen die Abfrage „Use Divine Gift of Time …?".
// Beobachtet: (a) ✓ Abfrage; (b) und (c) ohne Abfrage – die Karte liegt in der Ablage, Time bleibt auf der Hand.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ abilities: { 0: { 2: [['Magic Arts', 'Magic Arts']] } }, hand: [['Divine Gift of Time', 'ZZ Filler'], []] });
    await t.run(() => t.engine.actionMillCards(0, 2, { selfInflicted: true }));
    await sleep(50);
    R.check('(a) Mill löst die Abfrage aus (Kontrolle)', t.prompts.some(p => p.d.title === 'Divine Gift of Time'), t.prompts.map(p => p.d.title));
  }
  {
    const t = await H.fresh({ abilities: { 0: { 2: [['Magic Arts', 'Magic Arts']] } }, hand: [['Divine Gift of Time', 'ZZ Filler'], []] });
    const c = t.put(0, 0, 0, 'Curse');
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, c));
    await sleep(50);
    R.check('(b) zerstörtes Attachment (Curse → Ablage) löst die Abfrage aus', t.prompts.some(p => p.d.title === 'Divine Gift of Time') && t.pile(0, 'hand').includes('Curse'), { disc: t.pile(0, 'discardPile'), prompts: t.prompts.map(p => p.d.title) });
  }
  {
    const t = await H.fresh({ abilities: { 0: { 2: [['Magic Arts', 'Magic Arts']] } }, hand: [['Divine Gift of Time', 'ZZ Filler'], ['Fireball']] });
    t.putSurprise(0, 0, 'Booby Trap'); t.grantFor(0, 0, 'Booby Trap');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(1, 'Fireball', { hero: 0 });
    await sleep(50);
    R.check('(c) ausgelöste Surprise (Booby Trap → Ablage) löst die Abfrage aus', t.prompts.some(p => p.d.title === 'Divine Gift of Time'), { disc: t.pile(0, 'discardPile'), prompts: t.prompts.map(p => p.d.title) });
  }
  R.finish();
})();
