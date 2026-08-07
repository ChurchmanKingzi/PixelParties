// ═══════════════════════════════════════════
//  ASCENDED HERO: "Flamebathed Waflav"
//  450 HP, 140 ATK — Waflav archetype
//
//  "You must play this Hero from your hand on top of a
//   'Waflav' Hero you control by removing 2 Evolution
//   Counters from it. Ascending this Hero does not end your
//   turn. Whenever a target is Burned, place 1 Evolution
//   Counter onto this Hero. You may once per turn Descend
//   this Hero to place 1 Evolution Counter onto it."
//
//  "Whenever a target is Burned" — Als Ruling: EVERY target
//  on the board counts, both sides, mine included. The
//  trigger therefore does not filter by owner. It fires on
//  the status being APPLIED (ON_STATUS_APPLIED), which is
//  the only event the sentence describes; the per-turn tick
//  damage that follows is not a new application.
//
//  Everything shared lives in _waflav-shared.js.
// ═══════════════════════════════════════════

const W = require('./_waflav-shared');

const CARD_NAME = 'Flamebathed Waflav';
const ASCEND_COST = 2;
const DESCEND_GAIN = 1;
const TRIGGER_STATUS = 'burned';

module.exports = {
  activeIn: ['hero'],

  // ── Ascension ──
  ...W.ascensionContract(ASCEND_COST),
  blockEndPhaseOnAscend: true,
  formsAscensionStack: true,
  evolutionAnimation: true,

  /**
   * Nach dem Aufstieg die Ascension-Ziele neu berechnen.
   *
   * `performAscension` loescht direkt vor diesem Aufruf `ascensionReady`
   * und `ascensionTargets` (Aufraeumen der alten Form). Ohne dieses
   * Setup blieben beide leer, bis das naechste Mal ein Counter bewegt
   * wird — GENAU der Fall, den Al gesehen hat: nach dem Aufstieg zu
   * Thunderstruck war mit 7 Countern keine weitere Form waehlbar, und
   * erst der Descend (der Counter setzt und dabei refresht) machte sie
   * wieder sichtbar.
   */
  onAscendSetup(gs, pi, heroIdx, engine) {
    W.refreshAscensionTargets(engine, pi);
  },


  /**
   * On Ascension: "Choose any target on the board and Burn it."
   * Feuert nur beim Aufstieg — `performDescend` ruft den Slot nicht auf.
   * Alle normalen Status-Schranken greifen ueber die Engine-Helfer
   * (Karian, Johanna, Immunitaets-Buffs, Erst-Runden-Schutz).
   */
  async onAscensionBonus(engine, pi, heroIdx) {
    await W.applyStatusOnAscension(engine, pi, CARD_NAME, 'burned', {
      duration: 1, animationType: 'fire_burst',
      description: 'Choose any target on the board and Burn it.',
      confirmLabel: '🔥 Burn!',
      confirmClass: 'btn-danger',
    });
  },

  /** CPU: immer die gefaehrlichste gegnerische Karte treffen. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget' && kind !== 'target') return undefined;
    return W.cpuPickEnemyTarget(engine, payload);
  },

  // ── Descend (once per turn, free) ──
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    return W.canDescend(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx);
  },

  cpuShouldUseHeroEffect(engine, pi, heroIdx) {
    return W.cpuShouldDescend(engine, pi, heroIdx);
  },

  async onHeroEffect(ctx) {
    return await W.performWaflavDescend(
      ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, DESCEND_GAIN,
    );
  },

  hooks: {
    ...W.gameStartHook,

    /** "Whenever a target is Burned, place 1 Evolution Counter onto this Hero." */
    onStatusApplied: async (ctx) => {
      // Der Statusname kommt je nach Feuerstelle unter ZWEI verschiedenen
      // Feldern an: die Helden-Pfade in `addHeroStatus` senden nur
      // `statusName`, die Creature-Pfade nur `status`, zwei weitere
      // Stellen senden beide. Wer nur eines liest, ist fuer die halbe
      // Engine blind — genau deshalb lesen Luna Pele und die vier
      // Mischief-Militia-Karten schon heute beide. Bis die Engine das
      // vereinheitlicht, machen wir es ebenso.
      const applied = ctx.statusName || ctx.status;
      if (applied !== TRIGGER_STATUS) return;
      const engine = ctx._engine;
      const pi = ctx.cardOriginalOwner;
      const heroIdx = ctx.card?.heroIdx;
      if (typeof heroIdx !== 'number' || heroIdx < 0) return;
      const self = engine.gs.players[pi]?.heroes?.[heroIdx];
      if (self?.name !== CARD_NAME || self.hp <= 0) return;
      W.addEvo(engine, pi, heroIdx, 1, CARD_NAME);
      engine.sync();
    },
  },

  // Fighting-Lv1-Boden gegen Lern-Drift (Begruendung in _waflav-shared).
  // An JEDER Form deklariert, weil `abilityPlacementBonus` das Skript der
  // AKTUELLEN Form nachschlaegt und Abilities auch im aufgestiegenen
  // Zustand platziert werden.
  cpuAbilityPriorFloor(abilityName, targetLevel) {
    return W.waflavAbilityPriorFloor(abilityName, targetLevel);
  },

  cpuMeta: {
    // Kosten 0 = der Helden-Effekt dieser Form VERBRAUCHT keine Zaehler
    // (der Descend legt welche nach). Der Ausgabe-Kanal bleibt dadurch
    // stumm — der Vertrag wird hier nur wegen seines LESE-Zugriffs
    // deklariert.
    //
    // Warum das noetig ist: `classifyFormTurn` und `classifyDescendTags`
    // holen den Zaehlerstand ueber genau diesen Vertrag. Ohne ihn meldeten
    // die vier Descend-Formen still `evo: 0`, egal wie viele Zaehler
    // wirklich auf ihnen lagen — die Kennzahl "Zaehlerstand am Zugende"
    // war fuer jeden ascended beendeten Zug schlicht falsch.
    counterSpend: W.counterSpendContract(() => 0),
    // ── Ability-Prior-Identitaet (Als Vorschlag 6.8.) ────────────────
    // Alle Formen dieses Helden teilen sich EINEN Prior-Satz fuer
    // Ability-Platzierungen. Begruendung: `performAscension` fasst
    // `abilityZones` nicht an — die Abilities haengen am HELDENSLOT und
    // ueberleben jeden Auf- und Abstieg. Es gibt also gar keine
    // Entscheidung "welche Form soll Fighting bekommen", es gibt nur
    // "soll dieser Held Fighting bekommen".
    //
    // Getrennte Priors waren nicht bloss duenn, sie waren VERDREHT: der
    // Recorder stempelt `abilities` am SPIELENDE mit dem dann aktuellen
    // Formnamen. `Fighting@Flamebathed +150` (11 Beobachtungen) hiess
    // damit nicht "Fighting ist gut auf Flamebathed", sondern "Spiele,
    // die in Flamebathed-Form endeten, liefen gut" — die Endform-WR
    // reicht von 30.2% (Basis) bis 68.8% (Thunderstruck), also lud der
    // Ability-Kanal genau diese Spanne als Ability-Wert ein. Umgekehrt
    // stammte `Fighting@Waflav −60` aus 691 Beobachtungen von Spielen,
    // die in der Basisform endeten — den verlorenen.
    abilityIdentity: W.ARCHETYPE,
    // Woher bezieht DIESE Form laufend Evolution Counter?
    // Zaehler, sobald IRGENDEIN Ziel verbrannt wird — richtig, wenn ein
    // Burn-Applier zur Hand ist (Als Ruling 6.8.).
    // Deckneutraler Vertrag: die Zugende-Messung liest ihn, statt
    // Formnamen zu kennen.
    counterSource: { kind: 'status', status: 'burned' },
    counterConsumer: true,
  },
};
