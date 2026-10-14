'use strict';
// Z7c-A3 · Knife Throw: „Send an Artifact equipped to the user to the discard pile TO PLAY THIS CARD" — das Artefakt ist ein Kostenpunkt und bleibt bei Ganz-Negierung in der Ablage.
// Aufbau: Sitz 0: Held 0 (Fighting 2) mit ausgerüstetem Club of Gobbo, Knife Throw auf der Hand; Sitz 1 hält "The Master's Plan" (negiert jede gespielte Handkarte).
// Erwartung: (1) negiert: das Artefakt liegt schon VOR dem Reaktionsfenster in der Ablage und bleibt dort, der Gegner nimmt keinen Schaden;
//            (2) Kontrolle ohne Negation: Artefakt in der Ablage, Gegner-Held 0 verliert HP; (3) ohne ausgerüstetes Artefakt ist die Karte nicht spielbar (unverändert).
// Aufruf: node docs/niche-tests/repro/Z7c/A3-knife-throw-kosten-bleiben-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const PLAN = "The Master's Plan";
async function bau(reaktion) {
  const t = await H.fresh({ hand: [['Knife Throw'], reaktion ? [PLAN] : []], abilities: { 0: { 0: [['Fighting', 'Fighting'], [], []] } } });
  t.put(0, 0, 0, 'Club of Gobbo');
  if (reaktion) t.grantFor(1, 0, PLAN);
  t.policy.confirm = true;
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  return t;
}
const artefaktDa = (t) => t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === 'Club of Gobbo').length === 1;
(async () => {
  const R = H.runner();
  {
    const t = await bau(true);
    let beimFenster = null;
    t.script.unshift({ match: d => d.type === 'confirm' && d.title === PLAN, answer: () => { beimFenster = artefaktDa(t); return { confirmed: true }; }, once: true });
    const hp = t.hp(1, 0);
    await t.play(0, 'Knife Throw', { hero: 0 });
    R.check("(1) The Master's Plan wurde gespielt", beimFenster !== null && !t.pile(1, 'hand').includes(PLAN), { beimFenster, prompts: t.prompts.map(p => p.d.title || p.d.type) });
    R.check('(1) das Artefakt war beim Reaktionsfenster schon abgelegt (Kosten vor der Kette)', beimFenster === false, { beimFenster });
    R.check('(1) negiert: Artefakt bleibt in der Ablage', !artefaktDa(t) && t.pile(0, 'discardPile').includes('Club of Gobbo'), t.pile(0, 'discardPile'));
    R.check('(1) negiert: kein Schaden', t.hp(1, 0) === hp, t.hp(1, 0));
    R.check('(1) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(false);
    const hp = t.hp(1, 0);
    await t.play(0, 'Knife Throw', { hero: 0 });
    R.check('(2) Kontrolle ohne Negation: Artefakt in der Ablage', !artefaktDa(t) && t.pile(0, 'discardPile').includes('Club of Gobbo'), t.pile(0, 'discardPile'));
    R.check('(2) Kontrolle ohne Negation: Gegner-Held 0 verliert HP', t.hp(1, 0) < hp, { hp, jetzt: t.hp(1, 0) });
    R.check('(2) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(false);
    t.inst(c => c.zone === 'support' && c.name === 'Club of Gobbo').forEach(c => t.engine._untrackCard(c.id));
    t.gs.players[0].supportZones[0] = [[], [], []];
    const r = await t.play(0, 'Knife Throw', { hero: 0 });
    R.check('(3) ohne ausgerüstetes Artefakt nicht spielbar: Karte bleibt auf der Hand', t.pile(0, 'hand').includes('Knife Throw'), { r, hand: t.pile(0, 'hand') });
  }
  R.finish();
})();
