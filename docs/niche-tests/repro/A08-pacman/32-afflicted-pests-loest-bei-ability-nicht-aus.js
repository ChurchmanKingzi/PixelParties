// A08-32 · Afflicted Pests: reagiert nicht, wenn der Gegner eine ABILITY an einen Helden anlegt
// ENTSCHIEDEN (Al, Welle 11, Q59): „Nein. Hier sollte der Regeltext etwas klarer sein (etwa 'equips or attaches a card into a Hero's Support Zone' oder so)" – Abilities liegen in
//   Ability-Zonen, nicht in Support Zones; Kartentext jetzt „… equips or attaches a card into a Hero's Support Zone." (UMGESTELLT: Ability ⇒ Pests löst NICHT aus; Ausrüstung ⇒ löst aus.)
// (Alter Kartentext: „equips or attaches a card to a Hero")
//
// Kartentext: „Activate this Surprise when your opponent equips or attaches a card to a Hero. Choose a card in any Hero's Support Zone and send it to the discard pile, …"
// Noble Mummy Guards (Schwesterkarte) sagt „attaches an Ability to a Hero" – im Spiel werden Abilities also „attached" (auch Waflav: „Attach an additional Ability … to this Hero").
// Aufbau: Sitz 0: Afflicted Pests als Surprise an Held 0, eine Dummy in der Support Zone; Sitz 1 legt Fighting (bzw. Resistance) an Held 0 an. Vergleich: Sitz 1 rüstet Club of Gobbo aus → Pests löst aus.
// (Lesart B ist die verbindliche Regel: nur Karten, die in eine Support Zone treten.)
// Beobachtet: Bei Abilities löst Pests nicht aus (Lesart B); `_engine.js` ~3567 ruft `_checkSurpriseOnEquip` nur beim Eintritt in eine Support Zone, nicht bei Ability-Zonen.
// Aufruf: node docs/niche-tests/repro/A08-pacman/32-afflicted-pests-loest-bei-ability-nicht-aus.js   (✗ = Regel verletzt)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, F = H.INERT.filler;
  for (const [karte, erwartet] of [['Club of Gobbo', 'Kontrolle (Ausrüstung)'], ['Fighting', 'Ability'], ['Resistance', 'Ability']]) {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    t.grantFor(0, 0, 'Afflicted Pests');
    t.putSurprise(0, 0, 'Afflicted Pests');
    const d = t.put(0, 0, 0, D); d.turnPlayed = 1;
    t.targetFn = (valid) => [valid[0].id];
    t.reset();
    await t.play(1, karte, { hero: 0 });
    const ausgeloest = t.inst(c => c.name === 'Afflicted Pests').some(c => c.zone === 'support');
    R.note(`${karte} (${erwartet})`, JSON.stringify({ ausgeloest }));
    const soll = erwartet.startsWith('Kontrolle');   // nur die Ausrüstung öffnet das Fenster, Abilities nicht
    R.check(`${karte}: Pests ${soll ? 'löst aus' : 'löst NICHT aus'}`, ausgeloest === soll, { ausgeloest });
    R.check(`${karte}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
