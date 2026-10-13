'use strict';
// A01-pollution-26 · Goldify: Gold (und Zusatzaktion) auch dann, wenn die Kreatur durch einen Schutz überlebt – Regelfrage
// Kartentext: „Place 1 Pollution Token into your free Support Zone to use this Spell. Choose a Creature and defeat it. Gain Gold equal to 5 times its level. If you chose a level 1 or lower Creature,
//   this counts as an additional Action.“
// Aufbau: Sitz 1 hat Soul Shard Ba (Lv1); Schutz: (a) Golden Wings aus der Hand (Reaktion), (b) Warrior of Teocuilatl + Doom Clock (zusätzlich in der Erkundung: `_cardinalImmune` – gleiches Bild).
// Offen: der Text nennt „defeat it“ und „gain gold“ als getrennte Sätze (kein „if you do“); der Warrior negiert „alle Effekte auf diese Kreatur“ – der Goldgewinn ist kein Effekt auf die Kreatur.
//   Wörtlich wären Gold und Zusatzaktion also korrekt; spielerisch bezahlt der Gegner für den Schutz (Token/Doom Counter), und der Goldify-Spieler bekommt trotzdem +5 Gold und seine Aktion zurück.
// Beobachtet: in allen Fällen überlebt Ba, Sitz 0 erhält +5 Gold und die Zusatzaktion (Phase bleibt 3).
// Ursache: cards/effects/goldify.js (~Z. 163-185): `await engine.actionDestroyCard(ctx.card, inst)` – das Ergebnis wird nicht ausgewertet; Gold und `_spellFreeAction` folgen unbedingt.
// Aufruf: node docs/niche-tests/repro/A01-pollution/26-goldify-gold-trotz-ueberlebender-kreatur.js   (✗ = Gold fließt trotz überlebender Kreatur)
const H = require('../../lib/h.js');
const tgt = (t) => (v) => [v.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0 && x.slotIdx === 0).id];
(async () => {
  const R = H.runner();
  // a) Golden Wings des Gegners
  let t = await H.fresh({ hand: [['Goldify', 'Fireball'], ['Golden Wings']] });
  t.put(1, 0, 0, 'Soul Shard Ba'); t.grantFor(1, 0, 'Golden Wings');
  t.targetFn = tgt(t); t.policy.confirm = true;
  let g0 = t.gs.players[0].gold;
  await t.play(0, 'Goldify', { hero: 0 });
  R.check('(a) Golden Wings: Ba überlebt', !!t.find('Soul Shard Ba', 'support'), 'Ba lebt nicht – Aufbau greift nicht');
  R.check('(a) überlebende Kreatur → kein Gold für Goldify', t.gs.players[0].gold === g0, { gold: [g0, t.gs.players[0].gold] });
  // b) Warrior
  t = await H.fresh({ hand: [['Goldify', 'Fireball'], []] });
  t.putArea(1, 'Doom Clock').counters.doom = 5;
  t.put(1, 0, 0, 'Soul Shard Ba'); t.put(1, 0, 1, 'Warrior of Teocuilatl');
  t.targetFn = tgt(t); t.policy.confirm = true;
  g0 = t.gs.players[0].gold;
  await t.play(0, 'Goldify', { hero: 0 });
  R.check('(b) Warrior-Schutz: Ba überlebt', !!t.find('Soul Shard Ba', 'support'), 'Ba lebt nicht – Aufbau greift nicht');
  R.check('(b) überlebende Kreatur → kein Gold für Goldify', t.gs.players[0].gold === g0, { gold: [g0, t.gs.players[0].gold] });
  R.finish();
})();
