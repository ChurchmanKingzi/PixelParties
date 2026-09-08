// ═══════════════════════════════════════════
//  CARD EFFECT: "Shattered Trident, Treasure of the Deepsea"
//  Artifact (Equipment, Cost 10) — Secret Rare
//
//  "The equipped Hero's Attack stat is increased by 10. When the
//   equipped Hero performs an Attack against a single target, you may
//   increase that Attack's damage by the user's Attack stat. If you
//   do, send this card to the discard pile after the Attack resolved."
//
//  ① +10 ATK: `grantAtk` beim Anlegen (auch per Effekt — die
//     Ausruest-Helfer feuern onPlay), `revokeAtk` beim Verlassen
//     (Legendary-Sword-Muster).
//  ② Der Schub sitzt im `onAttackDeclare`-Slot (zwischen Zielwahl und
//     Animation, siehe CARD_API): Traeger greift ein EINZELNES Ziel an
//     → Ja/Nein-Prompt → `ctx.modifyAmount(hero.atk)` (der Wert des
//     Traegers INKLUSIVE der eigenen +10). Der Verbrauch wird an der
//     Instanz vermerkt und nach dem Angriff eingeloest: Trident →
//     Discard ueber `actionMoveCard` (Hooks, ATK-Rueckzug, Instrument-/
//     Spirit-Ausloeser). Als Ruling 30.8.: ein vom Spieler ABGEBROCHENER
//     Angriff verbraucht nicht — NEGATION (Invisibility Cloak: ganzer
//     Treffer; Strong Shield: nur der Schaden) verbraucht SCHON. Deshalb
//     zwei Einloese-Hooks: `afterSpellResolved` (normal aufgeloester
//     Angriff, auch Heldeneffekt-Angriffe wie Arthor) UND
//     `onAnyActionResolved` (feuert nach jedem Handspiel, auch negiert —
//     ein Abbruch erreicht ihn nicht). Wer zuerst kommt, loescht den
//     Zettel; ein verwaister Zettel faellt am Zugbeginn.
//  ③ Treffer-Animation (Al 30.8.): rosa splitterndes Glas auf dem ZIEL,
//     `pink_glass_shatter`, mit Klang (ZONE_ANIM_SFX). Gestartet aus dem
//     Declare-Slot mit ~420 ms Verzug, damit es mit dem Aufprall der
//     Angriffsanimation zusammenfaellt.
//
//  Aufstiegsbaustein von Lolek — die Bereitschaft pflegt der Basisheld
//  selbst (`_lolek-shared`), hier ist nichts zu tun.
// ═══════════════════════════════════════════

const CARD_NAME = 'Shattered Trident, Treasure of the Deepsea';
const ATK_BONUS = 10;

/** Zettel einloesen: Trident in die Ablage. Idempotent ueber den Zettel. */
async function spend(engine, inst) {
  if (!inst?.counters?._tridentSpent) return;
  delete inst.counters._tridentSpent;
  if (inst.zone !== 'support') return;
  await engine.actionMoveCard(inst, 'discard', -1, -1, { source: CARD_NAME });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },
    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card.id) return;
      if (!ctx.leavingCard && (ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot)) return;
      ctx.revokeAtk();
      delete ctx.card.counters._tridentSpent;
    },
    onTurnStart: (ctx) => {
      if (ctx.card?.counters?._tridentSpent) delete ctx.card.counters._tridentSpent;
    },

    onAttackDeclare: async (ctx) => {
      const inst = ctx.card;
      const src = ctx.source;
      if (!inst || !src || inst.zone !== 'support') return;
      if (src.heroIdx !== inst.heroIdx) return;
      if ((src.owner ?? src.controller) !== ctx.cardOwner) return;
      if (inst.counters?._tridentSpent) return;            // schon verbraucht, wartet auf Discard
      const targets = Array.isArray(ctx.target) ? ctx.target : (ctx.target ? [ctx.target] : []);
      if (targets.length !== 1) return;                     // „against a single target"

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const hero = engine.gs.players[pi]?.heroes?.[inst.heroIdx];
      const bonus = hero?.atk || 0;
      if (bonus <= 0) return;

      const answer = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: `Increase this Attack's damage by ${bonus} (the user's Attack stat)? The Trident is sent to the discard pile after the Attack resolved.`,
        confirmLabel: '🔱 Shatter!', cancelLabel: 'No', cancellable: true,
      });
      if (!answer || answer.cancelled || answer.confirmed === false) return;

      ctx.modifyAmount(bonus);
      if (!inst.counters) inst.counters = {};
      inst.counters._tridentSpent = { turn: engine.gs.turn, attack: src.name || null };
      engine._broadcastEvent('play_zone_animation', {
        type: 'equip_flash', owner: pi, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      // Rosa Glas auf dem Ziel — verzoegert auf den Aufprall, nicht
      // awaited (der Angriff soll nicht auf uns warten).
      const tgt = targets[0];
      if (tgt && typeof tgt.owner === 'number') {
        const zoneSlot = tgt.type === 'hero' ? -1 : (tgt.zoneSlot ?? tgt.slotIdx ?? -1);
        (async () => {
          await engine._delay(420);
          engine._broadcastEvent('play_zone_animation', {
            type: 'pink_glass_shatter', owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot,
          });
        })().catch(() => {});
      }
      engine.log('trident_shatter', {
        player: engine.gs.players[pi]?.username, hero: hero?.name, bonus, attack: src.name || null,
      });
    },

    afterSpellResolved: async (ctx) => {
      const inst = ctx.card;
      if (!inst?.counters?._tridentSpent || inst.zone !== 'support') return;
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Attack') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (ctx.isSecondCast) return;
      await spend(ctx._engine, inst);
    },

    // Negierter Angriff (Cloak/Strong Shield): afterSpellResolved bleibt
    // aus, dieser Hook feuert trotzdem — Abbruch erreicht ihn nicht.
    onAnyActionResolved: async (ctx) => {
      const inst = ctx.card;
      if (!inst?.counters?._tridentSpent || inst.zone !== 'support') return;
      if (ctx.actionType !== 'attack' && ctx.actionType !== 'hero_effect') return;
      if (ctx.playerIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      await spend(ctx._engine, inst);
    },
  },
};
