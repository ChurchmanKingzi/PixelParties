'use strict';
// R02-17 · Tarleinn's Floating Island: „when a TARGET a player controls has its HP healed" – Heilung einer Kreatur löst nie aus
// Kartentext: „Once per turn, when a target a player controls has its HP healed, that player may draw 1 card."
// Skriptkopf (tarleinn-s-floating-island.js): „Creature heals don't fire afterHeal in the engine, so this card effectively triggers off hero heals" – die Lücke ist bekannt, aber nicht im Text gedeckt (Kreaturen sind Ziele).
// Aufbau: Tarleinn's Floating Island liegt als Area von Sitz 0. Sitz 0 hat eine verletzte Kreatur (ZZ Dummy, 100/200 HP) und einen verletzten Helden (500/800). Ja auf alle Fragen.
//   (a) `actionHealHero` 100 auf den Helden (Kontrolle), (b) in einer frischen Szene `actionHealCreature` 100 auf die Kreatur.
// Erwartet: in beiden Fällen kommt die Frage „Draw 1 card from Tarleinn's Floating Island?", der Spieler zieht 1 Karte.
// Beobachtet: (a) ✓ (Frage, Karte gezogen). (b) die Kreatur wird geheilt (200 HP), aber keine Frage, keine Karte.
// Ursache: `actionHealCreature` (_engine.js ~10109) ruft `runHooks('afterHeal', …)` nie (nur `actionHealHero`, ~10093); das Skript lauscht nur auf `afterHeal`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const ziel of ['(a) Held', '(b) Kreatur']) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.putArea(0, "Tarleinn's Floating Island");
    t.policy.confirm = true;
    const c = t.put(0, 1, 0, H.INERT.creature); c.counters.currentHp = 100;
    t.hero(0, 0).hp = 500;
    const hand0 = t.pile(0, 'hand').length;
    if (ziel.startsWith('(a)')) await t.engine.actionHealHero({ name: 'X', owner: 0 }, t.hero(0, 0), 100);
    else await t.engine.actionHealCreature({ name: 'X', owner: 0, heroIdx: 0 }, c, 100);
    const gefragt = t.prompts.some(p => p.d.title === "Tarleinn's Floating Island");
    R.check(`${ziel}: die Heilung ist angekommen`, ziel.startsWith('(a)') ? t.hp(0, 0) === 600 : (c.counters.currentHp === 200), { hp: t.hp(0, 0), cre: c.counters.currentHp });
    R.check(`${ziel}: Tarleinn's Floating Island bietet das Ziehen an`, gefragt, t.prompts.map(p => p.d.title));
    R.check(`${ziel}: eine Karte gezogen`, t.pile(0, 'hand').length === hand0 + 1, { hand: [hand0, t.pile(0, 'hand').length] });
    R.check(`${ziel}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
