'use strict';
// A09-04 · Golden Arrow: „You cannot gain or spend Gold for the rest of the turn afterwards" – Cecilia und Smuggler's Pier zahlen trotzdem
// Kartentext Golden Arrow: „… You gain 1 Gold for every 10 damage that Attack dealt. You cannot gain or spend Gold for the rest of the turn afterwards."
// Cecilia: „spend all your Gold (at least 1) to delete an Artifact … and add a copy of it from your deck to your hand."   Pier: „spend a multiple of 5 Gold to draw a card for every 5 Gold spent".
// Konvention im Code: Karten, die Gold als EFFEKT ausgeben, prüfen ps.goldLocked selbst (anti-magnet.js, golden-ladybug.js, hel-the-bound-specter.js);
// CARD_API Tabelle „Gold: gain, spend, set": actionSpendGold ist durch goldLocked gesperrt.
// Aufbau: Seed 1234. Seite 0: Held 0 Tushu mit Fighting 1, Held 1 Cecilia. Hand [Golden Arrow, Smuggler's Pier]; Ablage [Idej Blade - Hakai]; Deck enthält 1x Idej Blade - Hakai.
// Schritte: 1. Attack + Golden Arrow -> Goldsperre. 2. Cecilia aktivieren (Hakai wählen). 3. Smuggler's Pier ausspielen und aktivieren (10 Gold -> 2 Karten).
// Erwartet: Gold bleibt unverändert, Cecilia/Pier tun nichts (Ausgabe unmöglich).
// Beobachtet: Cecilia: Gold unverändert, aber Artifact gelöscht + Kopie auf der Hand (Kosten nicht gezahlt); Pier: 10 Gold gezahlt, 2 Karten gezogen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const mk = async () => {
    const t = await H.fresh({ hand: [['Golden Arrow', "Smuggler's Pier", 'Attack'], []], gold: [100, 100],
      heroes: [['Tushu, the Knowledge Keeper', 'Cecilia, the Harrowing Crusader', 'Zwei, the Lucky Thief'], null],
      discard: [['Idej Blade - Hakai'], []], deck: [['Idej Blade - Hakai', ...Array(12).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Attack', { hero: 0 });
    return t;
  };
  R.section('Cecilia');
  {
    const t = await mk();
    R.check('Goldsperre liegt', t.gs.players[0].goldLocked === true);
    const g = t.gs.players[0].gold;
    t.script.push({ match: d => d.type === 'cardGallery' && /Cecilia/.test(d.title || ''), answer: () => ({ cardName: 'Idej Blade - Hakai' }) });
    await t.activateHero(0, 1, {});
    const bekommen = t.pile(0, 'hand').includes('Idej Blade - Hakai') || t.pile(0, 'deletedPile').includes('Idej Blade - Hakai');
    R.check('Cecilia: bei Goldsperre keine Wirkung (Karte nicht gelöscht/geholt, ohne dass Gold ausgegeben wurde)', !(bekommen && t.gs.players[0].gold === g), { gold: t.gs.players[0].gold, goldVorher: g, hand: t.pile(0, 'hand'), deleted: t.pile(0, 'deletedPile') });
  }
  R.section("Smuggler's Pier");
  {
    const t = await mk();
    t.setGold(0, 100);   // Spielkosten der Pier sind eine eigene Frage (siehe A09-10); hier geht es um das Ausgeben per Effekt
    await t.play(0, "Smuggler's Pier", {});
    t.setGold(0, 100);
    const h = t.pile(0, 'hand').length;
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === "Smuggler's Pier", answer: () => ({ optionId: 'pay-2' }) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.engine.activateAreaEffect(0, 0, "Smuggler's Pier"));
    R.check("Pier: bei Goldsperre wird kein Gold ausgegeben und keine Karte gezogen", t.gs.players[0].gold === 100 && t.pile(0, 'hand').length === h, { gold: t.gs.players[0].gold, hand: t.pile(0, 'hand').length, handVorher: h });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
