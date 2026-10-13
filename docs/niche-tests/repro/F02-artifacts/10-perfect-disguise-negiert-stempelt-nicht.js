'use strict';
// F02-10 · Negierter Perfect Disguise verbraucht die Einmal-pro-Spiel-Grenze nicht
// Kartentext: „You can only play 1 "Perfect Disguise" per game." – Ruling CARD_API.md ~Z. 11418-11440 (v1031, Divine Gifts): „Der Stempel sitzt dort, wo die Karte die Hand verlässt – ab da IST sie
//   aktiviert …, unabhängig davon, ob ein Gegenzug sie später negiert." (Parallelbefund S01-01 für Spells.)
// Aufbau: Sitz 0: 2× Perfect Disguise auf der Hand, 100 Gold; Sitz 1: Rusty Touch (Spell-Reaktion, negiert einen Artifact-Spielzug; der Spieler zahlt trotzdem).
// Schritte: 1. Perfect Disguise spielen (Held 0 als Ziel), Sitz 1 negiert mit Rusty Touch. 2. Das zweite Perfect Disguise spielen.
// Erwartet: Nach dem ersten (negierten) Spielzug ist `perfectDisguise` gestempelt; das zweite ist nicht spielbar.
// Beobachtet: `_oncePerGameUsed` bleibt leer (12 Gold wurden aber bezahlt), das zweite Perfect Disguise wird gespielt und wirkt.
// Vermutete Ursache: der Stempel für Ziel-Artefakte steht erst im Normalzweig von `doConfirmPotion` (nicht im Negierungs-Zweig).
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
  R.check('negierter Spielzug stempelt „perfectDisguise"', [...(t.gs.players[0]._oncePerGameUsed || [])].includes('perfectDisguise'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
  t.policy.confirm = false; t.reset();
  const b = await spiele();
  R.check('2. Perfect Disguise ist NICHT mehr spielbar', b.geoeffnet === false, { b, hand: t.pile(0, 'hand'), untargetable: t.hero(0, 0).statuses.untargetable });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
