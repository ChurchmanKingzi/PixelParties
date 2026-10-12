'use strict';
// H01-heroes-08 · Cool Rescuer Monia: die Schildmarke `gs._moniaShieldActive` bleibt nach dem geschützten Effekt stehen
//
// Kartentext: „Once per turn, when 1 or more Creatures either player controls would be affected by a card or effect, you may discard
//   1 card to negate any effects that card or effect has on all Creatures."
// Erwartung: Die Negation gilt nur für DIESE eine Karte / diesen einen Effekt. Ein späterer, unabhängiger Effekt des Gegners (hier Gift auf
//   eine andere Kreatur) wirkt normal, und die Marke ist nach dem Effekt weg.
// Beobachtet: `beforeCreatureDamageBatch` setzt `gs._moniaShieldActive = protectOwner` und räumt sie nur im `afterSpellResolved` (feuert nur bei
//   Spells/Attacks) bzw. im `onTurnStart` von Monia selbst ab. Bei einem Kreatureneffekt o. ä. bleibt die Marke bis zum nächsten Zugbeginn;
//   `canApplyCreatureStatus` / `canTargetForStatus` (_engine.js ~18573 / ~19431) lesen sie und verweigern JEDEN negativen Status auf Kreaturen dieses
//   Besitzers. Stirbt/erstarrt Monia vorher, läuft ihr `onTurnStart` nie mehr: die Marke bleibt dauerhaft.
// Ursache: cards/effects/cool-rescuer-monia.js (Z. ~160 Marke setzen; Räumung nur in afterSpellResolved/onTurnStart des Helden).
const H = require('../../lib/h.js');
const MO = 'Cool Rescuer Monia';
const D = H.INERT.creature;
(async () => {
  const R = H.runner();
  async function aufbau() {
    const t = await H.fresh({ heroes: [[MO, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[H.INERT.filler, H.INERT.filler, H.INERT.filler], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));          // wie im echten Spielstart: setzt heroFlags.moniaProtection
    t.gs.activePlayer = 1; t.phase(3);                                // Zug des Gegners
    const a = t.put(0, 1, 0, D); a.turnPlayed = 1;
    const b = t.put(0, 2, 0, D); b.turnPlayed = 1;
    t.script.push({ match: d => d.type === 'optionPicker' && /Cool Rescue/.test(d.title || ''), answer: (d) => ({ optionId: d.options[0].id }), once: true });
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, a, 60, 'creature', { sourceOwner: 1 }));
    return { t, a, b };
  }
  R.section('Monia schützt Kreatur a vor einem Kreaturen-/Karteneffekt (Handkarte wird abgeworfen)');
  const { t, a, b } = await aufbau();
  R.check('Vorprobe: a bleibt bei 200 HP, 1 Handkarte abgeworfen', a.counters.currentHp === 200 && t.pile(0, 'hand').length === 2, [a.counters.currentHp, t.pile(0, 'hand').length]);
  R.check('Schildmarke ist nach dem Effekt wieder weg', t.gs._moniaShieldActive == null, t.gs._moniaShieldActive);
  await t.run(() => t.engine.applyCreatureStatus(b, 'poisoned', { sourceOwner: 1 }));
  R.check('anderer, unabhängiger Effekt (Gift auf Kreatur b) wirkt normal', !!b.counters.poisoned, JSON.stringify(b.counters));

  R.section('Monia fällt danach, mehrere Zugwechsel');
  const x = await aufbau();
  x.t.hero(0, 0).hp = 0; x.t.hero(0, 0).diedOnTurn = x.t.gs.turn;       // Monia ist besiegt
  await x.t.endTurn(); await x.t.endTurn(); await x.t.endTurn();
  await x.t.run(() => x.t.engine.applyCreatureStatus(x.b, 'poisoned', { sourceOwner: 1 }));
  R.check('drei Zugwechsel später: Gift auf die Kreatur wirkt', !!x.b.counters.poisoned, { flag: x.t.gs._moniaShieldActive, c: JSON.stringify(x.b.counters) });
  R.check('keine Engine-Fehler', t.errors.length === 0 && x.t.errors.length === 0, [t.errors, x.t.errors]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
