'use strict';
// A05-skeletons-19 · Skeleton Bard lässt auch negierte bzw. diesen Zug beschworene Skelette ihren Effekt „zusätzlich" benutzen
// Kartentext (Skeleton Bard): „You may once per turn choose another "Skeleton" Creature you control with a once per turn effect. It may immediately use its once
//   per turn effect an additional time."
// Regel (Engine): Kreatureneffekte sind nicht nutzbar, solange die Kreatur negiert/eingefroren/betäubt ist (`isCreatureEffectSuppressed`). „An additional time" setzt voraus,
//   dass die Kreatur ihren Effekt überhaupt benutzen dürfte.
// Aufbau: Skeleton Bard (alt) + Skeleton Mage („draw 2, discard 1"; Handnetto +1). (a) Mage negiert; (b) Mage diesen Zug beschworen.
// Erwartung (a): Bard bietet das negierte Skelett nicht an / es zieht nicht (W16c behoben).
// ★ W18b (Entscheidung Al, 19.10.2026, A05-19b: „Darf der Bard ein Skelett wählen, das diesen Zug beschworen wurde?" – „Ja"): (b) ist ERLAUBT. Der Bard erlaubt die Nutzung
//   ausdrücklich „immediately"; ein frisch beschworenes Skelett (Summoning Sickness) darf er wählen und es zieht 2/legt 1 ab (Hand +1). Das Repro prüfte die verworfene Lesart A
//   („nicht anbietbar") und ist auf die bestätigte Regel umgestellt; das Skript blieb unverändert (Ist-Zustand).
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
  // W18b: Al hat „Ja" gesagt – ein diesen Zug beschworenes Skelett darf der Bard wählen (Summoning Sickness hindert hier nicht).
  R.check('(b) diesen Zug beschworenes Skeleton Mage zieht über den Bard (Al: „Ja")', b.r === true && b.plus === 1, { r: b.r, plus: b.plus });
  R.check('(b) keine Engine-Fehler', b.t.errors.length === 0, b.t.errors);
  R.finish();
})();
