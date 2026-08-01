// ═══════════════════════════════════════════
//  CARD EFFECT: "Infected Greatmaw"
//  Creature (Summoning Magic, Lv1, Normal) — 50 HP
//  Archetype: Greatmaw
//
//  "You may once per turn sacrifice another Creature you control that
//   was not summoned this turn to choose a target and deal damage
//   equal to the Attack stat of one of your Heroes to it. That is
//   treated as that Hero hitting the target with an Attack."
//
//  • Once-per-turn = the engine's default per-instance `creatureEffect`
//    soft HOPT (two Infected Greatmaws each get one use).
//  • "another Creature" — `resolveSacrificeCost` auto-excludes the
//    activating Creature's own instance, so Infected can't tribute
//    itself. The "not summoned this turn" restriction (+ the Greatmaw
//    Siren / Remora relaxations) come from `buildGreatmawSacSpec`.
//  • Flow (per design): choose Hero → choose target → pay the
//    sacrifice → THEN the Reaction window. The sacrifice is paid in
//    `promptDamageTarget`'s `onTargetChosen` hook — AFTER the target
//    is chosen, BEFORE the redirect / surprise / post-target windows
//    open — so the opponent can never commit Reactions / resources to
//    an effect the player then backs out of.
//  • "Treated as that Hero hitting the target with an Attack" —
//    `attackerSourceOverride` makes the reaction windows AND the
//    damage attribute the hit to the CHOSEN Hero, so retaliation
//    (Booby Trap, Fireshield, …) punishes that Hero, not Infected.
// ═══════════════════════════════════════════

const { buildGreatmawSacSpec } = require('./_greatmaw-shared');

const CARD_NAME = 'Infected Greatmaw';

/** Living Heroes `pi` controls — eligible ATK sources. */
function livingHeroes(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (h?.name && h.hp > 0) out.push({ heroIdx: hi, hero: h });
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  cpuMeta: {
    // ── ATK-Umsetzer ────────────────────────────────────────────────
    // Verwandelt 1×/Zug je Instanz die ATK eines eigenen Helden in
    // Schaden. Datengrundlage des Angriffswert-Terms in evaluateState:
    // ohne mindestens einen deklarierten Umsetzer (oder eine
    // Attack-Karte auf der Hand) ist ATK dort wertlos — genau richtig,
    // weil ein Held ohne Ausschütter seine ATK nie zu Schaden macht.
    atkConversionsPerTurn: 1,

    // ── Wincondition-Boden (Designer-Vorgabe) ───────────────────────
    // Der einzige wiederholbare Ausschütter des Decks. Gemessen
    // (1268 Spiele) WR nach Aktivierungen: 0-2 → 12-13%, 3 → 28%,
    // 4 → 48%, 5+ → 45%; Schnitt lag bei 2.23 Aktivierungen/Spiel.
    // Gelernter Wert 57.9 — schon der höchste im Deck, aber nicht
    // deutlich genug, um im Gratis-Pfad und in der Tutor-Wahl zu
    // gewinnen. Wirkt nur nach oben.
    cardValueFloor: 70,
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Need a Hero to source the damage and a legal tribute (self is
    // auto-excluded by resolveSacrificeCost → satisfies "another").
    if (livingHeroes(engine, pi).length === 0) return false;
    const spec = buildGreatmawSacSpec(engine, pi);
    return engine.canSatisfySacrifice(pi, spec, ctx.card?.id);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // ── Step 1: choose one of your Heroes (the "attacker") ──
    const heroes = livingHeroes(engine, pi);
    if (heroes.length === 0) return false;

    let attacker;
    if (heroes.length === 1) {
      attacker = heroes[0];
    } else {
      const targets = heroes.map(h => ({
        id: `hero-${pi}-${h.heroIdx}`,
        type: 'hero', owner: pi, heroIdx: h.heroIdx, cardName: h.hero.name,
      }));
      const picked = await ctx.promptTarget(targets, {
        title: CARD_NAME,
        description: 'Choose one of your Heroes. The target takes damage equal to that Hero’s Attack.',
        confirmLabel: '🦷 Choose Hero!',
        confirmClass: 'btn-info',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
        _skipRedirectCheck: true, // choosing your own Hero is not a redirectable "target"
      });
      if (!picked || picked.length === 0) return false;
      attacker = heroes.find(h => `hero-${pi}-${h.heroIdx}` === picked[0]);
      if (!attacker) return false;
    }
    const attackerHeroIdx = attacker.heroIdx;

    // Sacrifice spec — paid inside `onTargetChosen` below.
    const spec = buildGreatmawSacSpec(engine, pi, {
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice another Creature you control to fuel the strike.',
      confirmLabel: '🗡️ Sacrifice!',
    });

    // ── Step 2: choose the target ──
    // The sacrifice is paid via `onTargetChosen` — AFTER the target is
    // picked, BEFORE the reaction windows. `attackerSourceOverride`
    // makes redirect / surprise / post-target reactions (and the
    // retaliation they drive) see the chosen Hero as the attacker.
    let paid = false;
    const atkPreview = Math.max(0, attacker.hero.atk || 0);
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'attack',
      baseDamage: atkPreview,
      title: CARD_NAME,
      description: `Deal ${attacker.hero.name}’s Attack (${atkPreview}) to a target as ${attacker.hero.name}’s Attack.`,
      confirmLabel: `💥 Strike! (${atkPreview})`,
      confirmClass: 'btn-danger',
      cancellable: true,
      noSpellCancel: true, // Infected is a Creature effect, not a Spell
      attackerSourceOverride: {
        name: attacker.hero.name, owner: pi, controller: pi,
        heroIdx: attackerHeroIdx, zone: 'hand', _heroAttackSource: true,
      },
      onTargetChosen: async () => {
        // Idempotent — a dead-target retarget re-enters promptDamageTarget.
        if (paid) return true;
        paid = await engine.resolveSacrificeCost(ctx, spec);
        return paid;
      },
    });

    if (!target) {
      // Null = the player cancelled, OR the effect was negated by a
      // post-sacrifice reaction (Booby Trap killed the attacker, etc.).
      // If the sacrifice was already paid, the use IS spent (claim HOPT
      // by returning true); a pre-sacrifice cancel returns false.
      return paid;
    }

    // ── Step 3: deal the damage as that Hero's Attack ──
    // The sacrifice + surprise window already resolved inside
    // promptDamageTarget; actionDealDamage skips the re-check via
    // `_surpriseCheckedHeroes`. Re-read the Hero live — a reaction
    // could have changed its ATK or killed it.
    const hero = gs.players[pi]?.heroes?.[attackerHeroIdx];
    if (!hero || hero.hp <= 0) {
      engine.log('infected_greatmaw_fizzle', { player: ps.username, reason: 'hero_gone' });
      engine.sync();
      return true; // cost paid — effect fizzles but the use is spent
    }
    const damage = Math.max(0, hero.atk || 0);
    // "Treated as that Hero hitting the target with an Attack" — the
    // damage source is the Hero, type 'attack', so afterDamage-style
    // retaliation (Fireshield) routes to the Hero, not Infected.
    const source = { name: hero.name, owner: pi, heroIdx: attackerHeroIdx };

    // Re-resolve the live target — a reaction could have moved or
    // killed it between the pick and here.
    let tHero = null, tInst = null;
    if (target.type === 'hero') {
      tHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!tHero || tHero.hp <= 0) { engine.sync(); return true; }
    } else if (target.cardInstance) {
      tInst = engine.cardInstances.find(c => c.id === target.cardInstance.id);
      if (!tInst || tInst.zone !== 'support') { engine.sync(); return true; }
    } else {
      engine.sync();
      return true;
    }

    // ── Ram animation ──
    // The chosen Hero physically charges the target and returns — the
    // same visual The Yeeting / Phoenix Tackle use, reinforcing that
    // this hit is "that Hero attacking".
    const tgtHeroIdx = tInst ? tInst.heroIdx : target.heroIdx;
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner: pi, sourceHeroIdx: attackerHeroIdx,
      targetOwner: target.owner, targetHeroIdx: tgtHeroIdx,
      targetZoneSlot: tInst ? tInst.zoneSlot : undefined,
      cardName: hero.name, duration: 1200,
    });
    await engine._delay(150); // Hero reaches the target at ~12% of 1200ms

    // Impact at the moment of contact.
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: target.owner,
      heroIdx: tgtHeroIdx, zoneSlot: tInst ? tInst.zoneSlot : -1,
    });
    await engine._delay(200);

    // Damage, dealt as that Hero's Attack.
    if (tHero) {
      await engine.actionDealDamage(source, tHero, damage, 'attack');
    } else if (tInst) {
      await engine.actionDealCreatureDamage(
        source, tInst, damage, 'attack',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('infected_greatmaw', {
      player: ps.username, hero: hero.name, damage,
      target: target.cardName || target.type,
    });
    engine.sync();
    return true;
  },
};
