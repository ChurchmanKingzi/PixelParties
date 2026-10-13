'use strict';
// F02-23 · Item Lock (Hammer Throw): Reaktions-Artefakte, die im EIGENEN Zug gespielt werden, kosten keine Handkarte
// Kartentext Hammer Throw: „… The target's controller must delete a card from their hand whenever they play an Artifact during their next turn. …"
// Server (doPlayArtifact/doUseArtifactEffect, server.js ~Z. 11323/12226): `ps.itemLocked` ⇒ Prompt „Item Lock Cost: You must delete 1 card from your hand to use an Artifact."
// Aufbau: (a) Sitz 1 mit `itemLocked = true`, Hand [Idol of Crestina, ZZ Filler ×2]; Zugwechsel auf Sitz 1 (eigener Resource Phase, Idol wird angeboten und angenommen).
//         (b) Sitz 0 mit `itemLocked = true`, Hand [Attack, Magic Topaz, ZZ Filler ×2]; Sitz 0 greift an, Topaz wird als Reaktion gespielt.
// Erwartet: In beiden Fällen ist ein „Artifact gespielt" im eigenen Zug: Item-Lock-Kosten-Prompt (eine Handkarte löschen) bzw. das Artefakt ist nicht gratis spielbar.
// Beobachtet: Idol und Topaz werden ohne Item-Lock-Prompt gespielt, nichts wird gelöscht. (Kontrolle: ein normal gespieltes Artefakt löst den Prompt aus ✓.)
// Vermutete Ursache: die Hand-Reaktionsfenster der Engine (`_checkResourcePhaseReactions` ~Z. 34090, `_checkAttackReactions`-Familie) prüfen `_artifactLockTurn`, aber nirgends `itemLocked`; der Kostenprompt steht nur in den Server-Spielwegen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const itemLockPrompts = (t) => t.prompts.filter(p => /Item Lock/i.test(p.d.title || '') || /Item Lock/i.test(p.d.source || ''));
  // a) Idol of Crestina
  let t = await H.fresh({ hand: [[], ['Idol of Crestina', 'ZZ Filler', 'ZZ Filler']], gold: [100, 100], deck: [['ZZ Dummy'], ['Fireball', 'Attack', 'ZZ Dummy', 'ZZ Dummy']] });
  t.gs.players[1].itemLocked = true;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Idol of Crestina', answer: () => ({ cardName: 'Fireball' }) });
  t.policy.confirm = true;
  await t.endTurn();
  const idolGespielt = t.pile(1, 'discardPile').includes('Idol of Crestina');
  R.check('(a) Idol of Crestina im eigenen Resource Phase gespielt', idolGespielt, { disc: t.pile(1, 'discardPile') });
  R.check('(a) Idol unter Item Lock: Kostenprompt / Löschung einer Handkarte', itemLockPrompts(t).length > 0 || t.pile(1, 'deletedPile').length > 0, { prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')), del: t.pile(1, 'deletedPile') });
  // b) Magic Topaz
  t = await H.fresh({ hand: [['Attack', 'Magic Topaz', 'ZZ Filler', 'ZZ Filler'], []], gold: [100, 100] });
  t.gs.players[0].itemLocked = true;
  t.policy.confirm = true;
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const hp = t.hp(1, 0);
  await t.play(0, 'Attack', { hero: 0 });
  R.check('(b) Magic Topaz gespielt (+60)', hp - t.hp(1, 0) === 100, { dmg: hp - t.hp(1, 0) });
  R.check('(b) Topaz unter Item Lock: Kostenprompt / Löschung einer Handkarte', itemLockPrompts(t).length > 0 || t.pile(0, 'deletedPile').length > 0, { prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')), del: t.pile(0, 'deletedPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
