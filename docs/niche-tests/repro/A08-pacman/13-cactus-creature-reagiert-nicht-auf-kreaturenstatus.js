// A08-13 · Cactus Creature reagiert nur auf Statuseffekte an HELDEN, nicht an eigenen Kreaturen
//
// Kartentext: „Activate this Surprise when a target you control would be affected by a status effect. Afflict any other target you control with that status
//   effect instead, then place this Creature into one of the user's free Support Zones."
// („target" umfasst in diesem Spiel Helden UND Kreaturen; das Skript selbst führt Kreaturen als Ziel der Umleitung und in `canTelekinesisActivate` mit.)
//
// Erwartung: Wird eine Kreatur von Sitz 0 eingefroren (Quelle: Sitz 1), bietet Cactus Creature die Umleitung an (Kontrolle: bei einem Helden tut sie es).
// Beobachtet: Beim Helden wird die Surprise angeboten und umgeleitet (Kontrolle ✓). Bei der Kreatur kommt kein Fenster, die Kreatur ist eingefroren, die Surprise bleibt verdeckt liegen.
//   Das Fenster `_checkSurpriseOnStatus` hängt nur an `addHeroStatus` (`_engine.js:44755`), nicht an `applyCreatureStatus` (`_engine.js:17564`).
// Aufruf: node docs/niche-tests/repro/A08-pacman/13-cactus-creature-reagiert-nicht-auf-kreaturenstatus.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler, D = H.INERT.creature;
  const neu = async () => {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    t.grantFor(0, 0, 'Cactus Creature');
    t.putSurprise(0, 0, 'Cactus Creature');
    t.targetFn = (valid) => [(valid.find(x => x.type === 'hero' && x.heroIdx === 1) || valid[0]).id];   // Umleitungsziel: Held 1
    return t;
  };
  {   // Kontrolle: Heldenstatus
    const t = await neu();
    await t.run(() => t.engine.addHeroStatus(0, 0, 'frozen', { duration: 1, appliedBy: 1 }));
    R.check('Kontrolle Held: Cactus wird angeboten und der Frost landet bei Held 1', !!t.hero(0, 1).statuses.frozen && !t.hero(0, 0).statuses.frozen, { h0: Object.keys(t.hero(0, 0).statuses), h1: Object.keys(t.hero(0, 1).statuses) });
  }
  {   // eigene Kreatur
    const t = await neu();
    const c = t.put(0, 0, 0, D); c.turnPlayed = 1;
    await t.run(() => t.engine.applyCreatureStatus(c, 'frozen', { sourceOwner: 1 }));
    const angeboten = t.prompts.some(p => p.d.type === 'confirm');
    R.check('Kreatur: Cactus Creature wird angeboten (Bestätigungsfenster)', angeboten, { prompts: t.prompts.map(p => p.d.type), kreaturFrozen: !!c.counters.frozen, surprise: t.gs.players[0].surpriseZones });
    R.check('Kreatur: der Frost wurde umgeleitet (Kreatur nicht gefroren)', !c.counters.frozen, c.counters);
    R.check('Kreatur: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
