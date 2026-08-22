// ═══════════════════════════════════════════
//  CARD EFFECT: "The Core's Awakening"
//  Spell (Reaction, Support Magic Lv1)
//
//  "Play this card immediately when you play an Artifact. Choose up to
//   1/2/3 copies of that Artifact from your deck and send them to your
//   discard pile before the Artifact's effect resolves."
//
//  ── Der Beschleuniger des Archetyps ──
//  Jede Future-Tech-Karte wird staerker, je mehr Kopien ihrer selbst in
//  der Ablage liegen — und diese Reaktion befuellt die Ablage GENAU mit
//  der Karte, die gerade gespielt wird, und zwar BEVOR deren Effekt
//  aufloest. Spielt man die zweite Barrage und laesst vorher zwei
//  weitere Kopien in die Ablage wandern, schlaegt sie dreifach zu.
//
//  ── „1/2/3" ist die Schulstufe des Wirkers ──
//  Hausnotation (Create Illusion, Army of the Cute, Betrayal): die drei
//  Zahlen stehen fuer Stufe 1, 2 und 3 der geforderten Schule — hier
//  Support Magic. Gedeckelt auf 1..3.
//
//  ── Reaktion auf die EIGENE Karte ──
//  Anders als Rusty Touch (`lastLink.owner === pi` → false) verlangt
//  diese Karte das Gegenteil: das Artefakt muss MIR gehoeren. Sonst
//  gleicher Vertrag — `isReaction`, `canActivate: false`,
//  `reactionCondition` prueft die letzte Kette.
//
//  ── Bewegung wird animiert ──
//  Der Weg Deck → Ablage laeuft ueber den gemeinsamen Helfer und damit
//  ueber `actionMillCards` (Als Regel 21.8.); die Karten fliegen
//  einzeln.
// ═══════════════════════════════════════════

const { schickeVonDeckInAblage } = require('./_future-tech-shared');

const CARD_NAME = "The Core's Awakening";
const SCHULE = 'Support Magic';

/** Wie viele Kopien darf der Wirker holen? Schulstufe, 1..3. */
function maximum(gs, pi, engine, heroIdx) {
  const ps = gs.players[pi];
  const zonen = ps?.abilityZones?.[heroIdx];
  if (!zonen) return 1;
  const stufe = engine.countAbilitiesForSchool(SCHULE, zonen);
  return Math.max(1, Math.min(stufe, 3));
}

/** Der erste Held, der diese Reaktion wirken darf. */
function wirkenderHeld(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return -1;
  const cd = engine._getCardDB()[CARD_NAME];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.negated) continue;
    if (engine.heroMeetsLevelReq(pi, hi, cd)) return hi;
  }
  return -1;
}

module.exports = {
  isReaction: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const letzte = chainCtx.chain[chainCtx.chain.length - 1];
    // ★ EIGENES Artefakt (Gegenteil von Rusty Touch)
    if (letzte.owner !== pi) return false;
    if (letzte.cardType !== 'Artifact') return false;
    // Ohne Kopie im Deck waere die Reaktion folgenlos
    const ps = gs.players[pi];
    if (!ps || !(ps.mainDeck || []).includes(letzte.cardName)) return false;
    return wirkenderHeld(gs, pi, engine) >= 0;
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps || !chain || myIndex === undefined) return;

    // Das Artefakt, auf das reagiert wurde, liegt direkt darunter.
    const ziel = chain[myIndex - 1];
    if (!ziel || ziel.cardType !== 'Artifact') return;
    const name = ziel.cardName;

    const heroIdx = wirkenderHeld(gs, pi, engine);
    if (heroIdx < 0) return;
    const grenze = maximum(gs, pi, engine, heroIdx);

    // „up to": so viele wie im Deck liegen, hoechstens die Schulstufe.
    const vorhanden = (ps.mainDeck || []).filter(n => n === name).length;
    const wieViele = Math.min(grenze, vorhanden);
    if (wieViele <= 0) return;

    // ── Blitze aus der Kettenanzeige (Als Vorgabe 21.8.) ──
    // Von DIESER Karte in der Kette einmal auf das Artefakt-Glied
    // darunter und einmal auf das eigene Deck — dieselbe Blitzform wie
    // bei Future Tech Barrage (`bolt: true`). Die Anker sind keine
    // Brettzonen, deshalb ueber die Selektor-Ueberschreibung des
    // Beam-Kanals (v538).
    const meins = `[data-chain-idx="${myIndex}"]`;
    const artefakt = `[data-chain-idx="${myIndex - 1}"]`;
    const deck = pi === 0 ? '[data-my-deck]' : '[data-opp-deck]';
    for (const ziel of [artefakt, deck]) {
      engine._broadcastEvent('play_beam_animation', {
        sourceSelector: meins, targetSelector: ziel,
        color: '#9fdcff', glow: '#7cc4ff',
        thickness: 0.8, duration: 700,
        impactAnim: 'electric_strike', impactOpacity: 0.7,
        bolt: true,
      });
      await engine._delay(120);
    }
    await engine._delay(260);

    const bewegt = await schickeVonDeckInAblage(
      engine, pi, Array(wieViele).fill(name), CARD_NAME,
    );

    engine.log('ft_core_awakening', {
      player: ps.username, card: name, count: bewegt.length, max: grenze,
    });
    engine.sync();
  },
};
