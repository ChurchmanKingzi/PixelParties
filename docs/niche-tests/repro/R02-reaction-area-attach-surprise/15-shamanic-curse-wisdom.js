'use strict';
// R02-15 · Shamanic Curse + Wisdom: (a) die gerade gewirkte Spielkarte gilt als Handkarte für den Wisdom-Abwurf, (b) der zusätzliche Wisdom-Abwurf wird nie bezahlt
// Kartentext: „Play this card immediately when an opponent's Hero uses a Spell. Increase that Spell's level by 1. If the Spell's level is now too high for that Hero to use it, it is negated and sent to the discard pile. If it does, your opponent may immediately perform an additional Action afterwards."
// Skript (shamanic-curse.js): „Spell survives iff the caster CAN cover it [mit Wisdom] AND has enough hand cards to pay. The original cast already paid its own Wisdom cost before this reaction — we don't charge more."
// Wisdom: „This Hero can use Spells 1 level higher than it normally could. If this Hero uses a Spell it would not be able to use without this effect, discard [Karten] …"
// Aufbau: Sitz 0, Held 0 mit Destruction Magic 1 + Wisdom 1 spielt Burning Finger (Lv1, ohne Wisdom castbar) auf Held 0 von Sitz 1. Sitz 1 hält Shamanic Curse (Held 0 mit Decay Magic 3).
//   Das Level steigt auf 2 ⇒ nur noch mit Wisdom castbar, Kosten 1 Handkarte. Variante A: Hand von Sitz 0 = nur der Burning Finger. Variante B: Burning Finger + 2 Heal.
// Erwartet: A: Sitz 0 hat nichts zum Abwerfen (der Zauber selbst ist keine Handkarte mehr) ⇒ Burning Finger wird negiert (Held 0 von Sitz 1 bleibt bei 800 HP, Karte in der Ablage). 
//   B: Die Wisdom-Kosten des erhöhten Levels (1 Handkarte) werden gezahlt oder der Zauber negiert; Sitz 0 hat danach nur noch 1 Heal.
// Beobachtet: A: der Zauber „überlebt" und trifft (700 HP) – gezählt wird die Hand inkl. des laufenden Zaubers (gleiche Ursache wie R02-07). B: der Zauber überlebt, aber es wird nichts abgeworfen (beide Heal bleiben).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const variante of ['A: nur der Zauber auf der Hand', 'B: 2 weitere Handkarten']) {
    const t = await H.fresh({ hand: [['Burning Finger', ...(variante.startsWith('B') ? ['Heal', 'Heal'] : [])], ['Shamanic Curse']], hp: 800 });
    t.setAbilities(0, 0, [['Destruction Magic'], ['Wisdom'], []]);
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []]);
    t.policy.confirm = true;
    t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid[0]).id];
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    const gefragt = t.prompts.some(p => p.d.title === 'Shamanic Curse');
    R.check(`${variante}: Aufbau – Shamanic Curse wurde angeboten`, gefragt, t.prompts.map(p => p.d.title));
    if (variante.startsWith('A')) {
      R.check('A: Burning Finger wird negiert (Sitz 1 unversehrt)', t.hp(1, 0) === 800, { hp1: t.hp(1, 0), hand0: t.pile(0, 'hand') });
    } else {
      const heal = t.pile(0, 'hand').filter(c => c === 'Heal').length;
      R.check('B: der Wisdom-Abwurf des erhöhten Levels wird gezahlt (1 Heal weg) oder der Zauber negiert', heal === 1 || t.hp(1, 0) === 800, { heal, hp1: t.hp(1, 0) });
    }
    R.check(`${variante}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
