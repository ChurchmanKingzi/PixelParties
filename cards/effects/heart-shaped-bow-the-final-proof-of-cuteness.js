// ═══════════════════════════════════════════
//  CARD EFFECT: "Heart-Shaped Bow, the Final Proof of Cuteness"
//  Artifact (Equipment, Cost 10) — Secret Rare
//
//  "Equip this card to a Hero you control. The equipped Hero's Attack
//   stat is increased by 10 and its Attacks do not trigger your
//   opponent's Surprises. When the equipped Hero performs an Attack,
//   you may immediately perform a 'Love Shot' Spell from your hand
//   with it as an additional Action regardless of its level."
//
//  ① +10 ATK: `grantAtk`/`revokeAtk` (Legendary-Sword-Muster).
//  ② Keine Surprises auf ihre Angriffe: `hero._skipAttackSurprises`,
//     das Phalanx-Pike-Flag, das `_checkSurpriseWindow` liest. Beim
//     Verlassen nur loeschen, wenn kein Pike/zweiter Bogen mehr liegt.
//  ③ Love Shot nach dem Angriff: Zusatzaktions-Typ `heart_bow_love_shot`
//     mit Namensfilter und `bypassesCasterRequirement: true` — genau
//     das Wolflesia-Flag, ueber das `heroMeetsLevelReq` uebersprungen
//     wird („regardless of its level"). Ablauf wie Legendary Swords
//     Gratis-Beschwoerung: HOPT je Bogen-Instanz, Token gewaehren,
//     `performImmediateAction` mit Namensfilter, bei Abbruch Token
//     verfallen + HOPT zurueck.
//
//  Aufstiegsbaustein von Molinda — die Bereitschaft pflegt der
//  Basisheld selbst (`_molinda-shared`), hier ist nichts zu tun.
// ═══════════════════════════════════════════

const CARD_NAME = 'Heart-Shaped Bow, the Final Proof of Cuteness';
const ATK_BONUS = 10;
const LOVE_SHOT = 'Love Shot';
const ADDITIONAL_TYPE = 'heart_bow_love_shot';

function registerType(engine) {
  engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
    label: CARD_NAME,
    allowedCategories: ['spell'],
    filter: (cardData) => cardData?.name === LOVE_SHOT,
    bypassesCasterRequirement: true,
  });
}

/** Liegt an diesem Helden noch eine Karte, die Surprises unterdrueckt? */
function otherSuppressorOnHero(engine, ownerIdx, heroIdx, excludeId) {
  return engine.cardInstances.some(c =>
    c.id !== excludeId && c.owner === ownerIdx && c.zone === 'support' && c.heroIdx === heroIdx
    && ((c.counters?._effectOverride || c.name) === CARD_NAME || (c.counters?._effectOverride || c.name) === 'Phalanx Pike'));
}

function applySkip(engine, ownerIdx, heroIdx) {
  const hero = engine.gs.players[ownerIdx]?.heroes?.[heroIdx];
  if (hero) hero._skipAttackSurprises = true;
}

module.exports = {

  /**
   * „Equip this card to a Hero you control." — Seitenbindung, siehe
   * `equipOwnSideOnly` in CARD_API.md. Ohne die Fahne gilt die
   * Hausvorgabe „Ausruestung darf an beide Seiten" (Al, 5.9.: der
   * Kartentext ist bindend).
   */
  equipOwnSideOnly: true,
  activeIn: ['support'],

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
      applySkip(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx);
      registerType(ctx._engine);
    },
    onGameStart: (ctx) => {
      registerType(ctx._engine);
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
      applySkip(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx);
    },
    onTurnStart: (ctx) => {
      registerType(ctx._engine);
    },
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card.id) return;
      if (!ctx.leavingCard && (ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot)) return;
      ctx.revokeAtk();
      ctx.expireAdditionalAction();
      const engine = ctx._engine;
      if (!otherSuppressorOnHero(engine, ctx.cardOwner, ctx.card.heroIdx, ctx.card.id)) {
        const hero = engine.gs.players[ctx.cardOwner]?.heroes?.[ctx.card.heroIdx];
        if (hero) delete hero._skipAttackSurprises;
      }
    },

    afterSpellResolved: async (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Attack') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (ctx.isSecondCast) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      const hoptKey = `heart-bow-love-shot:${ctx.card.id}`;
      if (!ctx.hardOncePerTurn(hoptKey)) return;
      const refundHopt = () => { if (gs.hoptUsed) delete gs.hoptUsed[`${hoptKey}:${pi}`]; };

      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) { refundHopt(); return; }

      registerType(engine);
      // Token ZUERST, damit die Eignungspruefung den Level-Bypass sieht.
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);
      const eligible = engine.getHeroEligibleActionCards(pi, heroIdx).filter(n => n === LOVE_SHOT);
      if (eligible.length === 0) {
        ctx.expireAdditionalAction();
        refundHopt();
        return;
      }

      const result = await ctx.performImmediateAction(heroIdx, {
        title: `Love Shot with ${hero.name}?`,
        description: `${CARD_NAME} — perform a Love Shot from your hand as an additional Action, regardless of its level!`,
        allowedCardTypes: ['Spell'],
        cardNameFilter: (n) => n === LOVE_SHOT,
        skipAbilities: true,
        cancellable: true,
      });

      if (result?.played) {
        engine.consumeAdditionalAction(pi, ADDITIONAL_TYPE);
        engine.log('heart_bow_love_shot', { player: gs.players[pi].username, hero: hero.name });
      } else {
        ctx.expireAdditionalAction();
        refundHopt();
      }
      engine.sync();
    },
  },
};
