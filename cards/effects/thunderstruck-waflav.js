// ═══════════════════════════════════════════
//  ASCENDED HERO: "Thunderstruck Waflav"
//  500 HP, 120 ATK — Waflav archetype
//
//  "You must play this Hero from your hand on top of a
//   'Waflav' Hero you control by removing 2 Evolution
//   Counters from it. Ascending this Hero does not end your
//   turn. Whenever this Hero defeats a target, place 1
//   Evolution Counter on it and choose any target on the
//   board and Stun it for 1 turn. You may once per turn
//   Descend this Hero to place 1 Evolution Counter onto it."
//
//  "defeats a target" — Als Ruling: no narrowing on the card,
//  so EVERY direct damage counts (Attack, Spell, effect), but
//  NOT status ticks and NOT damage dealt by Creatures. Both
//  exclusions are handled by `W.defeatTriggerHooks`.
//
//  "place 1 Evolution Counter on it" — "it" is this Hero; the
//  defeated target is gone.
//
//  "choose any target on the board" — literally any, including
//  the controller's own cards. Mandatory once the trigger fires
//  (the text has no "you may"), so the prompt is not cancellable.
//  The stun itself mirrors Deepsea Mummy: Hero and Creature
//  branch, `duration: 1`, electric strike.
// ═══════════════════════════════════════════

const W = require('./_waflav-shared');

const CARD_NAME = 'Thunderstruck Waflav';
const ASCEND_COST = 2;
const DESCEND_GAIN = 1;

async function onDefeat(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOriginalOwner;
  const heroIdx = ctx.card?.heroIdx;
  if (typeof heroIdx !== 'number' || heroIdx < 0) return;
  const self = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (self?.name !== CARD_NAME || self.hp <= 0) return;

  // "place 1 Evolution Counter on it"
  W.addEvo(engine, pi, heroIdx, 1, CARD_NAME);
  engine.sync();

  // "and choose any target on the board and Stun it for 1 turn"
  const targets = W.collectBoardTargets(engine);
  if (targets.length === 0) return;

  const pick = await engine.promptEffectTarget(pi, targets, {
    title: CARD_NAME,
    source: CARD_NAME,            // CPU dispatch key — see CARD_API.md
    description: 'Choose any target on the board to Stun for 1 turn.',
    confirmLabel: '⚡ Stun!',
    confirmClass: 'btn-warning',
    cancellable: false,           // the text has no "you may"
    maxTotal: 1,
    minRequired: 1,
    appliesStatus: 'stunned',
    redSelect: true,
  });
  if (!pick || pick.length === 0) return;
  const sel = targets.find(t => t.id === pick[0]);
  if (!sel) return;

  if (sel.type === 'hero') {
    await engine.addHeroStatus(sel.owner, sel.heroIdx, 'stunned', {
      duration: 1, appliedBy: pi, animationType: 'electric_strike',
    });
  } else if (sel.cardInstance) {
    await engine.applyCreatureStatus(sel.cardInstance, 'stunned', {
      duration: 1, appliedBy: pi, animationType: 'electric_strike',
    });
  }
  engine.log('thunderstruck_stun', {
    player: engine.gs.players[pi]?.username, target: sel.cardName,
  });
  engine.sync();
}

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
   * On Ascension: "Choose any target on the board and Stun it for 1 turn."
   * Derselbe Effekt wie beim Defeat-Trigger, nur ohne Counter — und er
   * feuert ausschliesslich beim Aufstieg, nicht beim Descend.
   */
  async onAscensionBonus(engine, pi, heroIdx) {
    await W.applyStatusOnAscension(engine, pi, CARD_NAME, 'stunned', {
      duration: 1,
      animationType: 'electric_strike',
      description: 'Choose any target on the board and Stun it for 1 turn.',
      confirmLabel: '⚡ Stun!',
      confirmClass: 'btn-warning',
    });
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

  /** CPU: immer die gefaehrlichste gegnerische Karte stunnen. Deckt
   *  BEIDE Stun-Prompts ab (Aufstieg und Defeat-Trigger) — sie teilen
   *  denselben `source`-Namen. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget' && kind !== 'target') return undefined;
    return W.cpuPickEnemyTarget(engine, payload);
  },

  hooks: { ...W.gameStartHook, ...W.defeatTriggerHooks(onDefeat) },

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
    // Einzige Ascended Form, die den Defeat-Trigger der Basis wiederholt —
    // deshalb der richtige Endpunkt, wenn Waflav angreifen kann und
    // einen Kill sieht (Als Ruling 6.8.).
    // Deckneutraler Vertrag: die Zugende-Messung liest ihn, statt
    // Formnamen zu kennen.
    counterSource: { kind: 'defeat' },
    counterConsumer: true,
    appliesStatus: 'stunned',
  },
};
