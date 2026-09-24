'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: „Memory Wipe"
//  Spell · Normal · Decay Magic Lv3 · PP SOB   (v1335, neuer Text)
//
//  „Choose a Hero your opponent controls. Your opponent must send up to
//   3 Abilities of their choice attached to it to the discard pile (or
//   as many as possible)."
//
//  ── ABLAUF ────────────────────────────────────────────────────────
//  1. ZIEL: ein gegnerischer Held ueber `promptDamageTarget` (ohne
//     Schaden) — Abbrechbar (Als Regel 23.9.), Zielschutz, Anti Magic,
//     Surprise- und Umleitungsfenster wie bei jeder zielenden Karte.
//     Jeder lebende gegnerische Held ist waehlbar; der Text schraenkt
//     nicht ein.
//  2. BILD: Rune ueber dem Ziel, Erinnerungsfragmente loesen sich
//     (`memory_wipe`, neue Animation mit Klang, Kartenbild als Vorlage).
//  3. DER GEGNER WAEHLT: genau min(3, Zahl seiner Ability-Karten an
//     diesem Helden) — „up to 3 … (or as many as possible)". Gezaehlt
//     werden einzelne KARTEN: ein Stapel „Fighting ×3" sind drei, jede
//     Wahl nimmt die oberste Kopie (Level sinkt um 1). Abilities in
//     Support Zones (Xal, Xalibur) zaehlen mit — dieselbe Auslegung wie
//     Barrier of Faith und Weapon Storm (`_ability-cost-shared.js`).
//     Kein vorzeitiges „Done", kein Abbruch.
//  Verursacher der Ablage ist der Wirker (`sourceOwner`), nicht der
//  ablegende Gegner.
// ═══════════════════════════════════════════

const { sendables, abilityCardCount, sendCardsLoop } = require('./_ability-cost-shared');

const CARD_NAME = 'Memory Wipe';
const HOECHSTENS = 3;

module.exports = {
  requiresTarget: true,
  activeIn: ['hand'],
  // ★★ ENTKOPPELTE BILDER (CARD_API): auch bei Negation sichtbar.
  spellVisual: { impact: { type: 'memory_wipe' }, impactMs: 600 },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      // ── 1. Ziel ──────────────────────────────────────────────────
      const ziel = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero'],
        damageType: null,
        dealsDamage: false,
        title: CARD_NAME,
        description: 'Choose a Hero your opponent controls. They must send up to 3 of its Abilities to the discard pile.',
        confirmLabel: '🌀 Wipe!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!ziel) return;                                   // Abbruch → Karte zurueck (Engine)
      const besitzer = ziel.owner;
      const heroIdx = ziel.heroIdx;
      const held = gs.players[besitzer]?.heroes?.[heroIdx];
      if (!held?.name) return;

      // ── 2. Bild ──────────────────────────────────────────────────
      engine._broadcastEvent('play_zone_animation', {
        type: 'memory_wipe', owner: besitzer, heroIdx, zoneSlot: -1,
        duration: 1300,   // v1341: ohne Angabe schneidet der Client nach 1000 ms ab
      });
      await engine._delay(700);

      // ── 3. Der Gegner waehlt ─────────────────────────────────────
      const vorrat = abilityCardCount(sendables(engine, besitzer, heroIdx).abilities);
      const anzahl = Math.min(HOECHSTENS, vorrat);
      if (anzahl <= 0) {
        engine.log('memory_wipe', { player: gs.players[pi]?.username, hero: held.name, sent: 0 });
        engine.sync();
        return;
      }
      const erg = await sendCardsLoop(engine, besitzer, heroIdx, {
        cardName: CARD_NAME,
        kinds: ['ability'],
        min: anzahl, max: anzahl,
        sourceOwner: pi,
        confirmLabel: '📤 Discard',
        confirmClass: 'btn-danger',
        describe: (gesendet) => `${CARD_NAME}: send ${anzahl - gesendet} more Abilit${anzahl - gesendet === 1 ? 'y' : 'ies'} attached to ${held.name} to your discard pile.`,
      });
      engine.log('memory_wipe', { player: gs.players[pi]?.username, hero: held.name, sent: erg.abilitiesSent });
      engine.sync();
    },
  },

  /** CPU als Wirker: den Helden mit den meisten Ability-Karten. */
  cpuResponse(engine, kind, promptData) {
    const ziele = promptData?.validTargets;
    if (kind !== 'effectTarget' || promptData?.config?.title !== CARD_NAME) return undefined;
    if (!Array.isArray(ziele) || ziele.length === 0 || !ziele.every(t => t?.type === 'hero')) return undefined;
    let best = null, bestN = -1;
    for (const t of ziele) {
      if (t.ineligible) continue;
      const n = abilityCardCount(sendables(engine, t.owner, t.heroIdx).abilities);
      if (n > bestN) { best = t; bestN = n; }
    }
    return best ? [best.id] : undefined;
  },
};
