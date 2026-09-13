// ═══════════════════════════════════════════
//  CARD EFFECT: „Zhigao, the Heavenly Emperor"
//  Hero (300 HP / 0 ATK, Divinity + Divinity)
//
//  „If this is one of your starting Heroes, you may only bring 1 other
//   starting Hero to the game.
//   This Hero may perform a second Action during each of your Action
//   Phases."
//
//  BAUART
//  ──────
//  • TEIL 1 ist eine DECKBAU-Regel, kein Spielzug: mit Zhigao im Team
//    besteht die Aufstellung aus GENAU ZWEI Helden statt drei. Das
//    steht in `app-shared.jsx` (`isDeckLegal` und `canAddCard`), wo
//    alle Aufstellungsgrenzen wohnen — hier im Skript ist dafuer
//    nichts zu tun.
//
//  • TEIL 2 ist derselbe Zweitaktions-Zuschlag, den Soul Shard Ba und
//    Duigno benutzen (`_second-action-shared`) — mit einem
//    Unterschied:
//
//  • ★ ZHIGAO ZAEHLT NUR DIE ACTION PHASE (Als Vorgabe 12.9.).
//    Duigno traegt `secondActionOfTurn: true` und verlangt damit, dass
//    im GANZEN ZUG erst eine Aktion lief; eine Zusatzaktion aus einer
//    Main Phase (Quick Attack, Dangerous Knowledge) verbraucht ihn.
//    Zhigao laesst die Flagge weg und bleibt bei der Grundregel
//    „zweite Aktion DIESER Action Phase" — Main-Phase-Aktionen sind
//    ihm egal.
//
//  • ★ UND BEIDE MEINEN DIESELBE ZWEITE AKTION. Wer Duignos Zuschlag
//    einloest, hat seine zweite Aktion verbraucht; Zhigaos Zuschlag
//    steht dann zwar noch da, ist aber nicht mehr einloesbar, und die
//    Action Phase endet. Dafuer sorgt die Engine, nicht die Karte: die
//    Advance-Pruefungen fragen seit v991 nicht mehr „gibt es noch
//    einen Zuschlag?", sondern „gibt es noch einen EINLOESBAREN?".
//
//  • `heroRestricted: true`: „THIS Hero may perform" — die zweite
//    Aktion gehoert Zhigao, nicht der ganzen Aufstellung.
// ═══════════════════════════════════════════

const { secondActionGrant, secondActionHooks } = require('./_second-action-shared');

const CARD_NAME = 'Zhigao, the Heavenly Emperor';
const AKTIONSPHASE = 3;

/** Zuschlag setzen, solange Zhigao lebt und der Zug meiner ist. */
async function zuschlagSetzen(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'hero') return;
  const pi = ctx.cardOwner;
  if (engine.gs.activePlayer !== pi) return;
  const hero = engine.gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
  if (!hero?.name || hero.hp <= 0) return;             // besiegt: kein Zuschlag
  await secondActionGrant(ctx, {
    sourceLabel: CARD_NAME,
    heroRestricted: true,           // „THIS Hero may perform"
    animationType: 'gold_sparkle',
  });
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    // Lebenszyklus des Zuschlags (Abzeichen, Phasenriegel, Verpuffen,
    // Aufraeumen) — unveraendert aus dem gemeinsamen Modul.
    ...secondActionHooks,

    // Zu Beginn jeder eigenen Action Phase neu.
    onPhaseStart: async (ctx) => {
      if (ctx.phaseIndex !== AKTIONSPHASE) return;
      await zuschlagSetzen(ctx);
    },

    // Und zu Zugbeginn, falls die Action Phase schon laeuft (Puzzle-
    // Aufbau, Effekte, die mitten in der Phase Helden tauschen).
    onTurnStart: async (ctx) => {
      if (ctx._engine.gs.currentPhase !== AKTIONSPHASE) return;
      await zuschlagSetzen(ctx);
    },
  },
};
