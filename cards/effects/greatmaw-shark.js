// ═══════════════════════════════════════════
//  CARD EFFECT: "Greatmaw Shark"
//  Creature (Summoning Magic, Lv1, Normal) — 80 HP
//  Archetype: Greatmaw
//
//  "You may once per turn sacrifice a Creature you control that was
//   not summoned this turn to increase the Attack stat of a Hero you
//   control by 100 until the end of the turn. You can only use this
//   effect of "Greatmaw Shark" once per turn."
//
//  The doubled "once per turn" is a HARD once-per-turn shared across
//  every Greatmaw Shark the player controls — even with 2+ Sharks,
//  only one Shark may fire, once. Wired with a shared `claimHOPT`
//  key `greatmaw_shark_effect:<pi>` (the engine's own per-instance
//  `creature-effect:<id>` HOPT still applies on top).
//
//  The sacrifice cost — including the "not summoned this turn"
//  restriction and the Greatmaw Siren / Remora relaxations — is built
//  by `_greatmaw-shared.buildGreatmawSacSpec` and resolved through the
//  engine's `resolveSacrificeCost`. The +100 ATK is granted via
//  `engine.grantTempHeroAtk` — recorded on the HERO, not on Shark —
//  so it lasts the full turn even if Shark is itself sacrificed
//  afterwards (e.g. fed to Infected Greatmaw). `_processBuffExpiry`
//  revokes it at the start of the opponent's next turn.
// ═══════════════════════════════════════════

const { buildGreatmawSacSpec } = require('./_greatmaw-shared');

const CARD_NAME = 'Greatmaw Shark';
const ATK_BONUS = 100;

// Shared HARD once-per-turn across every Greatmaw Shark a player
// controls. NOTE: `engine.claimHOPT(key, pi)` stores the claim under
// `${key}:${pi}` — it appends the player index itself. So the claim
// passes the BARE key and the peek appends ":<pi>" to match.
const SHARK_HOPT_KEY = 'greatmaw_shark_effect';
const sharkHoptUsed = (engine, pi) =>
  engine.gs.hoptUsed?.[`${SHARK_HOPT_KEY}:${pi}`] === engine.gs.turn;

/** Living Heroes `pi` controls — eligible buff targets. */
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

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Shared HARD once-per-turn — any Shark already fired this turn.
    if (sharkHoptUsed(engine, pi)) return false;
    // Need a Hero to buff and a legal tribute.
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

    // Defensive shared-HOPT recheck (another Shark could have fired in
    // an interleaved reaction window).
    if (sharkHoptUsed(engine, pi)) return false;

    // ── Step 1: choose which Hero you control to buff ──
    const heroes = livingHeroes(engine, pi);
    if (heroes.length === 0) return false;

    let chosen;
    if (heroes.length === 1) {
      chosen = heroes[0];
    } else {
      const targets = heroes.map(h => ({
        id: `hero-${pi}-${h.heroIdx}`,
        type: 'hero', owner: pi, heroIdx: h.heroIdx, cardName: h.hero.name,
      }));
      const picked = await ctx.promptTarget(targets, {
        title: CARD_NAME,
        description: `Choose a Hero you control to gain +${ATK_BONUS} Attack until the end of the turn.`,
        confirmLabel: `🦈 Empower! (+${ATK_BONUS})`,
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
      });
      if (!picked || picked.length === 0) return false;
      chosen = heroes.find(h => `hero-${pi}-${h.heroIdx}` === picked[0]);
      if (!chosen) return false;
    }

    // ── Step 2: pay the sacrifice cost ──
    // Cancelling the picker returns false here → HOPT stays unclaimed.
    const spec = buildGreatmawSacSpec(engine, pi, {
      title: `${CARD_NAME} — Sacrifice`,
      description: `Sacrifice a Creature you control to give ${chosen.hero.name} +${ATK_BONUS} Attack.`,
      confirmLabel: '🗡️ Sacrifice!',
    });
    const paid = await engine.resolveSacrificeCost(ctx, spec);
    if (!paid) return false;

    // ── Step 3: grant the ATK until the end of the turn ──
    // grantTempHeroAtk records the grant ON THE HERO (not on Shark),
    // so it survives Shark itself being sacrificed mid-turn — e.g.
    // fed to Infected Greatmaw. `_processBuffExpiry` revokes it at the
    // start of the opponent's next turn ("rest of this turn").
    const hero = gs.players[pi]?.heroes?.[chosen.heroIdx];
    if (!hero || hero.hp <= 0) return false;
    engine.grantTempHeroAtk(pi, chosen.heroIdx, ATK_BONUS, {
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: pi === 0 ? 1 : 0,
      source: CARD_NAME,
    });

    // ── Step 4: claim the shared hard-once-per-turn ──
    // claimHOPT stores under `${key}:${pi}` — pass the bare key.
    engine.claimHOPT(SHARK_HOPT_KEY, pi);

    engine.log('greatmaw_shark', {
      player: ps.username, hero: hero.name, amount: ATK_BONUS,
    });
    engine.sync();
    return true;
  },
};
