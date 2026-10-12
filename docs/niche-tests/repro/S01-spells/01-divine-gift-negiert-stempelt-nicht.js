'use strict';
// S01-01 · Negiertes Divine Gift verbraucht die gemeinsame Einmal-pro-Spiel-Grenze nicht
// Kartentext (alle Divine Gifts): „You can only activate 1 "Divine Gift" card per game."
// Ruling CARD_API.md ~Z. 11418-11440 (v1031): „Der Stempel sitzt dort, wo die Karte die Hand verlässt – ab da IST sie aktiviert …,
//   unabhängig davon, ob ein Gegenzug sie später negiert."
// Aufbau: Sitz 0 hat Divine Gift of Fire und Divine Gift of Skill auf der Hand; Sitz 1 hat Silence (Reaktion, negiert einen Zauber).
// Schritte: 1. Divine Gift of Fire spielen, Sitz 1 antwortet mit Silence (negiert). 2. Divine Gift of Skill spielen.
// Erwartet: Nach dem ersten (negierten) Gift ist „divineGift" gestempelt; das zweite Gift ist nicht spielbar (Server lehnt ab / Karte bleibt auf der Hand).
// Beobachtet: `_oncePerGameUsed` bleibt leer, das zweite Gift wird gespielt und wirkt (4 Bonus-Anhänge). Der Stempel steht in server.js doPlaySpell nur im
//   Normalzweig (ca. Z. 8948); der Negierungs-Zweig (`if (chainResult.negated) { … return true; }`, ca. Z. 8324-8374) kehrt davor zurück.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of Fire', 'Divine Gift of Skill'], ['Silence']] });
  t.grantFor(1, 0, 'Silence');
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return [(v || valid[0]).id]; };
  t.script.push({ match: d => d.type === 'playerPicker', answer: () => ({ playerIdx: 1 }) });
  t.policy.confirm = true;                                            // Sitz 1 spielt Silence
  const r1 = await t.play(0, 'Divine Gift of Fire', { hero: 0 });
  R.check('Divine Gift of Fire wurde negiert (kein Brand, Karte in der Ablage)', r1 === true && t.pile(0, 'discardPile').includes('Divine Gift of Fire') && !t.gs.players[1].heroes.some(h => h.statuses.burned));
  R.check('Silence hat reagiert (Sitz 1 hat sie nicht mehr auf der Hand)', !t.pile(1, 'hand').includes('Silence'), t.pile(1, 'hand'));
  const stempel1 = [...(t.gs.players[0]._oncePerGameUsed || [])];
  R.check('negiertes Gift gilt als aktiviert: „divineGift" ist gestempelt', stempel1.includes('divineGift'), stempel1);
  t.policy.confirm = false;
  t.reset();
  const r2 = await t.play(0, 'Divine Gift of Skill', { hero: 0 });
  const wirkte = (t.gs.players[0]._bonusAbilityAttachments || {})[0] === 4;
  R.check('zweites Divine Gift ist NICHT mehr spielbar', r2 === false && !wirkte, { r2, hand: t.pile(0, 'hand'), bonus: t.gs.players[0]._bonusAbilityAttachments });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
