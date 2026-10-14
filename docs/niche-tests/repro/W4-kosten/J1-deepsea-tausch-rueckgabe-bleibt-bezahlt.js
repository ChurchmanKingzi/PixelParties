'use strict';
// W4-J1 · Deepsea-Tausch („You may add a "Deepsea" Creature that was not summoned this turn from one of your Heroes' Support Zones to your hand to place this Creature into the same Support Zone"):
//   die Rückgabe des Bewohners ist der Kostenpunkt und wird VOR dem Reaktionsfenster erbracht. Al (Welle 4): „auch wenn zB ein Deep-sea negiert wird, soll das ursprüngliche auf der Hand landen
//   und das neue negiert sein.“
// Aufbau: Sitz 0: Deepsea Mummy (nicht in diesem Zug beschworen) in Held 0 / Platz 0, Deepsea Pirate auf der Hand, Wurf auf den BELEGTEN Platz 0; Sitz 1 hält Off Duty („Negate the summoning and shuffle the Creature back into the deck“).
// Erwartung: (1) Off Duty: beim Fenster liegt die Mummy schon auf der Hand (Rückgabe vor der Kette), bleibt dort; der Platz ist leer, die Pirate ist negiert (nicht auf dem Brett, zurück im Deck);
//            (2) Kontrolle ohne Negation: Pirate steht in Platz 0, Mummy auf der Hand; (3) Abbruch der Bewohner-Wahl: nichts passiert, Karte bleibt auf der Hand, Off Duty ungespielt.
// Aufruf: node docs/niche-tests/repro/W4-kosten/J1-deepsea-tausch-rueckgabe-bleibt-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const auf = (t, name) => t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === name && c.heroIdx === 0 && c.zoneSlot === 0).length;
async function bau(negieren) {
  const t = await H.fresh({ hand: [['Deepsea Pirate'], negieren ? ['Off Duty'] : []] });
  t.put(0, 0, 0, 'Deepsea Mummy');
  for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0;
  if (negieren) t.grantFor(1, 0, 'Off Duty');
  t.policy.confirm = true;
  t.targetFn = (v) => { const e = v.filter(x => !x.ineligible); return e.slice(0, 1).map(x => x.id); };
  return t;
}
(async () => {
  const R = H.runner();
  {
    const t = await bau(true);
    let beimFenster = null;
    t.script.unshift({ match: d => d.type === 'confirm' && /Off Duty/.test(JSON.stringify(d)), answer: () => { beimFenster = { hand: t.pile(0, 'hand').includes('Deepsea Mummy'), platz: auf(t, 'Deepsea Mummy') }; return { confirmed: true }; }, once: true });
    const r = await t.play(0, 'Deepsea Pirate', { hero: 0, slot: 0 });
    R.check('(1) Off Duty gespielt; beim Fenster war die Mummy schon auf der Hand und der Platz leer', !!beimFenster && beimFenster.hand && beimFenster.platz === 0 && !t.pile(1, 'hand').includes('Off Duty'), { beimFenster, r });
    R.check('(1) negiert: die Mummy bleibt auf der Hand (Kosten bezahlt)', t.pile(0, 'hand').includes('Deepsea Mummy') && auf(t, 'Deepsea Mummy') === 0, t.pile(0, 'hand'));
    R.check('(1) negiert: die Pirate ist negiert (nicht auf dem Brett, nicht auf der Hand)', auf(t, 'Deepsea Pirate') === 0 && !t.pile(0, 'hand').includes('Deepsea Pirate'), { hand: t.pile(0, 'hand') });
    R.check('(1) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(false);
    const r = await t.play(0, 'Deepsea Pirate', { hero: 0, slot: 0 });
    R.check('(2) Kontrolle: Pirate steht im getauschten Platz, Mummy auf der Hand', auf(t, 'Deepsea Pirate') === 1 && t.pile(0, 'hand').includes('Deepsea Mummy') && !t.pile(0, 'hand').includes('Deepsea Pirate'), { r, hand: t.pile(0, 'hand') });
    R.check('(2) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(true);
    t.script.unshift({ match: d => d.type === 'zonePick', answer: () => null });
    t.targetFn = () => null;
    t.policy.cancelTargets = true;
    // Die Wurf-Marke fuehrt direkt auf den Bewohner (keine Wahl) — der Abbruch-Fall ist daher: Tausch auf einen NICHT tauschbaren Platz (kein Bewohner nach Zugnummer).
    for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = t.gs.turn;   // in diesem Zug beschworen → nicht tauschbar
    const r = await t.play(0, 'Deepsea Pirate', { hero: 0, slot: 0 });
    R.check('(3) nicht tauschbarer Bewohner: Karte bleibt auf der Hand, Mummy bleibt, Off Duty ungespielt', t.pile(0, 'hand').includes('Deepsea Pirate') && auf(t, 'Deepsea Mummy') === 1 && t.pile(1, 'hand').includes('Off Duty'), { r, hand: t.pile(0, 'hand') });
    R.check('(3) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
