// ═══════════════════════════════════════════
//  CARD EFFECT: "Tri Fecta, the Puppet Master"
//  Hero (400 HP / 60 ATK) — Puppets, PP MSIN
//  Starting Abilities: Creativity + Inventing
//
//  "No cards can be placed into this Hero's
//  Support Zones, except by its own effect or
//  the effects of "Puppet" Tokens. At the start
//  of the game, before drawing your starting
//  hand, place 1 "Destructive Puppet Shishi",
//  "Creative Puppet Brammi" and "Preserving
//  Puppet Vinny" Token into this Hero's Support
//  Zones. This Hero and Tokens in its Support
//  Zones share 1 HP pool. When this Hero has no
//  Tokens in its Support Zones, it is
//  immediately defeated. These effects cannot
//  be negated."
//
//  Umsetzung (v704)
//  ────────────────
//  • Startsatz ueber `onBeforeHandDraw` (Bill-
//    Muster) — idempotent, fuellt nur LEERE
//    Slots 0..2; `onGameStart` als Rueckfall
//    fuer Pfade ohne Hand-Draw-Hook (Puzzle).
//    Vorplatzierte Tokens im Puzzle-Editor
//    bleiben unangetastet.
//  • Zonensperre ueber den Engine-Vertrag
//    `supportZonesLocked` (Gate in doPlayCreature,
//    summonCreatureWithHooks, actionPlaceCreature,
//    actionMoveCard, getFreeSupportZones).
//  • HP-Pool: die TOKENS tragen `sharesHpWithHero`
//    — Schaden/Heilung an ein Token landet auf
//    diesem Helden (Engine, processCreatureDamage-
//    Batch / actionHealCreature).
//  • „no Tokens → defeated" im `onCardLeaveZone`
//    (feuert VOR dem Splice → abgehende Instanz
//    wird ausgeschlossen); Rueckfall zusaetzlich
//    im eigenen `onTurnStart`, falls ein Token
//    ohne Zonen-Hook verschwindet.
//  • „cannot be negated": `bypassStatusFilter`
//    (Hooks laufen auch Negated/Stunned/Frozen)
//    + `cannotBeNegated`.
//  • Hat nur 3 Support Zones — Inselzonen
//    (Flying Island) waeren per Sperre ohnehin
//    unerreichbar.
// ═══════════════════════════════════════════

const {
  TRI_FECTA, TRI_AD, FECTA_SET, isPuppetToken, triAdHoptFree,
  puppetTokensInColumn, checkPuppetHeroDefeat, puppetSupportZonesLocked,
  placePuppetToken,
  PUPPET_HERO_GUARDS, purgePuppetCountersIfOrphaned,
} = require('./_puppets-shared');

async function placeStartingSet(ctx, via) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const hi = ctx.cardHeroIdx;
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name || hero.name !== TRI_FECTA || hero.hp <= 0) return;
  if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
  // Idempotent: bereits liegende Puppets (zweiter Hook-Pfad, Puzzle-
  // Vorplatzierung) werden nicht ueberschrieben.
  if (puppetTokensInColumn(engine, pi, hi).length > 0) return;
  let placed = 0;
  for (let slot = 0; slot < FECTA_SET.length; slot++) {
    const zone = ps.supportZones[hi][slot] || [];
    if (zone.length > 0) continue;
    const res = await placePuppetToken(engine, pi, hi, FECTA_SET[slot], slot, { source: TRI_FECTA });
    if (res?.inst) placed++;
    else if (res) placed++;
  }
  engine.log('tri_fecta_starting_set', { player: ps.username, placed, via });
  engine.sync();
}

module.exports = {
  activeIn: ['hero'],
  // „These effects cannot be negated."
  cannotBeNegated: true,
  bypassStatusFilter: true,
  // v708: Luck-Umleitung und Preserve-Negation haengen am HELDEN — die
  // Counter sind jederzeit einloesbar, auch ohne Laki/Vinny (Al 3.9.).
  boardGuards: PUPPET_HERO_GUARDS,

  /** Engine-Vertrag v704: Zonensperre dieser Spalte. */
  supportZonesLocked(engine, pi, heroIdx, opts) {
    return puppetSupportZonesLocked(engine, pi, heroIdx, opts);
  },

  /**
   * Bereitschaft fuer Tri Ad (Dajan-Muster, bei jedem sync): Tri Ad wird
   * ueber die Ascension-Bedienung aufgelegt — der Client zeigt den Drop
   * nur, wenn `ascensionReady`/`ascensionTargets` gesetzt sind. Frei,
   * solange das gemeinsame HOPT (Auflegen/Zuruecknehmen) unverbraucht ist.
   */
  refreshAscensionReadiness(engine, pi, heroIdx) {
    const gs = engine.gs;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero || hero.name !== TRI_FECTA) return;
    if (hero.hp > 0 && triAdHoptFree(gs, pi)) {
      hero.ascensionReady   = true;
      hero.ascensionTarget  = TRI_AD;
      hero.ascensionTargets = [TRI_AD];
    } else {
      delete hero.ascensionReady;
      delete hero.ascensionTarget;
      delete hero.ascensionTargets;
    }
  },

  hooks: {
    onBeforeHandDraw: async (ctx) => { await placeStartingSet(ctx, 'beforeHandDraw'); },
    onGameStart:      async (ctx) => { await placeStartingSet(ctx, 'gameStart'); },

    /** Token verlaesst die Spalte → ohne verbleibende Tokens besiegt. */
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      // `ctx.card` ist hier der HELD (Listener) — die abgehende Karte
      // steht in `ctx.leavingCard` (actionMoveCard-Form).
      const card = ctx.leavingCard;
      if (!card || ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner || ctx.fromHeroIdx !== ctx.cardHeroIdx) return;
      if (!isPuppetToken(card.name)) return;
      await checkPuppetHeroDefeat(engine, ctx.cardOwner, ctx.cardHeroIdx,
        { name: TRI_FECTA, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx }, card.id);
    },

    /** Rueckfall: Zustand ohne Tokens, den kein Zonen-Hook gemeldet hat. */
    /** Ohne Tri Fecta/Tri Ad verschwinden alle Luck/Preserve Counter (Al 3.9.). */
    onHeroKO: async (ctx) => {
      const dead = ctx.hero;
      if (!dead || dead !== ctx._engine.gs.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx]) return;
      purgePuppetCountersIfOrphaned(ctx._engine, ctx.cardOwner);
    },
    onTurnStart: async (ctx) => {
      await checkPuppetHeroDefeat(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx,
        { name: TRI_FECTA, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx });
    },
  },
};
