// ═══════════════════════════════════════════
//  CARD EFFECT: "Jenny, the Class Fairy"
//  Hero — 300 HP, 30 ATK
//  Starting abilities: Friendship, Magic Arts
//
//  Hero Effect (HOPT, Main Phase):
//  Pick any number of Ability slots from Heroes
//  the controller PERMANENTLY controls (own +
//  not charmed). For each picked slot with 2+
//  copies stacked, the controller chooses how
//  many copies to recall (1..stack). Each
//  recalled copy returns to hand and grants 1
//  draw. After resolving, the controller's hand
//  is locked for the rest of the turn — no more
//  draws or deck-tutoring (`ps.handLocked = true`).
//
//  Implementation
//  ──────────────
//  • Stage 1 — slot picker via `promptEffectTarget`
//    with `type: 'ability'` targets, one per
//    occupied own ability slot. Multi-select via
//    maxPerType / maxTotal set high; minRequired: 0
//    lets the player back out.
//  • Stage 2 — per-slot count picker (only for
//    stacks of size ≥ 2). Single-copy slots auto-
//    recall their lone copy. Lv2/Lv3 stacks fire a
//    `promptGeneric` optionPicker offering 1..N.
//    `cancellable: false` because the slot was
//    already committed in stage 1; the player can
//    still pick "1" to bounce a single copy.
//  • For each picked slot with chosen count K,
//    the copies leave ONE AT A TIME (top of the
//    stack first), each with:
//      – a zone-anchored `play_pile_transfer`
//        (ability → hand) emitted BEFORE the sync,
//        so the card visibly flies from its slot
//        into the hand (Befund 26.9.: vorher kein Flug,
//        die Karte tauchte nur in der Hand auf),
//      – the regular `onCardLeaveZone` pass with
//        `leavingCard`, so Toughness / Fighting &
//        Co. revoke their stack bonus (26.9.:
//        vorher nur `_untrackCard` — HP/ATK
//        blieben stehen),
//      – splice + untrack + `handZugangSync`,
//      – a short pause before the next copy.
//    Support-Zone entries that count as Abilities
//    (Cloak of Edge, Xalibur stacks) go through
//    `actionMoveCard(inst, 'hand')` — the engine's
//    support→hand path brings flight + hooks.
//  • Draw N cards via `actionDrawCards` (which
//    already gates on `handLocked`, so order
//    matters: draw FIRST, then lock).
//  • `ps.handLocked = true` blocks all draws
//    and `actionAddCardFromDeckToHand` calls
//    for the rest of the turn (cleared on the
//    standard turn-start cleanup pass).
// ═══════════════════════════════════════════

const CARD_NAME = 'Jenny, the Class Fairy';

/**
 * Live heroes `pi` PERMANENTLY controls: own (not charmed away) plus heroes taken permanently from the other side
 * (Paraseed Control, `permaControlBy`). W16f (H02-09): Ruling 4.9. — ein dauerhaft übernommener Held zählt wie ein von Anfang an
 * beherrschter; seine Abilities liegen in der Spalte des Vorbesitzers (`physOwner`). Charme (temporär) zählt nicht.
 * @returns {Array<{physOwner:number, heroIdx:number}>}
 */
function permanentlyControlledHeroIndices(engine, pi) {
  const out = [];
  for (const { physOwner, heroIdx, hero: h } of engine.heroesControlledBy(pi, { permanentOnly: true })) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.charmedBy != null && h.permaControlBy !== pi) continue;
    out.push({ physOwner, heroIdx });
  }
  return out;
}

/** Build the per-slot target list for the picker. */
function buildAbilityTargets(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const heroIdxs = permanentlyControlledHeroIndices(engine, pi);
  const targets = [];
  for (const { physOwner, heroIdx: hi } of heroIdxs) {
    // Support-Zonen-Karten, die dort als Ability zaehlen (Cloak of Edge)
    // — zentral ueber den Sammler (Als Ruling 5.8.). Nur an eigenen Helden
    // (W16f: ein übernommener Held der Gegenspalte bietet nur seine Ability Zones an;
    // `actionMoveCard` brächte die Karte in die Hand des Besitzers).
    if (physOwner === pi) for (const t of (engine.collectSupportZoneAbilities?.(pi, hi) || [])) {
      targets.push({
        id: `equip-${pi}-${hi}-${t.slotIdx}`, type: 'equip',
        owner: pi, heroIdx: hi, slotIdx: t.slotIdx,
        cardName: t.cardName, level: 1,
      });
    }
    const abZones = engine.gs.players[physOwner]?.abilityZones?.[hi] || [];
    for (let si = 0; si < abZones.length; si++) {
      const slot = abZones[si] || [];
      if (slot.length === 0) continue;
      const baseName = slot[0];
      targets.push({
        id: `ability-${physOwner}-${hi}-${si}`,
        type: 'ability',
        owner: physOwner,
        heroIdx: hi,
        slotIdx: si,
        cardName: baseName,
        // Stash for the resolve loop — count of copies in this slot.
        _jennyStackSize: slot.length,
      });
    }
  }
  return targets;
}

/** Tracked instances in one of the controller's Support Zone slots. */
function supportSlotInsts(engine, pi, heroIdx, slotIdx) {
  return engine.cardInstances.filter(c => c.zone === 'support' && c.owner === pi
    && c.heroIdx === heroIdx && c.zoneSlot === slotIdx);
}

/**
 * Recall the TOP copy of an Ability Zone stack to its owner's hand.
 * Order matters:
 *   1. Flight broadcast while the client still shows the copy in its
 *      slot (`handZugangSync` syncs — after that the slot is shorter).
 *   2. `onCardLeaveZone` with `leavingCard` while the inst is still
 *      tracked in the ability zone — Toughness / Fighting read the
 *      stack via `abgangsBetrag` and revoke the top level's bonus.
 *   3. Splice, untrack, add to hand (fresh hand inst + sync).
 * @returns {boolean} whether a copy was recalled.
 */
async function recallAbilityCopy(engine, pi, heroIdx, slotIdx, physOwner = pi) {
  const ps = engine.gs.players[pi];                         // Hand: Kontrolleur
  const slotPs = engine.gs.players[physOwner];              // Ability Zones: Spalte des Helden (W16f, H02-09)
  const slot = slotPs?.abilityZones?.[heroIdx]?.[slotIdx];
  if (!Array.isArray(slot) || slot.length === 0) return false;
  const name = slot[slot.length - 1];
  const inst = engine.cardInstances
    .filter(c => c.zone === 'ability' && c.owner === physOwner && c.name === name
                 && c.heroIdx === heroIdx && c.zoneSlot === slotIdx)
    .pop() || null;

  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: physOwner, toOwner: pi, cardName: name,
    from: 'ability', to: 'hand',
    fromHeroIdx: heroIdx, fromSlotIdx: slotIdx,
    toHandIdx: ps.hand.length, finalHandSize: ps.hand.length + 1,
  });

  if (inst) {
    await engine.runHooks('onCardLeaveZone', {
      card: inst, leavingCard: inst,
      fromZone: 'ability', fromHeroIdx: heroIdx, fromZoneSlot: slotIdx,
      fromOwner: physOwner, toZone: 'hand',
      source: CARD_NAME, sourceOwner: pi,
    });
  }

  // Re-read the slot: a hook may have touched it in the meantime.
  const live = slotPs.abilityZones?.[heroIdx]?.[slotIdx];
  if (Array.isArray(live)) {
    const idx = live.lastIndexOf(name);
    if (idx >= 0) live.splice(idx, 1);
  }
  if (inst) engine._untrackCard(inst.id);
  // Karte des Vorbesitzers: bei Abwurf/Spiel zurück in dessen Ablage (Konvention „gestohlene Karten gehen zu ihrem Besitzer").
  engine.handZugangSync(ps, name, { von: 'brett', source: CARD_NAME, ...(physOwner !== pi ? { originalOwner: physOwner } : {}) });
  return true;
}

/**
 * Recall the top copy of a Support Zone entry that counts as an Ability
 * (Cloak of Edge, a real Ability stack under Xalibur). `actionMoveCard`
 * owns the support→hand flight and the leave hooks for this zone.
 */
async function recallSupportCopy(engine, pi, heroIdx, slotIdx) {
  const ps = engine.gs.players[pi];
  const names = ps?.supportZones?.[heroIdx]?.[slotIdx] || [];
  const insts = supportSlotInsts(engine, pi, heroIdx, slotIdx);
  if (insts.length === 0) return false;
  const top = names[names.length - 1];
  const inst = [...insts].reverse().find(c => c.name === top) || insts[insts.length - 1];
  await engine.actionMoveCard(inst, 'hand', -1, -1, { source: CARD_NAME, sourceOwner: pi });
  if (inst.zone !== 'hand') return false; // Move blocked (immovable etc.).
  engine.sync();
  return true;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;
    // No legal recall target → effect can't fire.
    return buildAbilityTargets(engine, pi).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    // Styx 28.9.: Jenny selbst (Brettseite), nicht der gleich indizierte eigene Held.
    const jenny   = ctx.attachedHero ?? gs.players[ctx.cardHeroOwner ?? pi]?.heroes?.[heroIdx];
    if (!ps || !jenny?.name || jenny.hp <= 0) return false;

    const targets = buildAbilityTargets(engine, pi);
    if (targets.length === 0) return false;

    // ── Multi-pick prompt ─────────────────────────────────────────
    // Player clicks any number of own ability slots. minRequired: 0
    // lets the player back out without burning the HOPT (cancellable),
    // while picking ≥ 1 commits the recall + the post-effect lock.
    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Click any number of your own Ability slots to recall copies to your hand. You will choose how many copies per stack next. Each recalled copy = 1 card draw. Your hand will be LOCKED for the rest of the turn.',
      confirmLabel: '🧚 Recall!',
      confirmClass: 'btn-info',
      cancellable: true,
      exclusiveTypes: false,
      maxPerType: { ability: targets.length },
      maxTotal: targets.length,
      minRequired: 0,
    });
    if (!selectedIds || selectedIds.length === 0) return false;

    // ── Stage 2: per-slot count picker for stacks of size ≥ 2 ─────
    // Singles auto-resolve to count 1. The picker is non-cancellable
    // because the slot was already committed in stage 1; the player
    // can pick the minimum (1) to back off a single copy.
    const slotPlans = [];
    for (const sid of selectedIds) {
      const t = targets.find(x => x.id === sid);
      if (!t) continue;
      const zone = t.type === 'equip' ? 'support' : 'ability';
      const stackSize = zone === 'ability'
        ? (gs.players[t.owner]?.abilityZones?.[t.heroIdx]?.[t.slotIdx] || []).length
        : supportSlotInsts(engine, pi, t.heroIdx, t.slotIdx).length;
      if (stackSize === 0) continue;
      let count = stackSize;
      if (stackSize > 1) {
        const heroName = gs.players[t.owner]?.heroes?.[t.heroIdx]?.name || `Hero ${t.heroIdx + 1}`;
        const options = [];
        for (let n = 1; n <= stackSize; n++) {
          options.push({
            id: String(n), label: `${n} cop${n === 1 ? 'y' : 'ies'}`,
            description: `Recall ${n} of ${stackSize} ${t.cardName} from ${heroName}.`,
            color: '#44aaff',
          });
        }
        const result = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: `${t.cardName} on ${heroName} — choose how many copies to recall.`,
          options, cancellable: false,
        });
        const parsed = parseInt(result?.optionId, 10);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= stackSize) count = parsed;
        else count = 1; // Defensive default if the picker dismissed unexpectedly.
      }
      slotPlans.push({ zone, heroIdx: t.heroIdx, slotIdx: t.slotIdx, ability: t.cardName, count, physOwner: t.owner });
    }

    // ── Recall picked stacks back to hand — one copy at a time ────
    // Pause between two flights so they read as a sequence (also
    // within one stack) instead of a wall of cards leaving at once.
    const STAGGER_MS = 420;
    let totalRecalled = 0;
    const recallLog = [];
    for (const plan of slotPlans) {
      let recalled = 0;
      for (let n = 0; n < plan.count; n++) {
        if (totalRecalled > 0) await engine._delay(STAGGER_MS);
        const ok = plan.zone === 'support'
          ? await recallSupportCopy(engine, pi, plan.heroIdx, plan.slotIdx)
          : await recallAbilityCopy(engine, pi, plan.heroIdx, plan.slotIdx, plan.physOwner);
        if (!ok) break; // Slot emptied mid-resolve (defensive).
        recalled++;
        totalRecalled++;
      }
      if (recalled > 0) {
        recallLog.push({ heroIdx: plan.heroIdx, slotIdx: plan.slotIdx, ability: plan.ability, count: recalled });
      }
    }
    // v1365: Arbeit, die an den Abgang einer Karte gehaengt wurde.
    await engine._nachAbgangAbarbeiten?.();

    if (totalRecalled === 0) return false;

    engine.log('jenny_recall', {
      player: ps.username, total: totalRecalled, slots: recallLog,
    });
    engine.sync();
    await engine._delay(300);

    // ── Draw equal count BEFORE locking (the lock would gate the draw). ──
    // actionDrawCards animates one-by-one with the engine's standard
    // staggered delay; honors deck-emptiness and any other draw-batch
    // hooks. Skips if `ps.handLocked` is already set (it isn't here
    // since we haven't stamped yet).
    if (totalRecalled > 0) {
      await engine.actionDrawCards(pi, totalRecalled);
    }

    // ── Hand lock for the rest of the turn ────────────────────────
    // The standard turn-start cleanup (engine._engine.js: `ps.handLocked
    // = false`) clears this on the next turn boundary. Until then, all
    // draws (`actionDrawCards`) and tutors (`actionAddCardFromDeck
    // ToHand`) gate on `if (ps.handLocked) return [...]` and silently
    // no-op. Matches the user's spec exactly: "You cannot draw or add
    // cards from your deck to your hand for the rest of the turn".
    // Z6 (H02-10): der Text sperrt nur "draw or add cards FROM YOUR DECK" - also Zieh-Sperre + (schwache) Such-Sperre,
    // die den Ablagestapel offen laesst; die volle Hand-Sperre (`handLocked`, Kazena) waere breiter als der Text.
    ps.drawLocked = true;
    ps.searchLocked = true;
    engine.log('hand_locked', { player: ps.username, by: CARD_NAME });
    engine.sync();
    return true;
  },
};
