'use strict';
// A05-skeletons-19 · Skeleton Bard lässt auch negierte bzw. diesen Zug beschworene Skelette ihren Effekt „zusätzlich" benutzen
// Kartentext (Skeleton Bard): „You may once per turn choose another "Skeleton" Creature you control with a once per turn effect. It may immediately use its once
//   per turn effect an additional time."
// Regel (Engine): Kreatureneffekte sind nicht nutzbar, solange die Kreatur negiert/eingefroren/betäubt ist (`isCreatureEffectSuppressed`) und am Beschwörungstag
//   (Summoning Sickness: `turnPlayed === turn`, außer `_hasHaste`). „An additional time" setzt voraus, dass die Kreatur ihren Effekt überhaupt benutzen dürfte.
// Aufbau: Skeleton Bard (alt) + Skeleton Mage („draw 2, discard 1"; Handnetto +1). (a) Mage negiert; (b) Mage diesen Zug beschworen.
// Erwartung: Bard bietet die Kreatur nicht an / sie zieht nicht.
// Beobachtet: In beiden Fällen wird sie angeboten und zieht 2/legt 1 ab (Hand +1).
// Ursache: `skeleton-bard.js` `eligibleTargets()` prüft weder `engine.isCreatureEffectSuppressed(inst)` noch die Summoning-Sickness; `onCreatureEffect` ruft das Ziel-Skript direkt.
const H = require('../../lib/h.js');
async function szene(vorbereiten) {
  const t = await H.fresh({ hand: [['ZZ Filler', 'ZZ Filler'], []] });
  const bard = t.put(0, 0, 0, 'Skeleton Bard'); bard.turnPlayed = 1;
  const mage = t.put(0, 0, 1, 'Skeleton Mage'); mage.turnPlayed = 1;
  await vorbereiten(t, mage);
  t.put(1, 0, 0, H.INERT.big);
  t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable' || d.type === 'handPick', answer: () => ({ handIndex: 0, selectedCards: [{ handIndex: 0, cardName: t.pile(0, 'hand')[0] }] }) });
  t.targetFn = (valid) => [valid[0].id];
  t.gs.activePlayer = 0; t.phase(2);
  const h0 = t.pile(0, 'hand').length;
  const r = await t.activateCreature(0, 0, 0);
  return { r, plus: t.pile(0, 'hand').length - h0, t };
}
(async () => {
  const R = H.runner();
  const k = await szene(async () => {});
  R.check('Kontrolle: aktives Skeleton Mage wird per Bard erneut ausgelöst', k.r === true && k.plus === 1, { r: k.r, plus: k.plus });
  const a = await szene(async (t, mage) => { await t.run(() => t.engine.actionNegateCreature(mage, 'test')); });
  R.check('(a) negiertes Skeleton Mage zieht nicht über den Bard', a.plus === 0, { r: a.r, plus: a.plus });
  const b = await szene(async (t, mage) => { mage.turnPlayed = t.gs.turn; });
  // W16c: (b) ist eine offene Regelfrage an Al (Welle 16, A05-19b) - das Verhalten bleibt unverändert, der Prüfpunkt bleibt bis zur Antwort rot.
  R.check('(b) diesen Zug beschworenes Skeleton Mage zieht nicht über den Bard (Summoning Sickness)', b.plus === 0, { r: b.r, plus: b.plus });
  R.finish();
})();
