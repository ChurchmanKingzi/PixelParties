// ═══════════════════════════════════════════
//  CARD EFFECT: "Field Standard"
//  Artifact (Normal, Cost 10) — Banned base
//
//  Choose up to 3 Lv≤1 Creatures with DIFFERENT
//  names you control that already used their
//  active effects this turn. They may use those
//  effects an additional time this turn. You can
//  only play 1 'Field Standard' per turn.
//
//  Implementation
//  ──────────────
//  • Targeting Artifact — `getValidTargets` walks
//    own Lv≤1 Creatures whose per-inst HOPT
//    `creature-effect:${inst.id}` is stamped for
//    the current turn (the engine's canonical
//    "this Creature already activated its effect
//    this turn" marker — see `_engine.js` ~L17400
//    and `server.js`'s `doActivateCreatureEffect`).
//    Targets are deduplicated by `inst.name` so the
//    picker's `maxPerType: { equip: 3 }` cap is the
//    only count gate the player has to think about
//    — the "different names" clause is satisfied
//    structurally by the name-dedupe, not by an
//    extra client check that would have no live
//    UI feedback (validateSelection only fires at
//    server confirm).
//  • Reimbursement model — for each picked Creature
//    we DELETE its `creature-effect:${inst.id}`
//    HOPT key from `gs.hoptUsed`. The standard
//    activation gate (`exhausted = ...HOPT === turn`
//    in `_engine.js` ~L17401) then evaluates false,
//    so the player can click the Creature again to
//    fire its effect a second time through the
//    normal `doActivateCreatureEffect` path. We do
//    NOT re-fire effects here — text says "they
//    MAY use those effects", a player choice that
//    happens on the next click, not an immediate
//    re-fire.
//  • Once-per-turn-by-name HOPT keyed on
//    `field-standard:${pi}` — checked in
//    `canActivate` so the play is rejected at the
//    `doUseArtifactEffect` gate before any
//    targeting UI opens. Stamped at the top of
//    `resolve` once we know we have ≥1 valid pick;
//    no deferred-reveal song-and-dance because the
//    new "reimburse-only" flow has no abortable
//    sub-step (cf. the old "re-fire immediately"
//    flow which could be cancelled inside the
//    re-fired Creature's prompt).
//  • Does NOT stamp `ps._artifactLockTurn` — the
//    1-per-turn limit is on Field Standard itself,
//    not the Artifact slot.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Field Standard';
const HOPT_KEY_PREFIX = 'field-standard';
const MAX_LEVEL = 1;
const MAX_PICKS = 3;

function _hoptUsed(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_KEY_PREFIX}:${pi}`] === gs.turn;
}
function _stampHopt(gs, pi) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${HOPT_KEY_PREFIX}:${pi}`] = gs.turn;
}

/**
 * Is this Creature instance an eligible Field Standard target?
 *   • Controlled by `pi` (own side, including stolen-by us).
 *   • Face-up Creature card-type, level ≤ MAX_LEVEL.
 *   • Has used its active effect this turn — i.e. the engine's
 *     per-inst creature-effect HOPT is stamped for the current turn.
 *   • Has an `onCreatureEffect` script to re-activate.
 *   • Host hero is alive (a Creature on a dead Hero stays on the
 *     board but its effect activation gates require a live host).
 */
function _isEligible(engine, inst, pi) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if ((inst.controller ?? inst.owner) !== pi) return false;

  const cardDB = engine._getCardDB();
  const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
  if (!cd || !hasCardType(cd, 'Creature')) return false;
  if ((cd.level ?? 99) > MAX_LEVEL) return false;

  const effectName = inst.counters?._effectOverride || inst.name;
  const script = loadCardEffect(effectName);
  if (!script?.onCreatureEffect) return false;

  const host = engine.gs.players[pi]?.heroes?.[inst.heroIdx];
  if (!host?.name || host.hp <= 0) return false;

  const hoptKey = `creature-effect:${inst.id}`;
  if (engine.gs.hoptUsed?.[hoptKey] !== engine.gs.turn) return false;

  // ── WÜRDE DIE ERSTATTUNG ÜBERHAUPT ETWAS BEWIRKEN? (1.8.) ─────────
  // Manche Kreaturen führen zusätzlich eine eigene Sperre. Zwei Arten,
  // und sie müssen unterschiedlich behandelt werden:
  //
  //   • INSTANZGENAU (`<key>:<instId>`, z.B. Analyzer) — darf mitgelöst
  //     werden, wirkt ja nur auf genau diese Karte. Solche Schlüssel
  //     meldet die Karte über `creatureEffectHoptKeys`.
  //   • SPIELERWEIT / HART (`<key>:<pi>`, z.B. Greatmaw Shark, Skeleton
  //     Bard, Rebelliokai Oblivious Oni) — "nur EINE Nutzung pro Runde,
  //     egal wie viele Kopien". Die darf NICHT gelöst werden: das würde
  //     alle Kopien freischalten und genau die Regel aushebeln.
  //
  // Statt das je Karte zu entscheiden, wird hier simuliert: Schlüssel
  // versuchsweise entfernen und die Karte SELBST fragen. Sagt ihre
  // eigene Prüfung weiterhin nein, ist sie kein legales Ziel — der
  // Spieler kann Field Standard dann gar nicht erst darauf verschwenden.
  //
  // Die Simulation ist rein synchron und stellt im `finally` exakt den
  // Ausgangszustand wieder her (auch das Nicht-Vorhandensein eines
  // Schlüssels).
  if (typeof script.canActivateCreatureEffect !== 'function') return true;
  const gs = engine.gs;
  if (!gs.hoptUsed) gs.hoptUsed = {};
  const keys = [hoptKey];
  try {
    const extra = typeof script.creatureEffectHoptKeys === 'function'
      ? script.creatureEffectHoptKeys(engine, inst, pi) : null;
    for (const k of (extra || [])) if (k) keys.push(k);
  } catch { /* Meldung ist Kür */ }
  const merk = keys.map(k => [k, Object.prototype.hasOwnProperty.call(gs.hoptUsed, k), gs.hoptUsed[k]]);
  try {
    for (const k of keys) delete gs.hoptUsed[k];
    const probeCtx = engine._createContext(inst, { event: 'canCreatureEffectCheck' });
    return !!script.canActivateCreatureEffect(probeCtx);
  } catch {
    return true;   // Prüfung wirft → wie bisher zulassen
  } finally {
    for (const [k, hatte, wert] of merk) {
      if (hatte) gs.hoptUsed[k] = wert; else delete gs.hoptUsed[k];
    }
  }
}

module.exports = {
  /**
   * Suppress the default `potion_resolved` explosion that
   * `doConfirmPotion` would otherwise fire on each picked Creature.
   * Field Standard's own visual is the `field_standard_rally`
   * zone-anim per reimbursed Creature, fired inside `resolve`.
   */
  animationType: 'none',

  /**
   * CPU evaluation hint. The card's value (Creatures firing their
   * effects again) materialises through the REST of the current main
   * phase / turn, NOT in the immediate post-play state — the
   * reimbursement deletes HOPT keys but doesn't itself fire anything.
   * Without `evaluateThroughTurnEnd`, the MCTS gate's recon scores
   * Field Standard at the just-played snapshot (HOPTs cleared, -gold,
   * -hand) and always reads net-negative. With it, the gate plays out
   * the rest of the turn — subsequent `runMainPhase` passes activate
   * the reimbursed Creatures, and the eval sees the resulting board
   * impact (damage, gold, draws, …).
   *
   * Timing-within-turn is left to the natural CPU flow: `playArtifacts`
   * runs BEFORE `activateBoardEffects` in each `runMainPhase` pass, so
   * Field Standard's `canActivate` is naturally false in pass 1 (no
   * Creature has HOPT'd yet) and true from pass 2 onward (after pass 1
   * activated effects). Pick-count is decided by `cpuResponse` below
   * — always taking the maximum eligible (up to 3 different names),
   * matching the user-spec "reuse as many Creatures as possible".
   */
  cpuMeta: { evaluateThroughTurnEnd: true },

  /**
   * Play-time gate. Rejects the click before any targeting UI opens
   * when (a) the once-per-turn-by-name HOPT is already claimed, or
   * (b) there's no eligible Creature on the controller's side. The
   * server passes `engine` as the 3rd arg (see `doUseArtifactEffect`
   * in `server.js`); without it we can't walk `cardInstances`, so
   * fall back to rejecting the play.
   */
  canActivate(gs, pi, engine) {
    if (_hoptUsed(gs, pi)) return false;
    if (!engine) return false;
    for (const inst of engine.cardInstances) {
      if (_isEligible(engine, inst, pi)) return true;
    }
    return false;
  },

  /**
   * One eligible target per DISTINCT name in the controller's set
   * of Lv≤1 effect-used Creatures. First inst encountered wins —
   * the gameplay outcome (one Creature of that name becomes re-
   * activatable) is identical regardless of which physical copy
   * gets the reimbursement. Same dedupe pattern Cool Presents uses
   * for "any number of different-named cards from your hand".
   */
  getValidTargets(gs, pi, engine) {
    const out = [];
    if (!engine) return out;
    const seenNames = new Set();
    for (const inst of engine.cardInstances) {
      if (!_isEligible(engine, inst, pi)) continue;
      if (seenNames.has(inst.name)) continue;
      seenNames.add(inst.name);
      out.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, cardInstance: inst,
        ownSupport: true,
      });
    }
    return out;
  },

  targetingConfig: {
    // `title` doubles as the CPU brain's lookup key — `cpuPickTargets`
    // in `_cpu.js` reads `config.title` to resolve the card name and
    // find the `cpuResponse` hook below. Without it the per-card
    // override is skipped and the generic targeting brain handles the
    // pick (which works for damage / heal / buff shapes, but doesn't
    // know to take the max number of own-side equip targets for
    // Field Standard's reimburse-as-many shape).
    title: CARD_NAME,
    description: 'Choose up to 3 Lv≤1 Creatures with different names that already used their effects this turn. Each picked Creature may use its effect again.',
    confirmLabel: '🚩 Rally!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { equip: MAX_PICKS },
    maxTotal: MAX_PICKS,
    minRequired: 1,
  },

  validateSelection(selectedIds /*, validTargets */) {
    return Array.isArray(selectedIds)
      && selectedIds.length >= 1
      && selectedIds.length <= MAX_PICKS;
  },

  /**
   * CPU target-picker override. Returns the maximum number of valid
   * targets the picker allows (cap = `maxPerType.equip` = MAX_PICKS).
   * The "different names" constraint is structurally enforced by
   * `getValidTargets` (one inst per distinct name) — so the first N
   * valid targets are by construction N different names.
   *
   * What this hook does NOT decide: WHEN to play Field Standard. That
   * stays an MCTS gate decision via `cpuMeta.evaluateThroughTurnEnd`
   * — the gate compares "play now" vs "skip" rollouts and commits when
   * the rest-of-turn reimbursement value beats the gate threshold.
   * What this hook DOES decide: assuming the gate has chosen to play
   * the card, pick the maximum number of eligible Creatures. Picking
   * fewer would leave reimbursement value on the table and bias the
   * MCTS comparison against ever committing.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'target') return undefined;
    const validTargets = payload?.validTargets;
    if (!Array.isArray(validTargets) || validTargets.length === 0) {
      return payload?.config?.cancellable ? [] : undefined;
    }
    const cap = payload?.config?.maxPerType?.equip
      ?? payload?.config?.maxTotal
      ?? MAX_PICKS;
    return validTargets.slice(0, Math.min(cap, validTargets.length)).map(t => t.id);
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };

    const picked = selectedIds
      .map(id => (validTargets || []).find(t => t.id === id))
      .filter(t => t && t.cardInstance);
    if (picked.length === 0) return { cancelled: true };

    // Defensive re-validate — eligibility filter ran at play-time;
    // an interleaved effect could in theory have moved/destroyed/HOPT-
    // reset a creature between picker render and confirm.
    const eligible = picked.filter(t => _isEligible(engine, t.cardInstance, pi));
    if (eligible.length === 0) return { cancelled: true };

    // Commit the once-per-turn-by-name HOPT now — we know at least
    // one reimbursement will land.
    _stampHopt(engine.gs, pi);

    const reimbursedNames = [];
    for (const t of eligible) {
      const inst = t.cardInstance;
      const hoptKey = `creature-effect:${inst.id}`;
      // Reimburse: drop the engine's "effect used this turn" stamp so
      // `canActivateCreatureEffect` (engine.js ~L17401) sees the
      // Creature as fresh again.
      if (engine.gs.hoptUsed && engine.gs.hoptUsed[hoptKey] !== undefined) {
        delete engine.gs.hoptUsed[hoptKey];
      }
      // ── EIGENE SPERREN DER KARTE MITRÄUMEN (1.8., Als Report) ──────
      // Manche Kreatureffekte führen eine ZUSÄTZLICHE, eigene
      // Einmal-pro-Zug-Sperre — Greatmaw Shark etwa `greatmaw_shark_
      // effect:<pi>`, geteilt über alle Kopien eines Spielers. Der
      // generische Schlüssel oben trifft die nicht, weshalb Field
      // Standard bei genau diesen Karten wirkungslos blieb (belegt im
      // Mitschnitt: `field_standard_refire` feuerte, der Hai ließ sich
      // trotzdem nicht erneut einsetzen).
      //
      // Karten melden ihre Extra-Schlüssel über `creatureEffectHoptKeys`
      // — generisch, damit eine weitere Karte mit eigener Sperre keine
      // Änderung hier braucht.
      try {
        const sc = require('./_loader').loadCardEffect(inst.name);
        const extra = typeof sc?.creatureEffectHoptKeys === 'function'
          ? sc.creatureEffectHoptKeys(engine, inst, pi) : null;
        for (const k of (extra || [])) {
          if (engine.gs.hoptUsed && engine.gs.hoptUsed[k] !== undefined) {
            delete engine.gs.hoptUsed[k];
          }
        }
      } catch { /* Extra-Sperren sind Kür, nie Abbruchgrund */ }
      reimbursedNames.push(inst.name);

      // Brief "rallying flag" zone animation on the chosen Creature so
      // the reimbursement moment is visible to both players. No client-
      // side handler is required — unknown anim types render silently.
      engine._broadcastEvent('play_zone_animation', {
        type: 'field_standard_rally',
        owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      await engine._delay(120);
    }

    engine.log('field_standard_refire', {
      player: engine.gs.players[pi]?.username,
      creatures: reimbursedNames,
    });

    engine.sync();
    return true;
  },
};
