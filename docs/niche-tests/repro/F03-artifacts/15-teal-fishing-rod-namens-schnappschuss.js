'use strict';
// F03-artifacts-15 · Teal Fishing Rod: „not sent there this turn" wird nur am NAMEN geprüft – ein in diesem Zug erneut abgelegtes Exemplar ist angelbar (Stufe C)
// Kartentext: „Choose a level 0 Creature from your discard pile that was not sent there this turn and place it into the free Support Zone of any Hero you control."
// Aufbau: Seed 1234, Zug 5, Sitz 0; echter Zugwechsel hin und zurück (Schnappschuss `ps._discardNamesAtTurnStart` = {Bird}); Bird liegt seit Zugbeginn in der Ablage.
//   Kontrolle: Rod holt diesen Bird (✓ erlaubt). Fall B (frische Szene): derselbe Bird wird per `actionPlaceCreature(source: 'discard')` aufs Feld gestellt (so wie Skullmael's Greatsword/Lone
//   Survivor) und in DIESEM Zug zerstört ⇒ liegt wieder in der Ablage, ist aber „in diesem Zug dorthin gesendet".
// Erwartung: Fall B – Rod bietet diesen Bird nicht an (er wurde diesen Zug in die Ablage gesendet).
// Beobachtet (✗): Bird wird angeboten (Name steht im Schnappschuss und liegt jetzt wieder in der Ablage) und lässt sich auf das Feld holen.
// Ursache: `cards/effects/teal-fishing-rod.js` kandidaten() (Z. ~30–45): `start.has(n)` prüft nur den Namen; der Schnappschuss (_engine.js ~22598) ist ein Set ohne Anzahl/Herkunft.
//   Das Skript-Kommentar nennt die Definition „in der Menge UND jetzt in der Ablage" ausdrücklich – die Lücke ist die erneute Ablage desselben Namens im selben Zug.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TR = 'Teal Fishing Rod';
  const frisch = async () => {
    const t = await H.fresh({ hand: [[TR], []], discard: [['Bird'], []], gold: 100 });
    await t.endTurn(); await t.endTurn();           // Schnappschuss stammt aus dem echten Zugbeginn
    return t;
  };
  const scriptRod = (t, out) => {
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TR, answer: (d) => { out.gal = d.cards.map(c => c.name); return { cardName: 'Bird', source: 'discard' }; }, once: false });
    t.script.push({ match: d => d.type === 'zonePick' && d.title === TR, answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }), once: false });
  };
  // Kontrolle
  let t = await frisch(); let o = {};
  R.check('Aufbau: Schnappschuss enthält Bird', t.gs.players[0]._discardNamesAtTurnStart && t.gs.players[0]._discardNamesAtTurnStart.has('Bird'), t.gs.players[0]._discardNamesAtTurnStart && [...t.gs.players[0]._discardNamesAtTurnStart]);
  scriptRod(t, o);
  await t.play(0, TR);
  R.check('Kontrolle: Rod holt den Bird, der seit Zugbeginn in der Ablage liegt', [0, 1, 2].some(h => [0, 1, 2].some(s => t.zone(0, h, s) === 'Bird')), { gal: o.gal, board: [0, 1, 2].map(h => [0, 1, 2].map(s => t.zone(0, h, s))) });
  // Fall B
  t = await frisch(); o = {};
  const placed = await t.run(() => t.engine.actionPlaceCreature('Bird', 0, 0, 0, { source: 'discard' }));
  const bi = t.inst(c => c.name === 'Bird' && c.zone === 'support')[0];
  R.check('Aufbau B: Bird kam aus der Ablage aufs Feld', !!placed && !!bi && !t.pile(0, 'discardPile').includes('Bird'), { placed: !!placed, disc: t.pile(0, 'discardPile') });
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, heroIdx: 0 }, bi));
  R.check('Aufbau B: Bird liegt in diesem Zug wieder in der Ablage', t.pile(0, 'discardPile').includes('Bird'), t.pile(0, 'discardPile'));
  scriptRod(t, o);
  await t.play(0, TR);
  const aufBrett = [0, 1, 2].some(h => [0, 1, 2].some(s => t.zone(0, h, s) === 'Bird'));
  R.check('B) Rod bietet den soeben abgelegten Bird nicht an / holt ihn nicht', !aufBrett && !(o.gal || []).includes('Bird'), { gal: o.gal, aufBrett });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
