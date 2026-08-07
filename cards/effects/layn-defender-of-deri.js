// ═══════════════════════════════════════════
//  CARD EFFECT: "Layn, Defender of Deri"
//  Hero — 450 HP, 50 ATK
//  Starting abilities: Leadership, Toughness
//
//  Kartentext: "Increase the current and max HP
//  of any Creature you summon by 100."
//
//  EINMALIGER Bonus im Moment des Beschwoerens.
//  Er wird NIE zurueckgenommen — weder bei Layns
//  Tod noch bei Frozen / Stunned / Negated.
//
//  Tod und CC bewirken GENAU EINES (Als Ruling):
//  Creatures, die WAEHREND dieser Zeit beschworen
//  werden, bekommen den Bonus nicht. Kein Entzug,
//  keine rueckwirkende Nachvergabe, wenn Layn sich
//  erholt oder wiederbelebt wird.
//
//  Das erledigt die Engine von selbst: der zentrale
//  Listener-Filter in `runHooks` laesst die Hooks
//  eines toten oder CC'ten Helden gar nicht erst
//  feuern (allgemeine Regel: passiver Effekt wirkt
//  nicht waehrend stunned/frozen/negiert). Deshalb
//  gibt es hier KEIN `bypassStatusFilter` — es wuerde
//  genau diese Regel aushebeln.
//
//  Tracking: each buffed creature instance
//  carries inst.counters._laynBonus = 100.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Layn, Defender of Deri';
const BONUS     = 100;

// ─── Helpers ──────────────────────────────

/**
 * True when Layn is alive and unaffected by CC — die Bedingung fuer
 * eine NEUE Bonus-Vergabe.
 *
 * Doppelt gemoppelt und mit Absicht: der zentrale Listener-Filter in
 * `runHooks` unterdrueckt Hooks eines toten oder CC'ten Helden bereits.
 * Diese Pruefung ist der Guertel zum Hosentraeger — und sie dokumentiert
 * die Regel an der Stelle, an der sie zaehlt.
 */
function laynIsActive(hero) {
  return !!(
    hero && hero.hp > 0 &&
    !hero.statuses?.frozen &&
    !hero.statuses?.stunned &&
    !hero.statuses?.negated
  );
}

/**
 * Apply the HP bonus to a single creature instance that doesn't yet have it.
 * Uses ctx.increaseMaxHp so creature currentHp and maxHp both increase by BONUS.
 */
function applyBonus(ctx, inst) {
  if (inst.counters._laynBonus) return; // already buffed
  ctx.increaseMaxHp(inst, BONUS);
  inst.counters._laynBonus = BONUS;
}



// ─── Card module ──────────────────────────

const LAYN_ASCENSION_ITEM = 'Earth-Shattering Hammer, Relic of Deri';

module.exports = {
  activeIn: ['hero'],

  // Ascension condition cannot be bypassed via cheat mode
  cheatAscensionBlocked: true,

  // KEIN `bypassStatusFilter`: der zentrale Filter SOLL hier greifen —
  // er ist genau das, was "waehrend CC / tot keine neuen Boni" umsetzt.
  //
  // KEIN `cpuStatusSelfValue` mehr: die frueheren -80 standen dafuer,
  // dass CC Layn ihre ganze Aura entriss. Da nichts mehr entzogen wird,
  // ist ein Freeze auf Layn nicht schlimmer als auf jeden anderen
  // Helden mit Passive.

  // Vertrag für Träger-Schutz (Slippery Fridge & Co.).
  ascensionItems: [LAYN_ASCENSION_ITEM],

  // CPU ascension targeting: the Hammer is the only card that progresses Layn.
  ascensionNeedsCard(cardName, _cardData, engine, pi, hi) {
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero || hero.name !== CARD_NAME) return false;
    if (hero.ascensionReady) return false;
    if (cardName !== LAYN_ASCENSION_ITEM) return false;
    const alreadyHas = engine.cardInstances.some(c =>
      c.owner === pi && c.zone === 'support' &&
      c.heroIdx === hi && c.name === cardName);
    return !alreadyHas;
  },

  // CPU evaluator: 0 or 1 — binary for Layn (only one required item).
  ascensionProgress(engine, pi, hi) {
    const has = engine.cardInstances.some(c =>
      c.owner === pi && c.zone === 'support' &&
      c.heroIdx === hi && c.name === LAYN_ASCENSION_ITEM);
    return has ? 1 : 0;
  },

  hooks: {
    // ── Der EINZIGE Hook: Bonus beim Beschwoeren ──────────────────────────
    // Frueher gab es hier zusaetzlich onGameStart / onPlay (Flaechen-
    // Vergabe an alle bereits stehenden Creatures), onStatusApplied /
    // onStatusRemoved (Entzug bei CC + Nachvergabe danach), onHeroKO
    // (Entzug beim Tod) und onHeroRevive (Nachvergabe danach). Alle
    // ersatzlos entfernt: der Bonus gilt "any Creature you SUMMON",
    // wird nie entzogen und nie rueckwirkend nachgereicht.

    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support') return;

      const entering = ctx.enteringCard;
      if (!entering) return;

      const pi = ctx.cardOwner;
      if (entering.owner !== pi && entering.controller !== pi) return;

      const engine = ctx._engine;
      const cd = engine.getEffectiveCardData(entering) || engine._getCardDB()[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      const hero = ctx.attachedHero;
      if (!laynIsActive(hero)) return;
      if (entering.counters._laynBonus) return; // already has it (shouldn't happen, but guard)

      applyBonus(ctx, entering);
      engine.sync();
    },

    // ── KEINE Ruecknahme-Hooks ────────────────────────────────────────────
    // Hier standen frueher `onHeroKO` (Entzug beim Tod),
    // `onStatusApplied` (Entzug bei CC), `onStatusRemoved` und
    // `onHeroRevive` (jeweils Nachvergabe an alle). Alle ersatzlos
    // entfernt.
    //
    // Als Ruling: der Bonus wird NIE zurueckgenommen. Tod und CC
    // bewirken ausschliesslich, dass waehrenddessen beschworene
    // Creatures ihn nicht bekommen — und dafuer braucht es hier gar
    // nichts: der zentrale Listener-Filter in `runHooks` laesst
    // `onCardEnterZone` bei totem oder CC'tem Helden nicht feuern.
    //
    // Historie als Warnung: das alte `onHeroKO` hat NIE gefeuert, weil
    // seine Wache `ctx.heroIdx` / `ctx.deadHero` las, die Engine aber
    // `{ hero, source, _bypassDeadHeroFilter }` sendet. Ich habe die
    // Wache einmal "repariert" und damit den Entzug erst scharf
    // gestellt — der tote Code hatte in Wahrheit recht.
    // NICHT wieder einbauen.
  },
};
