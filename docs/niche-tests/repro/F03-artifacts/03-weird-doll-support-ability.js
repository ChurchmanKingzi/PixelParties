'use strict';
// F03-artifacts-03 · Weird Doll: Ability in einer Support Zone (Xalibur) lässt sich nicht wählen – es trifft die Ability-Zone mit gleicher Nummer
// Kartentext: „Choose an Ability attached to a Hero you control and send it to the discard pile. Delete this card."
// Erwartung: Wählt man die Ability „Toughness", die per Xalibur in Support Zone 1 liegt (zählt als angehängte Ability, das Skript bietet sie ausdrücklich an),
//   so wird GENAU Toughness abgelegt; die Ability-Zonen bleiben unberührt.
// Beobachtet (✗): Die Wahl-ID der Support-Ability ist `ability-<o>-<h>-<supportSlot>` und kollidiert mit der ID der Ability-ZONE gleicher Nummer. `resolve` liest dann
//   `abilityZones[h][slotIdx]` statt der Support Zone:
//   A) Ability-Zone 1 leer → „cancelled" (Doll bleibt/ist nutzlos, Toughness unerreichbar);
//   B) Ability-Zone 1 hat Charme ×2 → die falsche Ability (Charme) wird abgelegt, Toughness bleibt in der Support Zone.
// Ursache: `cards/effects/weird-doll.js` `_pushHeroAbilities` (fromSupport-Einträge, Z. ~203) und `resolve` (Z. ~85–100) kennen den Support-Pfad nicht (`fromSupport` wird nie gelesen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const variante of ['A', 'B']) {
    const t = await H.fresh({ hand: [['Xalibur', 'Toughness', 'Weird Doll'], []] });
    t.setAbilities(0, 0, variante === 'B' ? [['Leadership'], ['Charme', 'Charme'], ['Wisdom']] : [['Leadership'], [], ['Wisdom']]);
    await t.play(0, 'Xalibur', { hero: 0, slot: 0 });
    const hi = t.pile(0, 'hand').indexOf('Toughness');
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doPlayAbility(t.room, 0, { cardName: 'Toughness', handIndex: hi, heroIdx: 0, zoneSlot: 0, supportSlot: 1 }));
    R.check(variante + ') Aufbau: Toughness liegt in Support Zone 1', t.zone(0, 0, 1) === 'Toughness', [0, 1, 2].map(s => t.zone(0, 0, s)));
    t.targetFn = (valid) => { const v = valid.find(v => v.cardName === 'Toughness'); return v ? [v.id] : undefined; };
    const r = await t.play(0, 'Weird Doll');
    const disc = t.pile(0, 'discardPile'), abil = t.gs.players[0].abilityZones[0];
    R.check(variante + ') Toughness wurde abgelegt', disc.includes('Toughness'), { r, disc, support: [0, 1, 2].map(s => t.zone(0, 0, s)), abil });
    R.check(variante + ') Ability-Zonen unberührt (Charme-Stapel/Leere)', JSON.stringify(abil) === JSON.stringify(variante === 'B' ? [['Leadership'], ['Charme', 'Charme'], ['Wisdom']] : [['Leadership'], [], ['Wisdom']]), abil);
    R.check(variante + ') Weird Doll gelöscht', t.pile(0, 'deletedPile').includes('Weird Doll'), { del: t.pile(0, 'deletedPile'), hand: t.pile(0, 'hand') });
    R.check(variante + ') keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
