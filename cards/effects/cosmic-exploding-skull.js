'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Cosmic Exploding Skull"  (W78d)
//  Creature (Summoning Magic Lv1, 1 HP)
//
//  „When this Creature is defeated, defeat all other Creatures on the board. Negate this effect if the corresponding Hero doesn't have a Spell School Ability except "Summoning Magic"."
//  (Kartentext 25.10.: „defeat all other Creatures on the board" — vorher „delete all other Creatures the turn player controls".)
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • Auslöser: der eigene Tod (`onCreatureDeath`, Selbsttest über `instId`, Muster Golden Exploding Skull) — gleich, wodurch die Creature fällt.
//  • „corresponding Hero": der Held, in dessen Support Zone der Totenschädel lag (Brettseite + `heroIdx` der Instanz). Er braucht mindestens EINE Zauberschul-Ability außer Summoning Magic
//    (`SPELL_SCHOOL_ABILITIES` ohne Summoning Magic, dieselbe zentrale Liste wie Cosmic Skeleton; Fighting und Nutz-Abilities zählen nicht) — egal auf welcher Stufe; ist der Held besiegt,
//    zählt, was in seinen Ability Zones liegt. Sind seine Abilities hart negiert (Stufen 0, `heroAbilityLevelsBlanked`), gilt er als ohne Schul-Ability. Sonst ist der Effekt NEGIERT (nichts geschieht,
//    Meldung im Protokoll).
//  • „defeat all other Creatures on the board": ALLE anderen offenen Creatures beider Seiten (Tokens eingeschlossen, auch weitere Totenschädel — deren eigener Auslöser findet dann nichts mehr).
//    „Defeat" = `actionDestroyCard` mit dem Schädel als Quelle: Schutz (Cardinal Beasts, Rettungsfenster, Immunitäten) wirkt wie bei jedem Besiegen, die Tode zählen EIN Sterbe-Ereignis
//    (`_mitNiederlagenSammler`: Sammel-Fenster und Hand-Reaktionen sehen alle Opfer zusammen).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `cosmic_explosion` (Client, Pixelart) auf der Zone des Schädels: lilane Dimensionsexplosion — ein Riss im Raum (violette Zacken mit hellem Kern), Stoßringe, Sternenstaub, Wirbel —
//  dazu `play_screen_shake` (heavy). Danach fallen die übrigen Creatures.
// ═══════════════════════════════════════════

const { hasCardType, SPELL_SCHOOL_ABILITIES, spellSchoolAbilitiesOn } = require('./_hooks');

const CARD_NAME = 'Cosmic Exploding Skull';
const VALID_SCHOOLS = SPELL_SCHOOL_ABILITIES.filter(s => s !== 'Summoning Magic');
const BOOM_MS = 1000;       // Länge der Explosion (deckt sich mit `cosmic_explosion` im Client)
const VOR_MS = 520;         // die Creatures fallen, wenn der Riss aufreißt

/** Hat der entsprechende Held eine Zauberschul-Ability außer Summoning Magic? */
function hatSchulAbility(engine, seite, heroIdx) {
  const hero = engine.gs.players[seite]?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  if (engine.heroAbilityLevelsBlanked?.(seite, heroIdx)) return false;
  return spellSchoolAbilitiesOn(engine.gs.players[seite]?.abilityZones?.[heroIdx] || [], VALID_SCHOOLS).length > 0;
}

module.exports = {
  spellVisual: { impact: { type: 'cosmic_explosion' }, impactMs: 400 },

  activeIn: ['support'],

  cpuMeta: {
    // Der Schädel WILL sterben, wenn sein Held die Schul-Ability trägt (dann räumt er das Brett) — und das lohnt, wenn die Gegenseite mehr Creatures hat als die eigene.
    preferDead: true,
    onDeathBenefit: (engine, inst) => {
      if (!engine || !inst) return 0;
      const seite = engine.physicalSide(inst);
      if (!hatSchulAbility(engine, seite, inst.heroIdx)) return 0;
      const pi = inst.controller ?? inst.owner;
      let eigene = 0, fremde = 0;
      for (const c of engine.cardInstances) {
        if (c.id === inst.id || c.zone !== 'support' || c.faceDown) continue;
        const cd = engine.getEffectiveCardData(c) || engine._getCardDB()[c.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if ((c.controller ?? c.owner) === pi) eigene++; else fremde++;
      }
      return Math.max(0, (fremde - eigene) * 25);
    },
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const ich = ctx.card;
      const tot = ctx.creature;
      if (!engine || !ich || !tot) return;
      if ((tot.instId ?? tot.id) !== ich.id) return;                       // nur der eigene Tod

      const pi = ich.controller ?? ich.owner;
      const seite = engine.physicalSide(ich);
      const heroIdx = ich.heroIdx;
      const heldName = engine.gs.players[seite]?.heroes?.[heroIdx]?.name || null;

      // Die Wirkung ist NEGIERT, wenn der entsprechende Held keine Zauberschul-Ability (außer Summoning Magic) hat.
      if (!hatSchulAbility(engine, seite, heroIdx)) {
        engine.log('cosmic_skull_negated', { player: engine.gs.players[pi]?.username, hero: heldName });
        return;
      }

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      engine._broadcastEvent('play_zone_animation', { type: 'cosmic_explosion', owner: seite, heroIdx, zoneSlot: ich.zoneSlot, duration: BOOM_MS });
      engine._broadcastEvent('play_screen_shake', { intensity: 'heavy' });
      await engine._delay(VOR_MS);

      const opfer = engine.cardInstances.filter(c => {
        if (c.id === ich.id || c.zone !== 'support' || c.faceDown) return false;
        const cd = engine.getEffectiveCardData(c) || engine._getCardDB()[c.name];
        return !!cd && hasCardType(cd, 'Creature');
      });
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, cardType: 'Creature', cardInstance: ich, heroIdx, heroOwner: seite };
      await engine._mitNiederlagenSammler(async () => {
        for (const c of opfer) {
          if (c.zone !== 'support') continue;                                // fiel inzwischen (anderer Schädel)
          await engine.actionDestroyCard(quelle, c, { sourceOwner: pi, sourceName: CARD_NAME, fireCreatureDeath: true });
        }
      });
      engine.log('cosmic_skull_blast', { player: engine.gs.players[pi]?.username, hero: heldName, defeated: opfer.length });
      engine.sync();
      await engine._delay(Math.max(0, BOOM_MS - VOR_MS));
    },
  },
};
