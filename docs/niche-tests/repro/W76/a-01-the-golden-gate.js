'use strict';
// W76a-01 · The Golden Gate (Spell Area Lv1, Magic Arts)
// „Whenever a Creature is placed into a player's Support Zone, that player gains 2 Gold."
const H = require('../../lib/h.js');
const CARD = 'The Golden Gate';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

(async () => {
  const R = H.runner();

  R.section('A · Area legt sich selbst; jede Beschwörung zahlt DEM Spieler der Zone 2 Gold');
  {
    const t = await H.fresh({ hand: [[CARD, 'Cute Bird'], ['Cute Bird']], deckSize: 20, gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('Area liegt in der Area Zone', t.gs.areaZones[0].includes(CARD), t.gs.areaZones);
    const g0 = t.gs.players[0].gold, g1 = t.gs.players[1].gold;
    await t.play(0, 'Cute Bird', { hero: 0, zone: 0 });
    R.check('eigene Beschwörung: +2 Gold für Sitz 0', t.gs.players[0].gold - g0 === 2 - (t.DB['Cute Bird'].cost || 0), [g0, t.gs.players[0].gold]);
    R.check('Sitz 1 unverändert', t.gs.players[1].gold === g1, t.gs.players[1].gold);
    // Gegner beschwört in seine Zone: er bekommt das Gold
    t.gs.activePlayer = 1; t.phase('MAIN1'); t.resetActions(1);
    const g1b = t.gs.players[1].gold;
    await t.play(1, 'Cute Bird', { hero: 0, zone: 0 });
    R.check('Beschwörung des Gegners: +2 Gold für Sitz 1', t.gs.players[1].gold - g1b === 2 - (t.DB['Cute Bird'].cost || 0), [g1b, t.gs.players[1].gold]);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Wie bei Ingo: Platzieren, Bewegung in eine neue Zone und Creature-Token zahlen');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 20, gold: [100, 100], active: 0 });
    t.putArea(0, CARD);
    const g0 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionPlaceCreature('Cute Bird', 0, 0, 1, { source: 'test' }));
    R.check('Platzieren per Effekt: +2 Gold', t.gs.players[0].gold === g0 + 2, [g0, t.gs.players[0].gold]);
    const k = t.find('Cute Bird', 'support');
    R.check('die Creature liegt auf dem Brett', !!k, !!k);
    const g1 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionTransferCreature(k, 1, 0, 2, { sourceName: 'Dark Gear', skipAnimation: true }));
    R.check('Seitenwechsel (Bewegung): kein Gold mehr für Sitz 0', t.gs.players[0].gold === g1, [g1, t.gs.players[0].gold]);
    R.check('… sondern +2 Gold für Sitz 1, in dessen Zone sie jetzt liegt (Bewegung zählt wie bei Ingo)', t.gs.players[1].gold === 102, t.gs.players[1].gold);
    const g0t = t.gs.players[0].gold;
    await t.run(() => t.engine.actionPlaceCreature('Mummy Token', 0, 0, 3, { source: 'test' }));
    R.check('Creature-Token zählt wie bei Ingo: +2 Gold', t.gs.players[0].gold === g0t + 2, [g0t, t.gs.players[0].gold]);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('C · Ohne Area nichts; vor dem Legen aus der Hand nichts');
  {
    const t = await H.fresh({ hand: [[CARD, 'Cute Bird'], []], deckSize: 20, gold: [100, 100], active: 0 });
    const g0 = t.gs.players[0].gold;
    await t.play(0, 'Cute Bird', { hero: 0, zone: 0 });
    R.check('ohne Area: kein Gold (nur Kosten)', t.gs.players[0].gold === g0 - (t.DB['Cute Bird'].cost || 0), [g0, t.gs.players[0].gold]);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
