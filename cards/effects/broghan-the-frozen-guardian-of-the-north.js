// ═══════════════════════════════════════════
//  CARD EFFECT: "Broghan, the Frozen Guardian of the North"
//  Hero — Innate freeze immunity + once-per-turn
//  ranged attack that scales with deck depletion.
//
//  ① Cannot be Frozen (innate, applied at game
//    start and re-applied after revive).
//  ② Once per turn: choose any target and deal
//    max(10, 500 − 10 × cards-in-deck) damage as
//    an Attack. The −10×deck reduction is part of
//    the base damage formula, so effects that
//    "prevent damage reductions" can't undo it.
//  Animation: red laser beam (same as Alice).
// ═══════════════════════════════════════════

const CARD_NAME = 'Broghan, the Frozen Guardian of the North';

function applyFreezeImmunity(hero) {
  if (!hero) return;
  if (!hero.statuses) hero.statuses = {};
  hero.statuses.freeze_immune = { source: CARD_NAME, innate: true };
}

/**
 * W8 (Al, 14.10.2026: "Broghan ja"): "This Hero cannot be Frozen" ist ein laufender Passiv - solange Broghans Heldeneffekt ruht
 * (Frost/Betäubung/Negation, `_isHeroEffectSilenced`), entfällt die Immunität; nach dem Ende ist sie wieder da. Bereits
 * angewandter Frost bleibt. Der Stempel `freeze_immune` wird von mehreren Karten direkt gelesen, darum Stempel-Abgleich statt
 * Leser-Abfrage (W7a-Muster): `bypassStatusFilter` hält die Abgleich-Hooks am Laufen, der Zustand wird direkt gefragt. Nur der
 * eigene Stempel (source === Broghan) ruht; fremde Quellen (Heart of Ice, The Sun Sword …) bleiben unberührt.
 */
function abgleichen(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOriginalOwner, hi = ctx.cardHeroIdx;
  const hero = engine?.gs?.players?.[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return;
  if (engine._isHeroEffectSilenced(pi, hi)) {
    if (hero.statuses?.freeze_immune?.source === CARD_NAME) { delete hero.statuses.freeze_immune; engine.sync?.(); }
  } else if (!hero.statuses?.freeze_immune) {
    applyFreezeImmunity(hero);
  }
}

function computeDamage(deckSize) {
  return Math.max(10, 500 - 10 * deckSize);
}

module.exports = {
  // W26a (Al, Welle 26): als Attack geltender Heldeneffekt ohne Karte zählt für Stufen-Bedingungen ("level X or lower": Glass Wall, Test Flight, Future Tech Escape Device) als LEVEL 0 (Engine: `_heldenEffektStufe`).
  treatedAsAttack: { level: 0 },
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hero'],
  // W8: nur für den Stempel-Abgleich (alle Hooks dieser Karte betreffen ausschließlich `freeze_immune`; die Aktivierung des
  // Heldeneffekts läuft nicht über den Verteiler). Die Immunität ruht trotzdem - `abgleichen` fragt den Zustand selbst.
  bypassStatusFilter: true,
  heroEffect: true,
  // Rein schaedlich: 500 Schaden (deckabhaengig reduziert) auf ein Ziel.
  // Unter dem Spielstart-Schutz nicht nutzbar (Als Ruling 8.8.).
  heroEffectHarmfulOnly: true,

  // CPU heuristic — late-game ranged damage that grows as the deck thins.
  supportYield(ctx) {
    const { engine, pi } = ctx;
    const deckSize = engine.gs.players[pi]?.mainDeck?.length || 0;
    return { damagePerTurn: computeDamage(deckSize) };
  },

  // Always activatable — there's always a target on the board (if not, the
  // engine will fizzle the prompt).
  canActivateHeroEffect(_ctx) {
    return true;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = engine.gs.players[pi];
    const deckSize = ps?.mainDeck?.length || 0;
    const damage = computeDamage(deckSize);

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'attack',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage as an Attack (500 − 10 × ${deckSize} card${deckSize !== 1 ? 's' : ''} in deck, min 10).`,
      confirmLabel: `❄️ Strike! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!target) return false; // Cancelled

    // Red laser beam — same animation Alice uses.
    const targetZoneSlot = target.type === 'equip' ? target.slotIdx : -1;
    engine._broadcastEvent('play_beam_animation', {
      sourceOwner: ctx.cardHeroOwner,
      sourceHeroIdx: heroIdx,
      targetOwner: target.owner,
      targetHeroIdx: target.heroIdx,
      targetZoneSlot,
      color: '#ff2222',
      duration: 1500,
    });
    await engine._delay(400);

    // Damage type 'attack' so Fighting / Toughness / Sun Sword burn /
    // Ghuanjun's cap and other attack-keyed hooks fire normally.
    // usesHeroAtk is left false because the damage is a fixed formula,
    // not derived from hero.atk.
    const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi,
      ...(ctx.cardHeroOwner != null && ctx.cardHeroOwner !== pi ? { heroOwner: ctx.cardHeroOwner } : {}) };   // Styx 28.9.: Brettseite des Angreifers

    if (target.type === 'hero') {
      const targetHero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (targetHero && targetHero.hp > 0) {
        await engine.actionDealDamage(attackSource, targetHero, damage, 'attack');
      }
    } else if (target.type === 'equip') {
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (inst) {
        await engine.actionDealCreatureDamage(
          attackSource, inst, damage, 'attack',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.sync();
    await engine._delay(800);
    return true;
  },

  hooks: {
    // Innate freeze immunity. `hero.statuses` gets wiped by revive
    // (engine.actionReviveHero) and death cleanup, so re-apply on
    // game start, on revive, and as a turn-start safety net.
    onGameStart: (ctx) => { abgleichen(ctx); },
    onHeroRevive: (ctx) => {
      if (ctx.playerIdx !== ctx.cardOriginalOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      applyFreezeImmunity(ctx.hero);
      abgleichen(ctx);   // W8: wiederbelebt, aber negiert -> Immunität ruht
    },
    onTurnStart: (ctx) => { abgleichen(ctx); },
    // W8: Selbstabgleich bei Statuswechseln und je Phasenbeginn (leises Abklingen der Negation)
    onStatusApplied: (ctx) => { abgleichen(ctx); },
    onStatusRemoved: (ctx) => { abgleichen(ctx); },
    onPhaseStart: (ctx) => { abgleichen(ctx); },
    // Geliehen (??? the Shapeshifter): mit der Gestalt faellt auch die
    // Unfreezable-Marke ab (H01-heroes-02).
    onIdentityLost: (ctx) => {
      const hero = ctx.gameState.players[ctx.cardOriginalOwner]?.heroes?.[ctx.cardHeroIdx];
      if (hero?.statuses?.freeze_immune?.source === CARD_NAME) delete hero.statuses.freeze_immune;
    },
  },
};
