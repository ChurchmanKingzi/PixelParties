'use strict';
// F03-artifacts-04 · Snow Cannon bietet eine Kreatur an, die per Thicket „cannot be chosen by cards and effects" ist – und friert sie ein
// Kartentexte: Thicket „Choose a Creature you control. That Creature cannot be chosen by cards and effects until the beginning of your next turn."
//              Snow Cannon „Choose a target your opponent controls and Freeze it for 1 turn."
// Erwartung: Solange Thicket wirkt (Gegnerzug), kann Snow Cannon die Kreatur nicht wählen (Kontrollprobe: The Yeeting über `promptEffectTarget` bietet sie nicht an).
// Beobachtet (✗): Snow Cannon listet die Kreatur ohne `ineligible`-Marke, die Wahl wird ausgeführt, die Kreatur ist gefroren.
// Ursache: Snow Cannon baut seine Zielliste selbst (`cards/effects/snow-cannon.js` getValidTargets prüft `untargetable_all` nicht) und läuft über die
//   `potionTargeting`-Session; `normalizeValidTargets` (server.js ~11765) filtert Erst-Runden-Schutz, Seiten-Schild und Taunt, aber NICHT `counters.untargetable_all`
//   (die Marke wird nur in `promptEffectTarget`/Prompt-Sammlern ~5106/5681/28015 und im Sammler ~40272 beachtet). Betrifft jedes Ziel-Artefakt/-Trank mit eigener Liste.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Snow Cannon', 'The Yeeting'], ['Thicket']], active: 1, gold: 100 });
  const c = t.put(1, 0, 0, H.INERT.big, { counters: { currentHp: 1000, maxHp: 1000 } });
  c.turnPlayed = 1;
  t.targetFn = (valid) => { const v = valid.find(v => v.type === 'equip' && v.owner === 1); return v ? [v.id] : undefined; };
  await t.play(1, 'Thicket');
  R.check('Aufbau: Thicket wirkt (untargetable_all)', !!c.counters.untargetable_all, c.counters);
  await t.endTurn();
  R.check('Aufbau: Sitz 0 am Zug, Marke steht noch', t.gs.activePlayer === 0 && !!c.counters.untargetable_all, c.counters);
  let seenS;
  t.targetFn = (valid) => { seenS = valid.filter(v => !v.ineligible).map(v => v.id); return seenS.includes('equip-1-0-0') ? ['equip-1-0-0'] : null; };
  const rS = await t.play(0, 'Snow Cannon');
  R.check('Aufbau: Snow Cannon öffnete eine Zielwahl', seenS != null, { rS, hand: t.pile(0, 'hand'), gold: t.gs.players[0].gold });
  R.check('Snow Cannon bietet die Thicket-Kreatur nicht an', !(seenS || []).includes('equip-1-0-0'), seenS);
  R.check('Thicket-Kreatur nicht eingefroren', !c.counters.frozen, c.counters);
  const fd = t.put(1, 0, 1, H.INERT.creature, { counters: { currentHp: 200, maxHp: 200 } });
  let seenY = null;
  t.targetFn = (valid, cfg) => {
    if (cfg && /Yeeting — Choose Target/.test(cfg.title || '')) { seenY = valid.filter(v => !v.ineligible).map(v => v.id); return null; }
    const h = valid.find(v => v.type === 'hero' && v.owner === 0); return h ? [h.id] : undefined;
  };
  await t.play(0, 'The Yeeting');
  R.check('Kontrolle: The Yeeting bietet die Thicket-Kreatur nicht an (die andere schon)', seenY && !seenY.includes('equip-1-0-0') && seenY.includes('equip-1-0-1'), seenY);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
