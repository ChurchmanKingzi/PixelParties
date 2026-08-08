// ═══════════════════════════════════════════
//  CARD EFFECT: "Harpthenean War Counselor"
//  Creature (Summoning Magic Lv2, Normal) — 80 HP
//
//  EFFECT:
//   "You can only control 1 \"Harpthenean War
//    Counselor\".
//    You may once per turn gain 10 Gold times the
//    number of \"War Counselor\" Creatures you
//    control OR choose a target and deal damage
//    equal to 5 times your current Gold to it. That
//    damage cannot exceed 300."
//
//  ── Zwei Modi, eine Nutzung ──
//  Ein ODER: der Spieler waehlt beim Aktivieren
//  zwischen Gold und Schaden. Die Einmal-pro-Zug-
//  Sperre gilt fuer BEIDE zusammen (ein "once per
//  turn" fuer den ganzen Effekt), also die normale
//  HOPT von `creatureEffect`.
//
//  ── Gold-Modus ──
//  10 Gold je kontrollierter Ratgeber-KREATUR,
//  Exemplare gezaehlt. Harpthenean zaehlt sich
//  selbst mit — der Text sagt nicht "other".
//
//  ── Schaden-Modus ──
//  5 × AKTUELLES Gold, gedeckelt bei 300. Der Deckel
//  greift also ab 60 Gold. Das Gold wird NICHT
//  ausgegeben; es ist nur der Messwert.
//
//  Beide Zweige sind abbrechbar, und ein Abbruch gibt
//  ueber `return false` die Rundennutzung frei.
// ═══════════════════════════════════════════

const {
  WC,
  countWarCounselors,
  makeSingletonCanSummon,
} = require('./_war-counselor-shared');

const CARD_NAME = 'Harpthenean War Counselor';
const GOLD_PER_COUNSELLOR = 10;
const DAMAGE_PER_GOLD = 5;
const DAMAGE_CAP = 300;

module.exports = {
  // Harte Obergrenze dieses Schadens. Minocretes Verdoppler liest sie und
  // klemmt danach wieder auf 300 — "cannot exceed 300" gilt auch mit
  // fremder Hilfe (Als Ruling 8.8.).
  damageCap: DAMAGE_CAP,

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: makeSingletonCanSummon(CARD_NAME),

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const ps = gs.players[pi];
    if (!ps) return false;

    const counselors = countWarCounselors(engine, pi);
    const goldGain = GOLD_PER_COUNSELLOR * counselors;
    const gold = ps.gold || 0;
    const damage = Math.min(DAMAGE_CAP, DAMAGE_PER_GOLD * gold);

    const choice = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: 'Choose which counsel to follow.',
      showCard: CARD_NAME,
      options: [
        {
          id: 'gold',
          label: `💰 Gain ${goldGain} Gold`,
          description: `${GOLD_PER_COUNSELLOR} × ${counselors} "${WC}" Creature${counselors !== 1 ? 's' : ''} you control.`,
          color: '#ffd700',
        },
        {
          id: 'damage',
          label: `🔥 Deal ${damage} damage`,
          description: `${DAMAGE_PER_GOLD} × your ${gold} Gold, capped at ${DAMAGE_CAP}. Your Gold is not spent.`,
          color: '#ff4444',
        },
      ],
      cancellable: true,
    });
    if (!choice || choice.cancelled || !choice.optionId) return false;

    // ── Gold ──
    if (choice.optionId === 'gold') {
      if (goldGain <= 0) return false;              // nichts zu holen
      engine._broadcastEvent('play_gold_coins', { owner: pi });
      await engine._delay(300);
      await engine.actionGainGold(pi, goldGain);
      engine.log('harpthenean_gold', {
        player: ps.username, counselors, goldGained: goldGain,
      });
      engine.sync();
      return true;
    }

    // ── Schaden ──
    if (damage <= 0) return false;                  // ohne Gold kein Schuss
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage — ${DAMAGE_PER_GOLD} × your ${gold} Gold${damage === DAMAGE_CAP ? ` (capped at ${DAMAGE_CAP})` : ''}.`,
      confirmLabel: `🔥 Strike! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      // Goldene Federn — Harpthenean ist eine Harpyie (Als Vorgabe),
      // vorher liefen hier Bluttropfen.
      type: 'golden_feathers',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(450);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('harpthenean_strike', {
      player: ps.username, target: target.cardName, damage, gold,
    });
    engine.sync();
    return true;
  },
};
