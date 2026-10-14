'use strict';
// Z7c-A1 · Divine Gift of Sacrifice: das Opfer ist ein KOSTENPUNKT („Sacrifice a Hero originally controlled by you TO PLAY THIS CARD") und bleibt bei Ganz-Negierung bezahlt.
// Al (Welle 3): Opfer-Kosten bleiben bezahlt, die Karte wirkt nicht, der Einmal-Slot `divineGift` bleibt frei (Z7b-Regel „Durfte die Karte resolven?").
// Aufbau: Sitz 0 spielt Divine Gift of Sacrifice (Decay Magic), Sitz 1 hält Silence (negiert den Zauber).
// Fälle: (1) Opfer = ein anderer Held als der Wirker, negiert; (2) Opfer = der WIRKER selbst, negiert; (3) Kontrolle: nicht negiert — Opfer, Empfänger +Max-HP, Slot verbraucht;
//        (4) Kontrolle: Opfer = der Wirker selbst, nicht negiert — der Zauber fizzelt NICHT wegen des Selbstopfers (Empfänger bekommt die HP).
// Erwartung (1)(2): Held gefallen, kein Empfänger gestärkt, `divineGift` frei, ein zweites Divine Gift bleibt spielbar. (3)(4): Held gefallen, Empfänger +Max-HP, `divineGift` gestempelt.
// Aufruf: node docs/niche-tests/repro/Z7c/A1-divine-gift-of-sacrifice-opfer-bleibt-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
async function lauf({ opferIdx, empfaengerIdx, negiert }) {
  const t = await H.fresh({ hand: [['Divine Gift of Sacrifice', 'Divine Gift of Fire'], negiert ? ['Silence'] : []], abilities: { 0: { 0: [['Decay Magic'], [], []] } } });
  if (negiert) { t.grantFor(1, 0, 'Silence'); t.policy.confirm = true; }
  t.targetFn = (v, cfg) => {
    const beschr = (cfg && cfg.description) || '';
    const idx = /sacrifice\./i.test(beschr) ? opferIdx : empfaengerIdx;
    return [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === idx).id];
  };
  const maxVorher = t.gs.players[0].heroes.map(h => h.maxHp);
  await t.play(0, 'Divine Gift of Sacrifice', { hero: 0 });
  const h = t.gs.players[0].heroes;
  return {
    t, gefallen: h.map((x, i) => x.hp <= 0 ? i : -1).filter(i => i >= 0),
    maxDelta: h.map((x, i) => x.maxHp - maxVorher[i]),
    slot: !!t.gs.players[0]._oncePerGameUsed?.has('divineGift'),
    silenceGespielt: negiert ? !t.pile(1, 'hand').includes('Silence') : null,
    ablage: t.pile(0, 'discardPile'),
  };
}
(async () => {
  const R = H.runner();
  for (const [name, opferIdx, empf] of [['Opfer = Held 1 (nicht der Wirker)', 1, 2], ['Opfer = Held 0 (der Wirker selbst)', 0, 1]]) {
    const r = await lauf({ opferIdx, empfaengerIdx: empf, negiert: true });
    R.check(`[negiert] ${name}: Silence hat die Karte negiert`, r.silenceGespielt === true && r.ablage.includes('Divine Gift of Sacrifice'), { silence: r.silenceGespielt, ablage: r.ablage });
    R.check(`[negiert] ${name}: das Opfer bleibt bezahlt (Held ${opferIdx} gefallen)`, r.gefallen.length === 1 && r.gefallen[0] === opferIdx, r.gefallen);
    R.check(`[negiert] ${name}: die Karte wirkt nicht (kein Empfänger gestärkt)`, r.maxDelta.every(d => d === 0), r.maxDelta);
    R.check(`[negiert] ${name}: Einmal-Slot divineGift bleibt frei (Z7b)`, r.slot === false, r.slot);
    R.check(`[negiert] ${name}: keine Engine-Fehler / Zustand sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
  }
  // zweites Divine Gift nach der Negierung noch spielbar (Slot frei)
  {
    const r = await lauf({ opferIdx: 1, empfaengerIdx: 2, negiert: true });
    R.check('[negiert] danach ist ein anderes Divine Gift nicht ausgegraut (Slot frei)', !r.t.engine.getBlockedSpells(0).includes('Divine Gift of Fire'), r.t.engine.getBlockedSpells(0));
  }
  // Kontrollen: nicht negiert
  for (const [name, opferIdx, empf] of [['Opfer = Held 1', 1, 2], ['Opfer = Held 0 (Wirker)', 0, 1]]) {
    const r = await lauf({ opferIdx, empfaengerIdx: empf, negiert: false });
    R.check(`[Kontrolle, nicht negiert] ${name}: Opfer gefallen`, r.gefallen.length === 1 && r.gefallen[0] === opferIdx, r.gefallen);
    R.check(`[Kontrolle, nicht negiert] ${name}: Empfänger ${empf} bekommt die Max-HP des Opfers`, r.maxDelta[empf] === 800, r.maxDelta);
    R.check(`[Kontrolle, nicht negiert] ${name}: divineGift verbraucht`, r.slot === true, r.slot);
    R.check(`[Kontrolle, nicht negiert] ${name}: keine Engine-Fehler / Zustand sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
  }
  R.finish();
})();
