'use strict';
// A01-pollution-10 (Stufe C – Regelfrage) · Guardian of Teocuilatl schützt nur die EIGENEN Areas
// Kartentext: „When an Area would be affected by a card or effect, you may sacrifice this Creature from your hand or side of the board to negate all effects
//   that card or effect would have on that Area.“  (Vergleich Warrior of Teocuilatl desselben Archetyps: „a Creature EITHER PLAYER controls“ – dort ausdrücklich beide Seiten.)
// Frage an Al: Soll Guardian jede Area schützen dürfen („an Area“, auch eine gegnerische, z. B. um eine Gegner-Area zu behalten, die MIR nützt/nicht schadet),
//   oder nur die eigenen Areas?  Das Skript schränkt ohne Ruling ein („Only protect YOUR OWN Areas“: `if (ctx.affectedOwner !== pi) return;`).
// Beobachtet: Reality Crack (zwei Areas auf dem Brett: Acid Rain von Sitz 0, Cosmic Depths von Sitz 1). Guardian auf der Hand von Sitz 0 wird nur für Sitz 0s
//   eigene Area angeboten (Sitz 1s Area wird ohne Angebot gelöscht); Guardian auf der Hand von Sitz 1 nur für Sitz 1s eigene Area.
// Welle 9 (Al, 15.10.2026): Antwort „entsprechend dem Text“ – „an Area“ = jede Area; die Regel ist umgesetzt, das Repro misst jetzt mit echtem „Nein“.
// Aufruf: node docs/niche-tests/repro/A01-pollution/10-guardian-schuetzt-nur-eigene-areas.js   (✗ = die Gegner-Area wird NICHT angeboten)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Reality Crack', 'Guardian of Teocuilatl'], []] });
  t.putArea(0, 'Acid Rain'); t.putArea(1, 'Cosmic Depths');
  t.script.push({ match: d => d && d.type === 'confirm' && d.title === 'Guardian of Teocuilatl', answer: () => null, once: false });   // Welle 9: echtes „Nein“ (policy.confirm=false wäre truthy)
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cancelled: true }) });
  await t.play(0, 'Reality Crack', { hero: 0 });
  const angebote = t.prompts.filter(p => p.d.title === 'Guardian of Teocuilatl').map(p => String(p.d.message).replace(/\s+/g, ' ').slice(0, 90));
  R.check('Guardian wird für die eigene Area angeboten (Acid Rain)', angebote.some(m => m.includes('Acid Rain')), angebote);
  R.check('Guardian wird auch für die GEGNERISCHE Area angeboten (Cosmic Depths) – „an Area“', angebote.some(m => m.includes('Cosmic Depths')), angebote);
  R.finish();
})();
