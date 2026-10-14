'use strict';
// H04-15 · Kreatur-Tokens (Mummy / Invader / Leprochaun Token) landen bei „destroy/send to discard"-Effekten in der ABLAGE statt im Gelöscht-Stapel  [Stufe B]
//
// Regel (README §4, Familie 4: „Tokens (kommen nie in die Ablage)"; Engine: der Schadens-Todespfad schickt Tokens in den Gelöscht-Stapel,
//   `handleHeroDeathCleanup` ebenso, `_enforceSupportZoneLock` ebenso). Karten, die ein Token per `actionDestroyCard`/`actionMoveCard(…,'discard')`
//   wegschicken, bekommen das nicht mit: der Pfad `actionMoveCard` schiebt `cardInstance.name` unbesehen in `discardPile` (_engine.js ~Z. 13720,
//   „Kadaver landet VOR den Hooks").  Puppet- und Pollution-Tokens (cardType Token, subtype Normal) landen korrekt im Gelöscht-Stapel
//   (eigene Skript-Routen) – Mummy Token, Invader Token und Leprochaun Token (subtype Creature) nicht.
// Betroffene Karten dieser Gruppe: Sett (Zugende-Klausel, „counts as defeated"), Vena (Konfiszieren), Wall Breaker General Ralzish (Zerstören).
// Erwartung (W5a, Al 14.10.2026): der Token verschwindet vollständig (kein Eintrag in Ablage/Gelöscht-Stapel). Beobachtet (vor Welle 1): er lag in der Ablage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TOKENS = ['Mummy Token', 'Invader Token', 'Leprochaun Token'];
  const dl = Array(30).fill(H.INERT.creature);
  const alt = (t, s, h, z, n) => { const i = t.put(s, h, z, n); i.turnPlayed = 1; return i; };
  const inPiles = (t, nm) => [0, 1].flatMap(s => ['discardPile', 'deletedPile'].filter(k => t.pile(s, k).includes(nm)).map(k => `${s}.${k}`));
  for (const nm of TOKENS) {
    // Sett: Zugende-Klausel (nicht mit Mummy Token: der mumifiziert seinen Wirt – Sett wäre selbst stumm)
    let t = await H.fresh({ heroes: [['Sett, the Adept of Necromancy', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []], deck: [dl, dl] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    alt(t, 0, 0, 0, nm);
    t.gs.currentPhase = 4;
    await t.endTurn();
    if (nm !== 'Mummy Token') R.check(`Sett räumt ${nm} am Zugende ab → Token verschwindet vollständig (W5a: weder Ablage noch Gelöscht-Stapel)`, t.zone(0, 0, 0) === null && inPiles(t, nm).length === 0, { orte: inPiles(t, nm) });
    // Vena: Konfiszieren
    t = await H.fresh({ heroes: [['Vena, the Bounty Huntress', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []], gold: [50, 50] });
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    await t.run(() => t.engine.runHooks('onBeforeHandDraw', {}));
    alt(t, 1, 0, 0, nm);
    t.script.push({ match: d => d.type === 'optionPicker' && /Vena/.test(d.title || ''), answer: () => ({ optionId: 'discard' }) });
    await t.activateHero(0, 0, { effect: 'Vena, the Bounty Huntress' });
    R.check(`Vena konfisziert ${nm} → Token verschwindet vollständig (W5a: weder Ablage noch Gelöscht-Stapel)`, t.zone(1, 0, 0) === null && inPiles(t, nm).length === 0, { orte: inPiles(t, nm) });
    // Ralzish: Zerstören
    t = await H.fresh({ heroes: [['Wall Breaker General Ralzish', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    alt(t, 0, 0, 0, H.INERT.creature); alt(t, 0, 0, 1, H.INERT.creature);
    alt(t, 1, 0, 0, nm);
    t.targetFn = (valid) => { const v = valid.find(x => x.cardName === nm); return v ? [v.id] : null; };
    await t.activateHero(0, 0, { effect: 'Wall Breaker General Ralzish' });
    R.check(`Ralzish zerstört ${nm} → Token verschwindet vollständig (W5a: weder Ablage noch Gelöscht-Stapel)`, t.zone(1, 0, 0) === null && inPiles(t, nm).length === 0, { orte: inPiles(t, nm) });
  }
  R.finish();
})();
