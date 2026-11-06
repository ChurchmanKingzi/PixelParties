// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Niu" (Ox)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): delete up to 5 cards from
//    the discard piles → the NEXT Attack that ANY of
//    YOUR Heroes performs this turn deals +50 damage
//    per card deleted.
//    Als Ruling (Al 26.10.): „Ja, Niu stärkt die nächste
//    Attack, egal, wer angreift" — der Bonus hängt NICHT
//    an einem vorab gewählten Helden; es gibt keine
//    Heldenwahl mehr. Technisch tragen alle eigenen,
//    lebenden Helden denselben „Niu-Enhanced"-Buff
//    (`totalDamage`/`stacks`); die Engine löst ihn bei der
//    ersten Attack-Schadensrechnung irgendeines dieser
//    Helden ein und räumt ihn bei ALLEN eigenen Helden ab
//    (`_niuBonusEinloesen` in `actionDealDamage` /
//    `processCreatureDamageBatch`). Er verfällt zu Beginn
//    des nächsten Gegnerzugs (= funktional „Ende dieses
//    Zugs"). Mehrfach-Aktivierungen im selben Zug stapeln
//    (`totalDamage`/`stacks` addieren sich).
//
//  Niu does NOT need to remain on the board —
//  the buff lives on the Heroes, not on
//  Niu's instance, so Niu dying mid-turn doesn't
//  cancel the bonus.
//
//  Stacking semantics: the same buff key
//  (`niu_enhanced`) is reused; we read the existing
//  buff's totalDamage/stacks and merge before
//  re-applying. `actionAddBuff` overwrites the
//  whole entry, so the merge has to happen here.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  rangeValidCounts,
} = require('./_guardian-beasts-shared');
const { ablageLoeschKostenMoeglich } = require('./_guardian-beasts-shared');   // v1398

const CARD_NAME = 'Guardian Beast Niu';
const MAX_DELETE = 5;
const DAMAGE_PER_CARD = 50;
const BUFF_NAME = 'niu_enhanced';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    // v1398 (Als Ruling 25.9.): Löschkosten aus der Ablage unter Knight-[B]-Lockdown → nicht aktivierbar.
    if (!ablageLoeschKostenMoeglich(ctx)) return false;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 1) return false;
    // Need at least one alive own Hero to receive the buff.
    // Kontrolle statt Seite (Styx 28.9.)
    return engine.heroesControlledBy(pi).some(e => e.hero.hp > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    const total = (gs.players[0]?.discardPile?.length || 0)
      + (gs.players[1]?.discardPile?.length || 0);
    const cap = Math.min(MAX_DELETE, total);
    if (cap <= 0) return false;

    // Step 1 — Als Ruling (Al 26.10.): KEINE Heldenwahl — der Bonus gilt für die nächste Attack
    // irgendeines eigenen Helden. Alle eigenen, lebenden Helden bekommen den Buff (Anzeige am Helden).
    // Kontrolle statt Seite (Styx 28.9.): IDs/Zugriffe physisch.
    const buffHeroes = [];
    for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(pi)) {
      if (h.hp <= 0) continue;
      buffHeroes.push({ hero: h, owner: physOwner, heroIdx: hi });
    }
    if (buffHeroes.length === 0) return false;

    // Step 2 — pay the cost. Click 1-cap cards directly in the gallery.
    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: rangeValidCounts(cap),
      title: CARD_NAME,
      description: `Pick 1-${cap} cards from the discard piles to delete. The next Attack one of your Heroes performs this turn deals +${DAMAGE_PER_CARD} damage per deleted card.`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0) return false;
    const earned = deleted.length * DAMAGE_PER_CARD;

    // Step 3 — apply the buff to ALL own alive Heroes. Stacking: read existing data and merge
    // before calling actionAddBuff (which overwrites the whole entry).
    // Expire at the START of the opponent's next turn (= functional
    // "end of THIS turn" — buff doesn't survive into a fresh own turn).
    const oi = engine.opponentOf(pi);
    let newTotal = 0, newStacks = 0;
    for (const { hero: bh, owner: bo, heroIdx: bi } of buffHeroes) {
      const existing = bh.buffs?.[BUFF_NAME];
      const total = (existing?.totalDamage || 0) + earned;
      const stacks = (existing?.stacks || 0) + 1;
      newTotal = Math.max(newTotal, total);
      newStacks = Math.max(newStacks, stacks);
      await engine.actionAddBuff(bh, bo, bi, BUFF_NAME, {
        sourceOwner: pi,   // v1067: Quelle ist Pflicht (siehe _affected-shared)
        totalDamage: total,
        stacks,
        perCardBonus: DAMAGE_PER_CARD,
        source: CARD_NAME,
        expiresAtTurn: gs.turn + 1,
        expiresForPlayer: oi,
        addAnim: 'niu_powerup',
      });
    }

    engine.log('guardian_beast_niu_buff', {
      player: ps.username, hero: buffHeroes.map(b => b.hero.name).join(', '),
      deleted: deleted.length, addedBonus: earned,
      totalBonus: newTotal, stacks: newStacks,
    });
    engine.sync();
    return true;
  },
};
