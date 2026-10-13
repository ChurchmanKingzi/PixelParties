// A08-11 · Afflicted Pests legt ein gewähltes Token in die ABLAGE statt in den Gelöscht-Stapel
//
// Kartentext Afflicted Pests: „Activate this Surprise when your opponent equips or attaches a card to a Hero. Choose a card in any Hero's Support Zone
//   and send it to the discard pile, then place this Creature into one of the user's free Support Zones."
// Engine-Konvention (Tokens kommen nie in die Ablage): `_engine.js:47686-47706` (Ausrüstung eines gefallenen Helden: „Tokens go to deleted pile"),
//   Reaktives Netz `_enforceSupportZoneLock` („Token → Deleted"), Lösch-/Todeszweig der Kreaturen.
//
// Erwartung: Wählt Pests ein Token (Mummy Token, Pollution Token …), wird es gelöscht (Gelöscht-Stapel) – die Ablage bleibt frei von Tokens.
// Beobachtet: Das Token liegt danach als Karte „Mummy Token"/„Pollution Token" in der Ablage des Besitzers; die Gelöscht-Liste ist leer.
//   Pests schreibt direkt (`afflicted-pests.js` ~Z. 112-125: `discardPs.discardPile.push(tCardName)`), ohne die Token-Weiche der Engine.
// Aufruf: node docs/niche-tests/repro/A08-pacman/11-afflicted-pests-token-in-ablage.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  for (const token of ['Mummy Token', 'Pollution Token']) {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    t.grantFor(0, 0, 'Afflicted Pests');
    t.putSurprise(0, 0, 'Afflicted Pests');
    t.put(0, 0, 0, token).turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.cardName === token).id];
    const r = await t.play(1, 'Club of Gobbo', { hero: 0 });          // Gegner rüstet aus → Pests löst aus und wählt das Token
    R.check(`${token}: Pests hat ausgelöst (Token ist vom Brett)`, r === true && !t.gs.players[0].supportZones[0].some(z => z.includes(token)), { r, brett: t.gs.players[0].supportZones[0] });
    const inAblage = t.pile(0, 'discardPile').filter(n => n === token).length + t.pile(1, 'discardPile').filter(n => n === token).length;
    R.check(`${token}: kein Token in einer Ablage`, inAblage === 0, { ablage0: t.pile(0, 'discardPile'), ablage1: t.pile(1, 'discardPile'), geloescht0: t.pile(0, 'deletedPile') });
    R.check(`${token}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
