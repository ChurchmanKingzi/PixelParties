// ═══════════════════════════════════════════
//  CARD EFFECT: "Cool Tech Jetpack"
//  Artifact (Equipment, Cost 4) — Secret Rare
//
//  "When you play this card, except with the effect of 'Cool Repair',
//   immediately send it to the discard pile. The first time every turn
//   when the equipped Hero is chosen by a card or effect, you may
//   discard 1 card to negate that card or effect."
//
//  ① Sofort-Abwurf: `onPlay` ohne die Herkunftsmarke `_viaCoolRepair`
//     (setzt Cool Repair beim Anlegen, v668) → `actionMoveCard` in die
//     Ablage. Aus der Hand gespielt kostet es also 4 Gold und liegt
//     danach in der Ablage — genau dort, wo Cool Repair es holt.
//     Effekt-Anleger (Lolek, Mender & Co.) sind KEIN Cool Repair.
//  ② Negation bei Zielwahl: `isEquippedPostTargetReaction` (Weathercock-
//     Bauform, v549): der Traeger ist unter den Zielen, die Quelle
//     gehoert dem Gegner (Ruling — der Text sagt „a card or effect",
//     eigene Effekte auf sich selbst negieren waere Unsinn), eine
//     Handkarte ist da, HOPT je Instanz. Preis: 1 Karte abwerfen
//     (`actionPromptForceDiscard`, selbst zugefuegt), Ergebnis
//     `{ effectNegated: true }`.
//
//  Aufstiegsbaustein von Monia — die Bereitschaft pflegt der Basisheld
//  (`_monia-shared`, sync-getrieben), hier ist nichts zu tun.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cool Tech Jetpack';

module.exports = {
  activeIn: ['support'],

  isEquippedPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard, opts) {
    const inst = opts?.inst;
    const heroIdx = opts?.heroIdx ?? inst?.heroIdx;
    if (heroIdx == null || heroIdx < 0) return false;
    const hoptKey = `cool-tech-jetpack:${inst?.id || `${pi}-${heroIdx}`}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    const sourceOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (sourceOwner === pi) return false;
    const ps = gs.players[pi];
    if (!ps || (ps.hand || []).length < 1) return false;
    return (targetedHeroes || []).some(t => t.owner === pi && t.type === 'hero' && t.heroIdx === heroIdx);
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard, opts) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const inst = opts?.inst;
    const heroIdx = opts?.heroIdx ?? inst?.heroIdx;
    if (!ps || (ps.hand || []).length < 1) return {};
    const vorher = ps.hand.length;
    await engine.actionPromptForceDiscard(pi, 1, {
      title: CARD_NAME, source: CARD_NAME, selfInflicted: true,
    });
    if (ps.hand.length >= vorher) return {};          // nichts abgeworfen → keine Negation
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`cool-tech-jetpack:${inst?.id || `${pi}-${heroIdx}`}`] = gs.turn;
    engine._broadcastEvent('play_zone_animation', {
      type: 'equip_flash', owner: pi, heroIdx, zoneSlot: inst?.zoneSlot ?? -1,
    });
    engine.log('jetpack_negate', {
      player: ps.username, hero: ps.heroes?.[heroIdx]?.name, negated: sourceCard?.name || null,
    });
    return { effectNegated: true };
  },

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?._viaCoolRepair) return;      // ueber Cool Repair angelegt → bleibt
      const engine = ctx._engine;
      // Erst sichtbar in der Zone liegen (Sync + Landung des Flugs
      // abwarten), DANN von dort in die Ablage wandern (Al 30.8.).
      engine.sync();
      await engine._delay(450);
      // Sprengt sich selbst: Explosion auf dem Slot, dann der Pile-Flug.
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: ctx.cardOwner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      await engine._delay(300);
      engine.log('jetpack_discarded', { player: engine.gs.players[ctx.cardOwner]?.username, card: CARD_NAME });
      await engine.actionMoveCard(inst, 'discard', -1, -1, { source: CARD_NAME });
      engine.sync();
    },
  },
};
