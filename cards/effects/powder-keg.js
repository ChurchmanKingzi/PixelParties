// ═══════════════════════════════════════════
//  CARD EFFECT: "Powder Keg"
//  Artifact (subtype: Creature, Cost 4, 1 HP)
//
//  Cross-side placement: the player picks an
//  opponent's Hero (with a free Support Zone),
//  Powder Keg lands as a Creature on the
//  OPPONENT's side, and on death deals 150
//  damage to every other Creature in the host
//  Hero's Support Zones.
//
//  Routing
//  ───────
//  Subtype "Creature" would normally route the
//  card through `doPlayArtifact`'s isArtifactCreature
//  branch (drag-to-own-hero placement). We instead
//  declare `isTargetingArtifact: true`, and the
//  modified `doPlayArtifact` rejects the drag
//  path for targeting artifacts — the player
//  CLICKS the card from hand, which emits
//  `use_artifact_effect` and routes through
//  `doUseArtifactEffect`'s targeting branch
//  (server.js:6280). The picker shows opp Heroes
//  with at least one free Support Zone; the
//  `resolve` handler below places the card.
//
//  Ownership model
//  ───────────────
//  • `inst.owner` = the opponent (host side) —
//    so Powder Keg counts as their Creature for
//    Alice's buff, sacrifice mechanics, Ingo's
//    on-place gold trigger, Maya's-style hooks,
//    and the standard "this Hero's Creatures"
//    semantics.
//  • `inst.originalOwner` = the playing player
//    (whoever fired Powder Keg from hand) — so
//    the corpse routes to THEIR discard pile per
//    the engine's standard discard-routing rule.
//    Overwritten after `summonCreatureWithHooks`
//    returns; any hooks that fired during
//    placement saw the default (= owner). Powder
//    Keg has 1 HP and could theoretically die
//    inside its own placement hook chain, but no
//    placement hook in the codebase damages a
//    freshly-placed Creature, so this is a
//    theoretical edge only.
//
//  Death payload
//  ─────────────
//  `onCreatureDeath` filters to its own instance
//  id (`death.instId === ctx.card.id`) and
//  collects every face-up Creature in the HOST
//  hero's Support Zones excluding Powder Keg's
//  own (former) slot. Damage type 'artifact' —
//  this is artifact-sourced damage, and the
//  source attribution uses `inst.originalOwner`
//  so retaliation hooks (Fireshield, Shield of
//  Life, etc.) see the original caster as the
//  aggressor rather than the host opponent.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Powder Keg';
const DEATH_DAMAGE = 150;

/**
 * Build the picker target list — one entry per opp Hero that has at
 * least one free base support slot, plus one entry per free slot on
 * each such Hero. Either click commits the placement. Dead / Frozen /
 * Stunned / Negated host Heroes are deliberately accepted (per the
 * card text — the Hero just needs to physically host the slot; their
 * status doesn't matter to Powder Keg).
 *
 * Emitting BOTH a hero target and the per-slot targets lets the player:
 *   • Click the Hero header → auto-place into the first free slot.
 *   • Click a specific free slot → place into that exact slot.
 *
 * `exclusiveTypes: true` + `maxPerType: { hero: 1, equip: 1 }` in the
 * targeting config prevents picking both, so the engine commits the
 * single confirmed click.
 */
function getOppPlacementTargets(gs, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const oppPs = gs.players[oppIdx];
  if (!oppPs) return [];
  const out = [];
  for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
    const hero = oppPs.heroes[hi];
    if (!hero?.name) continue; // empty Hero slot has no Support Zones to use
    const supZones = oppPs.supportZones?.[hi] || [];
    const freeSlots = [];
    for (let si = 0; si < 3; si++) {
      if ((supZones[si] || []).length === 0) freeSlots.push(si);
    }
    if (freeSlots.length === 0) continue;
    out.push({
      id: `hero-${oppIdx}-${hi}`,
      type: 'hero',
      owner: oppIdx,
      heroIdx: hi,
      cardName: hero.name,
    });
    for (const si of freeSlots) {
      out.push({
        id: `slot-${oppIdx}-${hi}-${si}`,
        type: 'equip',
        owner: oppIdx,
        heroIdx: hi,
        slotIdx: si,
        cardName: null, // empty slot has no card name
      });
    }
  }
  return out;
}

module.exports = {
  isTargetingArtifact: true,
  // ── Cross-side placement marker ──
  // Tells server (doPlayArtifact) and client (drag UI) that this
  // card's destination is on the opponent's board, not the playing
  // player's. Both honour the flag uniformly — the drag-drop path
  // routes onto opp Heroes / Support Zones, the targeting picker's
  // valid targets are all on opp's side, the engine publishes
  // `crossSidePlayableArtifacts` for client highlighting.
  placesOnOpponentBoard: true,
  activeIn: ['support'],

  canActivate(gs, pi) {
    return getOppPlacementTargets(gs, pi).length > 0;
  },

  getValidTargets(gs, pi) {
    return getOppPlacementTargets(gs, pi);
  },

  /**
   * CPU sanity gate. Powder Keg's placement on its own is a net loss
   * for the playing side — it costs gold + a hand card, fills an opp
   * Support slot the opp could've used (mild positive), AND immediately
   * feeds opp's on-creature-placed hooks (Ingo's gold, Maya's HP buff,
   * Alice's buff, etc.) — all clearly negative deltas. The value comes
   * later when the 1-HP body dies and AoEs the host hero's row. Refuse
   * the play unless at least one opp hero has a free slot AND at least
   * one Creature already sitting in their row that the AoE would hit.
   */
  cpuShouldPlay(engine, pi) {
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = engine.gs.players[oppIdx];
    if (!oppPs) return false;
    const cardDB = engine._getCardDB();
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const supZones = oppPs.supportZones?.[hi] || [];
      const hasFreeSlot = supZones.slice(0, 3).some(s => (s || []).length === 0);
      if (!hasFreeSlot) continue;
      let creatures = 0;
      for (let si = 0; si < 3; si++) {
        for (const cn of (supZones[si] || [])) {
          const cd = cardDB[cn];
          if (cd && hasCardType(cd, 'Creature')) creatures++;
        }
      }
      if (creatures >= 1) return true;
    }
    return false;
  },

  /**
   * CPU target picker for the opp-Hero prompt. Picks the Hero whose
   * row would generate the highest AoE payoff — sum of (min(currentHp,
   * 150)) over the row's living Creatures. Capping at 150 reflects
   * that overkill doesn't matter (1-HP victims and 500-HP victims both
   * count as one kill for damage-budget purposes). Tie-break on raw
   * creature count, then on the smallest existing free-slot count
   * (fewer free slots = more crowded row = more AoE coverage).
   *
   * Falls through to the generic CPU brain on non-target prompts.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'target' && kind !== 'effectTarget') return undefined;
    const { validTargets } = payload || {};
    if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
    const cardDB = engine._getCardDB();
    const DAMAGE_CAP = 150;
    const scored = validTargets.map(t => {
      const ps = engine.gs.players[t.owner];
      const supZones = ps?.supportZones?.[t.heroIdx] || [];
      let payoff = 0;
      let count = 0;
      let freeSlots = 0;
      for (let si = 0; si < 3; si++) {
        const slot = supZones[si] || [];
        if (slot.length === 0) { freeSlots++; continue; }
        for (const cn of slot) {
          const cd = cardDB[cn];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          const inst = engine.cardInstances.find(c =>
            c.owner === t.owner && c.zone === 'support'
            && c.heroIdx === t.heroIdx && c.zoneSlot === si && c.name === cn,
          );
          const hp = inst?.counters?.currentHp ?? cd.hp ?? 0;
          payoff += Math.min(hp, DAMAGE_CAP);
          count++;
        }
      }
      return { id: t.id, payoff, count, freeSlots };
    });
    scored.sort((a, b) =>
      (b.payoff - a.payoff)
      || (b.count - a.count)
      || (a.freeSlots - b.freeSlots),
    );
    return [scored[0].id];
  },

  targetingConfig: {
    description: "Pick an opponent's Hero (auto-places in the first free Support Zone) or click a specific free Support Zone.",
    confirmLabel: '💥 Place!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  // Suppress the default explosion-on-target animation — the actual
  // payoff is the death blast, not the placement.
  animationType: 'none',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return { aborted: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return { aborted: true };

    const hostOwner = target.owner;
    const hostHeroIdx = target.heroIdx;
    const hostPs = engine.gs.players[hostOwner];
    if (!hostPs) return { aborted: true };

    // Resolve the destination slot. Slot targets (`type: 'equip'`)
    // carry an explicit `slotIdx`; hero targets (`type: 'hero'`)
    // auto-pick the first free base slot on that Hero.
    let freeSlot;
    if (target.type === 'equip' && Number.isInteger(target.slotIdx)) {
      freeSlot = target.slotIdx;
    } else {
      freeSlot = -1;
      const supZones = hostPs.supportZones?.[hostHeroIdx] || [];
      for (let si = 0; si < 3; si++) {
        if ((supZones[si] || []).length === 0) { freeSlot = si; break; }
      }
    }
    if (freeSlot < 0) return { aborted: true };
    // Final re-validate — slot must still be empty (interleaved effect
    // between picker render and resolve could have filled it).
    if (((hostPs.supportZones?.[hostHeroIdx] || [])[freeSlot] || []).length > 0) {
      return { aborted: true };
    }

    // Place as a Creature on the host's side. `isPlacement: true` runs
    // onPlay + onCardEnterZone (so Ingo / Maya / Alice all see the
    // arrival) while skipping host-incapacitation gates — important
    // because Powder Keg's text explicitly allows placement onto dead
    // / Frozen / Stunned / Negated Heroes.
    const placed = await engine.summonCreatureWithHooks(
      CARD_NAME, hostOwner, hostHeroIdx, freeSlot,
      { source: CARD_NAME, isPlacement: true },
    );
    if (!placed?.inst) return { aborted: true };

    // Re-stamp `originalOwner` so the corpse routes to the playing
    // player's discard pile — Powder Keg conceptually belongs to
    // whoever fired it, even though it sits on opp's side.
    placed.inst.originalOwner = pi;

    // Suppress the doConfirmPotion hand-to-discard disposition
    // (server.js:6379). Powder Keg now LIVES on the board as the
    // tracked instance the engine just summoned — pushing the card
    // name to the discard pile here would double-stamp it (one copy
    // on the board, one copy already in the discard pile waiting for
    // re-summon by every "from your discard" effect). Same flag /
    // semantics that Area Artifacts (Smuggler's Pier, …) use.
    engine.gs._spellPlacedOnBoard = true;

    engine.log('powder_keg_placed', {
      placer: engine.gs.players[pi]?.username,
      host: engine.gs.players[hostOwner]?.username,
      hostHero: hostPs.heroes[hostHeroIdx]?.name,
      slot: freeSlot,
    });

    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Death payload — 150 damage to every other face-up Creature in
     * the host Hero's Support Zones. Self-only fire (instId match)
     * so simultaneous Powder Keg deaths each only fire their own
     * blast; no HOPT because the card text has no once-per-turn
     * gate and Powder Keg can't easily die twice on the same turn
     * anyway (1 HP, no revive mechanic in its own text).
     */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death) return;
      if (death.instId !== ctx.card.id) return;

      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const hostOwner = death.owner;
      const hostHeroIdx = death.heroIdx;
      const ownSlot = death.zoneSlot;

      // Collect Creatures in the host's other Support Zones on the
      // same Hero column. Walk `cardInstances` so we don't double-
      // count or pick up phantom entries from the discard splice
      // path; engine guarantees one inst per zone slot.
      const victims = [];
      for (const inst of engine.cardInstances) {
        if (inst.owner !== hostOwner) continue;
        if (inst.zone !== 'support') continue;
        if (inst.heroIdx !== hostHeroIdx) continue;
        if (inst.zoneSlot === ownSlot) continue;
        if (inst.faceDown) continue;
        const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        victims.push(inst);
      }
      if (victims.length === 0) return;

      // Explosion flash on every victim in parallel, brief delay,
      // then a single batched damage pass — same shape Book of Doom
      // and Exploding Skull use so beforeCreatureDamageBatch listeners
      // see the whole sweep at once.
      for (const v of victims) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'explosion',
          owner: v.owner,
          heroIdx: v.heroIdx,
          zoneSlot: v.zoneSlot,
        });
      }
      await engine._delay(400);

      const source = {
        name: CARD_NAME,
        owner: death.originalOwner ?? death.owner,
        heroIdx: -1,
        cardInstance: ctx.card,
      };

      const batch = victims.map(inst => ({
        inst,
        amount: DEATH_DAMAGE,
        type: 'artifact',
        source,
        sourceOwner: source.owner,
        canBeNegated: true,
        isStatusDamage: false,
        animType: null,
      }));
      await engine.processCreatureDamageBatch(batch);

      engine.log('powder_keg_blast', {
        damage: DEATH_DAMAGE,
        victims: victims.length,
        hostOwner,
        hostHeroIdx,
      });
      engine.sync();
    },
  },
};
