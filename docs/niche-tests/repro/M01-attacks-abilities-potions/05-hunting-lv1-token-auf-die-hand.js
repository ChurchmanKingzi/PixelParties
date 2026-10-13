'use strict';
// M01-05 · Hunting Lv1: ein besiegter gegnerischer TOKEN wird als Karte „Mummy Token" auf die Hand genommen
// Kartentext Hunting Lv1: „Once per turn, when this Hero defeats an opponent's Creature, you may add it to your hand instead of sending it to the discard pile."
// Regel (README §4 Familie 4 / CARD_API „Tokens … überall verboten"; Engine: Tokens gehen nie in die Ablage/Hand, sie werden gelöscht – Vorbild A05-02 Dive Bomblebee).
// Aufbau: Held 0 hat Hunting (1 Kopie); Sitz 1 hat einen Mummy Token (50 HP); Sitz 0 spielt Critical Strike (2×40 = 80) auf den Token; Hunting-Frage wird mit „Ja" beantwortet.
// Erwartet: Der Token wird nicht als Handkarte angeboten bzw. verschwindet wie sonst (Gelöscht-Stapel), die Hand von Sitz 0 enthält keinen „Mummy Token".
// Beobachtet: Die Frage „Add Mummy Token to your hand instead of sending it to the discard pile?" erscheint, nach „Ja" liegt die Karte „Mummy Token" (cardType Token) auf der Hand von Sitz 0.
// Gegenprobe: Lv2/Lv3 (Übernahme auf das Brett) funktionieren mit dem Token; eine normale Kreatur (ZZ Dummy Frail) kommt korrekt auf die Hand.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Critical Strike'], []], hp: 800, abilities: { 0: { 0: [['Hunting'], [], []] } } });
    t.put(1, 0, 0, H.INERT.frail);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    await t.play(0, 'Critical Strike', { hero: 0 });
    R.check('Kontrolle: normale Kreatur kommt auf die Hand', t.pile(0, 'hand').includes(H.INERT.frail), t.pile(0, 'hand'));
  }
  {
    const t = await H.fresh({ hand: [['Critical Strike'], []], hp: 800, abilities: { 0: { 0: [['Hunting'], [], []] } } });
    t.put(1, 0, 0, 'Mummy Token');
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    const r = await t.play(0, 'Critical Strike', { hero: 0 });
    R.check('Critical Strike gespielt', r === true, r);
    R.check('Hunting fragt NICHT nach einem Token (Z5: Token ist keine Karte)', !t.prompts.some(p => p.d.type === 'confirm' && p.d.title === 'Hunting'), t.prompts.map(p => p.d.title));
    R.check('Token im Gelöscht-Stapel des Besitzers', t.pile(1, 'deletedPile').includes('Mummy Token'), t.pile(1, 'deletedPile'));
    R.check('Token liegt NICHT als Karte auf der Hand', !t.pile(0, 'hand').includes('Mummy Token'), t.pile(0, 'hand'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
