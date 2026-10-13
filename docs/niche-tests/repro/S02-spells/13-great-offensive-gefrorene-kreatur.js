'use strict';
// S02-13 · Great Offensive lässt gefrorene/betäubte Kreaturen ihren aktiven Effekt benutzen
// Kartentext: „All level 2 and lower Creatures you control use their active effects an additional time (even if they were summoned this turn). Immediately end your turn afterwards."
// Konvention (server.js `doActivateCreatureEffect` ~9042: „v818: EIN Praedikat" `isCreatureEffectSuppressed`): eine gefrorene/betäubte Kreatur kann ihren aktiven Effekt nicht benutzen.
// Aufbau: „Skeleton Mage" (Lv1, „You may once per turn draw 2 cards and discard 1 card afterwards") steht seit Zug 1 auf dem Brett (turnPlayed = 1).
//   Kontrolle: normal aktivierbar (+1 Karte netto), gefroren bzw. betäubt NICHT aktivierbar. Dann Great Offensive mit der gefrorenen/betäubten Mage.
// Erwartet: die gefrorene/betäubte Mage zieht nicht (die Parenthese hebt nur den Beschwörungs-Schlaf auf, nicht Frost/Betäubung).
// Beobachtet: die gefrorene/betäubte Mage zieht und wirft ab (Netto +1 Karte), die negierte nicht.
// Ursache: `_engine.js` `reactivateCreatureEffect` (~25180) prüft nur `counters.negated/nulled`, nicht `isCreatureEffectSuppressed` (frozen/stunned/…); `great-offensive.js`
//   `eigeneAktivKreaturen` filtert ebenfalls nicht nach Status. Gleicher Weg wird von Kohta und Spirit of the Forbidden Grimoire benutzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const discardFirst = (t) => t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable', answer: () => ({ cardName: t.pile(0, 'hand')[0], handIndex: 0 }) });
  for (const st of ['frozen', 'stunned']) {
    const t = await H.fresh({ hand: [['Great Offensive'], []], deckSize: 30 });
    const m = t.put(0, 0, 0, 'Skeleton Mage'); m.turnPlayed = 1;
    await t.engine.applyCreatureStatus(m, st, { sourceOwner: 1, duration: 3 });
    discardFirst(t);
    t.phase(2);
    const aktiv = await t.activateCreature(0, 0, 0);
    R.check(`Kontrolle: ${st} Mage ist regulär nicht aktivierbar`, aktiv === false, aktiv);
    const h0 = t.pile(0, 'hand').length;                       // 1 (Great Offensive)
    const r = await t.play(0, 'Great Offensive', { hero: 0 });
    const netto = t.pile(0, 'hand').length - (h0 - 1);
    t.say(`${st}: Great Offensive ->`, r, '| Karten netto durch die Mage:', netto);
    R.check(`${st} Mage zieht durch Great Offensive nicht`, netto === 0, netto);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
