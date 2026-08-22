// ═══════════════════════════════════════════
//  CARD EFFECT: "Shield of Life"
//  Artifact (Equipment, Cost 4)
//
//  When the equipped Hero takes damage from an
//  opponent's card/effect (not self, not status)
//  and survives, controller selects any target
//  to heal for 100 HP. Once per turn.
//
//  Animation: heal sparkle on target.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],

  // ── CPU-Zielwahl (cpuResponse-Intercept, Muster Pengu/Fridge) ──────
  // Der Heil-Prompt ist cancellable — der generische CPU-Responder
  // lehnt cancellable Prompts per Default ab, d. h. die CPU cancelte
  // Shield of Life IMMER: Effekt feuerte nie, Profil-Wert klebte am
  // Floor (8), und in 288 Trainingsspielen blieb die Karte wirkungslos.
  // Politik: bestes eigenes verletztes Ziel heilen (Held vor Kreatur,
  // größtes gedeckeltes Defizit min(100, maxHp − hp)); liegt nirgends
  // ein Defizit ≥ 30, wird gecancelt — der Refund erhält den
  // Once-per-turn für einen späteren, besseren Treffer im selben Zug.
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    if (payload?.config?.title !== 'Shield of Life') return undefined;
    const pi = payload?.playerIdx;
    const validTargets = payload?.validTargets || [];
    if (typeof pi !== 'number' || validTargets.length === 0) return [];
    const gs = engine.gs;

    let best = null, bestDeficit = 29; // Schwelle: erst ab 30 HP Defizit heilen
    for (const t of validTargets) {
      if (t.owner !== pi) continue; // nur eigene Ziele heilen
      let deficit = 0, isHero = false;
      if (t.type === 'hero') {
        const h = gs.players?.[pi]?.heroes?.[t.heroIdx];
        if (!h?.name || h.hp <= 0) continue;
        const maxHp = h.maxHp || h.hp;
        deficit = Math.min(100, Math.max(0, maxHp - h.hp));
        isHero = true;
      } else {
        const inst = t.cardInstance || engine.cardInstances?.find(c =>
          c.owner === t.owner && c.zone === 'support'
          && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
        const cur = inst?.counters?.currentHp;
        const max = inst?.counters?.maxHp ?? inst?.counters?.baseHp;
        if (typeof cur !== 'number' || typeof max !== 'number') continue;
        deficit = Math.min(100, Math.max(0, max - cur));
      }
      // Helden bei Gleichstand bevorzugen (leichter Bonus)
      const score = deficit + (isHero ? 5 : 0);
      if (score > bestDeficit) { bestDeficit = score; best = t; }
    }
    return best ? [best.id] : [];
  },

  hooks: {
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const card = ctx.card;
      const target = ctx.target;
      const source = ctx.source;
      const dmgType = ctx.type;

      if (!target || target.hp === undefined) return;

      // Only hero damage (not creatures)
      if (target.hp <= 0) return; // Must survive

      // Find which hero was damaged
      let tgtPi = -1, tgtHi = -1;
      for (let p = 0; p < 2; p++) {
        for (let h = 0; h < (gs.players[p]?.heroes || []).length; h++) {
          if (gs.players[p].heroes[h] === target) { tgtPi = p; tgtHi = h; break; }
        }
        if (tgtPi >= 0) break;
      }
      if (tgtPi < 0 || tgtHi < 0) return;

      // Must be THIS Shield's hero
      if (tgtPi !== ctx.cardOriginalOwner || tgtHi !== card.heroIdx) return;

      // Must be opponent's damage (not self-inflicted by controller)
      const srcOwner = source?.controller ?? source?.owner;
      if (srcOwner == null || srcOwner === ctx.cardOwner) return;

      // No status damage
      if (dmgType === 'status') return;

      // Once per turn
      if (card.counters.shieldFiredThisTurn) return;

      card.counters.shieldFiredThisTurn = true;

      const pi = ctx.cardOwner; // Effective controller
      const heroIdx = card.heroIdx;

      // Prompt: select any hero or creature target. Renamed from `target`
      // to avoid shadowing the damaged-hero `target` from this hook's ctx.
      const healTarget = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        title: 'Shield of Life',
        description: `${ctx.attachedHero?.name || 'Hero'} survived damage! Choose a target to heal for 100 HP.`,
        confirmLabel: '💚 Heal! (100)',
        confirmClass: 'btn-success',
        cancellable: true,
        noSpellCancel: true,
      });

      if (!healTarget) {
        card.counters.shieldFiredThisTurn = false; // Refund if cancelled
        return;
      }

      // Anzeige-Split: Der Client rendert HP-Popups als Diff zwischen
      // zwei Syncs. Ohne Zwischen-Sync verschmelzen Gegner-Schaden und
      // Schild-Heilung zu EINER Netto-Zahl ("−200" statt "−300, +100").
      // Dieser Sync friert den Schadens-Stand als eigenen Tick ein; die
      // Heilung landet im nächsten.
      engine.sync();

      // Equip-Karte aufleuchten lassen (grün = Heilung)
      // Auftritt links am Feld (Als Regel 21.8.: beim Ausloesen).
      await engine.announceHookActivation('Shield of Life',
        ctx.cardController ?? ctx.cardOwner, { source: ctx.source });

      engine._broadcastEvent('play_zone_animation', {
        type: 'equip_flash', color: '#4ade80',
        owner: ctx.cardController ?? ctx.cardOwner,
        heroIdx: card.heroIdx, zoneSlot: card.zoneSlot,
      });

      // Heal sparkle animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle', owner: healTarget.owner, heroIdx: healTarget.heroIdx,
        zoneSlot: healTarget.type === 'hero' ? -1 : healTarget.slotIdx,
      });
      await engine._delay(300);

      // Heal
      const healSource = { name: 'Shield of Life', owner: ctx.cardOriginalOwner, heroIdx };
      if (healTarget.type === 'hero') {
        const h = gs.players[healTarget.owner]?.heroes?.[healTarget.heroIdx];
        if (h && h.hp > 0) await engine.actionHealHero(healSource, h, 100);
      } else {
        const inst = healTarget.cardInstance || engine.cardInstances.find(c =>
          c.owner === healTarget.owner && c.zone === 'support' && c.heroIdx === healTarget.heroIdx && c.zoneSlot === healTarget.slotIdx
        );
        if (inst) await engine.actionHealCreature(healSource, inst, 100);
      }

      engine.log('shield_of_life', { player: gs.players[pi].username, target: healTarget.cardName });
      engine.sync();
    },

    onTurnStart: async (ctx) => {
      ctx.card.counters.shieldFiredThisTurn = false;
    },
  },
};
