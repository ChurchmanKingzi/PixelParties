// ═══════════════════════════════════════════
//  CARD EFFECT: "Occultism"
//  Ability — Free activation (HOPT).
//
//  Once per turn, sacrifice a Creature you control that was NOT
//  summoned this turn, choose a target, and deal damage based on
//  Occultism's stack level:
//    Lv1 →  50 damage
//    Lv2 → 100 damage
//    Lv3 → 150 damage
//
//  Asriel, the Sapling Sacrificer's hero text — "You may sacrifice
//  Creatures the turn they are summoned with this Hero's Occultism."
//  — relaxes the summoning-sickness gate when Occultism is activated
//  on Asriel. Detected via the host hero's name (Asriel carries no
//  effect script of his own; his text is a constraint loosening read
//  by this ability).
//
//  Flow:
//    1. Pick a Creature to sacrifice (cancellable).
//    2. Pick a damage target (cancellable).
//    3. Resolve in order: sacrifice animation → ON_CREATURE_SACRIFICED
//       → actionDestroyCard → beam to target → deal damage.
//       Der Strahl startet an DIESER Occultism-Ability — nicht am
//       Tribut und nicht an der ersten Occultism der Seite.
//
//  Both prompts are cancellable; the cost is paid only after BOTH
//  selections are confirmed, so a half-committed activation never
//  loses a Creature for nothing.
// ═══════════════════════════════════════════

const { hasCardType, HOOKS } = require('./_hooks');

const CARD_NAME = 'Occultism';
const ASRIEL_NAME = 'Asriel, the Sapling Sacrificer';
const LEVEL_DAMAGE = [50, 100, 150];

/**
 * The sacrifice cost's rule set, in the engine's `spec` shape.
 * Default: the tribute must NOT have been summoned this turn. Asriel
 * relaxes that — every owned Creature is fair game.
 */
function getOccultismSacrificeSpec(engine, hostHero) {
  const currentTurn = engine.gs.turn || 0;
  if (hostHero?.name === ASRIEL_NAME) return {};
  return { filter: c => c.inst.turnPlayed !== currentTurn };
}

/**
 * Build the list of tributes available for THIS Occultism activation.
 *
 * Routed through the engine's `_collectSacrificeCandidates` — the same
 * collector `resolveSacrificeCost` uses — rather than the board-only
 * `getSacrificableCreatures`. That is what makes hand substitutes
 * (`sacrificableFromHand`, i.e. Chosen Sacrifice) show up: Occultism's
 * cost is a plain "sacrifice a Creature you control", so Chosen
 * Sacrifice's "you may instead sacrifice this Creature in your hand"
 * applies. Hand substitutes are exempt from the spec's filter inside
 * the collector — the card REPLACES the would-be tribute, so
 * "not summoned this turn" never touches it.
 */
function getOccultismSacrificeCandidates(engine, pi, hostHero, selfId) {
  return engine._collectSacrificeCandidates(
    pi, getOccultismSacrificeSpec(engine, hostHero), selfId,
  );
}

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  requiresTarget: true, // Tagged for Blinded gating — Occultism aims a damage shot.

  /**
   * Pre-check: is at least one Creature available to sacrifice for
   * this hero's Occultism? Without this, the activation UI would
   * stay lit when the rule's cost can't be paid.
   */
  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hostHero = engine.gs.players[pi]?.heroes?.[heroIdx];
    return getOccultismSacrificeCandidates(engine, pi, hostHero, ctx.card?.id).length > 0;
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    const hostHero = ps.heroes?.[heroIdx];
    if (!hostHero?.name || hostHero.hp <= 0) return false;

    const damage = LEVEL_DAMAGE[Math.min(Math.max(level, 1), 3) - 1];

    // ── Step 1: pick a Creature to sacrifice. ──
    const candidates = getOccultismSacrificeCandidates(engine, pi, hostHero, ctx.card?.id);
    if (candidates.length === 0) return false;

    // Target shapes mirror `resolveSacrificeCost`: board tributes are
    // `equip` entries, hand substitutes render as clickable hand cards
    // (`type: 'hand'`, the Rocky Slime mixed-target pattern).
    const seenIds = new Set();
    const sacTargets = [];
    for (const c of candidates) {
      let t;
      if (c._fromHand) {
        const handIdx = (ps.hand || []).indexOf(c.cardName);
        if (handIdx < 0) continue;
        t = {
          id: `hand-${c.inst.owner}-${handIdx}`,
          type: 'hand',
          owner: c.inst.owner, handIndex: handIdx,
          heroIdx: -1, slotIdx: -1,
          cardName: c.cardName, cardInstance: c.inst,
        };
      } else {
        t = {
          id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
          type: 'equip',
          owner: c.inst.owner, heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot,
          cardName: c.cardName, cardInstance: c.inst,
        };
      }
      // Hand ids are derived by `indexOf(cardName)`, so two copies of the
      // same substitute in hand would produce two entries with the SAME
      // id — a phantom duplicate in the picker. Only one tribute is ever
      // picked here, so collapse them.
      if (seenIds.has(t.id)) continue;
      seenIds.add(t.id);
      sacTargets.push(t);
    }
    if (sacTargets.length === 0) return false;

    const sacPick = await engine.promptEffectTarget(pi, sacTargets, {
      title: CARD_NAME,
      description: hostHero.name === ASRIEL_NAME
        ? 'Sacrifice any Creature you control (Asriel allows fresh summons too).'
        : 'Sacrifice a Creature you control that was not summoned this turn.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      // Exactly one tribute, regardless of its type. Type-agnostic caps
      // (`maxTotal`/`minRequired`, as `resolveSacrificeCost` uses) rather
      // than `maxPerType: { equip: 1 }` — the latter left hand entries
      // uncapped once the list became mixed.
      maxTotal: 1,
      minRequired: 1,
      // Repaint eligible-target glow red (the default yellow can read as
      // "click to buff" — sacrifice flavor needs the threat colour).
      redSelect: true,
    });
    if (!sacPick || sacPick.length === 0) return false;
    const sacTarget = sacTargets.find(t => t.id === sacPick[0]);
    const sacInst = sacTarget?.cardInstance;
    if (!sacInst) return false;
    const isHandSub = sacTarget.type === 'hand' || sacInst.zone === 'hand';

    // ── Step 2: pick a damage target. ──
    const damageTarget = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage to a target.`,
      confirmLabel: `🔥 ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!damageTarget) return false;

    // ══════════════════════════════════════════════════════════════
    //  Both selections confirmed — commit cost and effect together.
    // ══════════════════════════════════════════════════════════════

    // Capture sacrifice-site coordinates BEFORE actionDestroyCard
    // moves the instance to discard (zoneSlot survives, but using a
    // local snapshot keeps the beam origin readable.).
    const sacOwner    = sacInst.owner;
    const sacHeroIdx  = sacInst.heroIdx;
    const sacZoneSlot = sacInst.zoneSlot;
    const sacName     = sacInst.name;

    // ── Sacrifice: animation → hook → destroy. ──
    // A hand substitute has no board slot to plunge a knife into, so
    // the zone animation is board-only.
    if (!isHandSub) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'knife_sacrifice',
        owner: sacOwner, heroIdx: sacHeroIdx, zoneSlot: sacZoneSlot,
      });
      await engine._delay(550);
    }

    await engine.runHooks(HOOKS.ON_CREATURE_SACRIFICED, {
      creature: sacInst,
      cardName: sacName,
      owner: sacOwner,
      heroIdx: sacHeroIdx,
      zoneSlot: sacZoneSlot,
      source: { name: CARD_NAME, owner: pi, heroIdx },
      _skipReactionCheck: true,
    });
    if (isHandSub) {
      // Hand substitute: route it to discard by hand, mirroring
      // `resolveSacrificeCost`. NO ON_CREATURE_DEATH — the card never
      // entered the board, and on-death watchers (Hell Fox & co.) must
      // not fire for a card sacrificed straight from hand. The
      // hand→discard flight runs only NOW, after the hook above has
      // resolved the card's own on-sacrifice reward (Chosen Sacrifice's
      // draw / gold choice), so exactly one flight plays.
      const subPs = gs.players[sacInst.owner];
      const hi = (subPs?.hand || []).indexOf(sacName);
      engine._broadcastEvent('play_pile_transfer', {
        owner: sacInst.owner, cardName: sacName,
        from: 'hand', to: 'discard',
        fromHandIdx: hi >= 0 ? hi : 0,
      });
      if (hi >= 0) subPs.hand.splice(hi, 1);
      if (subPs) subPs.discardPile.push(sacName);
      sacInst.zone = 'discard'; sacInst.heroIdx = -1; sacInst.zoneSlot = -1;
      engine._untrackCard(sacInst.id);
      engine.sync();
    } else {
      await engine.actionDestroyCard(
        { name: CARD_NAME, owner: pi, heroIdx },
        sacInst,
        // Kosten-Zahlung des eigenen Besitzers, kein Fremdzugriff —
        // Schutzkarten dürfen den Tribut nicht abfangen, nachdem der
        // Nutzen schon eingestrichen wurde (Als Ruling vom 1.8.).
        { isSacrifice: true },
      );
    }

    // ── Damage: beam from the ACTIVATED OCCULTISM to the target. ──
    //
    // 16.8., Als Report: der Strahl startete frueher an der geopferten
    // Kreatur. Der Schaden kommt aber von der Ability, nicht vom Tribut
    // — und zwar von GENAU DIESER Occultism, nicht der ersten auf der
    // Seite. `ctx.card` ist die aktivierte Ability-Instanz, ihr
    // `zoneSlot` also der richtige Ability-Slot. `sourceZoneType:
    // 'ability'` sagt dem Client, in welcher Zonenart er suchen soll.
    //
    // Faellt der Slot wider Erwarten aus (Ability mitten in der
    // Aufloesung entfernt), bleibt `sourceZoneSlot: -1` — der Client
    // faellt dann auf die Heldenzone zurueck, also immer noch auf den
    // richtigen Helden statt auf den Tribut. Der Hand-Substitut-Fall
    // braucht dadurch keine Sonderbehandlung mehr.
    const abilitySlot = Number.isInteger(ctx.card?.zoneSlot) ? ctx.card.zoneSlot : -1;
    const targetZoneSlot = damageTarget.type === 'hero' ? -1 : damageTarget.slotIdx;
    engine._broadcastEvent('play_beam_animation', {
      sourceOwner: pi,
      sourceHeroIdx: heroIdx,
      sourceZoneSlot: abilitySlot,
      sourceZoneType: 'ability',
      targetOwner: damageTarget.owner,
      targetHeroIdx: damageTarget.heroIdx,
      targetZoneSlot,
      color: '#aa44ff',
      duration: 1100,
    });
    await engine._delay(350); // Let the beam draw before damage numbers pop.

    if (damageTarget.type === 'hero') {
      const hero = gs.players[damageTarget.owner]?.heroes?.[damageTarget.heroIdx];
      if (hero && hero.hp > 0) {
        await ctx.dealDamage(hero, damage, 'other');
      }
    } else {
      const inst = damageTarget.cardInstance || engine.cardInstances.find(c =>
        c.owner === damageTarget.owner && c.zone === 'support'
        && c.heroIdx === damageTarget.heroIdx && c.zoneSlot === damageTarget.slotIdx,
      );
      if (inst) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx },
          inst, damage, 'other',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.log('occultism_activated', {
      player: ps.username,
      hero: hostHero.name,
      level,
      damage,
      sacrificed: sacName,
      target: damageTarget.cardName,
    });
    engine.sync();
    await engine._delay(200);
    return true;
  },
};
