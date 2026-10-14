'use strict';
// W4-F1 · Tribut-/Opfer-Kreaturen: die Kosten der Beschwörung („… to play this card" / „You can only summon this Creature by sacrificing …") werden VOR dem Reaktionsfenster bezahlt
//   und bleiben bei einer komplett negierten Beschwörung (Off Duty: „Negate the summoning and shuffle the Creature back into the deck") bezahlt.
// Karten: 500 Piranhas in a Monster Suit (Gegner-Kreatur besiegen), Dark Deepsea God (Tribut kehrt auf die Hand zurück), Blue-Ice Dragon, Foresta, The Egg of God,
//   Steam Dwarf Dragon Pilot (Opfer), Gigantisaur King Trex (Opfer eines Gigantisaurs), Gigantisaur Chimera (drei Gigantisaurs abwerfen), Pollution Piranha (Pollution Token entfernen).
// Erwartung je Karte: (1) Off Duty gespielt, die Kosten waren schon BEIM Fenster bezahlt und bleiben es, die Kreatur liegt nicht auf dem Brett;
//                     (2) Kontrolle ohne Negation: Kosten bezahlt UND Kreatur auf dem Brett.
// Aufruf: node docs/niche-tests/repro/W4-kosten/F1-tribut-kreaturen-kosten-bleiben-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const D = H.INERT.creature;
const alt = (t) => { for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0; };   // „not summoned this turn"
const auf = (t, name, seat = 0) => t.inst(c => c.zone === 'support' && c.owner === seat && c.name === name).length;
const FALLE = [
  { name: '500 Piranhas in a Monster Suit', bau: (t) => { t.put(1, 0, 0, D); },
    bezahlt: (t) => auf(t, D, 1) === 0, board: (t) => t.inst(c => c.zone === 'support' && c.name === '500 Piranhas in a Monster Suit').length === 1 },
  { name: 'Dark Deepsea God', n: 2, bau: (t) => { t.put(0, 0, 0, 'Elven Leader'); t.put(0, 0, 1, 'Elven Leader'); alt(t); },
    bezahlt: (t) => auf(t, 'Elven Leader') === 0 && t.pile(0, 'hand').filter(n => n === 'Elven Leader').length === 2, board: (t) => auf(t, 'Dark Deepsea God') === 1 },
  { name: 'Blue-Ice Dragon', n: 2, bau: (t) => { t.put(0, 0, 0, D); t.put(0, 0, 1, D); alt(t); },
    bezahlt: (t) => auf(t, D) === 0, board: (t) => auf(t, 'Blue-Ice Dragon') === 1 },
  { name: 'Foresta, the Guard', n: 2, bau: (t) => { t.put(0, 0, 0, D); t.put(0, 0, 1, D); alt(t); },
    bezahlt: (t) => auf(t, D) === 0 && t.hp(0, 0) < 800, board: (t) => auf(t, 'Foresta, the Guard') === 1 },
  { name: 'The Egg of God', bau: (t) => { t.put(0, 0, 0, D); alt(t); },
    bezahlt: (t) => auf(t, D) === 0, board: (t) => auf(t, 'The Egg of God') === 1 },
  { name: 'Steam Dwarf Dragon Pilot', n: 2, bau: (t) => { t.put(0, 0, 0, D); t.put(0, 0, 1, D); alt(t); },
    bezahlt: (t) => auf(t, D) === 0, board: (t) => auf(t, 'Steam Dwarf Dragon Pilot') === 1 },
  { name: 'Gigantisaur King Trex', bau: (t) => { t.put(0, 0, 0, 'Gigantisaur Ankylos'); alt(t); },
    bezahlt: (t) => auf(t, 'Gigantisaur Ankylos') === 0, board: (t) => auf(t, 'Gigantisaur King Trex') === 1 },
  { name: 'Gigantisaur Chimera', hand: ['Gigantisaur Chimera', 'Gigantisaur Ankylos', 'Gigantisaur Brachion', 'Gigantisaur Pteranos'],
    bezahlt: (t) => ['Gigantisaur Ankylos', 'Gigantisaur Brachion', 'Gigantisaur Pteranos'].every(n => t.pile(0, 'discardPile').includes(n)), board: (t) => auf(t, 'Gigantisaur Chimera') === 1 },
  { name: 'Pollution Piranha', bau: (t) => { t.put(0, 0, 2, 'Pollution Token'); },
    bezahlt: (t) => t.inst(c => c.name === 'Pollution Token').length === 0, board: (t) => auf(t, 'Pollution Piranha') === 1 },
];
async function bau(f, negieren) {
  const t = await H.fresh({ hand: [f.hand || [f.name], negieren ? ['Off Duty'] : []] });
  if (negieren) t.grantFor(1, 0, 'Off Duty');
  if (f.bau) f.bau(t);
  t.policy.confirm = true;
  t.targetFn = (v) => { const e = v.filter(x => !x.ineligible); return e.slice(0, f.n || 1).map(x => x.id); };   // Opfer-/Tributwahl: die ersten n zulässigen
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });   // DDG: Landeplatz
  t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: (d) => ({ cardName: t.gs.players[0].hand[d.eligibleIndices[0]], handIndex: d.eligibleIndices[0] }) });   // Chimera: Abwurf der Reihe nach
  return t;
}
(async () => {
  const R = H.runner();
  for (const f of FALLE) {
    {
      const t = await bau(f, true);
      let beimFenster = null;
      t.script.unshift({ match: d => d.type === 'confirm' && /Off Duty/.test(JSON.stringify(d)), answer: () => { beimFenster = f.bezahlt(t); return { confirmed: true }; }, once: true });
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (1) Off Duty gespielt, Kosten lagen schon beim Fenster`, beimFenster === true && !t.pile(1, 'hand').includes('Off Duty'), { beimFenster, r, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
      R.check(`${f.name}: (1) negiert: Kosten bleiben bezahlt`, f.bezahlt(t), null);
      R.check(`${f.name}: (1) negiert: Kreatur nicht auf dem Brett`, !f.board(t), null);
      R.check(`${f.name}: (1) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(f, false);
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (2) Kontrolle ohne Negation: Kosten bezahlt, Kreatur auf dem Brett`, f.bezahlt(t) && f.board(t), { r, bezahlt: f.bezahlt(t), board: f.board(t) });
      R.check(`${f.name}: (2) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
