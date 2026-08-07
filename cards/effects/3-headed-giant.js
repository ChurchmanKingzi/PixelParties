// ═══════════════════════════════════════════
//  CARD EFFECT: "3-Headed Giant"
//  Creature (Summoning Magic Lv3, Normal, 150 HP)
//
//  "You may up to 3 times per turn choose a target
//   and deal 80 damage to it."
//
//  Umsetzung
//  ─────────
//  • AKTIVER Effekt (`creatureEffect`), keine
//    Aktionskosten — der Kartentext nennt keine,
//    und aktive Effekte kosten ohne ausdrückliche
//    Angabe nie eine Aktion. Damit Main Phase 1/2,
//    Beschwörungskrankheit greift wie üblich.
//  • DREI EINZELNE Aktivierungen, nicht ein Picker
//    mit drei Zielen. Jede wählt ihr Ziel neu; ein
//    Ziel darf mehrfach getroffen werden, weil der
//    Text es nicht ausschließt.
//  • "a target" ohne weitere Einschränkung heißt
//    JEDES Ziel: beide Seiten, Helden wie Creatures.
//  • Die Engine sperrt Kreatur-Effekte auf einmal
//    pro Runde. Wir führen den Verbrauch selbst und
//    setzen `ctx._skipCreatureEffectHopt`, solange
//    noch Nutzungen offen sind; mit der DRITTEN
//    lassen wir die Engine normal stempeln, damit
//    die Karte im Client korrekt ausgraut. Muster
//    von Analyzer from the Cosmic Depths.
//  • Der Zähler steht auf der INSTANZ und trägt die
//    Rundennummer mit sich, setzt sich also selbst
//    zurück. Bewusst NICHT über einen
//    `onTurnStart`-Hook wie bei Archer: Hooks von
//    Creatures feuern nicht, solange sie Frozen /
//    Stunned / Negated / Nulled sind (runHooks-
//    Filter). Ein eingefrorener Riese hätte seinen
//    Zähler nie zurückgesetzt und wäre nach dem
//    Auftauen dauerhaft verbraucht gewesen.
// ═══════════════════════════════════════════

const CARD_NAME = '3-Headed Giant';
const MAX_USES  = 3;
const DAMAGE     = 80;

const TURN_KEY = '_threeHeadedGiantTurn';
const USES_KEY = '_threeHeadedGiantUses';

/** Bereits verbrauchte Nutzungen in der LAUFENDEN Runde. */
function usesThisTurn(gs, inst) {
  const c = inst?.counters;
  if (!c) return 0;
  if (c[TURN_KEY] !== (gs?.turn || 0)) return 0;   // andere Runde → 0
  return c[USES_KEY] || 0;
}

/** Eine Nutzung verbuchen; gibt den neuen Stand zurück. */
function spendUse(gs, inst) {
  if (!inst.counters) inst.counters = {};
  const turn = gs?.turn || 0;
  if (inst.counters[TURN_KEY] !== turn) {
    inst.counters[TURN_KEY] = turn;
    inst.counters[USES_KEY] = 0;
  }
  inst.counters[USES_KEY] = (inst.counters[USES_KEY] || 0) + 1;
  return inst.counters[USES_KEY];
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  /**
   * Einzige Stelle, die "darf noch" beantwortet — Client-Ausgrauen und
   * CPU lesen beide hierüber (Engine: creatureEffectStillAvailable).
   * Damit kann die CPU nie mehr Nutzungen bekommen als ein Mensch.
   */
  canActivateCreatureEffect(ctx) {
    return usesThisTurn(ctx._engine?.gs, ctx.card) < MAX_USES;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOwner;
    const inst   = ctx.card;
    // Physische Renderseite: Quell-Animationen starten am tatsächlichen
    // Support-Slot (cardHeroOwner), nicht beim Aktivierenden — die
    // beiden laufen bei einer temporär geklauten Creature auseinander.
    const heroIdx = ctx.cardHeroIdx;

    const used = usesThisTurn(gs, inst);
    if (used >= MAX_USES) return false;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: DAMAGE,
      title: CARD_NAME,
      description: `Choose a target and deal ${DAMAGE} damage to it. (${used + 1}/${MAX_USES} this turn)`,
      confirmLabel: `🪵 ${DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    // Abbruch VOR der Zielwahl kostet nichts: keine Nutzung verbucht,
    // und der Rückgabewert false hält die Engine davon ab, die Sperre
    // zu stempeln.
    if (!target) return false;

    const spent = spendUse(gs, inst);
    // Solange noch Nutzungen offen sind, die Engine-Sperre offen lassen.
    // Mit der letzten NICHT mehr — dann greift die reguläre Sperre und
    // die Karte graut aus.
    if (spent < MAX_USES) ctx._skipCreatureEffectHopt = true;

    const tgtOwner    = target.owner;
    const tgtHeroIdx  = target.heroIdx;
    const impactSlot  = target.type === 'hero' ? -1 : target.slotIdx;

    // Stachelkeule kracht von oben auf das Ziel.
    engine._broadcastEvent('play_zone_animation', {
      type: 'spiked_club_smash',
      owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
    });
    // Aufprall der Animation liegt bei 380 ms (siehe clubSmashDrop in
    // style.css); der Schaden landet direkt danach.
    await engine._delay(480);

    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, DAMAGE, 'creature');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('three_headed_giant_smash', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      damage: DAMAGE,
      use: spent,
      usesRemaining: MAX_USES - spent,
    });
    engine.sync();
    return true;
  },
};
