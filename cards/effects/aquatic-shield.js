// ═══════════════════════════════════════════
//  CARD EFFECT: "Aquatic Shield"
//  Spell (Surprise) — Magic Arts + Support Magic Lv 2
//  Archetype "Aquatic" (Mizune-Serie, v697)
//
//  1. TRIGGER (VOR-Schaden-Fenster,
//     `firesOnAnyDamageTarget` + neu
//     `firesOnSelfSourcedDamage`):
//     "when the user takes any damage" — nur der
//     TRAEGER-Held, aber JEDE Quelle, auch die
//     eigene (The Yeeting auf den eigenen Helden
//     ist der Mizune-Plan) UND Status-Ticks
//     (Als Ruling: Burn/Poison = "any damage").
//     Wirkung: den Schaden um 100 reduzieren
//     (`{ damageReduced: 100 }`). Echter Schaden
//     ("cannot be reduced") laeuft an diesem
//     Fenster konstruktionsbedingt vorbei.
//
//  2. DISCARD-RIDER (v697-Fenster): jedes Ziel
//     unter eigener Kontrolle (lebende Helden +
//     eigene offene Creatures) bekommt einen
//     EINMAL-Schild ueber 100 bis zum Beginn des
//     eigenen naechsten Zuges — Engine-Mechanik
//     `_grantOneShotDamageShield` (Verbrauch und
//     Verfall zentral). Danach der geteilte
//     Aquatic-Nachschub.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { offerAquaticReplacement, cpuPickReplacement } = require('./_aquatic-shared');

const CARD_NAME = 'Aquatic Shield';
const REDUCTION = 100;

module.exports = {
  isSurprise: true,
  // Prae-Schaden-Fenster (Banner-Bearer-Kanal) …
  firesOnAnyDamageTarget: true,
  // … auch bei eigenquelligem Schaden (v697-Opt-in) …
  firesOnSelfSourcedDamage: true,
  // … und bei Status-Ticks: Als Ruling — Burn/Poison zaehlt als
  // "takes ANY damage" (nur fuer den Shield-Trigger; als "you deal
  // damage" fuer Spear zaehlt Status ausdruecklich NICHT).
  firesOnStatusTickDamage: true,

  /**
   * Nur der TRAEGER zaehlt ("the user"): Helden-Ziel, eigene Seite,
   * gleiche Position wie die Zone, Schaden > 0.
   */
  surpriseTrigger(gs, ownerIdx, hostHeroIdx, sourceInfo) {
    const tgt = sourceInfo?.damageTarget;
    if (!tgt || tgt.kind !== 'hero') return false;
    if (tgt.owner !== ownerIdx || tgt.heroIdx !== hostHeroIdx) return false;
    return (sourceInfo.damageAmount || 0) > 0;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'cardGallery' && promptData.title === CARD_NAME) {
      return cpuPickReplacement(promptData, CARD_NAME);
    }
    // Aktivierungs-Confirm aus dem Prae-Schaden-Fenster (title =
    // Kartenname). Lohnt, wenn die vollen 100 gebraucht werden oder der
    // Treffer den Traeger sonst toeten wuerde.
    if (promptData?.type === 'confirm' && promptData.title === CARD_NAME) {
      const amount = promptData._damageAmount ?? 0;
      const cpuIdx = engine._cpuPlayerIdx;
      const hero = engine.gs.players[cpuIdx]?.heroes?.[promptData._hostHeroIdx ?? -1];
      const lethal = hero ? hero.hp <= amount : false;
      return { confirmed: amount >= REDUCTION || lethal };
    }
    return undefined;
  },

  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx ?? -1;

    engine._broadcastEvent('play_zone_animation', {
      type: 'shield_block', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(500);

    engine.log('aquatic_shield_reduce', {
      player: engine.gs.players[pi]?.username,
      reduced: REDUCTION,
      incoming: sourceInfo?.damageAmount ?? null,
    });
    engine.sync();
    return { activated: true, damageReduced: REDUCTION };
  },

  // ── DISCARD-RIDER: Einmal-Schilde fuer alle eigenen Ziele ────────
  async onBoardSentToDiscard(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return;
    const cardDB = engine._getCardDB();

    let vergeben = 0;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      engine._grantOneShotDamageShield('hero', h, REDUCTION, CARD_NAME, pi);
      engine._broadcastEvent('play_zone_animation', {
        type: 'shield_block', owner: pi, heroIdx: hi, zoneSlot: -1,
      });
      vergeben++;
    }
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) !== pi) continue;
      if (inst.zone !== 'support' || inst.faceDown) continue;
      const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      engine._grantOneShotDamageShield('creature', inst, REDUCTION, CARD_NAME, pi);
      engine._broadcastEvent('play_zone_animation', {
        type: 'shield_block', owner: pi, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      vergeben++;
    }
    if (vergeben > 0) {
      engine.log('aquatic_shield_blessing', {
        player: ps.username, targets: vergeben, amount: REDUCTION,
      });
      engine.sync();
      await engine._delay(600);
    }

    if (ctx.fromZone === 'surprise' && ctx.fromHeroIdx >= 0) {
      await offerAquaticReplacement(engine, pi, ctx.fromHeroIdx, CARD_NAME);
    }
  },

  cpuMeta: {
    onDeathBenefit: 0,
  },
};
