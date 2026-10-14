'use strict';
// M01-08 · Biomancy Token / Boulder in a Bottle, die per „defeat/destroy" (actionDestroyCard) sterben, landen in der ABLAGE statt im Gelöscht-Stapel
// Kartentext Biomancy: „… as a Biomancy Token … When it leaves the board, delete it." / Potions werden nach dem Einsatz gelöscht (Boulder: Skriptkopf „Typ Creature/Token … soll beim Verlassen des Bretts in den GELOESCHT-Stapel gehen").
// Ursache (Engine, schon als Nebenbefund in H02 notiert): `_engine.js` `_actionMoveCardKern` (~Z. 13731) schiebt den Kadaver ohne Token-Umleitung auf `discardPile`; der Schadenspfad (~Z. 47686/47235) kennt sie.
// Reale Wege: Burned Contract („Choose a Creature any player controls and defeat it") und Decapitating Strike (Kreaturen-Zweig) laufen über `engine.actionDestroyCard`.
// Aufbau A: Sitz 0 Held 0 Biomancy Lv1; Healing Potion → Token (40 HP). Sitz 1 spielt Burned Contract auf den Token.
// Aufbau B: Sitz 0 spielt Boulder in a Bottle auf Sitz 1 Held 0; Sitz 1 zerstört ihn mit Burned Contract.
// Erwartet: Token bzw. Fels landen im Gelöscht-Stapel (Biomancy-Token: Gelöscht-Stapel des Besitzers; Potion nie in der Ablage).
// W5a (Al 14.10.2026, "Potion wird deleted"): der TOKEN selbst verschwindet vollständig; nur die echte Karte darunter (Potion) wird gelöscht – genau einmal, Gelöscht-Stapel ihres Besitzers.
// Beobachtet: A: „Healing Potion" liegt in der Ablage von Sitz 0 (kann per Shooting Star / Spontaneous Reappearance zurückgeholt und erneut gespielt werden). B: „Boulder in a Bottle" liegt in der Ablage von Sitz 1.
// Kontrolle: stirbt derselbe Token durch SCHADEN, landet er korrekt im Gelöscht-Stapel.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  R.section('A) Biomancy Token stirbt durch Burned Contract');
  {
    const t = await H.fresh({ hand: [['Healing Potion'], ['Burned Contract']], hp: 800, gold: 100, abilities: { 0: { 0: [['Biomancy'], [], []] } } });
    t.hero(0, 1).hp = 500;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
    await t.play(0, 'Healing Potion');
    const tok = t.inst(c => c.counters && c.counters._effectOverride === 'Biomancy Token')[0];
    R.check('Vorbedingung: Biomancy Token liegt auf dem Brett', !!tok);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === 'Healing Potion').id];
    const r = await t.play(1, 'Burned Contract');
    R.check('Burned Contract gespielt', r === true, r);
    R.check('Token ist weg', tok.zone !== 'support', tok.zone);
    R.check('Potion liegt im Gelöscht-Stapel von Sitz 0', t.pile(0, 'deletedPile').includes('Healing Potion'), { del0: t.pile(0, 'deletedPile'), disc0: t.pile(0, 'discardPile') });
    R.check('Potion liegt NICHT in der Ablage', !t.pile(0, 'discardPile').includes('Healing Potion'), t.pile(0, 'discardPile'));
    R.check('Potion genau einmal gelöscht', t.pile(0, 'deletedPile').filter(n => n === 'Healing Potion').length === 1, t.pile(0, 'deletedPile'));
  }
  R.section('B) Boulder in a Bottle stirbt durch Burned Contract');
  {
    const t = await H.fresh({ hand: [['Boulder in a Bottle'], ['Burned Contract']], hp: 800, gold: 100 });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Boulder in a Bottle');
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === 'Boulder in a Bottle').id];
    const r = await t.play(1, 'Burned Contract');
    R.check('Burned Contract gespielt', r === true, r);
    const alle = [...t.pile(0, 'discardPile'), ...t.pile(1, 'discardPile')];
    R.check('Boulder liegt in KEINER Ablage', !alle.includes('Boulder in a Bottle'), { disc0: t.pile(0, 'discardPile'), disc1: t.pile(1, 'discardPile') });
    const gel = [...t.pile(0, 'deletedPile'), ...t.pile(1, 'deletedPile')].filter(n => n === 'Boulder in a Bottle').length;
    R.check('Boulder in a Bottle (die echte Karte darunter) liegt genau einmal im Gelöscht-Stapel', gel === 1, { del0: t.pile(0, 'deletedPile'), del1: t.pile(1, 'deletedPile') });
  }
  R.section('Kontrolle: Biomancy Token stirbt durch Schaden');
  {
    const t = await H.fresh({ hand: [['Healing Potion'], []], hp: 800, abilities: { 0: { 0: [['Biomancy'], [], []] } } });
    t.hero(0, 1).hp = 500;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
    await t.play(0, 'Healing Potion');
    const tok = t.inst(c => c.counters && c.counters._effectOverride === 'Biomancy Token')[0];
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0, controller: 1 }, tok, 500, 'spell', { sourceOwner: 1 }));
    R.check('durch Schaden: Gelöscht-Stapel', t.pile(0, 'deletedPile').includes('Healing Potion') && !t.pile(0, 'discardPile').includes('Healing Potion'), { del0: t.pile(0, 'deletedPile'), disc0: t.pile(0, 'discardPile') });
  }
  R.finish();
})();
