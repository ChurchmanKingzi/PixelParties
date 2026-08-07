// ═══════════════════════════════════════════
//  ASCENDED HERO: "Stormkissed Waflav"
//  400 HP, 100 ATK — Waflav archetype
//
//  "You must play this Hero from your hand on top of a
//   'Waflav' Hero you control by removing 1 Evolution
//   Counter from it. Ascending this Hero does not end your
//   turn. When you Ascend this Hero, place 2 Evolution
//   Counters on it. You may once per turn Descend this
//   Hero to place 1 Evolution Counter onto it."
//
//  Net +1 counter per Ascension (costs 1, refunds 2) — the
//  archetype's engine piece.
//
//  Dazu der Starthilfe-Effekt aus der Hand: der ERSTE Counter ist mit
//  der Basisform schwer zu bekommen (sie braucht dafuer einen Kill),
//  also kann man eine ueberzaehlige Stormkissed abwerfen, um den
//  Archetyp ueberhaupt in Gang zu bringen.
//
//  Everything shared lives in _waflav-shared.js.
// ═══════════════════════════════════════════

const W = require('./_waflav-shared');

const CARD_NAME = 'Stormkissed Waflav';
const ASCEND_COST = 1;
const DESCEND_GAIN = 1;

module.exports = {
  // 'hand' zusaetzlich, damit der Abwurf-Effekt aus der Hand greift.
  activeIn: ['hand', 'hero'],

  // ── Starthilfe: abwerfen fuer 1 Evolution Counter ──────────────────
  // "You may discard this card from your hand to place 1 Evolution
  //  Counter on top of a 'Waflav' Hero you control."
  //
  // Laeuft ueber den `handActivatedEffect`-Vertrag (Luna Kiai ist das
  // Vorbild). Der Vertrag laesst die Karte normalerweise IN der Hand und
  // stempelt sie als "diese Runde benutzt" — hier wird sie stattdessen
  // abgeworfen, der Stempel landet also auf einer Instanz, die die Hand
  // ohnehin verlassen hat. Kein Once-per-turn noetig: die Kosten sind
  // die Karte selbst.
  handActivatedEffect: true,
  handActivateLabel: 'Discard → 1 Evolution Counter',

  canHandActivate(gs, pi, engine) {
    return W.waflavHeroTargets(engine, pi).length > 0;
  },

  async onHandActivate(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const targets = W.waflavHeroTargets(engine, pi);
    if (targets.length === 0) return false;

    // Immer waehlen lassen, auch bei nur einem Ziel — dieselbe Vorgabe
    // wie bei der Cottage: der Spieler soll sehen, wohin der Counter
    // geht, bevor die Karte weg ist.
    const pick = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      source: CARD_NAME,
      description: 'Discard this card to place 1 Evolution Counter on a "Waflav" Hero you control.',
      confirmLabel: '🧬 Discard!',
      confirmClass: 'btn-warning',
      cancellable: true,          // "You may"
      maxTotal: 1,
      minRequired: 1,
    });
    if (!pick || pick.length === 0) return false;
    const sel = targets.find(t => t.id === pick[0]);
    if (!sel) return false;

    const discarded = await W.discardFromHand(engine, pi, CARD_NAME, ctx.handIndex, CARD_NAME);
    if (!discarded) return false;

    W.addEvo(engine, pi, sel.heroIdx, 1, CARD_NAME);
    engine.sync();
    return true;
  },

  /**
   * CPU-Soft-Gate fuer den Hand-Abwurf.
   *
   * Die Karte hat ZWEI Verwendungen aus derselben Hand: Abwurf gegen
   * 1 Counter, oder Aufstieg fuer 1 Counter (netto +1 plus Tutor). Wer
   * schon aufsteigen KANN, soll nicht stattdessen abwerfen — der
   * Aufstieg ist in jeder Hinsicht das bessere Geschaeft. Umgekehrt ist
   * der Abwurf die einzige Counter-Quelle, die keinen Kill voraussetzt.
   */
  cpuShouldHandActivate(engine, pi) {
    const targets = W.waflavHeroTargets(engine, pi);
    if (targets.length === 0) return false;
    // Steht bereits genug fuer einen Aufstieg bereit? Dann lieber den.
    for (const t of targets) {
      const h = engine.gs.players[pi]?.heroes?.[t.heroIdx];
      if (W.affordableForms(engine, pi, t.heroIdx).length > 0
          && (engine.gs.players[pi]?.hand || []).some(n => W.FORMS[n]
              && W.FORMS[n].cost <= W.getEvo(h))) {
        return false;
      }
    }
    return true;
  },

  /** CPU: den Helden mit den meisten Countern weiterfuettern. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget' && kind !== 'target') return undefined;
    const { validTargets, playerIdx } = payload || {};
    if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
    const me = playerIdx != null ? playerIdx : engine._cpuPlayerIdx;
    let best = null, bestEvo = -1;
    for (const t of validTargets) {
      if (t.owner !== me) continue;
      const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      const evo = W.getEvo(h);
      if (evo > bestEvo) { bestEvo = evo; best = t; }
    }
    return best ? [best.id] : undefined;
  },

  // ── Ascension ──
  ...W.ascensionContract(ASCEND_COST),
  blockEndPhaseOnAscend: true,   // "does not end your turn"
  formsAscensionStack: true,     // push the previous form for Descend
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
      // flashy transformation flourish

  /**
   * Zwei Dinge beim Aufstieg:
   *   • "When you Ascend this Hero, place 2 Evolution Counters on it."
   *   • On Ascension: "Add 1 Ascended Hero from your deck to your hand."
   * Die Counter zuerst — sie sind bedingungslos, der Tutor kann an einer
   * Handsperre oder einem leeren Deck scheitern.
   */
  async onAscensionBonus(engine, pi, heroIdx) {
    W.addEvo(engine, pi, heroIdx, 2, CARD_NAME);
    engine.sync();
    await W.tutorAscendedHeroes(engine, pi, CARD_NAME, { from: 'deck', max: 1 });
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
    const engine = ctx._engine;
    return await W.performWaflavDescend(
      engine, ctx.cardOwner, ctx.cardHeroIdx, DESCEND_GAIN,
    );
  },

  hooks: { ...W.gameStartHook },

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
    // Keine laufende Quelle — nur der einmalige +2 beim Aufstieg. Als
    // Ruling 6.8.: NIEMALS die beste Ascended Form, ausser die einzige
    // Alternative waere die Basisform.
    // Deckneutraler Vertrag: die Zugende-Messung liest ihn, statt
    // Formnamen zu kennen.
    counterSource: { kind: 'none' },
    // Evolution Counters on this side have a consumer — same
    // declaration Argos uses for Change Counters.
    counterConsumer: true,

    /**
     * Als Regel (5.8.): "Stormkissed abwerfen — immer tun, wenn man auf
     * 0 Countern ist, sonst via ML lernen, ob es das wert ist."
     *
     * Der erste Counter ist der Flaschenhals des ganzen Archetyps: ohne
     * ihn gibt es keinen Aufstieg, ohne Aufstieg keine Bombs und keinen
     * Descend-Zyklus. Die Sofortbewertung sieht davon nichts — sie liest
     * nur "eine Handkarte weniger" (Flashbang-Klasse, wie Perfect
     * Disguise). Deshalb genau in diesem Fall der Bypass; sobald
     * Counter da sind, entscheidet wieder das regulaere Gate.
     */
    alwaysCommit(engine, pi) {
      try {
        const targets = W.waflavHeroTargets(engine, pi);
        if (targets.length === 0) return false;
        return targets.every(t => W.getEvo(engine.gs.players[pi]?.heroes?.[t.heroIdx]) === 0);
      } catch { return false; }
    },
  },
};
