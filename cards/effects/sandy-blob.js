// ═══════════════════════════════════════════
//  CARD EFFECT: "Sandy Blob"
//  Creature (Summoning Magic Lv0, Slimes) — 30 HP.
//
//  Up to 3 times per turn, when the on-summon
//  effect of a Creature you control activates,
//  you may choose a target your opponent controls
//  and deal 50 damage to it.
//
//  Implementation: listens on onCardEnterZone.
//  The engine fires this hook immediately AFTER
//  onPlay completes for every Creature placement
//  (normal summon, Deepsea bounce-place, Layn
//  ascended summon, Living Illusion, etc.), so
//  it serves as the de-facto "after on-summon
//  effect" trigger point.
//
//  Filters:
//    • Entering card must be a friendly Creature
//      (same controller as Sandy Blob — stolen
//      creatures count, since "control" in card
//      text means current controller).
//    • Entering card must ACTUALLY have an
//      onPlay hook — passive Creatures (including
//      other Sandy Blobs) don't spuriously burn
//      one of the 3 uses per turn.
//    • Sandy Blob itself must be active on the
//      board (not negated/nulled, host hero alive).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Sandy Blob';
const DISCHARGE_DAMAGE = 50;
const DISCHARGES_PER_TURN = 3;

const { usesLeft, spendUse } = require('./_charges');
const USE_KEY = 'sandyBlob';
module.exports = {
  // Ladungsanzeige oben rechts (Als Vorgabe 16.8.): nur LESEN,
  // niemals den Zaehler anfassen — laeuft bei jedem Zustandsversand.
  chargesPerTurn: 3,
  chargeKey: USE_KEY,
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx.toZone !== 'support') return;

      // Card text: "when the on-summon effect of a Creature you control
      // activates". Moves (Slippery Skates, Dark Gear, Diplomacy) are
      // not summons — the creature was already on the board, its on-
      // summon already fired. Skip.
      if (ctx._isMove) return;

      // Skip self-entry (Sandy Blob's own placement).
      if (entering.id === inst.id) return;

      // Only react to own-side Creatures. Use controller (current control)
      // so temporarily-stolen creatures fire the hook for whoever owns
      // the steal. ?? fallback handles legacy instances that predate the
      // controller field.
      const selfController = inst.controller ?? inst.owner;
      const enteringController = entering.controller ?? entering.owner;
      if (enteringController !== selfController) return;

      // Entering card must be a Creature with an on-summon effect. A
      // passive-only Creature (no on-summon hook) has no "on-summon
      // effect" per the card text — don't react. Two hook shapes count
      // as an on-summon effect:
      //   • `hooks.onPlay` — the standard shape (Deepsea Werewolf, most
      //     creatures with an on-summon payload).
      //   • top-level `beforeSummon` — used by Creatures that need to
      //     orchestrate their entrance around the placement itself
      //     (Dark Deepsea God runs its tribute + AoE damage here and
      //     deliberately leaves `hooks.onPlay` empty so the animation
      //     midpoint split works). Without this second check Sandy Blob
      //     silently ignored DDG even though its on-summon IS firing.
      const cardDB = engine._getCardDB();
      const cd = entering.counters?._cardDataOverride || cardDB[entering.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
      if (!cd || !hasCardType(cd, 'Creature')) return;
      if (cd.cardType === 'Token') return;
      // VERDECKTE Eintritte sind keine Beschwörung: eine Kreatur-Surprise,
      // die in eine Bakhm-Support-Zone GESETZT wird, feuert bereits beim
      // Setzen onCardEnterZone (doPlaySurprise) — da liegt sie aber nur
      // verdeckt herum. Gezählt wird erst das Aufdecken, das dieselben
      // Hooks mit face-up-Instanz nachschiebt.
      if (entering.faceDown) return;
      const enteringScript = loadCardEffect(entering.name);
      const hasOnSummon = !!(enteringScript?.hooks?.onPlay)
        || typeof enteringScript?.beforeSummon === 'function'
        // Kreatur-SURPRISES tragen ihren Beschwörungs-Effekt in
        // `onSurpriseActivate` (Pure Advantage Camel zieht dort seine
        // Karte) — hooks.onPlay ist bei ihnen leer. Ohne diesen dritten
        // Zweig hätte Sandy Blob sie in KEINEM Pfad gesehen, auch nicht
        // beim regulären Aufdecken aus der Surprise Zone. Als Ruling:
        // die Aktivierung ist die On-Play-Aktivierung.
        || typeof enteringScript?.onSurpriseActivate === 'function';
      if (!hasOnSummon) return;
      // Conditional on-summon gate. Cards whose on-summon effect runs
      // ONLY under specific entry conditions (Soul Shards' "summoned
      // from discard", Sah's "summoned by Necromancy", etc.) export
      // a `summonEffectActivates(ctx)` predicate. The hook ctx
      // already carries the same `_summonedFromDiscard` /
      // `_summonedByNecromancy` flags the entering creature's onPlay
      // would receive (engine propagates `hookExtras` to both
      // onPlay and onCardEnterZone), so the predicate sees the
      // identical state.
      //
      // Two-stage check:
      //   1. PREDICATE — entry conditions met? Skip immediately if no.
      //      (Catches the most common case: a Soul Shard summoned from
      //      hand, where the predicate returns false.)
      //   2. MARKER — even when entry conditions are met, the onPlay
      //      may bail mid-flow (gallery cancelled, no eligible cards,
      //      etc.). Conditional creatures stamp
      //      `inst.counters._summonEffectFiredTurn = gs.turn` ONLY at
      //      the END of their successful path. If the marker isn't
      //      set this turn, the effect ran but didn't actually
      //      commit — Sandy Blob skips.
      if (typeof enteringScript?.summonEffectActivates === 'function') {
        try {
          if (!enteringScript.summonEffectActivates(ctx)) return;
        } catch { /* defensive — assume activated on predicate throw */ }
        if (entering.counters?._summonEffectFiredTurn !== gs.turn) return;
      }
      // If the entering Creature is negated / nulled at the moment its
      // on-summon would fire (Necromancy stamps `negated` BEFORE firing
      // onCardEnterZone for exactly this reason), the on-summon effect
      // ITSELF is silenced by the engine's runHooks filter. Sandy
      // Blob's text says "WHEN the on-summon effect activates" — if it
      // doesn't activate, Sandy Blob doesn't react. Bail here so we
      // don't burn one of the 3 uses on a creature whose effect was
      // suppressed before it could run.
      if (entering.counters?.negated || entering.counters?.nulled) return;

      // Sandy Blob must be live on the board — by ITS OWN state only.
      // Als Bugreport (Demo 22-43-23, T7-T11): der Blob feuerte nie,
      // während sein Host-Hero (Teppes) tot war — hier stand ein
      // `attachedHero.hp <= 0`-Gate, das der Engine-Doktrin
      // widerspricht (isCardEffectActive: "Creatures … remain active
      // even when the Hero is dead"; Rulebook: Kreaturen toter Heroes
      // bleiben im Spiel, nur ABILITY-abhängige Effekte sterben mit
      // dem Hero — Cosmic-Skeleton-Klausel — und Blob braucht keine
      // Hero-Ability). Hero-Stun/Frozen gaten Kreaturen ebenfalls
      // nicht (nur die KREATUR-eigenen Statuses zählen).
      // `isCardEffectActive` ist das kanonische Gate: faceDown /
      // negated / nulled / frozen / stunned der Kreatur selbst —
      // frozen/stunned prüfte der alte Inline-Check gar nicht.
      if (!inst || inst.zone !== 'support') return;
      if (!engine.isCardEffectActive(inst)) return;

      // Rundenstempel und Kappe im gemeinsamen Zaehler (v417).
      if (usesLeft(inst, engine.gs, { key: USE_KEY, max: DISCHARGES_PER_TURN }) <= 0) return;

      const pi = selfController;
      const remaining = usesLeft(inst, engine.gs, { key: USE_KEY, max: DISCHARGES_PER_TURN });

      // Single-step activation: go straight to the target picker. The
      // player either clicks an opponent target (activates) or cancels
      // (declines). No separate confirm dialogue — same pattern as
      // Deepsea Werewolf's on-summon damage pick. Counter increments
      // only after a target is locked in, so cancelling doesn't burn
      // a use.
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DISCHARGE_DAMAGE,
        title: CARD_NAME,
        description: `${entering.name}'s on-summon effect just activated. Choose an opponent target to hit with a sand tornado for ${DISCHARGE_DAMAGE} damage, or cancel. (${remaining} use${remaining === 1 ? '' : 's'} left this turn)`,
        confirmLabel: `🌪️ Sand Tornado! (${DISCHARGE_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      spendUse(inst, engine.gs, { key: USE_KEY, max: DISCHARGES_PER_TURN });

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

      engine._broadcastEvent('play_zone_animation', {
        type: 'sand_twister',
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(500);

      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, DISCHARGE_DAMAGE, 'creature');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
          target.cardInstance, DISCHARGE_DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('sandy_blob_blast', {
        player: gs.players[pi]?.username,
        trigger: entering.name,
        target: target.cardName,
        damage: DISCHARGE_DAMAGE,
        usesRemaining: usesLeft(inst, engine.gs, { key: USE_KEY, max: DISCHARGES_PER_TURN }),
      });
      engine.sync();
    },
  },
};
