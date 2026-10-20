'use strict';
// N1-13 · Core Explosion / Crushing Defeat: Tod durch einen Burn-/Gift-Tick, dessen Status der GEGNER aufgelegt hat, wird nicht als „by an opponent's card or effect" gemeldet
// Kartentext Core Explosion: „Play this card immediately when a Creature you control is defeated by an opponent's card or effect. …"
// Kartentext Crushing Defeat: „Play this card immediately when the last Creature you control is defeated by an opponent's card or effect. …"
// Skript-Kopf (core-explosion.js): „Ohne bekannte Quelle (Status-Ticks ohne Verursacher) kein Angebot." – gemeint ist, dass es MIT bekanntem Verursacher ein Angebot gibt.
// Aufbau: Sitz 1 hält die Reaktion, hat eine 10-HP-Kreatur (Level 2) mit Burn bzw. Gift, aufgelegt von Sitz 0 (`applyCreatureStatus(…, {sourceOwner: 0})`, Zähler `burnAppliedBy`/`poisonAppliedBy` = 0).
//   Der Tick am Zugbeginn von Sitz 1 tötet die Kreatur.
// ENTSCHIEDEN (Al, 21.10.2026, W25a: „nein"): ein Tod durch Burn-/Gift-Tick zählt NICHT als „defeated by an opponent's card or effect" – auch wenn der Gegner den Status aufgelegt hat (Lesart B, heutiges Verhalten).
//   Der Tick-Eintrag trägt `source: {name:'Burn'}` ohne `owner`; das Skript-Kopfwort „Ohne bekannte Quelle (Status-Ticks ohne Verursacher) kein Angebot" bleibt Ist-Zustand.
// Erwartet jetzt: KEIN Fenster beim Tick-Tod (Exit 0). Gegenprobe: dieselbe Kreatur stirbt an DIREKTEM Schaden einer Gegnerkarte (destruction_spell von Sitz 0) → Fenster für Sitz 1.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const rx of ['Core Explosion', 'Crushing Defeat']) for (const status of ['burned', 'poisoned']) {
    const t = await H.fresh({ hand: [[], [rx]] });
    t.engine._getCardDB()['ZZ Dummy Frail'].level = 2;
    t.grantFor(1, 1, rx);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    const c = t.put(1, 1, 0, H.INERT.frail);
    await t.run(() => t.engine.applyCreatureStatus(c, status, { sourceOwner: 0 }));
    await t.endTurn(); await t.endTurn();
    R.check(`${rx} / ${status}: die Kreatur ist am Tick gestorben`, t.inst(i => i.id === c.id).length === 0 && t.pile(1, 'discardPile').includes(H.INERT.frail), t.pile(1, 'discardPile'));
    R.check(`${rx} / ${status}: KEIN Fenster beim Tod durch den Tick (auch mit bekanntem Verursacher)`, !t.prompts.some(p => p.pi === 1 && p.d.title === rx), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check(`${rx} / ${status}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  for (const rx of ['Core Explosion', 'Crushing Defeat']) {   // Gegenprobe: direkter Schaden einer Gegnerkarte → Fenster
    const t = await H.fresh({ hand: [[], [rx]] });
    t.engine._getCardDB()['ZZ Dummy Frail'].level = 2;
    t.grantFor(1, 1, rx);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    const c = t.put(1, 1, 0, H.INERT.frail);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 0, controller: 0, heroIdx: 0, cardType: 'Spell', counters: {} }, c, 100, 'destruction_spell'));
    R.check(`${rx} / Gegenprobe direkter Schaden: die Kreatur ist gestorben`, t.inst(i => i.id === c.id).length === 0, t.pile(1, 'discardPile'));
    R.check(`${rx} / Gegenprobe direkter Schaden: Fenster für Sitz 1`, t.prompts.some(p => p.pi === 1 && p.d.title === rx), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check(`${rx} / Gegenprobe: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
