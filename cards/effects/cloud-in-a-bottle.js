// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloud in a Bottle"
//  Potion (Reaction).
//
//  When any target you control takes damage,
//  halve the damage (rounded up) and apply the
//  Cloudy buff (halves all future damage this
//  turn) to that target.
//
//  Wiring — two entry points, consolidated UX:
//
//   1. `isPostTargetReaction` (primary) — fires
//      ONCE per damage source after targets are
//      determined. If 2+ of the activator's Heroes
//      are in the target list, the player chooses
//      WHICH ONE gets the halve + Cloudy buff. The
//      chosen Hero is stamped via
//      `engine.addCloudBottleMark`;
//      `_actionDealDamageImpl` consumes the mark
//      AFTER damage applies, restores half the
//      dealt amount, and applies the Cloudy buff.
//
//   2. `isAfterDamageReaction` (fallback) — fires
//      per-Hero for damage paths that don't route
//      through the post-target hub. Gated by the
//      per-source `_cibPromptedFor` flag so it
//      never re-prompts after the post-target
//      window has fired.
//
//  Dedup: per-player `_cibPromptedFor[pi]` is set in
//  `postTargetCondition` (covers both accept AND
//  decline paths) and in `afterDamageCondition`.
//  All flags + marks are cleared at chain-resolve.
//
//  Kreaturen (Welle 13, Q134): eigenes Fenster
//  `isAfterCreatureDamageReaction` (Haelfte zurueck + Cloudy).
//
//  ★ Welle 14 (Al, Q10): „Sowohl bei Heroes als auch Creatures soll Cloud auch für Schaden angeboten werden, der
//  tödlich wäre, und diesen halbieren. Natürlich könnte der Schaden, wenn er genug Overkill gehabt hätte, trotzdem
//  noch tödlich sein." → Der Treffer wird mit seinem VOLLEN Betrag (inkl. Overkill) halbiert (aufgerundet):
//   • Held: `firesOnLethalDamage` (Nach-Schaden-Fenster) und der Marken-Hook rechnen mit `hpBefore − ceil(voll/2)`;
//     ist das ≤ 0, bleibt der Held besiegt (kein Cloudy für einen Gefallenen).
//   • Kreatur: `isCreaturePreDefeatReaction` setzt den tödlichen Betrag herab (`info.amountOverride`, die Engine wendet
//     den neuen Betrag an; reicht er weiter, stirbt die Kreatur trotzdem). Nur Schaden, kein Zerstören/Opfer.
//
//  Stacking guard: targets that already have the
//  Cloudy buff are excluded from the candidate
//  list (no point doubling-up halving).
// ═══════════════════════════════════════════

const CARD_NAME = 'Cloud in a Bottle';

module.exports = {
  isPotion: true,
  canActivate: () => false,
  // Active in hand + deleted (Potions route to deletedPile on resolve)
  // so afterDamage / onChainResolve hooks fire while the card sits in
  // either zone.
  activeIn: ['hand', 'deleted'],

  // ── Batch-level (consolidated multi-target prompt) ──────────────
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, _engine, targetedTargets, sourceCard, opts) {
    // "when a target you control takes ANY DAMAGE" — never chain to
    // non-damage targeting (Disruption Ray, …). See Spectral Armor.
    if (opts && opts.dealsDamage === false) return false;
    if (_alreadyPrompted(gs, pi)) return false;
    const eligible = _collectOwnedHeroTargets(gs, pi, targetedTargets, _engine).length > 0;
    if (eligible) {
      // Side effect — covers decline path. Once the prompt is offered
      // (accept or decline), no further CIB prompts for this source.
      _markPrompted(gs, pi);
    }
    return eligible;
  },

  async postTargetResolve(engine, pi, targetedTargets /*, sourceCard, opts */) {
    const candidates = _collectOwnedHeroTargets(engine.gs, pi, targetedTargets, engine);
    if (candidates.length === 0) return { effectNegated: false };
    _markPrompted(engine.gs, pi);

    let picked;
    if (candidates.length === 1) {
      picked = candidates[0];
    } else {
      const result = await engine.promptEffectTarget(pi, candidates.map(c => ({
        id: c.id, type: 'hero',
        owner: c.owner, heroIdx: c.heroIdx, cardName: c.cardName,
      })), {
        title: CARD_NAME,
        description: 'Choose one of your Heroes to halve the incoming damage and gain Cloudy.',
        confirmLabel: '☁️ Protect!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: 1,
      });
      picked = (result && result.length > 0)
        ? (candidates.find(c => c.id === result[0]) || candidates[0])
        : candidates[0];
    }

    _addMark(engine.gs, _keyForHero(picked.owner, picked.heroIdx));
    engine.log('cloud_bottle_prompt_accepted', {
      player: engine.gs.players[pi]?.username, target: picked.cardName,
    });
    engine.sync();
    return { effectNegated: false };
  },

  // ── Per-hero fallback (direct hero damage paths) ─────────────────
  isAfterDamageReaction: true,
  firesOnLethalDamage: true,   // Welle 14 (Q10): auch ein sonst tödlicher Treffer wird angeboten und halbiert

  afterDamageCondition(gs, pi, _engine, target, _targetHeroIdx, _source, amount, _type, _info) {
    if (_alreadyPrompted(gs, pi)) return false;
    if (!(amount > 0)) return false;
    // Kontrolle statt Seite (Styx 28.9.) — der Reaktor ist hier die
    // physische Spalte; ein abgegebener Held ist nicht „you control".
    if (_engine && _engine.heroSideOf(pi, target) !== pi) return false;
    // Don't trigger if the hero already has the Cloudy buff (no stacking).
    if (target?.buffs?.cloudy) return false;
    _markPrompted(gs, pi);
    return true;
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, _source, amount, _type, info) {
    _markPrompted(engine.gs, pi);
    const gs = engine.gs;
    const ps = gs.players[pi];

    // Welle 14 (Q10): voller Treffer (inkl. Overkill) und HP davor — `amount` ist der auf die Vor-Treffer-HP gedeckelte Verlust.
    const voll = Number.isFinite(info?.fullAmount) ? info.fullAmount : amount;
    const hpVor = Number.isFinite(info?.hpBefore) ? info.hpBefore : (target.hp + amount);
    const halfDmg = Math.ceil(voll / 2);
    const neuHp = hpVor - halfDmg;
    if (neuHp <= 0) {
      // Auch halbiert noch tödlich: der Held bleibt besiegt (die Karte war trotzdem gespielt).
      target.hp = 0;
      engine.log('cloud_bottle_still_lethal', { player: ps.username, hero: target.name, originalDamage: voll, effectiveDamage: halfDmg });
      engine.sync();
      return;
    }
    if (neuHp > target.hp) {
      const restoreAmount = neuHp - target.hp;
      target.hp = Math.min(neuHp, target.maxHp);
      engine.log('cloud_bottle_restore', {
        player: ps.username, hero: target.name,
        originalDamage: voll, effectiveDamage: halfDmg, restored: restoreAmount,
      });
    }

    // Physische Adresse des Helden (Styx 28.9.: der Reagierende kann ihn
    // kontrollieren, waehrend er beim Gegner steht).
    const _phys = engine._findHeroOwner(target);
    const zielSeite = _phys >= 0 ? _phys : pi;
    engine._broadcastEvent('play_zone_animation', {
      type: 'cloud_gather', owner: zielSeite, heroIdx: targetHeroIdx, zoneSlot: -1,
    });
    await engine._delay(600);

    const nextPlayer = engine.opponentOf(gs.activePlayer);
    await engine.actionAddBuff(target, zielSeite, targetHeroIdx, 'cloudy', {
      sourceOwner: pi,   // v1067: Quelle ist Pflicht (siehe _affected-shared)
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: nextPlayer,
      source: CARD_NAME,
      addAnim: 'cloud_gather',
      removeAnim: 'cloud_disperse',
    });

    engine.log('cloud_bottle', {
      player: ps.username, hero: target.name,
    });
    engine.sync();
  },

  // ── Kreaturen (Welle 13, Q134, Al: „Sollte auch für Creatures einsetzbar sein") ──
  // „a target you control" schliesst Kreaturen ein. Eigenes Nach-Schadens-Fenster
  // der Kreatur-Seite (`isAfterCreatureDamageReaction`, wie Spiky Armor): die
  // Haelfte des gerade erlittenen Schadens kommt zurueck, danach traegt die
  // Kreatur „Cloudy" bis Zugende (halbiert allen weiteren Schaden). Dedup und
  // Grenzen wie beim Helden-Fallback (ein Angebot je Kette; kein Angebot bei
  // bereits Cloudy; ein toedlicher Treffer wird nicht mehr abgefangen).
  isAfterCreatureDamageReaction: true,

  afterCreatureDamageCondition(gs, pi, _engine, inst, _source, amount /*, type */) {
    if (_alreadyPrompted(gs, pi)) return false;
    if (!(amount > 0)) return false;
    if (!inst || (inst.controller ?? inst.owner) !== pi) return false;
    if (inst.zone !== 'support') return false;
    if ((inst.counters?.currentHp ?? 0) <= 0) return false;
    if (inst.counters?.buffs?.cloudy) return false;
    _markPrompted(gs, pi);
    return true;
  },

  async afterCreatureDamageResolve(engine, pi, inst, _source, amount /*, type */) {
    _markPrompted(engine.gs, pi);
    const gs = engine.gs;
    const restoreAmount = amount - Math.ceil(amount / 2);   // = floor(amount / 2)
    if (restoreAmount > 0 && (inst.counters.currentHp ?? 0) > 0) {
      const maxHp = inst.counters.maxHp ?? Infinity;
      inst.counters.currentHp = Math.min(inst.counters.currentHp + restoreAmount, maxHp);
      engine.log('cloud_bottle_restore', {
        player: gs.players[pi]?.username, creature: inst.name,
        originalDamage: amount, effectiveDamage: amount - restoreAmount, restored: restoreAmount,
      });
    }
    engine._broadcastEvent('play_zone_animation', {
      type: 'cloud_gather', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    await engine._delay(600);
    const nextPlayer = engine.opponentOf(gs.activePlayer);
    await engine.actionAddCreatureBuff(inst, 'cloudy', {
      sourceOwner: pi,
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: nextPlayer,
      source: CARD_NAME,
      addAnim: 'cloud_gather',
      removeAnim: 'cloud_disperse',
    });
    engine.log('cloud_bottle', { player: gs.players[pi]?.username, creature: inst.name });
    engine.sync();
  },

  // ── Kreaturen, TÖDLICHER Treffer (Welle 14, Q10) ─────────────────────
  // Vor dem Tod fragt die Engine die Hand (`_checkCreaturePreDefeatHandReactions`, nach allen anderen Modifikatoren, mit dem
  // endgültigen Betrag). Cloud rettet nicht, sondern halbiert (aufgerundet) den Betrag (`info.amountOverride`) und legt danach
  // „Cloudy" auf — beides nur, wenn die Kreatur den halbierten Treffer überlebt. Nur Schaden: Zerstören/Opfer sind kein Schaden.
  isCreaturePreDefeatReaction: true,

  creaturePreDefeatCondition(gs, pi, _engine, inst, _source, amount, type, info) {
    if (_alreadyPrompted(gs, pi)) return false;
    if (!(amount > 0)) return false;
    if (type === 'destroy' || info?.isSacrifice || info?.istZerstoerung) return false;
    if (!inst || (inst.controller ?? inst.owner) !== pi) return false;
    if (inst.zone !== 'support') return false;
    if (inst.counters?.buffs?.cloudy) return false;   // schon Cloudy: der Treffer ist bereits halbiert
    _markPrompted(gs, pi);
    return true;
  },

  async creaturePreDefeatResolve(engine, pi, inst, _source, amount, _type, info) {
    _markPrompted(engine.gs, pi);
    const gs = engine.gs;
    const halb = Math.ceil(amount / 2);
    if (info && typeof info === 'object') info.amountOverride = halb;
    const hp = inst.counters?.currentHp ?? 0;
    engine.log('cloud_bottle', { player: gs.players[pi]?.username, creature: inst.name, originalDamage: amount, effectiveDamage: halb, lethal: halb >= hp });
    if (halb >= hp) return { saved: false };   // auch halbiert tödlich: die Kreatur stirbt trotzdem
    engine._broadcastEvent('play_zone_animation', {
      type: 'cloud_gather', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    await engine._delay(600);
    const nextPlayer = engine.opponentOf(gs.activePlayer);
    await engine.actionAddCreatureBuff(inst, 'cloudy', {
      sourceOwner: pi,
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: nextPlayer,
      source: CARD_NAME,
      addAnim: 'cloud_gather',
      removeAnim: 'cloud_disperse',
    });
    engine.sync();
    return { saved: false };   // der (halbierte) Treffer wird von der Engine normal angewendet
  },

  hooks: {
    /**
     * Consume the per-target halve-after-damage mark. Restores
     * floor(actualAmount / 2) HP (effectively halving the damage,
     * rounded up) and applies the Cloudy buff. Mark is one-shot.
     * Runs in the engine's AFTER_DAMAGE hook window which fires
     * after HP has dropped but BEFORE the after-damage hand-reaction
     * window — so CIB's per-target `isAfterDamageReaction` fallback
     * is naturally suppressed (dedup flag set in postTargetCondition).
     */
    afterDamage: async (ctx) => {
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      const actualAmount = ctx.amount;
      if (!(actualAmount > 0)) return;
      const engine = ctx._engine;
      const tgtOwner = engine._findHeroOwner(target);
      if (tgtOwner < 0) return;
      const tgtHi = (engine.gs.players[tgtOwner]?.heroes || []).indexOf(target);
      if (tgtHi < 0) return;
      if (!_consumeMark(engine.gs, _keyForHero(tgtOwner, tgtHi))) return;

      // Welle 14 (Q10): auch ein tödlicher Treffer wird halbiert (voller Betrag inkl. Overkill; `realDealt` ist auf die Vor-Treffer-HP gedeckelt).
      const halfDmg = Math.ceil(actualAmount / 2);
      const hpVor = target.hp + (Number.isFinite(ctx.realDealt) ? ctx.realDealt : actualAmount);
      const neuHp = hpVor - halfDmg;
      if (neuHp <= 0) {
        // Halbiert immer noch tödlich: der Held bleibt besiegt, kein Cloudy für einen Gefallenen.
        engine.log('cloud_bottle_still_lethal', { target: engine._heroLabel(target), originalDamage: actualAmount, effectiveDamage: halfDmg });
        return;
      }
      const restoreAmount = neuHp - target.hp;
      if (restoreAmount > 0) {
        target.hp = Math.min(neuHp, target.maxHp);
      }
      engine._broadcastEvent('play_zone_animation', {
        type: 'cloud_gather', owner: tgtOwner, heroIdx: tgtHi, zoneSlot: -1,
      });
      await engine._delay(450);
      // Cloudy buff: expires at end of this turn (start of next player's turn).
      const nextPlayer = engine.opponentOf(engine.gs.activePlayer);
      await engine.actionAddBuff(target, tgtOwner, tgtHi, 'cloudy', {
        // v1067: Quelle ist Pflicht (siehe _affected-shared). In diesem
        // Hook gibt es kein `pi` — der Wirker ist der Besitzer der Flasche.
        sourceOwner: ctx.cardOwner,
        expiresAtTurn: engine.gs.turn + 1,
        expiresForPlayer: nextPlayer,
        source: CARD_NAME,
        addAnim: 'cloud_gather',
        removeAnim: 'cloud_disperse',
      });
      engine.log('cloud_bottle_apply', {
        target: engine._heroLabel(target),
        originalDamage: actualAmount, restored: restoreAmount,
      });
    },

    /**
     * Chain-resolve cleanup. Per-target marks + per-player prompt
     * dedup are scoped to a single chain.
     */
    onChainResolve: (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._cibMarks) delete gs._cibMarks;
      if (gs._cibPromptedFor) delete gs._cibPromptedFor;
    },
  },
};

// ─── Per-player prompt dedup ───────────────────────────────────────

function _alreadyPrompted(gs, pi) {
  return !!gs._cibPromptedFor?.[pi];
}
function _markPrompted(gs, pi) {
  if (!gs._cibPromptedFor) gs._cibPromptedFor = {};
  gs._cibPromptedFor[pi] = true;
}

// ─── Per-target halve-after-damage mark set + one-shot consume ────

function _addMark(gs, key) {
  if (!key) return;
  if (!gs._cibMarks) gs._cibMarks = new Set();
  gs._cibMarks.add(key);
}
function _consumeMark(gs, key) {
  const set = gs?._cibMarks;
  if (!set || !key || !set.has(key)) return false;
  set.delete(key);
  return true;
}
function _keyForHero(ownerIdx, heroIdx) {
  return `cib-hero-${ownerIdx}-${heroIdx}`;
}

/**
 * Filter the source's target list to alive Heroes controlled by `pi`
 * that don't already have the Cloudy buff. Kreaturen laufen ueber das
 * eigene Nach-Schadens-Fenster (`afterCreatureDamageResolve`, Welle 13).
 */
function _collectOwnedHeroTargets(gs, pi, targetedTargets, engine) {
  const out = [];
  if (!Array.isArray(targetedTargets)) return out;
  for (const t of targetedTargets) {
    if (!t || t.type !== 'hero') continue;
    const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
    // Kontrolle statt Seite (Styx 28.9.) — „a target you control"
    const seite = engine ? engine.heroSideOf(t.owner, hero) : t.owner;
    if (seite !== pi) continue;
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.buffs?.cloudy) continue;
    out.push({
      id: `hero-${t.owner}-${t.heroIdx}`,
      owner: t.owner, heroIdx: t.heroIdx,
      cardName: hero.name,
    });
  }
  return out;
}
