// ═══════════════════════════════════════════
//  CARD EFFECT: "Heat Wave"
//  Spell (Destruction Magic Lv3, Normal)
//
//  Every target on the board EXCEPT the casting
//  Hero either:
//    • gets permanently Burned (if not already
//      Burned and not burn-immune), OR
//    • takes 150 `destruction_spell` damage (if
//      it was already Burned before resolution).
//
//  Burn-immune targets that aren't already
//  Burned do nothing — the flame animation still
//  plays on them (per user spec: "animation for
//  this should be wide lines of flames shooting
//  at all targets except the user (even immune
//  ones!)").
//
//  Damage-lock edge case: if the caster's own
//  state carries `damageLocked` (Flame Avalanche's
//  rest-of-turn debuff), the damage branch is
//  suppressed. Burns still apply to the non-
//  already-burned, non-immune targets. The card
//  is still CAST (spell-school cost paid, HOPT
//  consumed) — it just skips the damage leg.
//
//  Play-time usability:
//    • Normal: usable if at least one non-caster
//      target would do something (take a new Burn
//      OR take damage because it's already Burned).
//    • Damage-locked: usable only if at least one
//      non-caster target can still be Burned
//      (i.e. not already Burned AND not immune).
//      Matches the user spec: "Heat Wave is still
//      usable unless ALL possible targets are
//      already Burned or immune to being Burned".
//
//  spellPlayCondition runs before we know which
//  Hero will cast, so it enumerates every live
//  Hero on both sides as a potential non-caster
//  target — over-inclusive, but the per-hero
//  level-/lock-check gates the bad cases.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Heat Wave';
const DAMAGE    = 150;

/**
 * Is a resolved target currently Burned?
 * Heroes check `statuses.burned`, creatures check `counters.burned`.
 */
function targetIsBurned(engine, t) {
  if (t.type === 'hero') {
    return !!engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.statuses?.burned;
  }
  return !!t.inst?.counters?.burned;
}

/**
 * Can the target receive a new Burned status right now? Targeting-
 * side gate — omni-immune Creatures (Cardinal Beasts etc.) stay in
 * the AoE pool so the flame_strike animation lands on them; the
 * actual Burn application fizzles silently inside the resolve loop
 * via `applyCreatureStatus` (which gates on `canApplyCreatureStatus`).
 * Mirrors the hero-side gates that `addHeroStatus` would hit
 * (immune / charmed / burn_immune).
 */
function targetCanBeBurned(engine, t, quelle = null) {
  if (t.type === 'hero') {
    const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.statuses?.burned) return false; // Already — not "can-be-newly".
    if (hero.statuses?.immune) return false;
    // Charme schuetzt nur in seiner Auspraegung (Styx: gar nicht).
    if (hero.statuses?.charmed && engine._charmBlocksFrom(hero, quelle)) return false;
    if (hero.statuses?.burn_immune) return false;
    return true;
  }
  if (!t.inst) return false;
  if (t.inst.counters?.burned) return false;
  return engine.canTargetForStatus(t.inst, 'burned');
}

/**
 * Gather every live non-caster target on the board.
 * If `casterIdx` is provided (at resolution time), the caster's hero is
 * filtered out. At play-condition time the caster isn't known yet, so
 * `casterIdx = -1` keeps all heroes in the pool.
 */
function collectTargets(engine, pi, casterHeroIdx) {
  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  const targets = [];
  for (let tpi = 0; tpi < 2; tpi++) {
    const ps = gs.players[tpi];
    if (!ps) continue;
    // Heroes
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (tpi === pi && hi === casterHeroIdx) continue; // Skip caster
      targets.push({ type: 'hero', owner: tpi, heroIdx: hi });
    }
    // Creatures — je Kontrolleur genau einmal (Styx 28.9.: das alte
    // Oder-Muster zaehlte gestohlene/seitenfremde doppelt).
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) !== tpi || inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      targets.push({
        type: 'creature',
        owner: engine.physicalSide(inst),
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        inst,
      });
    }
  }
  return targets;
}

/** Brettweite Heat-Wave-Animation (Client: `heat_wave`); wartet, bis die Schwaden das Brett erfasst haben. */
async function heissWindBild(engine, owner) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'heat_wave', zoneType: 'board', owner, heroIdx: -1, zoneSlot: -1, duration: 2800,
  });
  await engine._delay(1300);
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  // Negiert, bevor der Effekt lief: dasselbe Bild, EIN Broadcast.
  async spellVisual(engine, info) {
    if (info.schonGezeigt?.zone?.has('heat_wave')) return;   // der Effekt hat es schon gespielt
    await heissWindBild(engine, info.heroOwner ?? info.owner ?? 0);
  },

  /**
   * Gate the card out of hand-playability when it would do literally
   * nothing. Over-inclusive on caster identity (see header), which is
   * fine — the worst case is showing the card as playable when only
   * the caster's own hero would qualify, which is still a legal cast
   * (the spell just does nothing to that slot either way).
   */
  spellPlayCondition(gs, playerIdx, engine) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    // casterHeroIdx = -1 → nothing is excluded. The gate only cares
    // "would SOMETHING happen to at least one target?".
    const pool = collectTargets(engine, playerIdx, -1);
    if (pool.length === 0) return false;
    const damageLocked = !!ps.damageLocked;
    for (const t of pool) {
      const burned = targetIsBurned(engine, t);
      const canBurn = targetCanBeBurned(engine, t, playerIdx);
      if (damageLocked) {
        // Only the burn leg is live. Need a non-burned, non-immune target.
        if (canBurn) return true;
      } else {
        // Either a new burn or a damage-the-already-burned hit counts.
        if (canBurn || burned) return true;
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      if (!ps) return;
      const damageLocked = !!ps.damageLocked;

      // Der Anwender steht in seiner physischen Spalte (geliehener Held).
      const targets = collectTargets(engine, ctx.cardHeroOwner ?? pi, heroIdx);
      if (targets.length === 0) return;

      // ── Animation: heisse rote Winde mit Flammen, die das ganze Brett einhuellen ──
      // (Als Vorgabe 3.10.) Brettweit, EIN Broadcast — laeuft VOR dem Reaktionsfenster;
      // wird der Zauber danach negiert, spielt die Engine kein zweites Bild (`bilderGespielt`).
      await heissWindBild(engine, ctx.cardHeroOwner ?? pi);

      // ── Resolve effects ──
      // Snapshot burn-state BEFORE any status/damage application so the
      // "already Burned?" test isn't muddled by this card's own burns.
      // (A target that becomes Burned mid-resolution should NOT then
      // take 150 damage from a later iteration — card text is "already
      // Burned", meaning prior to this cast.)
      const preBurned = targets.map(t => targetIsBurned(engine, t));

      // AoE-Prinzip (markieren/Immunität → reagieren → wirken → Tode): alle Ziele
      // werden getroffen (auch immune, nur für die Animation), schon Brennende nehmen
      // Schaden, die anderen bekommen Burned — das läuft in `wirkung`, VOR den Toden.
      const quelle = { name: CARD_NAME, owner: pi, heroIdx, heroOwner: ctx.cardHeroOwner ?? pi };   // Als Befund 29.9.: Brettseite des Wirkers
      const ziele = targets.map((t, i) => {
        const amount = (preBurned[i] && !damageLocked) ? DAMAGE : 0;
        return t.type === 'hero'
          ? { type: 'hero', owner: t.owner, heroIdx: t.heroIdx, amount }
          : { type: 'creature', inst: engine.cardInstances.find(c => c.id === t.inst.id), amount };
      });
      await engine.dealDamageToTargets({ ...quelle, cardInstance: ctx.card }, ziele, {
        damage: DAMAGE, damageType: 'destruction_spell', sourceName: CARD_NAME,
        istFlaeche: true, hitDelay: 0, bilderGespielt: true,
        wirkung: async () => {
          for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            if (preBurned[i] || !targetCanBeBurned(engine, t, pi)) continue;
            if (t.type === 'hero') {
              await engine.addHeroStatus(t.owner, t.heroIdx, 'burned', {
                permanent: true, appliedBy: pi, _skipReactionCheck: true,
              });
            } else {
              const inst = engine.cardInstances.find(c => c.id === t.inst.id);
              if (inst && inst.zone === 'support') {
                const applied = await engine.applyCreatureStatus(inst, 'burned', {
                  sourceOwner: pi, source: CARD_NAME,
                });
                if (applied) engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: CARD_NAME });
              }
            }
          }
        },
      });

      engine.log('heat_wave', {
        player: ps.username,
        damageLocked,
        targetCount: targets.length,
      });
      engine.sync();
    },
  },
};
