'use strict';
// S01-19 · Divine Gift of Creation: die Sperre „you cannot use those cards or cards with the same names for the rest of the turn" gilt nicht für Equipment, Surprises und Abilities
// Kartentext: „Search your deck for up to 2 cards with different names, reveal them and add them to your hand. If you choose 2 cards, you cannot use those cards or cards with the same names for the rest of the turn."
// Die Sperre (`ps._creationLockedNames`) wird geprüft in: `validateActionPlay` (_engine.js ~Z. 20698: Zauber/Attacks/Kreaturen), `doUsePotion` (server.js ~Z. 11863) und `doUseArtifactEffect` (~Z. 12058).
//   Nicht geprüft: `doPlayArtifact` (Equipment), `doPlaySurprise`, `doPlayAbility`.
// Aufbau: Sitz 0 hat das Gift und eine Kopie der Testkarte auf der Hand; das Gift holt (Testkarte, Zweitkarte) aus dem Deck → beide Namen gesperrt.
// Erwartet: keine Kopie der gesperrten Namen ist in diesem Zug spielbar (Kontrolle: Burning Finger und Elven Archer werden abgelehnt).
// Beobachtet: Club of Gobbo (Equipment), Magic Mirror (Surprise), Toughness (Ability) lassen sich trotz Sperre spielen.
const H = require('../../lib/h.js');
async function lauf(karte, andere) {
  const DECK = ['Club of Gobbo', 'Elven Archer', 'Magic Mirror', 'Toughness', 'Burning Finger'];
  const t = await H.fresh({ hand: [['Divine Gift of Creation', karte], []], deck: [DECK, ['ZZ Dummy']], gold: [100, 100] });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: [karte, andere] }) });
  await t.play(0, 'Divine Gift of Creation', { hero: 0 });
  const ps = t.gs.players[0];
  const gesperrt = [...(ps._creationLockedNames || [])].includes(karte);
  const idx = ps.hand.indexOf(karte);
  const r = await t.play(0, karte, { hero: 0, keepActions: true, handIndex: idx });
  return { gesperrt, r, errors: t.errors };
}
(async () => {
  const R = H.runner();
  for (const [karte, art, andere] of [['Burning Finger', 'Zauber (Kontrolle)', 'Elven Archer'], ['Elven Archer', 'Kreatur (Kontrolle)', 'Burning Finger'],
                                       ['Club of Gobbo', 'Equipment', 'Burning Finger'], ['Magic Mirror', 'Surprise', 'Burning Finger'], ['Toughness', 'Ability', 'Burning Finger']]) {
    const x = await lauf(karte, andere);
    R.check(`${art}: ${karte} ist gesperrt (Name im Set) und nicht spielbar`, x.gesperrt && x.r === false, { gesperrt: x.gesperrt, spielResultat: x.r });
  }
  R.finish();
})();
