// A08-25 · Noble Mummy Guards: löst auch aus, wenn der Held keine ANDERE Fähigkeit hat (Stapeln derselben Fähigkeit) – Surprise wird ohne Wirkung verbraucht
//
// Kartentext: „Activate this Surprise when your opponent attaches an Ability to a Hero. Choose a different Ability attached to the same Hero and return it to its original owner's hand,
// then place this Creature into one of the user's free Support Zones."  Skriptkopf: „…attaches an Ability to a Hero that already has 1+ OTHER Abilities."
// Aufbau: Sitz 0 hat Noble Mummy Guards als Surprise an Held 0 (Summoning Magic). Sitz 1 Held 0 trägt „Fighting" (Stufe 1); Sitz 1 legt ein zweites „Fighting" darauf (Stapel → Stufe 2).
//   Vergleich: Sitz 1 legt „Training" neben „Fighting" (eine andere Fähigkeit liegt vor).
// Erwartung: Fighting auf Fighting hat keine „different Ability" ⇒ die Surprise darf nicht angeboten werden (bleibt verdeckt); beim Vergleich löst sie aus und schickt Fighting zurück.
// Beobachtet: Fighting auf Fighting ⇒ Bestätigungsfrage, die Surprise wird aufgedeckt und landet in einer Support Zone, ohne dass irgendetwas zurückgeschickt wird (Optionenliste leer → `return null`).
//   `surpriseTrigger` (noble-mummy-guards.js ~Z. 60-75) zählt den schon vorhandenen Stapel (`slot.length > 1`) der neu angehängten Fähigkeit selbst als „andere Fähigkeit".
// Aufruf: node docs/niche-tests/repro/A08-pacman/25-noble-mummy-guards-loest-ohne-andere-faehigkeit-aus.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  async function lauf(ab, karte, slot) {
    const t = await H.fresh({ hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    t.putSurprise(0, 0, 'Noble Mummy Guards'); t.grantFor(0, 0, 'Noble Mummy Guards');
    t.setAbilities(1, 0, ab);
    t.script.push({ match: d => d.type === 'optionPicker' && /Noble/.test(d.title || ''), answer: (d) => ({ optionId: d.options[0].id }) });
    t.reset();
    await t.play(1, karte, { hero: 0, zoneSlot: slot });
    const imBrett = t.inst(c => c.name === 'Noble Mummy Guards').some(c => c.zone === 'support');
    return { imBrett, fehler: t.errors.length, hand1: t.pile(1, 'hand') };
  }
  const gleich = await lauf([['Fighting'], [], []], 'Fighting', 0);
  R.note('Fighting auf Fighting', JSON.stringify(gleich));
  R.check('Fighting auf Fighting (keine andere Fähigkeit): Surprise bleibt verdeckt', !gleich.imBrett, gleich);
  const andere = await lauf([['Fighting'], [], []], 'Training', 1);
  R.note('Training neben Fighting', JSON.stringify(andere));
  R.check('Vergleich Training neben Fighting: Surprise löst aus und schickt Fighting zurück', andere.imBrett && andere.hand1.includes('Fighting'), andere);
  R.check('keine Engine-Fehler', gleich.fehler === 0 && andere.fehler === 0);
  R.finish();
})();
