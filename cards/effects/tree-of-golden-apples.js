'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Tree of Golden Apples"  (W79)
//  Spell (Area, Lv1, Magic Arts)
//
//  „At the start of each turn, the turn player may choose any target their opponent controls and take control of it until the end of their turn. Targets controlled that
//   way are unaffected by all other cards and effects."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • Zu Beginn JEDES Zuges (`onTurnStart` der liegenden Area, beide Spieler): der ZUGSPIELER darf (abbrechbar, „may") ein beliebiges Ziel wählen, das sein Gegner kontrolliert —
//    einen Helden, eine Kreatur oder einen Token, der als Kreatur zählt — und es bis zum Ende seines Zuges übernehmen.
//  • Die Ziele BLEIBEN IN IHREN ZONEN; nur der Kontrolleur wechselt (Helden: `temporaereKontrolle` / Charme-Mechanik, Rückgabe am Zugwechsel; Kreaturen: `actionStealCreatureGefragt`,
//    Rückgabe zu Beginn des nächsten Zuges). Bis dahin sind sie „unaffected by all other cards and effects" (Helden: `statuses.charmed` ohne Ausnahme-Marke, Kreaturen:
//    `omniImmune`, gleiche Marken wie bei Cute Conversion).
//  • Boris, the Guardian of Blackport: „cannot activate effects that would take control of any targets you control" — die Area bleibt liegen, ihr Effekt läuft ins Leere
//    (kein Angebot, solange der Gegner einen wirksamen Boris hat). Die Area selbst ist deshalb NICHT als `takesControlOfTargets` gekennzeichnet (sie bleibt spielbar).
//  • Erst-Zug-Schutz: im allerersten Zug ist der Gegner des Startspielers nicht wählbar (Heldenübernahme fizzelt, Kreaturen sind ausgegraut).
//  • Liegen mehrere Trees, löst jeder aus (je Area ein Angebot); ein schon übernommenes Ziel ist kein Ziel mehr.
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  Hintergrund: `TreeOfGoldenApplesOverlay` (public/app-areas.jsx): ein großer, im Wind schwankender goldener Baum voller glitzernder Äpfel. Bei der Übernahme
//  `golden_apple_burst` (die Goldpartikel von Golden Apple) auf dem Ziel.
// ═══════════════════════════════════════════

const { ziele, uebernehmen, borisBlockt } = require('./_temp-control-shared');

const CARD_NAME = 'Tree of Golden Apples';
const GOLD_MS = 1500;

module.exports = {
  activeIn: ['hand', 'area'],

  /** CPU: nimmt den Helden mit dem höchsten Angriffswert, sonst die stärkste Kreatur. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = payload || {};
    if (!Array.isArray(validTargets) || config?.title !== CARD_NAME) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length === 0) return undefined;
    const wert = (t) => {
      if (t.type === 'hero') return 1000 + (engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.atk || 0);
      const cd = t.cardInstance ? (engine.getEffectiveCardData(t.cardInstance) || {}) : {};
      return (cd.level || 0) * 50 + (cd.hp || 0) / 10;
    };
    frei.sort((a, b) => wert(b) - wert(a));
    return [frei[0].id];
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
      ctx._engine.log('tree_of_golden_apples_placed', { player: ctx._engine.gs.players[ctx.cardOwner]?.username });
      ctx._engine.sync();
    },

    /** Zugstart: der Zugspieler darf ein Ziel seines Gegners für diesen Zug übernehmen. */
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs.result || gs._endGameLaeuft) return;
      const pi = gs.activePlayer;
      if (pi == null || !gs.players[pi]) return;
      if (borisBlockt(engine, pi)) return;                         // Boris: der Effekt läuft ins Leere

      const liste = ziele(engine, pi);
      if (liste.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `${CARD_NAME}#${ctx.card.id}@${gs.turn}`, sfx: 'ability_activate' });
      const wahl = await engine.promptEffectTarget(pi, liste, {
        title: CARD_NAME, source: CARD_NAME,
        description: 'You may choose any target your opponent controls and take control of it until the end of your turn.',
        confirmLabel: '🍎 Take Control!',
        confirmClass: 'btn-success',
        greenSelect: true,
        maxTotal: 1, maxSelect: 1,
        exclusiveTypes: false, maxPerType: { hero: 1, equip: 1 },
        cancellable: true,                                           // „may"
      });
      const id = Array.isArray(wahl) ? wahl[0] : wahl;
      const ziel = id && liste.find(t => t.id === id);
      if (!ziel) return;

      const erg = await uebernehmen(engine, pi, ziel, {
        sourceName: CARD_NAME, heroMarker: null, kreaturImmun: true,
        anim: 'golden_apple_burst', animMs: GOLD_MS, trefferMs: Math.round(GOLD_MS * 0.55),
      });
      engine.log(erg.ok ? 'tree_of_golden_apples_control' : 'tree_of_golden_apples_fizzle', { player: gs.players[pi]?.username, target: ziel.cardName });
      engine.sync();
    },
  },
};
