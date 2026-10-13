'use strict';
// F02-24 · Philosopher's Stone wird trotz Artefakt-Sperre (Boomerang) angeboten
// Kartentext Boomerang: „Choose an Artifact from your discard pile and add it to your hand. You cannot play any Artifacts for the rest of this turn." (Blood-Soaked Coin: „You cannot play other Artifacts for the rest of the turn afterwards.")
// Kartentext Philosopher's Stone: „Play this card immediately when you would draw a card from your Potion Deck. …" – ein Reaction-Artefakt.
// Aufbau: Sitz 0: Hand [Boomerang, Potion of Greed, Philosopher's Stone], Ablage [Juice], Potion Deck [Healing Potion, Poison Vial, Acid Vial, Healing Potion].
// Schritte: 1. Boomerang spielen (Juice holen) – setzt `ps._artifactLockTurn`. 2. Potion of Greed spielen („Draw 2 cards from your Potion Deck").
// Erwartet: Die Stone ist nicht spielbar (Artefakt-Sperre bis Zugende); kein Reaktionsfenster, 2 Tränke normal gezogen. (Vergleich: Magic Topaz, Rocket Sneeze, Homerun! werden unter der Sperre nicht angeboten ✓.)
// Beobachtet: Die Stone wird angeboten, bezahlt (4 Gold) und ersetzt den Zug.
// Vermutete Ursache: `_engine.js _checkPotionDrawHandReactions` (~Z. 34202) kennt `_artifactLockTurn` nicht; die Geschwisterfenster (z. B. Z. 32150/32419/32585/32737/37807) haben `if (cardData?.cardType === 'Artifact' && ps._artifactLockTurn === this.gs.turn) continue;`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Boomerang', 'Potion of Greed', "Philosopher's Stone"], []], gold: [100, 100], discard: [['Juice'], []], potionDeck: [['Healing Potion', 'Poison Vial', 'Acid Vial', 'Healing Potion'], []] });
  t.policy.confirm = true;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Boomerang', answer: () => ({ cardName: 'Juice' }) });
  await t.play(0, 'Boomerang');
  R.check('Boomerang hat die Artefakt-Sperre gesetzt', t.gs.players[0]._artifactLockTurn === t.gs.turn, { lock: t.gs.players[0]._artifactLockTurn, turn: t.gs.turn });
  t.reset();
  t.script.length = 0;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === "Philosopher's Stone", answer: () => ({ cardName: 'Acid Vial' }) });
  const g0 = t.gs.players[0].gold;
  const r = await t.play(0, 'Potion of Greed');
  const stoneAngeboten = t.prompts.some(p => p.d.type === 'confirm' && p.d.title === "Philosopher's Stone");
  R.check('Potion of Greed gespielt', r === true, r);
  R.check('Philosopher\'s Stone wird unter der Artefakt-Sperre NICHT angeboten', !stoneAngeboten && !t.pile(0, 'discardPile').includes("Philosopher's Stone"), { prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')), hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
