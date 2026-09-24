'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: „Core Explosion"
//  Spell · Reaction · Destruction Magic Lv1 · PP WAW   (v1334, vorher Lv3)
//
//  „Play this card immediately when a Creature you control is defeated
//   by an opponent's card or effect. Deal damage equal to 30 times its
//   level to all targets your opponent controls (max 120). You can only
//   play 1 "Core Explosion" per turn."
//
//  ── FENSTER ───────────────────────────────────────────────────────
//  `isCreatureDefeatedReaction` — das Einzel-Fenster je Kreaturentod
//  (Pawn Chain, Troop Annihilation). Wirker (Destruction Magic 1,
//  lebend, handlungsfaehig), Kosten, Flug in die Ablage, Auftritt und
//  Log macht die Engine; sie reicht seit v1334 auch `{ casterIdx }` an
//  den Resolver.
//
//  ── BEDINGUNGEN ───────────────────────────────────────────────────
//  • „a Creature you control" — Kontrolleur zum Todeszeitpunkt.
//  • „by an opponent's card or effect" — die Todesquelle gehoert dem
//    Gegner (jede Kartenart; auch Besiegen ohne Schaden, Als Ruling
//    23.9.). Ohne bekannte Quelle (Status-Ticks ohne Verursacher) kein
//    Angebot.
//  • „its level" — Level ZUM TODESZEITPUNKT (`deathInfo.level`, Grund
//    plus Aenderungen). Level 0 → 0 Schaden → die Karte wird gar nicht
//    erst angeboten (sie wuerde nichts bewirken).
//  • „max 120" — Deckel ab Level 4.
//  • „You can only play 1 per turn" — HART, je Spieler (Wortlaut-Regel
//    v249), gestempelt beim Aufloesen.
//
//  ── WIRKUNG ───────────────────────────────────────────────────────
//  Flaechenschlag auf ALLE gegnerischen Ziele (Helden und Creatures)
//  ueber `actionAoeHit` — Anti-AoE (Interference, Deepsea Idol),
//  Surprise- und Post-Target-Fenster wie bei jeder Flaechenkarte.
//
//  ── BILD (Als Vorgabe 24.9., Kartenbild als Vorlage) ──────────────
//  Am Platz der gefallenen Creature platzt ihr Kern (`core_explosion`,
//  neue Animation mit eigenem Klang), und GLEICHZEITIG schiessen Blitze
//  von dort auf alle gegnerischen Ziele (`qinglong_lightning` je Ziel,
//  alle im selben Moment — Als Regel 22.9.). Danach faellt der Schaden.
// ═══════════════════════════════════════════

const CARD_NAME = 'Core Explosion';
const JE_LEVEL = 30;
const DECKEL = 120;
const sperre = (pi) => `core-explosion:${pi}`;

/** Seite des Verursachers (oder -1). */
function quellSeite(src) {
  const s = src?.controller ?? src?.owner;
  return typeof s === 'number' ? s : -1;
}

/** Schaden fuer eine gefallene Creature dieses Levels. */
function schadenFuer(level) {
  return Math.min(DECKEL, JE_LEVEL * Math.max(0, level || 0));
}

/** Level der gefallenen Creature (Todes-Info, sonst Kartendaten). */
function levelVon(engine, d) {
  if (typeof d?.level === 'number') return d.level;
  return engine._getCardDB()[d?.name]?.level || 0;
}

/** Alle gegnerischen Ziele fuer das Blitz-Bild. */
function gegnerZiele(engine, oppIdx) {
  const gs = engine.gs;
  const out = [];
  const ops = gs.players[oppIdx];
  for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (h?.name && h.hp > 0) out.push({ owner: oppIdx, heroIdx: hi, zoneSlot: -1 });
  }
  const db = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== oppIdx) continue;
    const cd = engine.getEffectiveCardData(inst) || db[inst.name];
    if (!cd || !String(cd.cardType || '').includes('Creature')) continue;
    out.push({ owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
  }
  return out;
}

module.exports = {
  activeIn: ['hand'],
  // AoE (Als Regel 18.9.): ausdruecklich, zusaetzlich zur Schadensklammer.
  hitsMultipleTargets: true,
  // ★★ ENTKOPPELTE BILDER (CARD_API): wird die Karte negiert, laeuft ihr
  // Rumpf nie — die Engine spielt dann dieses Bild.
  spellVisual: { impact: { type: 'core_explosion' }, impactMs: 420 },

  // KEIN `isReaction` (sonst meldet sie sich im generischen Kettenfenster).
  isCreatureDefeatedReaction: true,

  creatureDefeatedCondition(gs, pi, engine, deathInfo, source) {
    if (!deathInfo) return false;
    if ((deathInfo.controller ?? deathInfo.owner) !== pi) return false;
    const seite = quellSeite(source);
    if (seite < 0 || seite === pi) return false;
    if (gs.hoptUsed?.[sperre(pi)] === gs.turn) return false;
    return schadenFuer(levelVon(engine, deathInfo)) > 0;
  },

  async creatureDefeatedResolve(engine, pi, deathInfo, source, { casterIdx } = {}) {
    const gs = engine.gs;
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[sperre(pi)] = gs.turn;

    const oppIdx = pi === 0 ? 1 : 0;
    const level = levelVon(engine, deathInfo);
    const schaden = schadenFuer(level);
    const wirker = typeof casterIdx === 'number' ? casterIdx : -1;

    // ── Bild: Kern platzt + Blitze auf alle Gegnerziele, gleichzeitig ──
    const kern = { owner: deathInfo.owner, heroIdx: deathInfo.heroIdx, zoneSlot: deathInfo.zoneSlot };
    if (kern.heroIdx != null && kern.heroIdx >= 0 && kern.zoneSlot != null && kern.zoneSlot >= 0) {
      engine._broadcastEvent('play_screen_shake', { intensity: 'medium' });
      engine._broadcastEvent('play_zone_animation', {
        type: 'core_explosion', owner: kern.owner, heroIdx: kern.heroIdx, zoneSlot: kern.zoneSlot,
        duration: 1300,   // v1341: ohne Angabe schneidet der Client nach 1000 ms ab
      });
      for (const z of gegnerZiele(engine, oppIdx)) {
        engine._broadcastEvent('qinglong_lightning', {
          srcOwner: kern.owner, srcHeroIdx: kern.heroIdx, srcZoneSlot: kern.zoneSlot,
          tgtOwner: z.owner, tgtHeroIdx: z.heroIdx, tgtZoneSlot: z.zoneSlot, step: 0,
        });
      }
      await engine._delay(460);
    }

    // ── Flaechenschlag ──
    const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: wirker, zone: 'hand', counters: {} };
    const erg = await engine.actionAoeHit(quelle, {
      damage: schaden,
      damageType: 'destruction_spell',
      side: 'enemy',
      types: ['hero', 'creature'],
      sourceName: CARD_NAME,
    });
    engine.log('core_explosion', {
      player: gs.players[pi]?.username, creature: deathInfo.name, level, damage: schaden,
      cancelled: !!erg?.cancelled,
    });
    engine.sync();
  },

  // CPU: reiner Gewinn — immer spielen.
  cpuResponse(engine, kind, payload) {
    if (payload?.type === 'confirm' && payload?.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },
};
