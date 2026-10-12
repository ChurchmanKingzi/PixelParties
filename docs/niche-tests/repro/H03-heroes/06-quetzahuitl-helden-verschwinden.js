'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-06 · Quetzahuitl: die „gelöschten" Helden landen nirgends (Kartenbilanz −3)
//
//  Karte: Quetzahuitl, Receiver of Sacrifices (`cards/effects/quetzahuitl-receiver-of-sacrifices.js`, `performDescent`)
//  Kartentext: „… delete all your Heroes and all cards in their Support and Ability Zones to place this card into one of your Hero Zones
//  instead of losing the game."
//  Konvention der Engine: `engine.deleteHero` (_engine.js:25531, Soul Transmigration Ritual / Soul Transmitted) schiebt den Heldennamen
//  in `ps.deletedPile` (Zeile ~25633). Support-/Ability-Karten gehen bei Quetzahuitl selbst in den Gelöscht-Stapel.
//  Erwartung: Die drei Heldenkarten liegen nach dem Abstieg im Gelöscht-Stapel (Kartenbilanz bleibt erhalten).
//  Beobachtung (✗): `performDescent` setzt `hero.name = null` in allen drei Plätzen, ohne den Namen irgendwo abzulegen – die Heldenkarten
//  sind aus dem Spiel verschwunden (t.census(): Tushu −1, Rick −1, Zwei −1; Gelöscht-Stapel enthält nur die Support-/Ability-Karten).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/06-quetzahuitl-helden-verschwinden.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const Q = 'Quetzahuitl, Receiver of Sacrifices';
  const heroes = ['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'];
  const t = await H.fresh({ hp: 300, hand: [[Q, 'Heal'], []], deck: [['Divinity', 'Divinity', 'Divinity', 'Heal', 'Heal', 'Heal'], null], active: 1 });
  t.hero(0, 0).hp = 0; t.hero(0, 1).hp = 0;                       // zwei Helden sind schon gefallen
  t.setAbilities(0, 2, [['Fighting'], [], []]);
  const vorher = t.census();
  await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 2), 9999, 'spell'));   // letzter Held, Gegnerzug
  R.check('Abstieg hat stattgefunden (Quetzahuitl auf Platz 2, Spiel läuft)', t.hero(0, 2).name === Q && !t.engine.over.called, [t.hero(0, 2).name, t.engine.over]);
  const diff = t.censusDiff(vorher, t.census());
  R.note('Kartenbilanz', diff);
  R.note('Gelöscht-Stapel', t.pile(0, 'deletedPile'));
  for (const h of heroes) R.check(`Heldenkarte „${h}" liegt im Gelöscht-Stapel`, t.pile(0, 'deletedPile').includes(h), t.pile(0, 'deletedPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
