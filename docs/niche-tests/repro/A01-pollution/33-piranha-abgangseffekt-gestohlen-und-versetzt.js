'use strict';
// A01-pollution-33 · Pollution Piranha: „leaves the board“ – gestohlen stirbt sie folgenlos, beim Versetzen auf der eigenen Seite löst sie fälschlich aus
// Kartentext: „When this Creature leaves the board, delete 1 card from your hand.“
// (a) Sitz 0 besitzt die Piranha, Sitz 1 hat sie gestohlen (owner 0, controller 1); sie stirbt.  Erwartet: es wird 1 Handkarte gelöscht (Kontrolleur oder Besitzer – in jedem Fall ein Effekt).
//     Beobachtet: nichts wird gelöscht – der Guard `ctx.fromOwner !== ctx.cardOwner` (Besitzer ≠ Kontrolleur) bricht ab.
// (b) Die Piranha wird von Held 0 in die Zone von Held 1 derselben Seite versetzt (`actionTransferCreature`, Weg von Liberation/Diplomacy/Capture/Dark Gear) und bleibt auf dem Brett.
//     Erwartet: keine Löschung (sie hat das Brett nicht verlassen).  Beobachtet: 1 Handkarte von Sitz 0 wird gelöscht.
// Ursache: cards/effects/pollution-piranha.js `onCardLeaveZone` (Guard über fromOwner/cardOwner; kein Test auf toZone/„wirklich vom Brett“).
// Aufruf: node docs/niche-tests/repro/A01-pollution/33-piranha-abgangseffekt-gestohlen-und-versetzt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const mk = async () => {
    const t = await H.fresh({ hand: [['Fireball', 'Heal'], ['Fireball', 'Heal', 'Heal']] });
    const pir = t.put(0, 0, 0, 'Pollution Piranha');
    t.script.push({ match: d => d && d.type === 'forceDiscard', answer: (d) => ({ cardName: d.cards ? d.cards[0] : 'Heal', handIndex: 0 }) });
    t.policy.confirm = true;
    return { t, pir };
  };
  // (a)
  let { t, pir } = await mk();
  await t.run(() => t.engine.actionStealCreature(1, pir));
  R.check('(a) Aufbau: Piranha gestohlen (owner 0, controller 1)', pir.owner === 0 && pir.controller === 1, { owner: pir.owner, controller: pir.controller });
  const geloescht = () => t.pile(0, 'deletedPile').length + t.pile(1, 'deletedPile').length;
  const h0 = t.pile(0, 'hand').length + t.pile(1, 'hand').length;
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0, heroIdx: 0 }, pir));
  R.check('(a) Piranha ist tot', pir.zone !== 'support', pir.zone);
  R.check('(a) gestohlene Piranha stirbt: 1 Handkarte (Kontrolleur oder Besitzer) wird gelöscht', geloescht() === 1, { geloescht: geloescht(), hand: [h0, t.pile(0, 'hand').length + t.pile(1, 'hand').length] });
  // (b)
  ({ t, pir } = await mk());
  await t.run(() => t.engine.actionTransferCreature(pir, 0, 1, 0));
  R.check('(b) Piranha steht noch auf dem Brett (Held 1)', pir.zone === 'support' && pir.heroIdx === 1, { zone: pir.zone, hero: pir.heroIdx });
  R.check('(b) Versetzen innerhalb des Bretts löscht keine Handkarte', t.pile(0, 'deletedPile').length === 0, t.pile(0, 'deletedPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
