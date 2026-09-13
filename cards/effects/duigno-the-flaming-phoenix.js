// ═══════════════════════════════════════════
//  CARD EFFECT: „Duigno, the Flaming Phoenix"
//  Creature (Summoning Magic Lv 2, 100 HP, PP CROSS)
//
//  „While you control this Creature, you may perform a second Action
//   during each of your Action Phases, but if you do, you cannot
//   perform any other additional Actions during your turn."
//
//  BAUART
//  ──────
//  • Die Zweitaktion kommt aus `_second-action-shared` — dasselbe
//    Gespann, das Soul Shard Ba und Giga Steroids benutzen. Es bringt
//    Anbieter-Registrierung, Helden-Abzeichen, den Riegel gegen das
//    vorzeitige Phasenende (`_preventPhaseAdvance`), das Verpuffen bei
//    fremd verbrauchter zweiter Aktion und das Aufraeumen am
//    Phasenende mit.
//
//  • ★ DAUERWIRKUNG, NICHT EINMALIG: „during EACH of your Action
//    Phases". Der Zuschlag wird deshalb an zwei Stellen gesetzt —
//    beim Beschwoeren (Duigno kommt selbst in der Action Phase aufs
//    Brett, der Zuschlag muss noch im selben Zug greifen) und zu Beginn
//    JEDER eigenen Action Phase. `secondActionGrant` ist idempotent,
//    ein doppelter Aufruf kostet nichts.
//
//  • `heroRestricted: false`: der Text bindet die zweite Aktion an
//    keinen Helden — sie darf mit jedem ausgefuehrt werden.
//
//  • ★ NUR DIE ZWEITE AKTION DES ZUGES (Als Praezisierung 12.9.):
//    „a second Action during each of your Action Phases" heisst nicht
//    „irgendwann eine zusaetzliche". Wer in einer MAIN PHASE schon
//    gehandelt hat (Quick Attack, Dangerous Knowledge), ist mit der
//    Aktion der Action Phase bereits bei zwei — dann tut Duigno nichts
//    und die Phase endet normal. Umgesetzt ueber
//    `secondActionOfTurn: true`: die Engine verlangt dann zusaetzlich
//    `_actionsPlayedThisTurn === 1` (der Zaehler, der ANDERS als
//    `_actionsPlayedThisPhase` auch Main-Phase-Aktionen sieht).
//    FREMDE Zuschlaege ohne diese Flagge bleiben unberuehrt.
//
//  • ★ DER PREIS. „if you do, you cannot perform any OTHER additional
//    Actions during your turn" — sobald DUIGNOS Zuschlag eingeloest
//    ist, sind alle uebrigen Zusatzaktionen fuer den Rest des Zuges
//    zu. Dafuer gibt es jetzt den Engine-Vertrag
//    `additionalActionsLocked` (v965): ein Rundenstempel am Spieler,
//    gelesen an den beiden Stellen, durch die JEDE Suche nach einem
//    Zusatzaktions-Anbieter laeuft. Client-Ausgrauung und
//    Server-Pruefung teilen sich damit dieselbe Antwort.
//    Die Sperre gilt NUR in diese Richtung: wer zuerst eine andere
//    Zusatzaktion nimmt, darf Duignos zweite Aktion danach trotzdem
//    noch — der Text verbietet nur das Umgekehrte.
//    Die regulaere Zug-Aktion bleibt unberuehrt; gesperrt sind
//    ausschliesslich ZUSATZaktionen.
// ═══════════════════════════════════════════

const { secondActionGrant, secondActionHooks, isSecondActionGrant } = require('./_second-action-shared');

const CARD_NAME = 'Duigno, the Flaming Phoenix';
const AKTIONSPHASE = 3;

/** Zuschlag setzen, wenn Duigno auf dem Brett liegt und der Zug meiner ist. */
async function zuschlagSetzen(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;
  const pi = ctx.cardOwner;
  if (engine.gs.activePlayer !== pi) return;
  await secondActionGrant(ctx, {
    sourceLabel: CARD_NAME,
    heroRestricted: false,          // „a second Action", an keinen Helden gebunden
    secondActionOfTurn: true,       // ★ s. Kopf: nur die zweite Aktion des ZUGES
    animationType: 'flame_strike',
  });
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    // Lebenszyklus des Zuschlags (Abzeichen, Phasenriegel, Verpuffen,
    // Aufraeumen) — die eigenen Hooks unten setzen darauf auf.
    ...secondActionHooks,

    // ── Duigno kommt aufs Brett ─────────────────────────────────────
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await zuschlagSetzen(ctx);
    },

    // ── Zu Beginn jeder eigenen Action Phase neu ────────────────────
    onPhaseStart: async (ctx) => {
      if (ctx.phaseIndex !== AKTIONSPHASE) return;
      await zuschlagSetzen(ctx);
    },

    // ── Verpufft, sobald er nicht mehr einloesbar ist ───────────────
    // Sonst haelt der gemeinsame Hook den Spieler ueber
    // `_preventPhaseAdvance` in der Action Phase fest, obwohl die
    // zweite Aktion des ZUGES laengst verbraucht ist (Als Befund 12.9.).
    onActionUsed: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.name !== CARD_NAME) return;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      // ★ ZEITPUNKT BEACHTEN (v984, Als Befund 12.9.): `onActionUsed`
      // feuert VOR `onAnyActionResolved` — der Zugzaehler hat die
      // GERADE gespielte Aktion also noch nicht gesehen. „Diese Aktion
      // war die erste des Zuges" heisst hier deshalb: der Zaehler steht
      // noch auf 0. Alles darueber bedeutet, dass der Zuschlag nie die
      // zweite Aktion des Zuges sein kann — weg damit, BEVOR der
      // gemeinsame Hook die Phase offenhaelt.
      if (ps && (ps._actionsPlayedThisTurn || 0) >= 1 && isSecondActionGrant(engine, inst)) {
        for (const [tid, n] of Object.entries(inst.counters?.aaGrants || {})) {
          if (n > 0 && tid.startsWith('second_action')) engine.expireAdditionalActionType(inst, tid);
        }
        engine.log('duigno_grant_fizzle', { player: ps.username });
        engine.sync();
        return;
      }
      await secondActionHooks.onActionUsed(ctx);
    },

    // ── Der Preis: Duignos Zuschlag ist eingeloest ──────────────────
    onAdditionalActionUsed: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      // Erst das gemeinsame Aufraeumen (Abzeichen), dann der Preis.
      await secondActionHooks.onAdditionalActionUsed(ctx);
      if (!inst || inst.name !== CARD_NAME) return;
      if (!isSecondActionGrant(engine, inst)) return;
      // Noch offene Zuschlaege an DIESER Instanz? Dann war es nicht der
      // ihre, die gerade verbraucht wurde.
      const offen = Object.entries(inst.counters?.aaGrants || {})
        .some(([, n]) => n > 0);
      if (offen) return;

      const gs = engine.gs;
      const ps = gs.players[ctx.cardOwner];
      if (!ps) return;
      if (ps._additionalActionsLockedTurn === gs.turn) return;   // schon zu
      ps._additionalActionsLockedTurn = gs.turn;
      engine.log('duigno_lockout', {
        player: ps.username, hero: ps.heroes?.[inst.heroIdx]?.name,
      });
      engine.sync();
    },
  },
};
