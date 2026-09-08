// ═══════════════════════════════════════════
//  CARD EFFECT: "Tri Ad, the Puppet Mistress"
//  Hero (400 HP / 60 ATK) — Puppets, PP MSIN
//  Starting Abilities: Creativity + Inventing
//
//  "This cannot be one of your Starting Heroes.
//  You may once per turn place this card from
//  your hand on top of a Hero you control whose
//  original name is "Tri Fecta, the Puppet
//  Master" OR move this Hero from on top of a
//  Hero you control back to your hand. This
//  Hero and Tokens in its Support Zones share
//  1 HP pool. Cards cannot be placed into this
//  Hero's Support Zones, except by the effect
//  of "Puppet" Tokens. When this Hero has no
//  Tokens in its Support Zones, it is
//  immediately defeated. These effects cannot
//  be negated."
//
//  Als Rulings (2.9., bindend)
//  ───────────────────────────
//  • Tri Ad ist ein NORMALER Hero, nur im Main
//    Deck spielbar — KEIN Ascended Hero. Keine
//    der beiden Formen zaehlt als Ascended
//    (Karten wie Audience with a hostile King
//    pruefen den DB-Typ und sehen sie nicht).
//  • Auflegen/Zuruecknehmen: kostenlos in der
//    Main Phase, keine Action, EIN gemeinsames
//    HOPT fuer beides.
//  • Tausch der Tokens: stiller Austausch am
//    Platz mit eigener Animation je Token.
//
//  Umsetzung (v704, Bedienung wie Ascension —
//  Als Vorgabe 3.9.)
//  ────────────────
//  • Von der HAND: Skript-Vertrag `plainHeroForm`
//    — der Client bedient die Karte wie einen
//    Ascended Hero (Drag auf Tri Fecta oder Klick,
//    `ascend_hero`); `performAscension` erkennt
//    das Flag, umgeht den 'Ascended Hero'-Typcheck
//    und legt sie als FORM (`notAnAscension`:
//    kein Bonus, keine Ascend-Trigger, kein
//    Zugende). Die Bereitschaft (`ascensionReady`/
//    `ascensionTargets`) pflegt Tri Fecta ueber
//    `refreshAscensionReadiness`; `ascensionCondition`
//    hier prueft Basis + HOPT; `onPlainFormPlaced`
//    stempelt das HOPT und tauscht die Tokens.
//    `formsAscensionStack` fuehrt den `_formStack`
//    fuer den Rueckweg.
//  • Vom HELDEN: `heroEffect`/`onHeroEffect` →
//    `performDescend({ noDiscard, notADescend })`
//    (Open-Invitation-Gerueest), danach Karte
//    zurueck in die Hand. Pseudo-Abstieg mit
//    HP-Differenz 0 (beide 400) — kann nicht
//    toeten.
//  • Zonensperre / HP-Pool / „no Tokens →
//    defeated" wie Tri Fecta (Shared-Modul).
//  • `notAStartingHero`: Riegel im Deckbuilder
//    (Team-Slots) und Daily-Hero-Pool (Als
//    Auftrag 3.9.).
// ═══════════════════════════════════════════

const {
  TRI_FECTA, TRI_AD, isPuppetToken, triAdHoptFree, stampTriAdHopt,
  checkPuppetHeroDefeat, puppetSupportZonesLocked, swapPuppetTokens, setPuppetSwapLock,
  PUPPET_HERO_GUARDS, purgePuppetCountersIfOrphaned,
} = require('./_puppets-shared');

module.exports = {
  activeIn: ['hero'],
  cannotBeNegated: true,
  bypassStatusFilter: true,
  // v708: Luck-Umleitung und Preserve-Negation haengen am HELDEN.
  boardGuards: PUPPET_HERO_GUARDS,
  // „This cannot be one of your Starting Heroes." (Deckbuilder-Riegel)
  notAStartingHero: true,
  // Bedienung wie Ascension, aber als Form (Engine-Vertrag v704).
  plainHeroForm: true,
  // Basis-/HOPT-Bedingung darf kein Ascension-Skip (Throne Robber) umgehen.
  ascensionConditionUnskippable: true,
  // Rueckweg ueber performDescend braucht den Formenstapel.
  formsAscensionStack: true,

  /** performAscension-Gate: Basis muss Tri Fecta sein, HOPT frei. */
  ascensionCondition(gs, pi, heroIdx) {
    return gs.players[pi]?.heroes?.[heroIdx]?.name === TRI_FECTA && triAdHoptFree(gs, pi);
  },

  /** Nach dem Auflegen (performAscension, plainForm): HOPT + Token-Tausch. */
  async onPlainFormPlaced(engine, pi, heroIdx) {
    const gs = engine.gs;
    stampTriAdHopt(gs, pi);
    engine.log('tri_ad_placed', { player: gs.players[pi]?.username, heroIdx });
    engine.sync();
    await swapPuppetTokens(engine, pi, heroIdx, TRI_AD);
    engine.sync();
  },

  /** Engine-Vertrag v704: Zonensperre dieser Spalte. */
  supportZonesLocked(engine, pi, heroIdx, opts) {
    return puppetSupportZonesLocked(engine, pi, heroIdx, opts);
  },

  // ── Vom Helden: zurueck in die Hand (Helden-Effekt-Knopf) ──────
  heroEffect: true,
  canActivateHeroEffect(ctx) {
    const gs = ctx._engine.gs;
    if (!triAdHoptFree(gs, ctx.cardOwner)) return false;
    const hero = gs.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx];
    return hero?.name === TRI_AD && Array.isArray(hero._formStack) && hero._formStack.length > 0;
  },
  onHeroEffect: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const hi = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    const hero = ps?.heroes?.[hi];
    if (!hero || hero.name !== TRI_AD || !triAdHoptFree(gs, pi)) return false;
    // Sperre der Spalte ab JETZT (v707) — der Rueckweg hat vor dem
    // Tausch eigene Wartezeiten (performDescend).
    setPuppetSwapLock(engine, pi, hi, true);
    engine.sync();
    try {
      const res = await engine.performDescend(pi, hi, {
        noDiscard: true,     // Karte geht in die HAND, nicht in die Ablage
        notADescend: true,   // Als Ruling: gilt nicht als Descending
      });
      if (!res?.success) {
        engine.log('tri_ad_return_failed', { player: ps.username, heroIdx: hi });
        return false;
      }
      ps.hand.push(TRI_AD);
      engine._trackCard(TRI_AD, pi, 'hand');
      stampTriAdHopt(gs, pi);
      engine.log('tri_ad_returned_to_hand', { player: ps.username, heroIdx: hi, nowHero: ps.heroes[hi]?.name });
      engine.sync();
      await swapPuppetTokens(engine, pi, hi, TRI_FECTA);
    } finally {
      setPuppetSwapLock(engine, pi, hi, false);
      engine.sync();
    }
    return true;
  },

  hooks: {
    onCardLeaveZone: async (ctx) => {
      // `ctx.card` ist der HELD (Listener); abgehende Karte = `ctx.leavingCard`.
      const card = ctx.leavingCard;
      if (!card || ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner || ctx.fromHeroIdx !== ctx.cardHeroIdx) return;
      if (!isPuppetToken(card.name)) return;
      await checkPuppetHeroDefeat(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx,
        { name: TRI_AD, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx }, card.id);
    },
    /** Ohne Tri Fecta/Tri Ad verschwinden alle Luck/Preserve Counter (Al 3.9.). */
    onHeroKO: async (ctx) => {
      const dead = ctx.hero;
      if (!dead || dead !== ctx._engine.gs.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx]) return;
      purgePuppetCountersIfOrphaned(ctx._engine, ctx.cardOwner);
    },
    onTurnStart: async (ctx) => {
      await checkPuppetHeroDefeat(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx,
        { name: TRI_AD, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx });
    },
  },
};
