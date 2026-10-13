'use strict';
// S02-11 · Hand of Death: der verzögerte Effekt verfällt, wenn die Karte vor Zugende aus der Ablage geholt wird (Regelfrage)
// Kartentext: „If the user is not defeated, Frozen or Stunned at the end of your opponent's next turn, you may choose any target and defeat it. …
//   If a target is defeated by this effect, skip your next turn. You can only play 1 'Hand of Death' per turn."
// Skriptkopf: der Effekt hängt an `ps._handOfDeathArmed`; ausgelöst wird er vom `onTurnEnd`-Listener JEDER Hand-of-Death-Instanz in der ABLAGE (`ctx.card.zone !== 'discard'` ⇒ return).
// Aufbau: Sitz 0 spielt Hand of Death (Zug 5), dann „Magic Sapphire" (Artifact: „Choose a Spell from your discard pile and add it to your hand") und holt die Karte zurück.
//   Danach zwei Zugwechsel (Ende des Gegnerzugs 6).
// Erwartet (Lesart „Spell hat einen verzögerten Effekt gestartet"): am Ende des Gegnerzugs darf Sitz 0 trotzdem ein Ziel besiegen.
// Beobachtet: nichts passiert (kein Zielprompt); `_handOfDeathArmed` bleibt als Leiche stehen. Der Effekt ist an die Karte in der Ablage gebunden, nicht an den Zauber.
// Relevante echte Karten, die Zauber aus der Ablage holen: Magic Sapphire, Meditation (und Klaus' Mom für Decay Magic).
// Ursache: `cards/effects/hand-of-death.js` `onTurnEnd` (Z. 143: `if (ctx.card.zone !== 'discard') return;`) – ohne Karte in der Ablage kein Listener.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Hand of Death', 'Magic Sapphire'], []] });
  let prompts = 0;
  t.targetFn = (valid, cfg) => { if (/Hand of Death/.test((cfg && cfg.title) || '')) prompts++; return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; };
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { const c = d.cards.find(x => x.name === 'Hand of Death') || d.cards[0]; return { cardName: c.name, source: c.source }; } });
  await t.play(0, 'Hand of Death', { hero: 0 });
  prompts = 0;                                                       // Wahl beim Ausspielen gibt es nicht; ab hier zählt nur der Zugende-Prompt
  const r2 = await t.play(0, 'Magic Sapphire', { hero: 0 });
  t.say('Sapphire:', r2, '| Hand', t.pile(0, 'hand'), '| Ablage', t.pile(0, 'discardPile'));
  R.check('Hand of Death liegt wieder auf der Hand (Aufbau)', t.pile(0, 'hand').includes('Hand of Death'), t.pile(0, 'hand'));
  await t.endTurn(); await t.endTurn();
  t.say('Zugende des Gegners: Prompts', prompts, '| Gegnerheld 0 HP', t.hp(1, 0));
  R.check('der verzögerte Effekt feuert trotzdem (Zielwahl erscheint)', prompts > 0, prompts);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
