'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Fruit Bat, Nosferapple"
//  Creature (Normal, Lv 3, Summoning Magic, 200 HP)
//
//  „You may once per turn choose a target your opponent controls and deal 150 damage to it. If you do, heal this Creature for the amount of damage dealt."
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  Aktiver Effekt (einmal pro Zug, Engine-Sperre je Instanz). Ziel: ein Held oder eine Kreatur, die der GEGNER kontrolliert (`side: 'enemy'`, Zielschutz/Taunt/Umlenker/Surprises laufen wie bei
//  jedem Kreatureneffekt-Schaden, Typ `creature`). Abbruch der Zielwahl verbraucht nichts. Schaden 150 (Quelle: diese Kreatur, kein Held — Hero-Effekte wie Shrink gelten nicht).
//  HEILUNG = der WIRKLICH angerichtete Schaden: gemessen an den Trefferpunkten des Ziels vor und nach dem Treffer (Held: HP; Kreatur: aktuelle HP, bei geteiltem HP-Pool die des Helden).
//  Hatte das Ziel weniger als 150 HP, zählt nur, was es verloren hat; werden die 150 durch Effekte erhöht, zählt der höhere Betrag; ein negierter,
//  verhinderter oder abgewehrter Treffer (0 verloren) heilt nichts. Geheilt wird per `actionHealCreature` (Heilsperren gelten, nicht über die max. HP).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `bat_bite_drain` (Pixelart, Brett-Zweig mit `targets` = [Ziel, Fledermaus]): ein Vampirbiss am Ziel, danach fliegt Blut vom Ziel zur Fledermaus.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Fruit Bat, Nosferapple';
const DAMAGE = 150;
const BISS_MS = 420;       // bis zum Biss (dann trifft der Schaden)
const FLUG_MS = 620;       // Blut fliegt zur Fledermaus (dann kommt die Heilung)

/** Aktuelle Trefferpunkte eines Ziels (Held oder Kreatur) — bei geteiltem Pool die des Helden. */
function trefferpunkte(engine, ziel) {
  if (ziel.type === 'hero') {
    const h = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    return h?.name ? Math.max(0, h.hp) : 0;
  }
  const inst = ziel.cardInstance;
  if (!inst || !engine.cardInstances.includes(inst) || inst.zone !== 'support') return 0;
  if (loadCardEffect(inst.name)?.sharesHpWithHero && !engine.isCardPassiveDormant(inst)) {   // geteilter HP-Pool (Clone, Bonded Companions): der Held trägt den Schaden
    const h = engine.gs.players[engine.physicalSide(inst)]?.heroes?.[inst.heroIdx];
    return h?.name ? Math.max(0, h.hp) : 0;
  }
  return Math.max(0, inst.counters?.currentHp ?? inst.counters?.maxHp ?? engine._getCardDB()[inst.name]?.hp ?? 0);   // ungetroffene Kreatur: noch kein `currentHp` → volle HP
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,
  cpuMeta: { dealsDamage: true },

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    return !!inst && inst.zone === 'support' && !inst.faceDown;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = engine.kontrolleurVon(inst);
    if (!inst || inst.zone !== 'support') return false;
    const feld = engine.physicalSide(inst);

    const ziel = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: DAMAGE,
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage to a target your opponent controls. Heal this Creature for the damage dealt.`,
      confirmLabel: `🦇 Bite! (${DAMAGE})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!ziel) return false;

    const zielSlot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'bat_bite_drain', zoneType: 'board', duration: 1300,
      targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: zielSlot }, { owner: feld, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot }],
    });
    await engine._delay(BISS_MS);

    const vorher = trefferpunkte(engine, ziel);
    const quelle = { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx };
    if (ziel.type === 'hero') {
      const h = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (h?.name && h.hp > 0) await engine.actionDealDamage(quelle, h, DAMAGE, 'creature');
    } else if (ziel.cardInstance) {
      await engine.actionDealCreatureDamage(quelle, ziel.cardInstance, DAMAGE, 'creature', { sourceOwner: pi, canBeNegated: true });
    }
    const verloren = Math.max(0, vorher - trefferpunkte(engine, ziel));   // WIRKLICH angerichtet: HP-Verlust des Ziels

    await engine._delay(FLUG_MS);
    if (verloren > 0 && inst.zone === 'support') await engine.actionHealCreature(inst, inst, verloren);
    engine.log('fruit_bat_bite', { player: gs.players[pi]?.username, target: ziel.cardName, damage: verloren });
    engine.sync();
    await engine._delay(150);
    return true;
  },
};
