'use strict';
// S03-P1 (Prüfauftrag S01-11) · Victory Phoenix Cannon bietet als Folgezauber ein Divine Gift an, obwohl die Einmal-pro-Spiel-Grenze („divineGift") schon verbraucht ist
// Kartentext VPC: „… You may then immediately use a level 1 or lower Destruction Magic Spell from your hand with the user as an additional Action. If you do, the user takes 200 damage as recoil."
// Divine Gifts: „once per game" (`oncePerGame: true`, `oncePerGameKey: 'divineGift'`).
// Aufbau: Held 0 Destruction Magic 3 + Support Magic 4; Hand [VPC, Divine Gift of Fire, Meteor Crash]; `_oncePerGameUsed = {'divineGift'}`.
// Erwartet: Divine Gift of Fire wird nicht angeboten bzw. nicht gewirkt (nur Meteor Crash).
// Beobachtet: Die Galerie enthält Divine Gift of Fire, der Folgezauber wird gewirkt (Hand ohne Gift, Ablage mit Gift, Rückstoß 200). Gleiche Wurzel wie S01-11 (`_castSpellImmediately` prüft `oncePerGame` nicht).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Victory Phoenix Cannon', 'Divine Gift of Fire', 'Meteor Crash'], []], hp: 800 });
  t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Support Magic', 'Support Magic', 'Support Magic', 'Support Magic'], []]);
  t.gs.players[0]._oncePerGameUsed = new Set(['divineGift']);
  let angeboten = null;
  t.script.push({ match: d => d.type === 'playerPicker', answer: () => ({ playerIdx: 1 }) });
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { angeboten = d.cards.map(c => c.name); return { cardName: d.cards.find(c => c.name === 'Divine Gift of Fire') ? 'Divine Gift of Fire' : d.cards[0].name }; } });
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 0); return [(v || valid[0]).id]; };
  t.policy.confirm = true;
  await t.play(0, 'Victory Phoenix Cannon', { hero: 0, noGrant: true });
  R.check('Divine Gift of Fire (Einmal-pro-Spiel schon verbraucht) wird nicht angeboten', angeboten && !angeboten.includes('Divine Gift of Fire'), angeboten);
  R.check('Divine Gift of Fire bleibt auf der Hand', t.pile(0, 'hand').includes('Divine Gift of Fire'), { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
