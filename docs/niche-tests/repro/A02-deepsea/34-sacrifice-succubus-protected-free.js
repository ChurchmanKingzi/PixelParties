'use strict';
// A02-deepsea-34 · Greatmaw Shark / Infected Greatmaw: Opfer einer per Succubus geliehenen Kreatur – Kosten werden nicht bezahlt, der Nutzen kommt trotzdem
//
// Kartentext (Shark): „You may once per turn sacrifice a Creature you control that was not summoned this turn to increase the Attack stat of a Hero you control by 100 until the end of the turn."
// Kartentext (Infected Greatmaw): „You may once per turn sacrifice another Creature you control that was not summoned this turn to choose a target and deal damage equal to the Attack stat of one of your Heroes to it."
// Kartentext (Succubus): „… take control of it until the end of the turn, but that target cannot take any damage and cannot be defeated while you control it."
// Aufbau: Seat 0: Greatmaw Shark (bzw. Infected Greatmaw), Held 0 mit ATK 100. Seat 1: Kreatur (10 HP, eine Runde alt) in Held 1 / Slot 0, von Seat 0 per
//   `actionStealCreature(…, { damageImmune: true })` wie im Skript der Succubus geliehen. Phase Main 1, aktiver Effekt.
// Erwartung: Entweder wird die geliehene Kreatur gar nicht als Opfer angeboten (sie kann nicht besiegt werden), oder sie wird wirklich geopfert. Jedenfalls
//   keine „Kosten bezahlt, nichts passiert": Shark gibt +100 ATK nur, wenn ein Opfer tatsächlich vom Brett ging.
// Beobachtet: Die geliehene Kreatur wird als Opfer angeboten, bleibt aber unverändert auf dem Brett (der Zerstörungsweg ist durch `_stealImmortal` geschützt);
//   der Effekt gilt trotzdem als bezahlt: Shark +100 ATK (200), Einmal-pro-Zug-Sperre gesetzt. Infected: siehe zweiter Block.
// Ursache: `greatmaw-shark.js` / `infected-greatmaw.js` -> `engine.resolveSacrificeCost(ctx, spec)` meldet `paid` ohne zu prüfen, ob die Kreatur noch auf dem Brett steht;
//   `getSacrificableCreatures` nimmt Kreaturen mit `_stealImmortal` auf (nur `_cardinalImmune` wird in den Opfer-Pfaden gelesen, vgl. Kommentar `_engine.js` ~Z. 25880).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  R.section('Greatmaw Shark opfert die geliehene Kreatur');
  {
    const t = await H.fresh({ hand: [[], []] });
    t.hero(0, 0).atk = 100; t.hero(0, 0).baseAtk = 100;
    const shark = t.put(0, 0, 0, 'Greatmaw Shark'); shark.turnPlayed = 1;
    const x = t.put(1, 1, 0, H.INERT.frail); x.turnPlayed = 1;
    await t.run(() => t.engine.actionStealCreature(0, x, { damageImmune: true, sourceName: 'Deepsea Succubus' }));
    t.targetFn = (valid) => [(valid.find(v => v.cardName === H.INERT.frail) || valid[0]).id];
    t.phase(2);
    await t.activateCreature(0, 0, 0);
    const steht = t.inst(c => c.id === x.id && c.zone === 'support').length === 1;
    const atk = t.hero(0, 0).atk;
    R.check('kein Nutzen ohne Opfer: entweder Kreatur weg ODER keine +100 ATK', !(steht && atk === 200), { geliehene_steht_noch: steht, atk });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Infected Greatmaw opfert die geliehene Kreatur');
  {
    const t = await H.fresh({ hand: [[], []] });
    t.hero(0, 0).atk = 100; t.hero(0, 0).baseAtk = 100;
    const inf = t.put(0, 0, 0, 'Infected Greatmaw'); inf.turnPlayed = 1;
    const x = t.put(1, 1, 0, H.INERT.frail); x.turnPlayed = 1;
    await t.run(() => t.engine.actionStealCreature(0, x, { damageImmune: true, sourceName: 'Deepsea Succubus' }));
    const hp0 = t.hp(1, 0);
    t.targetFn = (valid, cfg) => {
      if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(valid.find(v => v.cardName === H.INERT.frail) || valid[0]).id];
      const opp = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0);
      return [(opp || valid[0]).id];   // 1. Wahl: eigener Held (ATK-Quelle), 2. Wahl: Gegnerheld 0 als Ziel
    };
    t.phase(2);
    await t.activateCreature(0, 0, 0);
    const steht = t.inst(c => c.id === x.id && c.zone === 'support').length === 1;
    const schaden = hp0 - t.hp(1, 0);
    R.check('kein Schaden ohne Opfer: entweder Kreatur weg ODER kein Treffer', !(steht && schaden > 0), { geliehene_steht_noch: steht, schaden });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
