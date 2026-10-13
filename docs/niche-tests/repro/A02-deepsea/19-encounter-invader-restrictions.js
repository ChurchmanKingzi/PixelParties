'use strict';
// A02-deepsea-19 · Deepsea Encounter: die Ersatz-Kreatur umgeht die Beschwörungsbeschränkungen (Invader)
//
// Kartentext (Deepsea Encounter): „Play this card immediately when your opponent chooses a Creature in one of your
// Heroes' Support Zones with an Attack, Spell or Creature effect. Add the Creature back to your hand and place a
// Creature with a different name whose level is up to 1 higher than the returned Creature's from your hand into
// the same Support Zone. That Creature becomes your opponent's new target."
// Kartentext (Invader from the Cosmic Depths): „This card can only be summoned by the effect of a "Cosmic" card or
// "Argos, the Eye of the Cosmos". … You can only control 1 "Invader from the Cosmic Depths" at a time."
// Vergleich: Shapeshift / Deepsea Castle bieten nur Ersatzkarten an, die `isCreatureSummonable` bestehen
// (`_deepsea-shared.js eligibleSwapReplacements`, Z. ~935); der Invader fällt dort heraus.
//
// Erwartung: Encounter bietet den Invader gar nicht an (er darf nur durch eine „Cosmic"-Karte beschworen werden),
//   und erst recht nicht, wenn man schon einen Invader kontrolliert.
// Beobachtet: `deepsea-encounter.js` (postTargetCondition / postTargetResolve) baut die Ersatzliste ohne
//   `isCreatureSummonable`: Der Invader steht in der Galerie und wird platziert (sein Token-Fenster öffnet sich);
//   mit einem schon kontrollierten Invader stehen danach ZWEI auf dem Brett.
const H = require('../../lib/h.js');
const S = require('../../../../cards/effects/_deepsea-shared.js');
(async () => {
  const R = H.runner();

  for (const zweiter of [false, true]) {
    R.section(zweiter ? 'Seat 0 kontrolliert schon einen Invader' : 'Seat 0 kontrolliert keinen Invader');
    const t = await H.fresh({ hand: [['Deepsea Encounter', 'Invader from the Cosmic Depths'], ['Deepsea Werewolf']] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], ['Decay Magic', 'Decay Magic']]);
    const ls = t.put(0, 0, 0, 'Life-Searcher from the Cosmic Depths'); ls.turnPlayed = 1;
    if (zweiter) { const inv = t.put(0, 2, 0, 'Invader from the Cosmic Depths'); inv.turnPlayed = 1; }

    if (!zweiter) {
      const basis = S.eligibleSwapReplacements(t.engine, 0, 'Dark Deepsea God', 4).map(x => x.name);
      R.check('Kontrolle: Shapeshift/Castle (eligibleSwapReplacements) bieten den Invader nicht an', !basis.includes('Invader from the Cosmic Depths'), basis);
    }

    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0 && v.slotIdx === 0).id];
    t.script.push({ match: d => d.type === 'optionPicker' && /Invader/.test(d.title || ''), answer: () => ({ optionId: '0' }) });
    // Sitz 1 beschwört Deepsea Werewolf (80 Schaden) auf Life-Searcher; Sitz 0 antwortet mit Encounter (Standardantwort „Ja")
    const r = await t.play(1, 'Deepsea Werewolf', { hero: 0, slot: 0 });
    R.check('Werewolf gespielt', r === true, r);
    const galerie = (t.prompts.find(p => p.d.type === 'cardGallery' && p.d.title === 'Deepsea Encounter') || { d: {} }).d;
    const angeboten = (galerie.cards || galerie.options || galerie.items || []).map(c => c.name || c.cardName || c);
    R.note('Encounter-Galerie', angeboten);
    R.check('Encounter bietet den Invader NICHT an (nur durch „Cosmic"-Effekt beschwörbar)', !angeboten.includes('Invader from the Cosmic Depths'), angeboten);
    const n = t.inst(c => c.zone === 'support' && c.name === 'Invader from the Cosmic Depths').length;
    R.check('Es steht höchstens 1 Invader auf dem Brett', n <= 1, { invader: n });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
