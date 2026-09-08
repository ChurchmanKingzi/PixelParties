// ═══════════════════════════════════════════
//  CARD EFFECT: "Fiona, the Princess of Blackport"
//  Hero — Wealth / Wealth
//
//  Whenever this Hero is afflicted by any
//  negative status effect, the player gains
//  20 Gold. Triggers per status instance
//  (not per stack). This effect CANNOT be
//  negated by Frozen, Stunned, Negated, or
//  any other negative status.
//
//  Ascension (ab v653): zu "Fiona, the Empty
//  Vessel of a Forgotten Sorceress", sobald sie
//  "Forbidden Grimoire of a Forgotten Sorceress"
//  UND mindestens einen Helden als Equipment
//  traegt. Die Bedingung steht in
//  _fiona-shared.js; hier wird nur die
//  Bereitschaft nachgefuehrt — bei JEDEM
//  Betreten/Verlassen ihrer Support Zones, weil
//  der angelegte Held keine feste Karte ist
//  (Initiation Ritual, Shapeshifter, …).
// ═══════════════════════════════════════════

const { STATUS_EFFECTS } = require('./_hooks');
const { checkFionaAscension, hasGrimoire, equippedHeroCount, GRIMOIRE_NAME, BASE_FIONA } = require('./_fiona-shared');

module.exports = {
  activeIn: ['hero'],

  // Das Grimoire gehoert zur Ascension-Bedingung — die CPU bewegt es
  // nie vom nicht-aufgestiegenen Traeger weg (Arthor-Vertrag).
  ascensionItems: [GRIMOIRE_NAME],
  // Wie Arthor: der Cheat-Aufstieg umgeht diese Bedingung nicht.
  cheatAscensionBlocked: true,

  // CPU-Aufstiegsplanung: das Grimoire „bringt sie weiter", solange
  // sie es nicht traegt. Den angelegten Helden kann kein einzelner
  // Kartenname liefern (er kommt ueber Initiation Ritual/Shapeshifter),
  // deshalb zaehlt hier nur das Grimoire.
  ascensionNeedsCard(cardName, _cardData, engine, pi, hi) {
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero || hero.name !== BASE_FIONA) return false;
    if (hero.ascensionReady) return false;
    if (cardName !== GRIMOIRE_NAME) return false;
    return !hasGrimoire(engine, pi, hi);
  },

  // 0..1: Grimoire und angelegter Held je zur Haelfte.
  ascensionProgress(engine, pi, hi) {
    let count = 0;
    if (hasGrimoire(engine, pi, hi)) count++;
    if (equippedHeroCount(engine, pi, hi) >= 1) count++;
    return count / 2;
  },

  // This hero's effects fire even while Frozen/Stunned/Negated
  bypassStatusFilter: true,

  // CPU threat assessment (gold supporter). +20 gold per triggered status
  // instance on her — use her current statuses as a proxy for "has been
  // statused this game". If she's currently carrying any negative status,
  // treat her as generating the full 20 gold-per-turn; otherwise 0.
  supportYield(ctx) {
    const hero = ctx.engine.gs.players[ctx.pi]?.heroes?.[ctx.hi];
    const statuses = hero?.statuses || {};
    for (const k of Object.keys(statuses)) {
      if (statuses[k]) return { goldPerTurn: 20 };
    }
    return { goldPerTurn: 0 };
  },

  // CPU self-status target score. Fiona gains 20 gold per negative-status
  // application, so the CPU should eagerly aim self-status cards
  // (Sickly Cheese, Zsos'Ssar cost, …) at her when she's on its side.
  cpuStatusSelfValue(statusName, ctx) {
    if (!STATUS_EFFECTS[statusName]?.negative) return 0;
    // Kontextabhängig statt konstant: +20 Gold sind nur dann ~40 Score
    // wert, wenn das Deck Gold BRAUCHT. Bei wachsendem Überschuss
    // (Bestand über dem Demand-Modell-Bedarf, siehe scoreSelfStatusTarget)
    // fällt der Wert linear auf 0 — ab ~40 Gold Überschuss ist ein
    // Selbst-Gift auf Fiona kein Gewinn mehr, und die Zielwahl gibt den
    // Status dorthin, wo er hingehört: auf den Gegner. Zusätzlich kein
    // Selbst-Status bei kritischen HP — der Status-Schaden ist dann
    // teurer als 20 Gold.
    const hero = ctx?.hero;
    if (hero && typeof hero.hp === 'number' && hero.hp <= 80) return 0;
    const surplus = ctx?.goldSurplus ?? 0;
    const factor = Math.max(0, Math.min(1, 1 - surplus / 40));
    return Math.round(40 * factor);
  },

  hooks: {
    // ── Ascension-Bereitschaft ──────────────────────────────────────
    // Spielstart (auch Puzzle-Aufstellung: server.js feuert onGameStart)
    // und Zugstart als Netz fuer Pfade ohne Zonen-Hooks (Charm-Flips,
    // Snapshot/Restore) — dasselbe Muster wie bei Arthor.
    onGameStart: (ctx) => {
      checkFionaAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },
    onTurnStart: (ctx) => {
      checkFionaAscension(ctx._engine, ctx.cardOriginalOwner, ctx.cardHeroIdx, null);
    },
    // Jede Karte, die ihre Support Zones betritt oder verlaesst, kann
    // die Bedingung kippen (Grimoire, angelegter Held). Billig und
    // idempotent, also ohne Namensfilter.
    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support') return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;
      checkFionaAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromHeroIdx !== undefined && ctx.fromHeroIdx !== ctx.cardHeroIdx) return;
      // Die gehende Karte steht noch in cardInstances — ausnehmen.
      // ACHTUNG: `ctx.card` ist der LAUSCHER (Fiona selbst; _createContext
      // ueberschattet das Feld), die gehende Karte ist `ctx.leavingCard`.
      checkFionaAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, ctx.leavingCard?.id);
    },

    onStatusApplied: async (ctx) => {
      // Only trigger when THIS hero receives the status
      const target = ctx.target;
      if (!target) return;

      const heroOwner = ctx.heroOwner;
      const heroIdx = ctx.heroIdx;
      if (heroOwner !== ctx.cardOwner || heroIdx !== ctx.cardHeroIdx) return;

      // Must be a negative status
      const statusName = ctx.statusName;
      const statusDef = STATUS_EFFECTS[statusName];
      if (!statusDef?.negative) return;

      // Hero must be alive
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      // Gain 20 Gold with sparkle animation
      const engine = ctx._engine;
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: heroOwner,
        heroIdx, zoneSlot: -1,
      });

      await ctx.gainGold(20);

      engine.log('fiona_gold', {
        hero: hero.name, status: statusName, gold: 20,
        player: engine.gs.players[heroOwner]?.username,
      });
    },
  },
};
