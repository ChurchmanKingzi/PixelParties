'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Bounce Trap"  (W78e)
//  Spell (Surprise, Lv2, Decay Magic)
//
//  „Activate this Surprise when a Creature is placed into an opponent's Support Zone. That Creature is returned to its owner's hand. If the Creature was placed into a Support Zone of the Hero
//   in the same position as the user of this Surprise, this Surprise's level becomes 0."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • Auslöser: das Eintritts-Fenster der Engine (`surpriseCreatureEnterSupportTrigger`, Muster Aquatic Arrows): Beschwörungen, Platzieren per Effekt UND Bewegungen in eine neue Zone — dieselbe weite
//    Lesart wie bei Ingo/The Golden Gate (Ruling 25.10.). Nur offene Creatures. „an opponent's Support Zone": die Zone liegt auf der Gegenseite und gehört dort einem Helden, den der Gegner
//    kontrolliert (ein von mir kontrollierter Held der Gegenspalte zählt nicht). Die Creature darf jemandem gehören/von jemandem kontrolliert werden — auch die eigene, bei einem Gegner abgelegte.
//  • „the Hero in the same position as the user": derselbe Heldenindex wie der Träger der Surprise (h0↔h0 …). Dann gilt für DIESEN Auslöser Stufe 0 (`surpriseLevelZero` → die Engine verlangt
//    keine Stufe; der Held muss die Surprise nur sonst aktivieren dürfen). Eine Creature beim gegenüberliegenden Helden kann also mit Stufe 0 zurückgeworfen werden.
//  • Wirkung: die Creature geht zurück in die Hand ihres BESITZERS (`engine.kartenBesitzerVon`, Muster Racket Arrow) — Schutz (Cardinal Beasts, Creature-Schutzfenster) greift wie bei jedem Bounce.
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `bounce_spring` (Client, Pixelart) an der Zone der Creature: eine Sprungfeder staucht sich unter ihr zusammen (Federring-Sprite in Stufen), dann schnellt sie hoch; danach `bounce_burst`
//  (Staubring, Stern) beim Abflug und der Standardflug der Karte auf die Hand — mit Schwung (der Flug startet erst nach dem Abschnellen).
// ═══════════════════════════════════════════

const { returnSupportCreatureToHand } = require('./_deepsea-shared');

const CARD_NAME = 'Bounce Trap';
const SCHLEUDER_REST_MS = 600;   // 820 ms Flug − 250 ms Nachlauf von returnSupportCreatureToHand
const STAUCH_MS = 300;       // 100 ms Anlauf des Clients + 200 ms Zusammendrücken: dann schnellt die Feder los (`bounce_spring` im Client) und die Karte startet

module.exports = {
  spellVisual: { impact: { type: 'bounce_spring' }, impactMs: 700 },

  isSurprise: true,

  surpriseCreatureEnterSupportTrigger(gs, ownerIdx, hostHeroIdx, info, engine) {
    if (!info || !info.cardInstance) return false;
    if (info.zoneOwner === ownerIdx) return false;                       // Gegenseite
    const held = gs.players[info.zoneOwner]?.heroes?.[info.heroIdx];
    if (held?.name && engine?.heroSideOf && engine.heroSideOf(info.zoneOwner, held) === ownerIdx) return false;   // „opponent's" nach Kontrolle
    return true;
  },

  /** Gleiche Position wie der Träger der Surprise → Stufe 0. */
  surpriseLevelZero(gs, ownerIdx, hostHeroIdx, info) {
    return !!info && (info.heroIdx ?? -1) === hostHeroIdx;
  },

  /** CPU: ja, sobald die Creature wirklich zurückgeworfen werden kann (es kostet nichts außer der Surprise). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm' || promptData.title !== CARD_NAME) return undefined;
    return { confirmed: true };
  },

  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const inst = sourceInfo?.cardInstance && engine.cardInstances.find(c => c.id === sourceInfo.cardInstance.id);
    if (!inst || inst.zone !== 'support') return null;                   // inzwischen weg
    const seite = engine.physicalSide(inst);
    engine._broadcastEvent('play_zone_animation', { type: 'bounce_spring', owner: seite, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, duration: 700 });
    await engine._delay(STAUCH_MS);
    if (inst.zone !== 'support') return null;
    const r = await returnSupportCreatureToHand(engine, inst, CARD_NAME, {
      sourceOwner: pi, toPlayer: engine.kartenBesitzerVon(inst), animationType: 'bounce_burst', flugStil: 'schleuder',
    });
    await engine._delay(SCHLEUDER_REST_MS);          // der Schleuderflug (820 ms im Client) läuft aus, bevor es weitergeht
    engine.log('bounce_trap', { player: engine.gs.players[pi]?.username, creature: sourceInfo.cardName, returned: !!r?.returned });
    engine.sync();
    return r?.returned ? { bounced: true } : null;
  },
};
