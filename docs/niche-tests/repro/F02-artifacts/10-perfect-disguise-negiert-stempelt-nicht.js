'use strict';
// F02-10 · Ganz negierter Perfect Disguise verbraucht die Einmal-pro-Spiel-Grenze NICHT (Als Entscheidung, Welle 3)
// Kartentext: „You can only play 1 "Perfect Disguise" per game." – REGEL (CARD_API.md „★ Z7b", ersetzt Ruling v1031 / Z7): eine komplett negierte Karte (Rusty Touch) hat nie aufgelöst →
//   Einmal-Slot unverbraucht, auch „per game"; die Kosten (12 Gold) bleiben bezahlt. Das zweite Exemplar ist spielbar; erst ein aufgelöstes stempelt.
// Aufbau: Sitz 0: 2× Perfect Disguise auf der Hand, 100 Gold; Sitz 1: Rusty Touch (Spell-Reaktion, negiert einen Artifact-Spielzug; der Spieler zahlt trotzdem).
// Schritte: 1. Perfect Disguise spielen (Held 0 als Ziel), Sitz 1 negiert mit Rusty Touch. 2. Das zweite Perfect Disguise spielen.
// Exit 1 (Fehler tritt auf) = der negierte Spielzug hat „perfectDisguise" gestempelt bzw. das zweite ist nicht spielbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Perfect Disguise', 'Perfect Disguise'], ['Rusty Touch']], gold: [100, 100] });
  t.grantFor(1, 0, 'Rusty Touch');
  t.policy.confirm = true;                                     // Sitz 1 spielt Rusty Touch
  const pick = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
  const spiele = async () => {
    await t.play(0, 'Perfect Disguise', { noAutoConfirm: true });
    const pt = t.gs.potionTargeting;
    if (!pt) return { geoeffnet: false };
    const valid = (pt.validTargets || []).filter(v => !v.ineligible);
    const c = await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: pick(valid) }));
    return { geoeffnet: true, c };
  };
  const g0 = t.gs.players[0].gold;
  const a = await spiele();
  R.check('1. Perfect Disguise wurde negiert (Rusty Touch in der Ablage, Karte in der Ablage, Gold bezahlt)',
    t.pile(1, 'discardPile').includes('Rusty Touch') && t.pile(0, 'discardPile').includes('Perfect Disguise') && g0 - t.gs.players[0].gold === 12, { a, d0: t.pile(0, 'discardPile'), gold: t.gs.players[0].gold });
  R.check('der ganz negierte Spielzug stempelt „perfectDisguise" NICHT', ![...(t.gs.players[0]._oncePerGameUsed || [])].includes('perfectDisguise'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
  t.policy.confirm = false; t.reset();
  const b = await spiele();
  R.check('2. Perfect Disguise ist spielbar (Zielwahl öffnet sich, Karte wirkt)', b.geoeffnet === true && b.c === true, { b, hand: t.pile(0, 'hand'), untargetable: t.hero(0, 0).statuses.untargetable });
  R.check('Kontrolle: das aufgelöste zweite stempelt „perfectDisguise"', [...(t.gs.players[0]._oncePerGameUsed || [])].includes('perfectDisguise'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
