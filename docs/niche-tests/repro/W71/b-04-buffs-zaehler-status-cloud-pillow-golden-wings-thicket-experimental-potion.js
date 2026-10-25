'use strict';
// W71b-04 · Cool Rescuer Monia: BUFFS, DEBUFFS, ZÄHLER und STATUS auf Kreaturen öffnen das Fenster
//
// „would be affected by a card or effect" gilt für jede Zustandsänderung an einer Kreatur, nicht nur für Schaden/Zerstören: Buff/Debuff (`actionAddCreatureBuff`: Cloud Pillow, Disruption Ray, Golden Wings),
// Marken/Zähler direkt am Skript (Thicket, Perfect Disguise, Experimental Potion) und Status (Gift). Vorher fragte Monia hier nie. Jetzt: `engine.kreaturBetroffen(inst, 'buff' | 'status', Quelle)` vor der ersten
// Änderung (Effektart und Quelle stehen im Hook-Kontext); negiert = nichts davon wird geschrieben (auch keine Zusatz-Marken wie bei Golden Wings oder Experimental Potion).
// Aufruf: node docs/niche-tests/repro/W71/b-04-….js   (Exit 0 = korrekt; auf dem Stand vor W71b rot)
const S = require('../../lib/monia-sweep.js');
const { H } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

const DEFS = [
  { name: 'Cloud Pillow', hand: ['Cloud Pillow'], ziel: 'eigen', spiel: (t, W, h) => t.play(W, 'Cloud Pillow', { hero: h }) },
  { name: 'Disruption Ray', hand: ['Disruption Ray'], ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Disruption Ray', { hero: h }) },
  { name: 'Golden Wings', hand: ['Golden Wings'], ziel: 'eigen', spiel: (t, W, h) => t.play(W, 'Golden Wings', { hero: h }) },
  { name: 'Thicket', hand: ['Thicket'], ziel: 'eigen', spiel: (t, W, h) => t.play(W, 'Thicket', { hero: h }) },
  { name: 'Perfect Disguise', hand: ['Perfect Disguise'], ziel: 'eigen', spiel: (t, W, h) => t.play(W, 'Perfect Disguise', { hero: h }) },
  { name: 'Experimental Potion', hand: ['Experimental Potion'], ablage: 0, ziel: 'eigen', spiel: (t, W, h) => t.play(W, 'Experimental Potion', { hero: h }) },
  { name: 'Toxic Fumes', hand: ['Toxic Fumes'], flaeche: true, ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Toxic Fumes', { hero: h }) },
  { name: 'Medusa\'s Curse', hand: ['Medusa\'s Curse'], flaeche: true, ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Medusa\'s Curse', { hero: h }) },
];

(async () => {
  const R = H.runner();
  await S.tabelle(R, DEFS);
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
