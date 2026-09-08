// ═══════════════════════════════════════════
//  CARD EFFECT: "Knife Throw"
//  Attack (Fighting Lv2, Normal)   ← Level ab v726 (war 1)
//
//  „Send an Artifact equipped to the user to the discard pile to play
//   this card. Choose a target and deal damage equal to twice the
//   attacker's Attack stat to it. This must be the only Attack you play
//   this turn. You can always target any target with this Attack.\"
//
//  Vier Saetze, vier Vertraege
//  ───────────────────────────
//  ① KOSTEN „Send an Artifact equipped to the user\": geprueft ueber
//     `canPlayWithHero` — der Vertrag, mit dem eine KARTE pro HELD
//     sagt, ob sie gerade spielbar ist. Ohne ausgeruestetes Artefakt
//     graut der Client die Karte unter diesem Helden aus, und der
//     Server weist sie ab. Bezahlt wird in `onPlay`, VOR der
//     Zielwahl — die Kosten sind keine Wahl, sondern der Eintritt.
//  ② SCHADEN: doppelter AKTUELLER Angriffswert (wie Critical Strike,
//     `usesHeroAtk: true` an der Quelle, damit Boni und Reiter greifen).
//  ③ „the only Attack you play this turn\": zwei Richtungen. Vorher —
//     wurde in diesem Zug schon ein Attack gespielt, ist Knife Throw
//     gesperrt (`attacksPlayedThisTurn`). Nachher — der Stempel
//     `ps._soleAttackTurn` sperrt JEDEN weiteren Attack dieses Zuges,
//     bei ALLEN Helden („you\", nicht „this Hero\"). Der Riegel liegt
//     in der Engine (v726) und ist damit auch fuer kuenftige Karten
//     mit diesem Satz da.
//  ④ „can always target any target\": `ignoresTargetingRestrictions`
//     (v616, Piercer-of-Heavens-Vertrag) — die Ziel-Picker behandeln
//     die Quelle wie unter Truth-Seeing Eye: Untargetable, Invisible,
//     Golden Wings, Taunt und auch das harte Dickicht (Thicket) sind
//     ausgehebelt. NICHT enthalten: Unangreifbarkeit im Schadenspfad
//     (Tempeste) — „waehlen duerfen\" ist nicht „Schaden durchbringen\".
//
//  Der Wurf hat seit v727 eine eigene Animation `knife_throw_fly`:
//  das Messer kommt flach und schnell aus dem Bildrand geflogen,
//  schlaegt ein und spritzt Blut entgegen der Flugrichtung.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Knife Throw';
const ATK_MULT = 2;

/** Artefakte, die an DIESEM Helden ausgeruestet sind. */
function ausruestungAm(engine, pi, heroIdx) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if (inst.owner !== pi || inst.heroIdx !== heroIdx) continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js.
  ignoresTargetingRestrictions: true,

  /**
   * Karteneigenes Gate je Held: ausgeruestetes Artefakt vorhanden UND
   * in diesem Zug noch kein Attack gespielt.
   */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    const ps = gs.players[pi];
    if (!ps) return false;
    if ((ps.attacksPlayedThisTurn || 0) > 0) return false;   // „the only Attack\"
    if (ps._soleAttackTurn === gs.turn) return false;
    return ausruestungAm(engine, pi, heroIdx).length > 0;
  },

  cpuMeta: {
    dealsDamage: true,
    // Der Pilot soll wissen, dass diese Karte den Zug fuer weitere
    // Attacks schliesst — sie ist kein Auftakt, sondern der Schlusspunkt.
    endsAttackSequence: true,
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      // ── ① Kosten: ein ausgeruestetes Artefakt in die Ablage ──────
      const ausruestung = ausruestungAm(engine, pi, heroIdx);
      if (ausruestung.length === 0) { gs._spellCancelled = true; return; }

      let opfer = ausruestung[0];
      if (ausruestung.length > 1) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'cardGallery', title: CARD_NAME,
          description: `Send one of ${hero.name}'s Artifacts to the discard pile to throw it.`,
          cards: ausruestung.map(i => ({ name: i.name, source: 'board' })),
          cancellable: false,
        });
        opfer = ausruestung.find(i => i.name === wahl?.cardName) || ausruestung[0];
      }
      await engine.actionMoveCard(opfer, 'discard', -1, -1, {
        source: ctx.card, sourceName: CARD_NAME,
      });
      engine.sync();
      await engine._delay(200);

      // ── ② Ziel und Schaden ───────────────────────────────────────
      const damage = (hero.atk || 0) * ATK_MULT;
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: damage,
        title: CARD_NAME,
        description: `Deal ${damage} damage (${ATK_MULT}× current ATK) to any target.`,
        confirmLabel: `🔪 Throw! (${damage})`,
        confirmClass: 'btn-danger',
        cancellable: false,          // Das Artefakt ist bereits bezahlt.
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      // ── ③ Der Zug ist fuer weitere Attacks zu, sobald die Karte
      //     aufgeloest hat — auch wenn kein Ziel mehr uebrig war.
      ps._soleAttackTurn = gs.turn;

      if (!target) { engine.sync(); return; }

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;

      const attackSource = {
        name: CARD_NAME, owner: pi, heroIdx, controller: pi, usesHeroAtk: true,
      };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, damage);

      // Geworfen, nicht gerannt: kein Ram, nur Flug und Einschlag.
      engine._broadcastEvent('play_zone_animation', {
        type: 'knife_throw_fly', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      });
      await engine._delay(320);          // Flug (180 ms) + Einschlag

      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionDealDamage(attackSource, tgtHero, finalDmg, 'attack');
        }
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support'
          && c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }
      await engine._delay(300);
      engine.sync();
    },
  },
};
