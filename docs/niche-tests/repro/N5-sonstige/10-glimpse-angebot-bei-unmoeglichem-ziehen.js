'use strict';
// N5-10 · Glimpse of the Future: „When you draw this card as part of your starting hand: You may immediately reveal it to draw 2 cards. Those cards count as part of your starting hand."
// Regel D1 / Tuscan-Artist-Ruling (16.8., `_draw-block-shared.js`): „Ist der Zug der einzige Nutzen … ist die Karte bzw. der aktive Effekt GESPERRT" — und Grasp the Future (Schwesterkarte) hält sich daran:
// `skipIfSearchBlocked` → unter der Such-Sperre kein Angebot. Glimpse prüft nichts: bei Zieh-/Hand-Sperre oder Tuscan Artist beim Gegner (der „2 oder 3 Karten ziehen" negiert) fragt das Startblatt-Fenster
// trotzdem, deckt die Karte DAUERHAFT auf (`revealHandCopy`: der Gegner sieht sie bis sie die Hand verlässt) und zieht nichts. Über Traveler from the Future (Resource Phase) ist das im laufenden Spiel erreichbar.
// Erwartet: kein Angebot, keine Aufdeckung, wenn das Ziehen unmöglich ist (Gegenprobe: freie Lage → Angebot, 2 Karten gezogen, Karte aufgedeckt ✓; Grasp unter Such-Sperre → kein Angebot ✓).
// Aufruf: node docs/niche-tests/repro/N5-sonstige/10-glimpse-angebot-bei-unmoeglichem-ziehen.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const G = 'Glimpse of the Future', GR = 'Grasp the Future';
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const [lbl, soll] of [['frei (Gegenprobe)', true], ['Tuscan Artist beim Gegner', false], ['drawLocked', false], ['handLocked', false]]) {
      const hand = [[], []]; hand[seat] = [G, 'Fireball'];
      const deck = [[], []]; deck[seat] = ['Fireball', 'Heal', 'Haste', 'ZZ Filler'];
      const t = await H.fresh({ active: seat, hand, deck });
      const ps = t.gs.players[seat];
      if (lbl.startsWith('Tuscan')) t.put(opp, 0, 0, 'Tuscan Artist');
      if (lbl === 'drawLocked') ps.drawLocked = true;
      if (lbl === 'handLocked') ps.handLocked = true;
      t.policy.confirm = true;
      await t.run(() => t.engine.processStartingHandDraw(seat, [G], { window: 'resource' }));
      const gefragt = t.prompts.some(p => p.pi === seat && p.d.title === G);
      const aufgedeckt = Object.keys(ps._permanentlyRevealedHandIndices || {}).length > 0;
      const gezogen = t.pile(seat, 'hand').length - 2;
      R.check(`Sitz ${seat} · ${lbl}: Glimpse ${soll ? 'wird angeboten, deckt auf und zieht 2' : 'wird nicht angeboten, nichts wird aufgedeckt'}`, soll ? (gefragt && aufgedeckt && gezogen === 2) : (!gefragt && !aufgedeckt), { gefragt, aufgedeckt, gezogen });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {   // Schwesterkarte als Vergleich
      const hand = [[], []]; hand[seat] = [GR, 'Fireball'];
      const deck = [[], []]; deck[seat] = ['Fireball', 'Heal'];
      const t = await H.fresh({ active: seat, hand, deck });
      t.gs.players[seat].searchLocked = true; t.policy.confirm = true;
      await t.run(() => t.engine.processStartingHandDraw(seat, [GR], { window: 'resource' }));
      R.check(`Sitz ${seat} · Vergleich Grasp the Future unter Such-Sperre: kein Angebot`, !t.prompts.some(p => p.pi === seat && p.d.title === GR), t.prompts.map(p => p.d.title));
    }
  }
  R.finish();
})();
