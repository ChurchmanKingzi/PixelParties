'use strict';
// A07-26 · Wolflesia: die Zusatz-Zauberaktion bleibt verfügbar, wenn die Kreatur negiert/gefroren/betäubt/von der Clown-Aura stillgelegt ist
//
// Kartentext Wolflesia: „… While this Creature has "Rafflesia, the Poison Princess" attached to it, it gains 200 HP and this effect: You may once
//   per turn use a level 3 or lower Decay or Support Spell with this Creature as an additional Action."
// Konvention: eine stillgelegte Kreatur verliert ihre Effekte (`engine.isCreatureEffectSuppressed`, B-querschnitt B-01…B-03).
// Mechanik: Wolflesia setzt per `grantAdditionalAction` einen Grant (`counters.aaGrants`), den `onAttachHero`/`onTurnStart` erneuert; der Grant ohne
//   `expiresAtTurnEnd` bleibt als Zähler stehen. `findAdditionalActionForCard`/`getAdditionalActions` (_engine.js ~39831/39880) lesen die Grants
//   aller Instanzen des Spielers, ohne die Stilllegung des Anbieters zu prüfen (nur der Hook-Weg der Karte ist stumm).
// Erwartung: Ist Wolflesia stillgelegt, gibt es keinen zweiten Zauber (Hauptaktion schon verbraucht).
// Beobachtet: Der zweite Zauber (Brilliant Idea, Support Magic Lv 1) wird in allen vier Zuständen als Zusatzaktion gespielt (Kontrolle ohne Wolflesia: abgelehnt).
//   Der Fehler betrifft jeden Anbieter von Zusatzaktionen, der seinen Grant persistent hält (Wolflesia hier gemessen; andere nicht).
const H = require('../../lib/h.js');
const D = H.INERT.creature;

async function szene(how) {
  const t = await H.fresh({ hand: [['Rafflesia, the Poison Princess', 'Brilliant Idea', 'Brilliant Idea', 'Brilliant Idea'], []], deck: [['Fireball', ...Array(10).fill(D)], []], deckSize: 20 });
  const w = t.put(0, 0, 0, how === 'ohne' ? D : 'Wolflesia, the Canine Flower'); w.turnPlayed = 1;
  if (how !== 'ohne') { t.gs.activePlayer = 0; t.phase(2); await t.activateCreature(0, 0, 0); }   // Rafflesia anlegen ⇒ Grant
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
  if (how === 'negiert') await t.engine.actionNegateCreature(w, 'Test');
  else if (how === 'eingefroren') await t.engine.applyCreatureStatus(w, 'frozen', { sourceOwner: 1 });
  else if (how === 'betäubt') await t.engine.applyCreatureStatus(w, 'stunned', { sourceOwner: 1 });
  else if (how === 'Clown-Aura') t.put(1, 0, 0, 'The Creepy Clown of Heaven');
  t.gs.activePlayer = 0; t.phase(3); t.resetActions(0);
  const r1 = await t.play(0, 'Brilliant Idea', { hero: 0, keepActions: true });          // verbraucht die Hauptaktion
  const hi = t.pile(0, 'hand').indexOf('Brilliant Idea');
  const r2 = await t.run(() => t.host.doPlaySpell(t.room, 0, { cardName: 'Brilliant Idea', handIndex: hi, heroIdx: 0, viaCreatureInstId: w.id }));
  return { t, w, r1, r2 };
}

(async () => {
  const R = H.runner();
  let s = await szene('ohne');
  R.check('Kontrolle: ohne Wolflesia wird der zweite Zauber abgelehnt', s.r1 === true && s.r2 === false, { r1: s.r1, r2: s.r2 });
  s = await szene('normal');
  R.check('Kontrolle: arbeitende Wolflesia erlaubt den zweiten Zauber', s.r1 === true && s.r2 === true, { r1: s.r1, r2: s.r2 });
  for (const how of ['negiert', 'eingefroren', 'betäubt', 'Clown-Aura']) {
    s = await szene(how);
    const still = s.t.engine.isCreatureEffectSuppressed(s.w);
    R.check(`Wolflesia ${how} (stillgelegt=${still}): zweiter Zauber wird abgelehnt`, still && s.r2 === false, { r1: s.r1, r2: s.r2, still });
  }
  R.finish();
})();
