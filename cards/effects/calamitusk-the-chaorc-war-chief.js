// ═══════════════════════════════════════════
//  HERO: "Calamitusk, the Chaorc War Chief"
//  HP 450 / ATK 90.  Starting abilities: Cannibalism, Leadership.
//  Archetype: Chaorcs  (Banned)
//
//  Hero Effect (free — costs no Action, hence "additional"; once per
//  turn):
//    Sacrifice a Creature you control that was NOT summoned this turn
//    → summon a "Chaorc" Creature with a DIFFERENT NAME from your hand
//    or deck into Calamitusk's column. That Creature has its level
//    reduced by 1.
//
//  Crucially, Calamitusk must himself be CAPABLE of summoning the
//  replacement at the reduced level — we gate every candidate on
//  `heroMeetsLevelReq` against a level-(N-1) copy of the card (plus the
//  Creature's own `canSummon`). A Chaorc he couldn't otherwise afford
//  becomes summonable once the -1 brings it within his school level.
//
//  Built on the Garius template:
//   • Sacrifice is paid through `engine.resolveSacrificeCost` (so the
//     engine's per-turn sacrifice tally + `_sacrificedTurn` stamp fire,
//     keeping every Chaorc payoff — Pyre's free-summon gate, Ruin
//     Mourner's level drop, Corpse Cannibal's resummon — consistent
//     with sacrifices from any other source).
//   • The replacement gallery + summon run in `onResolved`, AFTER the
//     tribute has left the board (so a tribute in Calamitusk's own
//     column frees the slot the replacement lands in).
//   • The shared Chaorc filter applies, so Chaorc Cannon Fodder may be
//     tributed even the turn it was summoned.
// ═══════════════════════════════════════════

const {
  chaorcSacrificeFilter, chaorcFreshSacCandidates,
  isChaorcCreature, firstFreeSupportSlot,
} = require('./_chaorcs-shared');

const CARD_NAME = 'Calamitusk, the Chaorc War Chief';

/** Can Calamitusk (at `calaHi`) summon `name` with its level reduced by
 *  1? Gates school/level on a -1 copy, plus the Creature's own
 *  `canSummon`. */
function canSummonReduced(engine, pi, calaHi, name) {
  if (!isChaorcCreature(name, engine)) return false;
  const cd = engine._getCardDB()[name];
  if (!cd) return false;
  const reduced = { ...cd, level: Math.max(0, (cd.level || 0) - 1) };
  if (!engine.heroMeetsLevelReq(pi, calaHi, reduced)) return false;
  if (!engine.isCreatureSummonable(name, pi, calaHi, { _bypassBeforeSummon: true })) return false;
  return true;
}

/** Distinct summonable Chaorc replacements (name != excludeName) from
 *  hand + deck, deduped by name (hand preferred for the splice). */
function replacements(engine, pi, calaHi, excludeName) {
  const ps = engine.gs.players[pi];
  const byName = new Map();
  for (const cn of (ps?.hand || [])) {
    if (cn === excludeName || byName.has(cn)) continue;
    if (canSummonReduced(engine, pi, calaHi, cn)) byName.set(cn, { name: cn, source: 'hand' });
  }
  for (const cn of (ps?.mainDeck || [])) {
    if (cn === excludeName || byName.has(cn)) continue;
    if (canSummonReduced(engine, pi, calaHi, cn)) byName.set(cn, { name: cn, source: 'deck' });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Sacrificing this tribute must (a) have ≥1 valid replacement and (b)
 *  leave Calamitusk a free Support slot — either one is free already,
 *  or the tribute sits in his column and frees one. */
function tributeViable(engine, pi, calaHi, c) {
  if (replacements(engine, pi, calaHi, c.cardName).length === 0) return false;
  return firstFreeSupportSlot(engine, pi, calaHi) >= 0 || c.inst.heroIdx === calaHi;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const calaHi = ctx.cardHeroIdx;
    return chaorcFreshSacCandidates(engine, pi, null)
      .some(c => tributeViable(engine, pi, calaHi, c));
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const calaHi = ctx.cardHeroIdx;
    const base = chaorcSacrificeFilter(engine);

    const paid = await engine.resolveSacrificeCost(ctx, {
      minCount: 1,
      maxCount: 1,
      title: `${CARD_NAME} — Cannibalize`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn) to summon a different-named Chaorc Creature with its level reduced by 1.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      filter: (c) => base(c) && tributeViable(engine, pi, calaHi, c),

      onResolved: async (_ctx, picked) => {
        const sacName = picked?.[0]?.cardName;
        // The tribute is gone — recompute the (now-free) slot in
        // Calamitusk's column.
        const slot = firstFreeSupportSlot(engine, pi, calaHi);
        if (slot < 0) { engine.sync(); return; }

        const opts = replacements(engine, pi, calaHi, sacName);
        if (opts.length === 0) { engine.sync(); return; }

        let chosen = opts[0];
        if (opts.length > 1) {
          const res = await engine.promptGeneric(pi, {
            type: 'cardGallery',
            cards: opts.map(o => ({ name: o.name, source: o.source })),
            title: CARD_NAME,
            description: `Summon which Chaorc Creature (other than ${sacName})? Its level is reduced by 1.`,
            confirmLabel: '⚔️ Summon!',
            cancellable: false,
          });
          chosen = opts.find(o => o.name === res?.cardName) || opts[0];
        }

        const pile = chosen.source === 'deck' ? ps.mainDeck : ps.hand;
        const idx = pile.indexOf(chosen.name);
        if (idx < 0) { engine.sync(); return; }
        pile.splice(idx, 1);
        if (chosen.source === 'deck') engine.shuffleDeck(pi);

        // Diese Beschwoerung wurde mit einem Opfer bezahlt (Als Ruling
        // 8.8.) — `hookExtras._tributePaid` meldet das an Trigger wie
        // Rubin, the Dragoneer Champion. Der Stempel aus
        // `_runBeforeSummon` greift hier nicht: das Opfer lief in
        // DIESEM Effekt, nicht in den Kosten der beschworenen Karte.
        const summon = await engine.summonCreatureWithHooks(
          chosen.name, pi, calaHi, slot,
          { source: CARD_NAME, hookExtras: { _tributePaid: true } },
        );
        if (!summon?.inst) {
          // Placement fizzled — refund the fetched card.
          pile.push(chosen.name);
          if (chosen.source === 'deck') engine.shuffleDeck(pi);
          engine.sync();
          return;
        }

        // "that Creature has its level reduced by 1." Silent — the -1 is
        // part of the summon, not a standalone level-down to flag with a
        // floating indicator above the new Creature.
        await engine.actionChangeLevel(summon.inst, -1, { silent: true });

        engine.log('calamitusk_summon', {
          player: ps.username, sacrificed: sacName,
          summoned: chosen.name, from: chosen.source,
        });
        engine.sync();
      },
    });

    return !!paid;
  },
};
