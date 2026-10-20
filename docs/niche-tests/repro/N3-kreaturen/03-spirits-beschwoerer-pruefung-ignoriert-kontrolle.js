'use strict';
// N3-03 · Fünf der sechs „Spirit of the …"-Kreaturen prüfen „Hero equipped with X" an der Spalte des KONTROLLEURS statt am übernommenen Helden
// Kartentext: „This Creature can only be summoned by a Hero equipped with «X»." (Barbarian Sword, Forbidden Grimoire, Heart Bow, Shattered Trident, Super-Killing Knife; Relic Hammer genauso)
// Regel: „Beschwören mit einem Helden: nur der aktuelle Kontrolleur" (Al, Welle 20/22); ein übernommener Held steht in der Spalte seines Besitzers (`charmedOwner` im Spielweg),
//   die Engine ruft `canPlayWithHero(gs, pi, heroIdx, …)` mit dem Kontrolleur `pi` und dem Index des Helden. Spirit of the Relic Hammer löst das mit `heldSeite(gs, pi, heroIdx)`;
//   die anderen fünf lesen `c.owner === pi && c.heroIdx === heroIdx` (Spalte des Kontrolleurs mit gleichem Index).
// Aufbau: Sitz 0 hat den Spirit auf der Hand. (a) FALSCH-POSITIV: Sitz 0s eigener Held 0 trägt die Ausrüstung; der übernommene Gegnerheld 1/0 trägt sie nicht – Sitz 0 beschwört
//   mit dem übernommenen 1/0. (b) FALSCH-NEGATIV: der übernommene Gegnerheld 1/0 trägt die Ausrüstung, Sitz 0s eigener Held 0 nicht.
// Erwartet: (a) abgelehnt (der beschwörende Held trägt nichts), (b) angenommen.   Beobachtet: (a) angenommen, (b) abgelehnt – für fünf der sechs Spirits (Hammer korrekt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SP = [
    ['Spirit of the Barbarian Sword', 'Legendary Sword of a Barbarian King'],
    ['Spirit of the Forbidden Grimoire', 'Forbidden Grimoire of a Forgotten Sorceress'],
    ['Spirit of the Heart Bow', 'Heart-Shaped Bow, the Final Proof of Cuteness'],
    ['Spirit of the Relic Hammer', 'Earth-Shattering Hammer, Relic of Deri'],
    ['Spirit of the Shattered Trident', 'Shattered Trident, Treasure of the Deepsea'],
    ['Spirit of the Super-Killing Knife', 'Super-Killing Knife, the Tool of Liquidation'],
  ];
  for (const [sp, eq] of SP) {
    const kurz = sp.replace('Spirit of the ', '');
    { // Gegenprobe: eigener Held mit Ausrüstung beschwört (normaler Weg)
      const t = await H.fresh({ hand: [[sp], []] });
      t.put(0, 0, 0, eq);
      const r = await t.play(0, sp, { hero: 0 });
      R.check(`${kurz}: Gegenprobe – eigener Held mit Ausrüstung beschwört`, r === true && !!t.find(sp, 'support'), r);
    }
    { // Gegenprobe: eigener Held ohne Ausrüstung darf nicht
      const t = await H.fresh({ hand: [[sp], []] });
      const r = await t.play(0, sp, { hero: 0 });
      R.check(`${kurz}: Gegenprobe – eigener Held ohne Ausrüstung wird abgelehnt`, !t.find(sp, 'support'), r);
    }
    { // (a) falsch-positiv
      const t = await H.fresh({ hand: [[sp], []] });
      t.put(0, 0, 0, eq);                                               // MEIN Held 0 trägt die Ausrüstung
      const ok = t.engine.actionStealHero(0, 1, 0, { sourceName: 'test' });   // übernommener Gegnerheld 1/0 ohne Ausrüstung
      const r = await t.play(0, sp, { hero: 0, charmedOwner: 1, slot: 0 });
      R.check(`${kurz}: (a) übernommener Held OHNE Ausrüstung darf den Spirit nicht beschwören`, ok === true && !t.find(sp, 'support'), { ok, r });
    }
    { // (b) falsch-negativ
      const t = await H.fresh({ hand: [[sp], []] });
      t.put(1, 0, 0, eq);                                               // der übernommene Gegnerheld 1/0 trägt die Ausrüstung
      const ok = t.engine.actionStealHero(0, 1, 0, { sourceName: 'test' });
      const r = await t.play(0, sp, { hero: 0, charmedOwner: 1, slot: 1 });
      R.check(`${kurz}: (b) übernommener Held MIT Ausrüstung darf den Spirit beschwören`, ok === true && r === true && !!t.find(sp, 'support'), { ok, r });
    }
  }
  R.finish();
})();
