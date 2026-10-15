'use strict';
// W10a · R6 (Equip-Fenster `_checkSurpriseOnEquip`) · Al, 15.10.2026: „Kommt drauf an, wie die Karten geworded sind. 'When your opponent plays a card' beachtet
//   den Spielenden. 'When a card is placed into an opponent's zone' beachtet, wo die Karte landet, egal, wer sie spielt.“
//   Cybug LOCUST: „Activate this Surprise when your opponent equips or attaches a card to a Hero **they control** …“
//   Afflicted Pests: „Activate this Surprise when your opponent equips or attaches a card to **a Hero** …“
// Erwartet (Cross-Side-Ausrüstung: Control Device / Powder Keg, Sitz 0 legt sie an einen Helden von Sitz 1 = den Besitzer der Surprise):
//   * Afflicted Pests (Sitz 1) löst aus: der Gegner (Spielende) legt an, der Held ist egal.
//   * Cybug LOCUST (Sitz 1) löst NICHT aus: der Held ist keiner, den der Gegner kontrolliert.
//   * Legt Sitz 1 SELBST eine Control Device an einen Helden von Sitz 0, löst Afflicted Pests (Sitz 1) nicht aus (maßgeblich ist, wer anlegt).
//   * Regression: gewöhnliches Anlegen des Gegners an den EIGENEN Helden löst beide aus.
//   (Powder Keg ist eine „Artifact Creature“ und wird platziert, nicht ausgerüstet: das Equip-Fenster ist für sie nicht zuständig – nur die Gegenprobe LOCUST.)
const H = require('../../lib/h.js');
const PESTS = 'Afflicted Pests', LOC = 'Cybug LOCUST', FUEL = "Treasure Hunter's Backpack", CTL = 'Future Tech Control Device', KEG = 'Powder Keg';
const gefragt = (t, n) => t.prompts.some(p => new RegExp(n).test(JSON.stringify(p.d)));
(async () => {
  const R = H.runner();
  for (const karte of [CTL, KEG]) {
    const equip = karte === CTL;
    // (a) Cross-Side durch Sitz 0: Pests ja, LOCUST nein
    if (equip) {
      const t = await H.fresh({ hand: [[karte], [FUEL]], gold: 100 });
      t.putSurprise(1, 0, PESTS); t.grantFor(1, 0, PESTS);
      await t.play(0, karte, { hero: 0, targetOwner: 1 });
      R.check(karte + ' cross-side: Afflicted Pests löst aus', gefragt(t, PESTS), t.prompts.map(p => p.d.type));
      R.check(karte + ' cross-side: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await H.fresh({ hand: [[karte], [FUEL]], gold: 100 });
      t.putSurprise(1, 0, LOC); t.grantFor(1, 0, LOC);
      await t.play(0, karte, { hero: 0, targetOwner: 1 });
      R.check(karte + ' cross-side: Cybug LOCUST löst NICHT aus („a Hero they control“)', !gefragt(t, LOC) && !t.pile(1, 'deletedPile').includes(FUEL), { prompts: t.prompts.map(p => p.d.type), del: t.pile(1, 'deletedPile') });
      R.check(karte + ' cross-side: Karte liegt beim Gegner-Helden (Sitz 1)', [0, 1, 2].some(s => t.zone(1, 0, s) === karte), [0, 1, 2].map(s => t.zone(1, 0, s)));
      R.check(karte + ' cross-side (LOCUST): keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    // (b) Sitz 1 legt SELBST an: die eigene Pests löst nicht aus
    if (equip) {
      const t = await H.fresh({ hand: [[], [karte]], gold: 100, active: 1 });
      t.putSurprise(1, 0, PESTS); t.grantFor(1, 0, PESTS);
      await t.play(1, karte, { hero: 0, targetOwner: 0 });
      R.check(karte + ' selbst angelegt: die eigene Afflicted Pests löst NICHT aus', !gefragt(t, PESTS), t.prompts.map(p => p.d.type));
      R.check(karte + ' selbst angelegt: keine Engine-Fehler', t.errors.length === 0, t.errors);
    }
    // (c) Sitz 1 legt an einen Helden von Sitz 0 an: die Pests von Sitz 0 löst aus
    if (equip) {
      const t = await H.fresh({ hand: [[], [karte]], gold: 100, active: 1 });
      t.putSurprise(0, 0, PESTS); t.grantFor(0, 0, PESTS);
      await t.play(1, karte, { hero: 0, targetOwner: 0 });
      R.check(karte + ' Sitz 1 legt an Sitz 0 an: Afflicted Pests (Sitz 0) löst aus', gefragt(t, PESTS), t.prompts.map(p => p.d.type));
    }
  }
  // (d) Regression: gewöhnliches Anlegen des Gegners an den eigenen Helden
  for (const surp of [PESTS, LOC]) {
    const t = await H.fresh({ hand: [['Future Tech Gun'], [FUEL]], gold: 100 });
    t.putSurprise(1, 0, surp); t.grantFor(1, 0, surp);
    await t.play(0, 'Future Tech Gun', { hero: 0 });
    R.check('Regression: ' + surp + ' löst beim normalen Anlegen des Gegners aus', gefragt(t, surp), t.prompts.map(p => p.d.type));
    R.check('Regression ' + surp + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
