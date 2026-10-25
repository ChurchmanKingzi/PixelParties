'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Ultimate Destroyer Punch"  (W76c)
//  Attack (Normal, Lv2, Fighting)
//
//  „Choose a Creature your opponent controls and defeat it. Then, deal damage equal to that Creature's max HP to the corresponding Hero, to a maximum of 300.
//   This Attack's level is reduced by 1 for each of your defeated Heroes."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • Ziel: eine offene Creature, die der Gegner kontrolliert (Zielregeln der Engine gelten: ein Schutz verhindert das WÄHLEN, nicht das Besiegen). Pflichtwahl; Abbruch legt die Karte zurück.
//  • „defeat it": `actionDestroyCard` mit der Karte als Quelle — Schutz (Cardinal Beasts, Defending the Gate, Rettungsfenster …) lässt sie stehen. Ruling 25.10.: bleibt die
//    Creature stehen, entfällt auch der Heldenschaden (nur eine tatsächlich besiegte Creature wird geworfen/schlägt ein).
//  • „max HP": das Maximum der Creature zum Zeitpunkt des Schlags (`counters.maxHp`, sonst gedruckte HP) — gemerkt VOR dem Besiegen. Höchstens 300.
//  • „the corresponding Hero": der Held, in dessen Support Zone die Creature stand (Brettseite + Index zum Zeitpunkt der Wahl). Ist er schon besiegt, verpufft der Schaden.
//  • Schaden-Typ `attack` (Quelle: die Karte, Angreifer = der Held); er hängt nicht an der ATK des Angreifers (kein `usesHeroAtk`). Wie Midnight Assault keine Zielerklärung („attack declare"), da der Held nicht gewählt wird.
//  • „level reduced by 1 for each of your defeated Heroes": `reduceCardLevel` (Muster Midnight Assault) — Handkarte, jeder besiegte Held des Spielers (die Seite des Spielers, hp ≤ 0) senkt
//    um 1; zwei Kopien zählen die Senkung nur einmal (`selbstsenkungZaehlt`).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  Der Angreifer rammt die Creature (`play_ram_animation`), beim Aufprall der kräftige Impact `udp_impact` (Pixelart: Stoßwelle, Risse, Splitter, Bildschirm-Wackeln); dann wird die Creature
//  auf den Helden GEWORFEN (`play_card_throw`, Modus `throw`: die Karte fliegt in Pixelschritten im Bogen zum Helden, kein Drehen; ihre Zone ist währenddessen leer) und schlägt dort ein (`udp_land`). Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { hasCardType, selbstsenkungZaehlt } = require('./_hooks');

const CARD_NAME = 'Ultimate Destroyer Punch';
const MAX_SCHADEN = 300;
const RAMM_MS = 1100;
const FLUG_MS = 760;       // Dauer des Wurfs (deckt sich mit `udp_throw` im Client)
const MONTAGE_MS = 140;    // Vorlauf, bis der Client den Flug eingehängt hat

function kreaturenDesGegners(engine, pi) {
  const db = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) === pi) continue;
    if (engine.playerCount() > 2 && (inst.controller ?? inst.owner) !== engine.opponentOf(pi)) continue;
    const cd = engine.getEffectiveCardData(inst) || db[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    const seite = engine.physicalSide(inst);
    out.push({ id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
  }
  return out;
}

/** Besiegte Helden des Spielers (Seite des Spielers, benannt, hp ≤ 0). */
function besiegteHelden(engine, pi) {
  return (engine.gs.players[pi]?.heroes || []).filter(h => h?.name && h.hp <= 0).length;
}

module.exports = {
  spellVisual: { impact: { type: 'udp_impact' }, impactMs: 420 },

  activeIn: ['hand'],
  requiresTarget: true,

  /** „This Attack's level is reduced by 1 for each of your defeated Heroes." */
  reduceCardLevel(cardData, engine, ownerIdx, inst) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    if (!inst || inst.zone !== 'hand') return 0;
    if (!selbstsenkungZaehlt(engine, inst, CARD_NAME, ownerIdx, { zone: 'hand' })) return 0;
    return besiegteHelden(engine, ownerIdx);
  },

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    return !eng || kreaturenDesGegners(eng, pi).length > 0;
  },

  /** CPU: die Creature mit den meisten Max-HP (bis 300) — das größte Loch und der größte Schaden. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const pi = payload?.playerIdx;
    const valid = (payload?.validTargets || []).filter(t => t.owner !== pi && !t.ineligible);
    if (valid.length === 0) return undefined;
    const wert = (t) => Math.min(MAX_SCHADEN, t.cardInstance?.counters?.maxHp ?? engine._getCardDB()[t.cardName]?.hp ?? 0);
    valid.sort((a, b) => wert(b) - wert(a));
    return [valid[0].id];
  },
  cpuShouldPlay(engine, pi) {
    return kreaturenDesGegners(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx ?? ctx.card?.heroIdx ?? -1;
      const seite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[seite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) return;

      const kandidaten = kreaturenDesGegners(engine, pi);
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }
      const gewaehlt = await engine.promptEffectTarget(pi, kandidaten, {
        title: CARD_NAME, source: CARD_NAME,
        description: `Choose a Creature your opponent controls: it is defeated and its max HP (up to ${MAX_SCHADEN}) hits the Hero it stood with.`,
        confirmLabel: '👊 Punch!', confirmClass: 'btn-danger',
        cancellable: true, maxTotal: 1, minRequired: 1,
      });
      if (!gewaehlt || gewaehlt.length === 0) { gs._spellCancelled = true; return; }
      const ziel = kandidaten.find(t => t.id === gewaehlt[0]);
      const inst = ziel?.cardInstance;
      if (!inst || inst.zone !== 'support') return;

      // Merken, solange die Creature noch steht: Max-HP, Zone und „der zugehörige Held".
      const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
      const maxHp = Math.max(0, inst.counters?.maxHp ?? cd?.hp ?? 0);
      const schaden = Math.min(MAX_SCHADEN, maxHp);
      const zSeite = engine.physicalSide(inst), zHero = inst.heroIdx, zSlot = inst.zoneSlot, name = inst.name;
      const attackSource = { name: CARD_NAME, owner: pi, controller: pi, heroIdx, heroOwner: seite, cardType: 'Attack' };

      // ① Rammen und kräftiger Impact.
      await engine.rammeBisKontakt({
        sourceOwner: seite, sourceHeroIdx: heroIdx, targetOwner: zSeite, targetHeroIdx: zHero, targetZoneSlot: zSlot,
        cardName: hero.name, duration: RAMM_MS,
      });
      engine._broadcastEvent('play_zone_animation', { type: 'udp_impact', owner: zSeite, heroIdx: zHero, zoneSlot: zSlot, duration: 900 });
      engine._broadcastEvent('play_screen_shake', { intensity: 'heavy' });
      await engine._delay(420);

      // ② Die Creature wird auf den Helden geworfen: Flug starten, Karte nach dem Einhängen aus der Zone nehmen (besiegen), landen lassen.
      const ziHero = gs.players[zSeite]?.heroes?.[zHero];
      const fliegt = !!ziHero?.name;
      if (fliegt) {
        engine._broadcastEvent('play_card_throw', {
          mode: 'throw', cardName: name, fromOwner: zSeite, fromHeroIdx: zHero, fromSlot: zSlot,
          toKind: 'hero', toOwner: zSeite, toHeroIdx: zHero,
          discardOwner: inst.originalOwner ?? inst.owner, suppressDiscard: true, duration: FLUG_MS,
        });
        await engine._delay(MONTAGE_MS);
      }
      await engine.actionDestroyCard(attackSource, inst, { sourceOwner: pi, sourceName: CARD_NAME, fireCreatureDeath: true, skipPileTransfer: fliegt });
      const besiegt = inst.zone !== 'support';
      engine.sync();
      if (fliegt) await engine._delay(FLUG_MS - MONTAGE_MS);

      // ③ Schaden an den zugehörigen Helden — nur, wenn die Creature wirklich besiegt wurde (Ruling 25.10.: geschützt → auch kein Heldenschaden).
      const th = gs.players[zSeite]?.heroes?.[zHero];
      if (besiegt && th?.name && th.hp > 0 && schaden > 0) {
        engine._broadcastEvent('play_zone_animation', { type: 'udp_land', owner: zSeite, heroIdx: zHero, zoneSlot: -1, duration: 700 });
        await engine._delay(180);
        if (th.hp > 0) await engine.actionDealDamage(attackSource, th, schaden, 'attack');
      }

      engine.log('ultimate_destroyer_punch', { player: ps.username, hero: hero.name, creature: name, defeated: besiegt, maxHp, damage: schaden, corresponding: th?.name || null });
      engine.sync();
    },
  },
};
