// ═══════════════════════════════════════════
//  CARD EFFECT: "Fun-Fun Circus Director"
//  Creature (Magic Arts / Summoning Magic Lv2, Normal, 90 HP) — PP MBS
//
//  „For every 5 Applause Counters on the board, your Resource Phase
//   repeats an additional time. Whenever another "Fun-Fun Circus"
//   Creature is defeated, you may discard 1 card to move all its
//   Applause Counters to this Creature, then discard a second card to
//   add it back to your hand instead of sending it to the discard pile."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────
//  • ① Resource Phase: `extraResourcePhases` = ⌊Brett-Summe / 5⌋, LIVE zu
//    Phasenbeginn (Engine: `_extraResourcePhases`, `case RESOURCE`). Jede
//    Wiederholung ist die volle Phase (Ziehen 1, 4 Gold, Phasenende-
//    Boni); mehrere Directors addieren sich. Nur die EIGENE Phase; eine
//    negierte Director zaehlt nicht (`isCardEffectActive`).
//  • ② „another 'Fun-Fun Circus' Creature": nur MEINE (Kontrolleur =
//    Director-Kontrolleur) — sie kommt auf MEINE Hand.
//  • Zweistufig, jede Stufe optional und nacheinander:
//      1. Abwurf 1 Karte → ALLE Applause Counter der sterbenden Creature
//         wandern auf den Director (Verschieben, kein Platzieren — kein
//         Elephant-Zaehlen). Auch bei 0 Countern erlaubt (Tor zu Stufe 2).
//      2. Zweiter Abwurf → die Creature kommt statt in die Ablage auf die
//         Hand (Todes-Anspruch `_deathClaim`, kein Zwischenstopp in der
//         Ablage; die Zaehler sind durch Stufe 1 schon beim Director).
//    Abbruch in Stufe 2 laesst Stufe 1 gelten.
//  • Der Abwurf ist eine KOSTE (Lernkanal `costFor`).
// ═══════════════════════════════════════════

const { boardTotal, istCircus, moveApplause, zaehler } = require('./_applause-shared');

const CARD_NAME = 'Fun-Fun Circus Director';

/** Abwurf-Kosten-Prompt: Karte waehlen + abwerfen. `true` = bezahlt. */
async function abwurfZahlen(engine, pi, beschreibung) {
  const ps = engine.gs.players[pi];
  if (!ps || (ps.hand || []).length === 0) return false;
  const antwort = await engine.promptGeneric(pi, {
    type: 'forceDiscardCancellable',
    costFor: CARD_NAME,
    costKind: 'protect',
    title: CARD_NAME,
    description: beschreibung,
    instruction: 'Click a card in your hand to discard it.',
    eligibleIndices: ps.hand.map((_, i) => i),
    cancellable: true,
  });
  if (!antwort || antwort.cancelled || antwort.cardName == null) return false;
  return !!(await engine.actionDiscardHandCard(pi, antwort.cardName, antwort.handIndex, { source: CARD_NAME }));
}

module.exports = {
  activeIn: ['support'],

  // ① Zusaetzliche Resource Phasen — Engine liest das je Spielerzug.
  extraResourcePhases(engine) {
    return Math.floor(boardTotal(engine) / 5);
  },

  // CPU: kostenlose Aufwertung — Abwurf-Prompts vom Lernkanal, sonst ja.
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onCreatureDeathClaim: async (ctx) => {
      const engine = ctx._engine;
      const director = ctx.card;
      if (!director || director.zone !== 'support') return;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const tot = ctx.creature;
      if (!tot || tot.instId === director.id) return;
      if ((tot.controller ?? tot.owner) !== pi) return;        // nur MEINE
      if (!istCircus(engine, tot.name)) return;

      const toteInst = engine.cardInstances.find(c => c.id === tot.instId);
      if (!toteInst || toteInst._deathClaim) return;           // Anspruch schon vergeben
      const n = zaehler(toteInst);

      // ── Stufe 1: Abwurf → Counter auf den Director ────────────────
      const ok1 = await abwurfZahlen(engine, pi,
        `${tot.name} was defeated. Discard 1 card to move its ${n} Applause Counter${n === 1 ? '' : 's'} to ${CARD_NAME}?`);
      if (!ok1) return;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `director:${tot.instId}` });
      const bewegt = moveApplause(engine, toteInst, director);
      engine.log('director_move_applause', {
        player: engine.gs.players[pi]?.username, from: tot.name, moved: bewegt,
      });

      // ── Stufe 2: zweiter Abwurf → zurueck auf die Hand ────────────
      if (toteInst._deathClaim) return;
      const ok2 = await abwurfZahlen(engine, pi,
        `Discard a second card to add ${tot.name} back to your hand instead of sending it to the discard pile?`);
      if (!ok2 || toteInst._deathClaim) return;
      toteInst._deathClaim = { to: 'hand', name: tot.name, owner: pi, by: CARD_NAME };
      engine.log('director_to_hand', { player: engine.gs.players[pi]?.username, creature: tot.name });
    },
  },
};
