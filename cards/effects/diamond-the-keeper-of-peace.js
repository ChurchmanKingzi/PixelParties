// ═══════════════════════════════════════════
//  CARD EFFECT: "Diamond, the Keeper of Peace"
//  Hero — Two passive effects:
//
//  1) Creatures you control with original level 0
//     are completely immune to status effect damage
//     (Burn, Poison ticks).
//
//  2) When any Creature(s) you control would take
//     damage from an opponent's card or effect,
//     prompt: "Protect [name]?" (or "Protect your
//     Creatures?" for multiple).
//     YES → Negate the damage (unless un-negatable),
//           deal 30 × affected creature count to
//           Diamond. This CAN kill Diamond.
//     NO  → Damage proceeds normally.
//
//  Damage negation: if canBeNegated is false,
//  Diamond still takes the 30× self-damage but
//  the creature damage is NOT prevented.
// ═══════════════════════════════════════════


const { heldenSperreKey } = require('./_hero-hopt-shared');   // v1275: Heldensperre pro Spieler (Ruling 22.9.)

const CARD_NAME = 'Diamond, the Keeper of Peace';
const AUFSTIEG_ZIEL = 'Diamond, the Bulwark of Peace';
const AUFSTIEG_VERLUST = 150;

/**
 * Aufstiegsbereitschaft an den Client melden („has lost at least 150 HP
 * due to its own effect"). Nur eine Anzeige — die verbindliche
 * Pruefung steht als `ascensionCondition` auf der aufgestiegenen Karte.
 * Der Zaehler `hero._diamondSelfLoss` summiert die HP, die Diamond
 * durch den Schutz-Selbstschaden TATSAECHLICH verloren hat (Heilung
 * mindert ihn nicht); im Puzzle-Editor setzbar.
 */
function meldeAufstieg(hero) {
  if (!hero || hero.name !== CARD_NAME) return;
  if ((hero._diamondSelfLoss || 0) >= AUFSTIEG_VERLUST) {
    hero.ascensionReady = true;
    hero.ascensionTarget = AUFSTIEG_ZIEL;
  } else if (hero.ascensionTarget === AUFSTIEG_ZIEL) {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
  }
}

module.exports = {
  // CPU: confirm Diamond's "protect your Creatures?" prompt — the default
  // brain declines cancellable confirms outside a card-cast (damage trigger),
  // so without this Diamond never shields. Shielding (Diamond self-tanks) is
  // her purpose, so accept. (Title must equal the card name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    // KEINE !showCard-Bedingung: promptConfirmEffect defaultet showCard
    // inzwischen IMMER auf den Kartennamen — die alte Bedingung war nie
    // erfüllt und der Confirm wurde still declined (Barker-Bugklasse).
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
  activeIn: ['hero'],

  hooks: {
    /**
     * beforeCreatureDamageBatch — fires before a batch of creatures takes damage.
     * Diamond intercepts to:
     *   Effect 1: Cancel status damage for original-Lv0 creatures (silent, no prompt).
     *   Effect 2: Prompt to protect creatures from opponent damage.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero;
      // Tot wirkt nicht — AUSSER der Tod ist im laufenden Flaechenschlag
      // nur vorgemerkt: dann gehoert Effekt 1 (Negation) noch zur
      // Schadensberechnung dieses Schlags (Todes-Aufschub 28.9.).
      if (!hero || (hero.hp <= 0 && !engine.heldTodAufgeschoben(hero))) return;

      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;

      // ── Effect 1: Status damage immunity for original-Lv0 creatures ──
      for (const e of entries) {
        if (e.cancelled) continue;
        // Controller-aware: "Creatures you control" — a Creature you
        // own but no longer control (cross-side-placed) is not yours.
        if ((e.inst.controller ?? e.inst.owner) !== pi) continue;
        if (!e.isStatusDamage) continue;
        if (e.originalLevel !== 0) continue;
        // This creature has original level 0 and is taking status damage → immune
        e.cancelled = true;
        engine.log('diamond_status_immune', { creature: e.inst.name, type: e.type, hero: hero.name });
      }

      // ── Effect 2: Protection prompt for opponent-sourced creature damage ──
      // Der Preis ist Schaden an Diamond selbst. Steht sie schon auf 0 HP
      // (Tod nur vorgemerkt), liefe er ins Leere — der Schutz waere
      // umsonst. Also nur mit lebender Diamond.
      if (hero.hp <= 0) return;
      // Collect entries where the source is the opponent
      const oppIdx = pi === 0 ? 1 : 0;
      const opponentEntries = entries.filter(e =>
        !e.cancelled &&
        (e.inst.controller ?? e.inst.owner) === pi &&
        e.sourceOwner === oppIdx &&
        e.originalLevel === 0
      );

      if (opponentEntries.length === 0) return;

      // HOPT check (soft, per hero instance)
      const hoptKey = heldenSperreKey('diamond-protect', pi);
      if (engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn) return;

      // Build prompt message
      const creatureNames = [...new Set(opponentEntries.map(e => e.inst.name))];
      const selfDamage = 30 * opponentEntries.length;
      const protectLabel = creatureNames.length === 1
        ? `Protect ${creatureNames[0]}?`
        : 'Protect your Creatures?';

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Diamond, the Keeper of Peace',
        message: `${protectLabel}\nDiamond takes ${selfDamage} damage (30 × ${opponentEntries.length}).`,
        confirmLabel: `🛡️ Protect! (${selfDamage} dmg to Diamond)`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in self-damage protect.
      });

      if (!confirmed || confirmed.cancelled) return;

      // Claim HOPT
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      engine.gs.hoptUsed[hoptKey] = engine.gs.turn;

      // Cancel negatable entries — un-negatable ones still proceed
      let negatedCount = 0;
      for (const e of opponentEntries) {
        if (e.canBeNegated !== false) {
          e.cancelled = true;
          negatedCount++;
          engine.log('diamond_protect', { creature: e.inst.name, amount: e.amount, negated: true });
        } else {
          engine.log('diamond_protect_failed', { creature: e.inst.name, amount: e.amount, reason: 'cannot_be_negated' });
        }
      }

      // Diamond takes 30 × total affected creatures (even those that couldn't be negated)
      engine.log('diamond_self_damage', { hero: hero.name, amount: selfDamage, protectedCount: opponentEntries.length, negatedCount });

      // Play shield animation on Diamond
      engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', owner: ctx.cardHeroOwner, heroIdx, zoneSlot: -1 });

      // Deal damage to Diamond (type 'other', can kill)
      // v845: Quelle mit Besitzer (siehe Angry Cheese) — sonst zaehlt der
      // Selbstschaden fuer Hooks wie Tazunes Schild als besitzerlos.
      const hpVorher = hero.hp;
      await engine.actionDealDamage({ name: 'Diamond, the Keeper of Peace', owner: pi, controller: pi }, hero, selfDamage, 'other');
      // Aufstiegsbedingung der Bulwark-Form: HP, die sie durch DIESEN
      // Effekt wirklich verloren hat (Schilde/Kuerzungen zaehlen nicht mit).
      const verloren = Math.max(0, hpVorher - Math.max(0, hero.hp));
      if (verloren > 0) hero._diamondSelfLoss = (hero._diamondSelfLoss || 0) + verloren;
      meldeAufstieg(hero);
      engine.sync();
    },

    // Anzeige nachziehen (Puzzle-Editor-Wert, geraeumte Marken) — wie
    // bei Cecilia. Styx 28.9.: der Held selbst (Brettseite).
    onTurnStart: (ctx) => {
      const ps = ctx._engine?.gs?.players?.[ctx.cardHeroOwner ?? ctx.cardOwner];
      meldeAufstieg(ctx.attachedHero ?? ps?.heroes?.[ctx.card?.heroIdx]);
    },
    onGameStart: (ctx) => {
      const ps = ctx._engine?.gs?.players?.[ctx.cardHeroOwner ?? ctx.cardOwner];
      meldeAufstieg(ctx.attachedHero ?? ps?.heroes?.[ctx.card?.heroIdx]);
    },
  },

  // Fuer die aufgestiegene Form und Tests.
  _AUFSTIEG_ZIEL: AUFSTIEG_ZIEL,
  _AUFSTIEG_VERLUST: AUFSTIEG_VERLUST,
};
