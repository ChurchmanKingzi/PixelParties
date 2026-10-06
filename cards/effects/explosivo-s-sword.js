// ═══════════════════════════════════════════
//  CARD EFFECT: "Explosivo's Sword"
//  Artifact (Equipment, Cost 12 — Banned)
//
//  ① Equipped Hero gains +10 ATK.
//  ② If the equipped Hero DEFEATS a target with
//     an Attack, deal 100 damage to all OTHER
//     targets your opponent controls (every alive
//     opponent Hero + every opponent Creature,
//     except the just-defeated one).
//  ③ "This effect can only occur once per turn"
//     — a HARD, player-wide once-per-turn. Even
//     with 2+ Explosivo's Swords on the same Hero
//     (legal — no per-Hero cap) OR spread across
//     several of the controller's Heroes, the
//     explosion fires exactly ONCE per turn for
//     that player. Implemented via
//     `engine.claimHOPT('explosivo-sword', pi)` —
//     the HOPT key is FIXED (not card-instance /
//     hero scoped), so every copy that player
//     controls shares the same per-turn slot, and
//     it auto-resets each turn via the turn
//     counter.
//
//  ── "defeats a target with an Attack" detection ──
//  Mirrors the Blade of the Swamp Witch family
//  (the established ATK+10 on-Attack sword equip):
//    • Hero target  → `afterDamage`, gated on
//      `ctx.type === 'attack'` + source == equipped
//      Hero. At afterDamage time the hero's HP is
//      already applied, so `target.hp <= 0` ⇒ the
//      Attack defeated it (same signal Swamp Witch
//      uses to detect a still-alive target).
//    • Creature target → `afterCreatureDamageBatch`,
//      per-entry gated on `e.type === 'attack'` +
//      source == equipped Hero, with
//      `e.inst.counters.currentHp <= 0` ⇒ defeated.
//  A Creature hosted on the equipped Hero's Support
//  Zone shares the Hero's heroIdx but is its own
//  damage source — those carry `source.zone ===
//  'support'`; the source-owner / sourceHeroIdx
//  match plus the absence of a support-zone source
//  keeps the trigger Hero-only (Swamp Witch relies
//  on the same source shape).
//
//  ── splash mechanics (Book of Doom scoping) ──
//  The 100 damage is an Artifact effect (type
//  'artifact'), NOT an Attack — so it does NOT
//  re-trigger Explosivo's Sword (the afterDamage /
//  batch gates require `type === 'attack'`), and
//  the HOPT is claimed BEFORE any splash damage as
//  a second re-entrancy guard.
//
//  Scoped exactly like **Book of Doom** (the other
//  mass-damage Artifact): the damage SOURCE is a
//  synthetic `{ name, owner, heroIdx: -1 }` — there
//  is NO host Hero behind this explosion. The
//  engine's standard per-Hero Surprise window
//  (`actionDealDamage`, ~line 4305) is gated on
//  `source.heroIdx >= 0`, so a Booby Trap (and any
//  Surprise whose `surpriseTrigger` needs an
//  attacking/casting Hero — `gs.players[
//  sourceInfo.owner].heroes[sourceInfo.heroIdx]`)
//  simply never opens on the splash. We do NOT pass
//  `skipSurpriseCheck` — that would also kill
//  legitimate damage-mitigation Surprises (Banner
//  Bearer's "with a card or effect" reduction). The
//  -1 heroIdx is the precise, engine-blessed lever:
//  attacker-requiring Surprises are excluded;
//  damage-mitigation paths still fire.
//
//  Damage-mitigation HAND reactions (Spectral Armor
//  / Sculpture Guards / Bamboo Shield) run through
//  the SEPARATE post-target window
//  (`preDamageMultiTargetWindow`, source-agnostic),
//  so they still apply and let the mitigating player
//  pick a target to reduce/prevent — exactly the
//  intended interaction.
//
//  Damage is otherwise routed through the standard
//  pipeline (`preDamageMultiTargetWindow` → per-hero
//  `actionDealDamage` → per-creature
//  `actionDealCreatureDamage`, all with the -1
//  synthetic source) so immunities, the post-target
//  mitigation window, Banner-Bearer-style damage
//  Surprises and post-death cleanup all compose
//  normally.
//
//  Diver Helmet is NOT consulted — it only grants
//  immunity to AREAS; Explosivo's Sword is an
//  Equipment's triggered damage, not an Area.
// ═══════════════════════════════════════════

const CARD_NAME = 'Explosivo\'s Sword';
const ATK_BONUS = 10;
const SPLASH_DAMAGE = 100;
const HOPT_KEY = 'explosivo-sword';

/**
 * Deal SPLASH_DAMAGE to every OTHER target the opponent controls
 * (alive Heroes + Creatures), excluding the just-defeated target.
 * Claims the shared player-wide HOPT first — bails (no effect) if
 * another Explosivo's Sword already exploded for this player this
 * turn. `excludeKey` identifies the defeated target so it is never
 * re-hit (heroes already drop out of getHeroTargets at hp<=0 and a
 * dead Creature is untracked out of getCreatureTargets — the explicit
 * filter is belt-and-suspenders).
 */
async function _explode(ctx, excludeKey) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;

  // ③ Hard, player-wide once per turn — shared by every copy this
  // player controls. Claim BEFORE dealing any damage so the splash's
  // own afterDamage / batch hooks can never re-enter.
  if (!engine.claimHOPT(HOPT_KEY, pi)) return;

  const oppIdx = engine.opponentOf(pi);

  // Kontrolle statt Seite (Styx 28.9.) — „all other targets your
  // opponent controls"; `owner` bleibt die physische Spalte.
  const heroTargets = engine.heroesControlledBy(oppIdx)
    .filter(({ hero }) => hero.hp > 0)
    .map(({ physOwner, heroIdx }) => ({ owner: physOwner, heroIdx }))
    .filter(t => `hero-${t.owner}-${t.heroIdx}` !== excludeKey);
  const creatureTargets = engine.getCreatureTargets(oppIdx)
    .map(t => t.cardInstance)
    .filter(inst => inst && inst.zone === 'support' && !inst.faceDown
      && `creature-${inst.id}` !== excludeKey);

  if (heroTargets.length === 0 && creatureTargets.length === 0) {
    engine.log('explosivo_sword_fizzle', {
      player: gs.players[pi]?.username, reason: 'no other opponent targets',
    });
    return;
  }

  // Source = synthetic, host-Hero-less (`heroIdx: -1`) — the Book of
  // Doom pattern. This is the lever that keeps attacker-requiring
  // Surprises (Booby Trap) from chaining onto the explosion while
  // leaving damage-mitigation paths intact (see header). NOT
  // `ctx.card`: the Sword instance carries the equipped Hero's
  // heroIdx, which would (wrongly) make this read as that Hero
  // dealing the damage and open its per-Hero Surprise window.
  const source = { name: CARD_NAME, owner: pi, heroIdx: -1 };

  // AoE-Prinzip (markieren/Immunität → reagieren → wirken → Tode): NUR dieser
  // 100er-Splash ist ein Flächenschlag — der Angriffsschaden des Trägers läuft getrennt.
  // Surprises/Hand-Reaktionen reagieren VOR dem ersten Schaden; die Explosionen laufen
  // auf allen Zielen gleichzeitig.
  const ziele = [
    ...heroTargets.map(ht => ({ type: 'hero', owner: ht.owner, heroIdx: ht.heroIdx })),
    ...creatureTargets.filter(i => i && i.zone === 'support').map(inst => ({ type: 'creature', inst })),
  ];
  await engine.dealDamageToTargets(source, ziele, {
    damage: SPLASH_DAMAGE, damageType: 'artifact', sourceName: CARD_NAME,
    animationType: 'explosion', animDelay: 450, hitDelay: 0, istFlaeche: true,
  });

  engine.log('explosivo_sword', {
    player: gs.players[pi]?.username,
    heroes: heroTargets.length,
    creatures: creatureTargets.length,
  });
  engine.sync();
}

module.exports = {
  // Equipment-artifact convention (Blade of the Swamp Witch / Wanted
  // Poster): placement is driven by the cards.json "Equipment" subtype;
  // the script only handles the ATK grant + the triggered effect, and
  // listens from the Support Zone it's equipped into.
  activeIn: ['support'],

  hooks: {
    // ── ① +10 ATK while equipped ──
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },

    // Re-grant on load if a tracked instance didn't carry the grant
    // (game restore / mid-game script load) — same guard Swamp Witch
    // uses so a re-grant never stacks on an already-granted instance.
    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },

    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if ((ctx.fromOwner !== ctx.cardOwner && ctx.fromOwner !== ctx.cardHeroOwner)   // Styx 28.9.: Brettseite
          || ctx.fromHeroIdx !== ctx.card.heroIdx
          || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },

    // ── ② Equipped Hero defeats a HERO with an Attack ──
    // afterDamage fires after the damage is applied (hp already
    // updated) and before ON_HERO_KO — the Swamp Witch timing. Gate on
    // attack damage sourced by THIS equipped Hero, target reduced to 0.
    afterDamage: async (ctx) => {
      if (ctx.type !== 'attack') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      // Styx 28.9.: „dieser Held" = Brettseite + Index (geliehener Held).
      if (!ctx._engine.quelleIstHeld(ctx.source, ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx)) return;
      // A Creature hosted on the equipped Hero's slot shares heroIdx
      // but is its own source — exclude (Hero-only trigger).
      if (ctx.source?.zone === 'support') return;

      const target = ctx.target;
      // Hero objects have `.statuses`; creatures are handled in the
      // batch hook below. Only fire on a Hero the Attack defeated.
      if (!target || target.hp === undefined || !target.statuses) return;
      if (target.hp > 0) return;

      // Identify the defeated hero so the splash never re-hits it.
      let excludeKey = null;
      for (let tpi = 0; tpi < ctx._engine.playerCount(); tpi++) {
        const hs = ctx._engine.gs.players[tpi]?.heroes || [];
        const hi = hs.indexOf(target);
        if (hi >= 0) { excludeKey = `hero-${tpi}-${hi}`; break; }
      }

      await _explode(ctx, excludeKey);
    },

    // ── ② Equipped Hero defeats a CREATURE with an Attack ──
    // Batch hook fires after the death loop; a defeated creature's
    // instance still reads counters.currentHp <= 0.
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.entries) return;

      for (const e of ctx.entries) {
        if (e.type !== 'attack') continue;
        if ((e.source?.heroIdx ?? -1) !== ctx.cardHeroIdx) continue;
        // Styx 28.9.: „dieser Held" = Brettseite + Index (geliehener Held).
        if (!ctx._engine.quelleIstHeld(e.source, ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx)) continue;
        if (e.source?.zone === 'support') continue;
        const inst = e.inst;
        if (!inst || (inst.counters?.currentHp ?? 1) > 0) continue;

        // A Creature this equipped Hero's Attack defeated → explode.
        // claimHOPT inside _explode dedupes if multiple entries (or
        // the hero-path above) already fired this turn.
        await _explode(ctx, `creature-${inst.id}`);
        return;
      }
    },
  },
};
