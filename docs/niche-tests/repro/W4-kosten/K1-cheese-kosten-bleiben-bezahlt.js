'use strict';
// W4-K1 · Angry Cheese („Choose a Hero you control and deal 100 damage to it to activate this card. Search your deck for a Destruction Magic Spell …") und Sickly Cheese („… inflict 1 Stack of Poison to it
//   to play this card. Choose a Decay Magic Spell from your deck …"): Schaden bzw. Gift am EIGENEN Helden sind der Kostenpunkt und werden VOR dem Reaktionsfenster erbracht (Al, Welle 4);
//   bei komplett negiertem Artefakt (The Master's Plan) bleiben sie bezahlt, die Suche entfällt.
// Erwartung je Karte: (1) negiert: Kosten beim Fenster schon bezahlt, bleiben bezahlt, kein Spell auf der Hand; (2) Kontrolle ohne Negation: Kosten + Spell auf der Hand; (3) Abbruch der Heldenwahl: nichts bezahlt, Karte auf der Hand.
// Aufruf: node docs/niche-tests/repro/W4-kosten/K1-cheese-kosten-bleiben-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const PLAN = "The Master's Plan";
const FALLE = [
  { name: 'Angry Cheese', spell: 'Fireball', bezahlt: (t) => t.hp(0, 0) === 700 },
  { name: 'Sickly Cheese', spell: 'Cold Coffin', bezahlt: (t) => (t.gs.players[0].heroes[0].statuses?.poisoned?.stacks || 0) >= 1 || !!t.gs.players[0].heroes[0].statuses?.poisoned },
];
async function bau(f, negieren) {
  const t = await H.fresh({ hand: [[f.name], negieren ? [PLAN] : []], deck: [[f.spell, f.spell, H.INERT.creature, H.INERT.creature], []] });
  if (negieren) t.grantFor(1, 0, PLAN);
  t.policy.confirm = true;
  t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return h ? [h.id] : []; };
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: f.spell, source: 'deck' }) });
  return t;
}
(async () => {
  const R = H.runner();
  for (const f of FALLE) {
    {
      const t = await bau(f, true);
      let beimFenster = null;
      t.script.unshift({ match: d => d.type === 'confirm' && d.title === PLAN, answer: () => { beimFenster = f.bezahlt(t); return { confirmed: true }; }, once: true });
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (1) The Master's Plan gespielt, Kosten lagen schon beim Fenster`, beimFenster === true && !t.pile(1, 'hand').includes(PLAN), { beimFenster, r });
      R.check(`${f.name}: (1) negiert: Kosten bleiben bezahlt, keine Suche`, f.bezahlt(t) && !t.pile(0, 'hand').includes(f.spell), { bezahlt: f.bezahlt(t), hand: t.pile(0, 'hand') });
      R.check(`${f.name}: (1) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(f, false);
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (2) Kontrolle: Kosten bezahlt und Spell auf der Hand`, f.bezahlt(t) && t.pile(0, 'hand').includes(f.spell), { r, bezahlt: f.bezahlt(t), hand: t.pile(0, 'hand') });
      R.check(`${f.name}: (2) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(f, true);
      t.targetFn = () => null;   // Mensch: Abbrechen-Knopf der Heldenwahl
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (3) Abbruch der Heldenwahl: nichts bezahlt, Karte bleibt auf der Hand, Master's Plan ungespielt`, !f.bezahlt(t) && t.pile(0, 'hand').includes(f.name) && t.pile(1, 'hand').includes(PLAN), { r, hand: t.pile(0, 'hand') });
    }
  }
  R.finish();
})();
