'use strict';
// F03-artifacts-07 · Slippery Fridge: Verschieben löst die „sent to the discard pile"-Trigger von Thunder Trumpet und Storm Piano aus
// Kartentexte: Thunder Trumpet „When this Artifact equipped to a Hero you control is sent to the discard pile, choose a target and deal 80 damage to it."
//              Storm Piano „When this Artifact … is sent to the discard pile, prevent any damage the previously equipped Hero would take until the end of your next turn."
//              Slippery Fridge „… equip them to a different Hero the same player controls."
// Erwartung: Die Ausrüstung wird nur von Held 0 an Held 1 umgehängt – sie kommt nicht in die Ablage, also kein Trigger (kein Schaden, kein damage_proof).
// Beobachtet (✗): Beide Instrumente feuern; Trompete fragt ein Ziel und macht 80 Schaden, Piano setzt `damage_proof` auf den Quellheld.
// Ursache: `cards/effects/slippery-fridge.js` (Schritt 5a) ruft `onCardLeaveZone` OHNE `toZone`; `_orchestra-shared.instrumentDiscardTrigger` (Z. ~123) wertet „kein toZone" als
//   Ablage („Heldentod-Abbau traegt kein toZone → Discard"). Gleiche Klasse: Rain Viola (nutzt denselben Helfer; nicht getestet).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SF = 'Slippery Fridge';
  // Thunder Trumpet
  let t = await H.fresh({ hand: [['Thunder Trumpet', SF], []], gold: 100 });
  await t.play(0, 'Thunder Trumpet', { hero: 0, slot: 0 });
  let prompts = 0;
  t.targetFn = (valid, cfg) => {
    const ti = (cfg && cfg.title) || '';
    if (ti === 'Thunder Trumpet') { prompts++; return [valid.find(v => v.type === 'hero' && v.owner === 1).id]; }
    if (ti === SF) { const v = valid.find(v => v.cardName === 'Thunder Trumpet'); return v ? [v.id] : undefined; }
    if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(v => v.type === 'hero' && v.heroIdx === 1); return v ? [v.id] : undefined; }
    return undefined;
  };
  await t.play(0, SF);
  R.check('Aufbau: Trompete liegt jetzt bei Held 1', [0, 1, 2].some(s => t.zone(0, 1, s) === 'Thunder Trumpet'), [0, 1, 2].map(h => [0, 1, 2].map(s => t.zone(0, h, s))));
  R.check('Thunder Trumpet: keine Zielwahl, kein 80-Schaden beim bloßen Verschieben', prompts === 0 && t.hp(1, 0) === 800, { prompts, hp1: t.hp(1, 0) });
  R.check('Trompete nicht in der Ablage', !t.pile(0, 'discardPile').includes('Thunder Trumpet'), t.pile(0, 'discardPile'));
  // Storm Piano
  t = await H.fresh({ hand: [['Storm Piano', SF], []], gold: 100 });
  await t.play(0, 'Storm Piano', { hero: 0, slot: 0 });
  t.targetFn = (valid, cfg) => {
    const ti = (cfg && cfg.title) || '';
    if (ti === SF) { const v = valid.find(v => v.cardName === 'Storm Piano'); return v ? [v.id] : undefined; }
    if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(v => v.type === 'hero' && v.heroIdx === 1); return v ? [v.id] : undefined; }
    return undefined;
  };
  await t.play(0, SF);
  R.check('Aufbau: Piano liegt jetzt bei Held 1', [0, 1, 2].some(s => t.zone(0, 1, s) === 'Storm Piano'), [0, 1, 2].map(h => [0, 1, 2].map(s => t.zone(0, h, s))));
  R.check('Storm Piano: Quellheld nicht damage_proof beim bloßen Verschieben', !t.hero(0, 0).statuses.damage_proof, t.hero(0, 0).statuses);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
