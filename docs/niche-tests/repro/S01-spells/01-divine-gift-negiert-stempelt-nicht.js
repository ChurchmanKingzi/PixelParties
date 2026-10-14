'use strict';
// S01-01 · Divine Gift: ein GANZ negiertes Gift verbraucht die gemeinsame Einmal-pro-Spiel-Grenze NICHT (Als Entscheidung, Welle 3)
// Kartentext (alle Divine Gifts): „You can only activate 1 "Divine Gift" card per game."
// REGEL (CARD_API.md „★ Z7b", ersetzt Ruling v1031 vom 12.9. und die Z7-Regel „jede negierte Karte gilt als gespielt"): ob das Limit verbraucht ist, hängt daran,
//   ob die Karte AUFLÖSEN durfte. Wird die komplette Karte negiert („Negate that Spell": Silence, Master's Plan, MOE Shield …), hat sie nie aufgelöst →
//   weder „per turn" noch „per game" ist verbraucht (Al: „Ja, das gilt auch für once per game, inklusive Divine Gifts"). Bezahlte Kosten bleiben bezahlt.
//   Löst die Karte auf und nur das Ergebnis wird verhindert, ist das Limit verbraucht (Kontrollfall unten).
// Aufbau: Sitz 0 hat Divine Gift of Fire und Divine Gift of Skill auf der Hand; Sitz 1 hat Silence (Reaktion, negiert einen Zauber).
// Schritte: 1. Divine Gift of Fire spielen, Sitz 1 antwortet mit Silence (negiert). 2. Divine Gift of Skill spielen.
// Exit 1 (Fehler tritt auf) = das negierte Gift hat „divineGift" gestempelt bzw. das zweite Gift ist nicht spielbar / wirkt nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of Fire', 'Divine Gift of Skill'], ['Silence']] });
  t.grantFor(1, 0, 'Silence');
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return [(v || valid[0]).id]; };
  t.script.push({ match: d => d.type === 'playerPicker', answer: () => ({ playerIdx: 1 }) });
  t.policy.confirm = true;                                            // Sitz 1 spielt Silence
  const r1 = await t.play(0, 'Divine Gift of Fire', { hero: 0 });
  R.check('Voraussetzung: Divine Gift of Fire wurde negiert (kein Brand, Karte in der Ablage)', r1 === true && t.pile(0, 'discardPile').includes('Divine Gift of Fire') && !t.gs.players[1].heroes.some(h => h.statuses.burned));
  R.check('Voraussetzung: Silence hat reagiert (Sitz 1 hat sie nicht mehr auf der Hand)', !t.pile(1, 'hand').includes('Silence'), t.pile(1, 'hand'));
  const stempel1 = [...(t.gs.players[0]._oncePerGameUsed || [])];
  R.check('das ganz negierte Gift hat „divineGift" NICHT gestempelt', !stempel1.includes('divineGift'), stempel1);
  t.policy.confirm = false;
  t.reset();
  const r2 = await t.play(0, 'Divine Gift of Skill', { hero: 0 });
  const wirkte = (t.gs.players[0]._bonusAbilityAttachments || {})[0] === 4;
  R.check('zweites Divine Gift ist spielbar und wirkt (4 Bonus-Anhänge)', r2 === true && wirkte, { r2, hand: t.pile(0, 'hand'), bonus: t.gs.players[0]._bonusAbilityAttachments });
  R.check('das aufgelöste zweite Gift verbraucht die Grenze', [...(t.gs.players[0]._oncePerGameUsed || [])].includes('divineGift'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
