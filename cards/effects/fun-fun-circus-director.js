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
//  • Zweistufig, jede Stufe optional und nacheinander (beide WAHLEN kommen
//    sofort hintereinander, die Abwuerfe samt Animationen erst danach):
//      1. Abwurf 1 Karte → ALLE Applause Counter der sterbenden Creature
//         wandern auf den Director (zaehlt fuer den Elephant in der Hand
//         wie Platzieren, Als Ruling 29.9.). Auch bei 0 Countern erlaubt (Tor zu Stufe 2).
//      2. Zweiter Abwurf → die Creature kommt statt in die Ablage auf die
//         Hand (Todes-Anspruch `_deathClaim`, kein Zwischenstopp in der
//         Ablage; die Zaehler sind durch Stufe 1 schon beim Director).
//    Abbruch in Stufe 2 laesst Stufe 1 gelten.
//  • Der Abwurf ist eine KOSTE (Lernkanal `costFor`).
// ═══════════════════════════════════════════

const { boardTotal, istCircus, moveApplause, zaehler } = require('./_applause-shared');

const CARD_NAME = 'Fun-Fun Circus Director';

/**
 * Abwurf-Kosten-Prompt: NUR die Wahl (nichts wird abgeworfen). `ausser` =
 * Handindex, der nicht mehr waehlbar ist (die schon fuer Stufe 1 gewaehlte
 * Karte). Rueckgabe `{ cardName, handIndex }` oder `null` (Abbruch/keine Karte).
 */
async function abwurfWaehlen(engine, pi, beschreibung, ausser = -1) {
  const ps = engine.gs.players[pi];
  const idxs = (ps?.hand || []).map((_, i) => i).filter(i => i !== ausser);
  if (idxs.length === 0) return null;
  const antwort = await engine.promptGeneric(pi, {
    type: 'forceDiscardCancellable',
    costFor: CARD_NAME,
    costKind: 'protect',
    title: CARD_NAME,
    description: beschreibung,
    instruction: 'Click a card in your hand to discard it.',
    eligibleIndices: idxs,
    cancellable: true,
  });
  if (!antwort || antwort.cancelled || antwort.cardName == null) return null;
  return { cardName: antwort.cardName, handIndex: antwort.handIndex };
}

/** Wirft die gewaehlte Karte ab (`opts`: `_noGlow`/`_noPace` fuer die zweite). */
async function abwerfen(engine, pi, wahl, opts = {}) {
  return !!(await engine.actionDiscardHandCard(pi, wahl.cardName, wahl.handIndex, { source: CARD_NAME, ...opts }));
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

      // ── Beide Wahlen ZUERST, danach erst die Abwuerfe ─────────────
      // Als Befund 29.9. („zu langer Delay zwischen Aktivierung und ‚Ich darf
      // jetzt abwerfen'"): Glow (500 ms), Abwurf-Takt und Auftritt der ersten
      // Stufe standen VOR der zweiten Abfrage. Jetzt kommt die zweite Frage
      // sofort nach der ersten Antwort; die Animationen laufen erst danach.
      // Die zweite Wahl darf die erste Karte nicht noch einmal nehmen.
      const wahl1 = await abwurfWaehlen(engine, pi,
        `${tot.name} was defeated. Discard 1 card to move its ${n} Applause Counter${n === 1 ? '' : 's'} to ${CARD_NAME}?`);
      if (!wahl1) return;
      const wahl2 = await abwurfWaehlen(engine, pi,
        `Discard a second card to add ${tot.name} back to your hand instead of sending it to the discard pile? (Cancel: keep only the Applause Counters move.)`,
        wahl1.handIndex);
      if (toteInst._deathClaim) return;   // waehrend der Abfragen weggeschnappt

      // ── Stufe 1: Abwurf → Counter auf den Director ────────────────
      if (!(await abwerfen(engine, pi, wahl1))) return;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `director:${tot.instId}` });
      const bewegt = moveApplause(engine, toteInst, director);
      engine.log('director_move_applause', {
        player: engine.gs.players[pi]?.username, from: tot.name, moved: bewegt,
      });

      // ── Stufe 2: zweiter Abwurf → zurueck auf die Hand ────────────
      if (!wahl2 || toteInst._deathClaim) return;
      // Die Hand ist um die erste Karte geschrumpft.
      const idx2 = wahl2.handIndex - (wahl2.handIndex > wahl1.handIndex ? 1 : 0);
      // Director hat gerade geleuchtet — kein zweiter Glow (Kosmetik-Dedupe).
      if (!(await abwerfen(engine, pi, { cardName: wahl2.cardName, handIndex: idx2 }, { _noGlow: true }))) return;
      toteInst._deathClaim = { to: 'hand', name: tot.name, owner: pi, by: CARD_NAME };
      engine.log('director_to_hand', { player: engine.gs.players[pi]?.username, creature: tot.name });
    },
  },
};
