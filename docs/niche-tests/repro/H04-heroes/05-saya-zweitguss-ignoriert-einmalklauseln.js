'use strict';
// H04-05 · Saya: der Zweitguss ignoriert „once per game"-Klauseln (Divine Gift, Guard Duty)  [Stufe C – Regelfrage]
//
// Kartentext Saya, the Plant Princess: „When this Hero uses a normal Support Magic Spell with a level lower than its Support Magic
//   level, it may immediately cast it a second time afterwards."
// Kartentext Divine Gift of Creation: „You can only activate 1 "Divine Gift" card per game. Search your deck for up to 2 cards …"
// Kartentext Guard Duty: „… You can only play 1 "Guard Duty" per game."
// Ruling CARD_API.md (v1277): „Ein Zweitguss ist kein neues Ausspielen." (gesagt zu `_spellFreeAction`, Bartas)
// Beobachtet: Saya darf ein Divine Gift (oncePerGame) und Guard Duty zweimal in Folge wirken (voller zweiter Guss, zweite Suche /
//   zweite Mischung). Die Einmal-Sperre wird nur beim ersten Ausspielen gestempelt (`_oncePerGameUsed`), der Zweitguss führt `onPlay` erneut aus.
// Frage an Al: siehe Bericht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SAYA = 'Saya, the Plant Princess';
  const heroes = [[SAYA, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']];
  const deck = ['Fireball', 'Icebolt', 'Heal', 'Haste', 'Brilliant Idea', 'Attack', 'Quick Attack'].concat(Array(10).fill(H.INERT.creature));
  const t = await H.fresh({ heroes, hand: [['Divine Gift of Creation'], []], deck: [deck, []] });
  t.engine && await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.setAbilities(0, 0, [['Support Magic', 'Support Magic'], [], []]);
  let suchen = 0;
  t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Divine Gift of Creation', answer: (d) => { suchen++; return { selectedCards: suchen === 1 ? ['Fireball', 'Icebolt'] : [d.cards[0].name] }; } });
  const r = await t.play(0, 'Divine Gift of Creation', { hero: 0, noGrant: true });
  R.check('Vorbereitung: Divine Gift of Creation gespielt, 1. Suche lief', r === true && suchen >= 1, { r, suchen });
  R.check('Divine Gift („only activate 1 per game"): Saya bietet KEINEN zweiten Guss/zweite Suche an', suchen === 1, { suchen, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });

  const t2 = await H.fresh({ heroes, hand: [['Guard Duty'], []], deck: [deck, []], discard: [['Fireball', 'Icebolt'], ['Attack']] });
  t2.setAbilities(0, 0, [['Support Magic', 'Support Magic'], [], []]);
  await t2.play(0, 'Guard Duty', { hero: 0, noGrant: true });
  const zweiteMischung = t2.prompts.filter(p => p.d.title === 'Guard Duty').length;
  R.check('Guard Duty („only play 1 per game"): nur EINE Mischfrage (kein Zweitguss)', zweiteMischung === 1, { fragen: zweiteMischung });
  R.finish();
})();
