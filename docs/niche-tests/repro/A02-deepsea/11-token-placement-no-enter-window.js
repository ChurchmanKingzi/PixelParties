'use strict';
// A02-deepsea-11 · Invader Token (Analyzer / Invader): das Platzieren öffnet das Eintritts-Fenster nicht (Aquatic Arrows bleibt stumm)
//
// Kartentext (Aquatic Arrows): „Activate this Surprise when a Creature enters a Support Zone of your opponent's Hero in the same position as the user.
//   Deal 100 damage to all Creatures in that Hero's Support Zones."
// Kartentext (Analyzer): „… place an Invader Token into either player's free Support Zone …" (Invader: „place up to 2 Invader Tokens into free Support Zones …")
// Ruling (CARD_API „Eintritts-Fenster 'Creature betritt eine Support Zone'"): das Fenster gilt für „Beschwoerung, place-Effekt UND reine Bewegung".
// Erwartung: Ein Invader Token (Karte vom Typ Token/Creature), der in die Zone eines gegnerischen Helden an meiner Position gelegt wird, löst meine Arrows aus.
// Beobachtet: Kontrolle (normale Beschwörung des Gegners an derselben Position) löst aus; der Token wird mit `engine.summonCreature` (still, ohne Hooks) gelegt –
//   kein `onCardEnterZone`, kein Fenster, die Arrows bleiben liegen.
// Ursache: `analyzer-from-the-cosmic-depths.js` runSpawn (~Z. 215) und `invader-from-the-cosmic-depths.js` placeInvaderTokens (~Z. 162) → `engine.summonCreature(INVADER_TOKEN, …)` ohne Hook-Lauf.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const AN = 'Analyzer from the Cosmic Depths';

  R.section('Kontrolle: normale Beschwörung des Gegners in Held 0 löst die Arrows aus');
  {
    const t = await H.fresh({ hand: [[], [H.INERT.creature]] });
    t.setAbilities(0, 0, [['Destruction Magic'], ['Magic Arts']]);
    t.putSurprise(0, 0, 'Aquatic Arrows');
    await t.play(1, H.INERT.creature, { hero: 0, slot: 0 });
    R.check('Arrows ausgelöst (Surprise abgelegt)', t.gs.players[0].surpriseZones[0].length === 0, t.gs.players[0].surpriseZones[0]);
  }

  R.section('Analyzer legt einen Invader Token in Held 0 des Gegners');
  {
    const t = await H.fresh({});
    t.setAbilities(0, 0, [['Destruction Magic'], ['Magic Arts']]);
    t.putSurprise(0, 0, 'Aquatic Arrows');
    const an = t.put(0, 1, 0, AN, { counters: { changeCounter: 2 } }); an.turnPlayed = 1;
    const big = t.put(1, 0, 2, H.INERT.big); big.turnPlayed = 1;
    t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options.find(o => o.id === 'spawn') ? 'spawn' : '1' }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ owner: 1, heroIdx: 0, slotIdx: d.zones.find(z => z.owner === 1 && z.heroIdx === 0).slotIdx }) });
    t.phase(2);
    await t.activateCreature(0, 1, 0);
    R.check('Vorbedingung: der Token liegt in Held 0 des Gegners', t.gs.players[1].supportZones[0].some(z => z[0] === 'Invader Token'), t.gs.players[1].supportZones[0]);
    R.check('Arrows ausgelöst (Surprise abgelegt)', t.gs.players[0].surpriseZones[0].length === 0, t.gs.players[0].surpriseZones[0]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
