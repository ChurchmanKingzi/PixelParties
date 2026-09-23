'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Cold-Hearted Yuki-Onna"  (v1317)
//  Creature — Summoning Magic Lv0
//
//  "When you summon this Creature, send any number of "Heart of Ice"
//   Artifacts equipped to Heroes you control to your discard pile to
//   trigger the following effects in sequence, depending on the number
//   sent.
//   1+: Freeze all targets your opponent controls for 1 turn.
//   2+: Deal 100 damage to all targets your opponent controls.
//   4+: All Frozen targets your opponent controls are Frozen for 2
//       additional turns."
//
//  • Auswahl der Hearts ueber die Zielwahl (mehrere, abbrechbar — Abbruch
//    oder 0 Hearts = kein Effekt). Nur Hearts an EIGENEN Helden.
//  • Die Stufen laufen der Reihe nach: erst Frost, dann Schaden (100,
//    Creature-Effekt, `aoeHit`), dann Frost-Verlaengerung (+2) auf allem,
//    was DANACH noch gefroren ist.
//  • Animationen auf allen Zielen gleichzeitig (Als Regel 22.9.).
// ═══════════════════════════════════════════
const { gegnerZiele, einfrieren, istGefroren, frostVerlaengern, eisblockAnimation } = require('./_frost-shared');

const CARD_NAME = 'Cold-Hearted Yuki-Onna';
const HEART = 'Heart of Ice';

function eigeneHearts(engine, pi) {
  return engine.cardInstances.filter(c => c.name === HEART && c.zone === 'support'
    && (c.controller ?? c.owner) === pi && engine.gs.players[pi]?.heroes?.[c.heroIdx]?.name);
}

module.exports = {
  activeIn: ['support'],
  hitsMultipleTargets: true,

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const hearts = eigeneHearts(engine, pi);
      if (hearts.length === 0) return;

      const ziele = hearts.map(h => ({
        id: `equip-${h.owner}-${h.heroIdx}-${h.zoneSlot}`, type: 'equip',
        owner: h.owner, heroIdx: h.heroIdx, slotIdx: h.zoneSlot, cardName: HEART, cardInstance: h,
      }));
      const ids = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME, source: CARD_NAME,
        description: 'Send any number of "Heart of Ice" to your discard pile. 1+: Freeze all enemy targets. 2+: 100 damage to all enemy targets. 4+: Frozen enemy targets stay Frozen 2 more turns.',
        confirmLabel: '❄️ Shatter!', confirmClass: 'btn-danger',
        cancellable: true, minRequired: 1, maxTotal: ziele.length,
        _skipRedirectCheck: true, _skipPostTargetReactions: true,
      });
      const gewaehlt = (ids || []).map(id => ziele.find(z => z.id === id)).filter(Boolean);
      if (gewaehlt.length === 0) return;

      let n = 0;
      for (const z of gewaehlt) {
        if (z.cardInstance.zone !== 'support') continue;
        const ok = await engine.sendBoardCardToDiscard(z.cardInstance, { source: CARD_NAME, sourceOwner: pi });
        if (ok !== false) n++;
      }
      engine.log('yuki_onna', { player: gs.players[pi]?.username, hearts: n });
      if (n === 0) { engine.sync(); return; }
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ★ v1318 (Als Vorgabe 23.9.): eigener Blizzard ueber dem GEGNER-Feld,
      // dessen Heftigkeit mit der Zahl der Hearts waechst (1 … 4+). Der
      // Client haelt ihn laenger, je heftiger er ist; die Stufen setzen ein,
      // waehrend er noch tobt.
      const heftigkeit = Math.min(n, 4);
      engine._broadcastEvent('yuki_blizzard', { ownerIdx: pi, targetIdx: oi, intensity: heftigkeit });
      await engine._delay(650 + 150 * heftigkeit);

      // 1+: alles einfrieren
      let feinde = gegnerZiele(engine, oi);
      eisblockAnimation(engine, feinde);
      await engine._delay(300);
      for (const z of feinde) await einfrieren(engine, z, { dauer: 1, appliedBy: pi, source: CARD_NAME });
      engine.sync();
      await engine._delay(350);

      // 2+: 100 Schaden an allem
      if (n >= 2 && !gs.result) {
        await ctx.aoeHit({
          damage: 100, damageType: 'creature', side: 'enemy', types: ['hero', 'creature'],
          animationType: 'ice_encase',
        });
        await engine._delay(250);
      }

      // 4+: was jetzt gefroren ist, bleibt 2 Zuege laenger
      if (n >= 4 && !gs.result) {
        feinde = gegnerZiele(engine, oi).filter(z => istGefroren(engine, z));
        eisblockAnimation(engine, feinde);
        for (const z of feinde) frostVerlaengern(engine, z, 2);
        engine.log('yuki_onna_extend', { player: gs.players[pi]?.username, targets: feinde.length });
        engine.sync();
        await engine._delay(300);
      }
    },
  },

  // CPU: alle Hearts einsetzen.
  cpuResponse(engine, kind, p) {
    if (kind === 'effectTarget' && p?.title === CARD_NAME) {
      return (p.validTargets || []).filter(t => !t.ineligible).map(t => t.id);
    }
    return undefined;
  },

  _test: { eigeneHearts },
};
