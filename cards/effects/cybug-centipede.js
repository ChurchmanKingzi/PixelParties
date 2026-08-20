// ═══════════════════════════════════════════
//  CARD EFFECT: "Cybug CENTIPEDE"
//  Creature (Summoning Magic Lv1, Surprise) — 10 HP
//
//  "Activate this Surprise when your opponent would draw cards
//   through an effect by deleting 1 "Wheels" from your hand or
//   deck. You draw the same number of cards. Then, place this
//   Creature into one of the user's free Support Zones. When this
//   Creature is defeated, add a "Wheels" from your discard pile to
//   your hand."
//
//  ── BALANCE-AENDERUNG v517 (Als Vorgabe 19.8.) ──────────────────
//  Bis v516 hiess der Text „You draw that number of cards INSTEAD":
//  die Ziehung des Gegners wurde abgefangen und umgeleitet. Das war
//  zu stark. Jetzt zieht der Gegner ganz normal, und der Beherrscher
//  zieht dieselbe Anzahl ZUSAETZLICH.
//
//  Technisch ist das genau eine Zeile: `onSurpriseActivate` gibt
//  KEIN `{ drawRedirected: true }` mehr zurueck. Der Rueckgabewert
//  ist der einzige Weg, auf dem `actionDrawCards` die Ziehung des
//  Gegners abbricht (`_engine.js` ~7241) — ohne ihn laeuft sie nach
//  dem Fenster ganz normal weiter.
//
//  Mechanics
//  ─────────
//   • Pre-draw window: hooks the engine's pre-draw Surprise window
//     (`surpriseBeforeOppDrawTrigger`). Fires INSIDE
//     `actionDrawCards` BEFORE any cards are dispensed. Der
//     Beherrscher zieht also VOR dem Gegner — dieselbe Stelle wie
//     bisher, nur ohne Abbruch. Zwei getrennte Decks, die
//     Reihenfolge hat keine Nebenwirkung.
//   • Activation cost: delete 1 "Wheels" from controller's hand
//     (preferred) or deck. The trigger gate refuses to even prompt
//     when no Wheels is available (`hasCybugFuel`).
//   • Placement: standard Creature-Surprise behavior — the engine's
//     `_activateSurprise` disposition places the live inst into the
//     host Hero's first free Support Zone, no extra work needed
//     here.
//   • On-death recovery: when THIS Cybug CENTIPEDE instance dies,
//     pull a "Wheels" from the controller's discard pile to hand.
//     Filter by `death.instId === ctx.card.id` so other Cybug
//     CENTIPEDE deaths on the board don't pile on each other's
//     trigger. Best-effort — no-op if no Wheels in discard or
//     if the controller is hand-locked.
//   • Telekinesis disallowed: there's no real triggering draw to
//     redirect under a forced activation. Same gate Frost Rune /
//     Magic Mirror use.
// ═══════════════════════════════════════════

const { deleteCybugFuel, recoverCybugFuel, hasCybugFuel } = require('./_cybug-shared');

const CARD_NAME = 'Cybug CENTIPEDE';
const FUEL_CARD = 'Wheels';

module.exports = {
  isSurprise: true,
  // Surprise zone for the pre-draw interrupt; support zone for the
  // post-activation Creature life (where the death hook fires).
  activeIn: ['surprise', 'support'],

  canTelekinesisActivate: false,

  /**
   * Trigger: opp is about to draw cards through an effect AND the
   * controller can pay the Wheels cost. The engine's pre-draw
   * window already filters by phase (Resource-Phase draws don't
   * open this window), so the script just needs to gate on
   * payability + a positive draw count.
   */
  surpriseBeforeOppDrawTrigger(gs, ownerIdx, heroIdx, drawInfo, engine) {
    if (!drawInfo || drawInfo.drawingPlayer === ownerIdx) return false;
    if (!drawInfo.count || drawInfo.count <= 0) return false;
    // Hand-locked controllers can't draw at all (`actionDrawCards`
    // steigt bei `handLocked` sofort aus) — refuse to even prompt,
    // sonst kostet die Aktivierung ein Wheels und bringt nur noch
    // den 10-HP-Koerper. Bewusst beibehalten aus v516; wenn Al den
    // Koerper auch ohne Ziehung haben will, faellt genau diese
    // Zeile weg.
    if (gs.players[ownerIdx]?.handLocked) return false;
    return hasCybugFuel(gs, ownerIdx, FUEL_CARD);
  },

  /**
   * Pay the Wheels cost → der Beherrscher zieht dieselbe Anzahl.
   * KEIN Rueckgabewert mit `drawRedirected`: der Gegner zieht nach
   * dem Fenster ganz normal weiter (Balance-Aenderung v517).
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return null;

    // Hand-lock guard — `surpriseBeforeOppDrawTrigger` already
    // rejects when locked, but a race (Friendship Lv1 etc. locking
    // mid-prompt) could leave us mismatched. Bail BEFORE paying so
    // no Wheels is wasted on a redirect that can't land.
    if (ps.handLocked) return null;

    // Pay cost — `surpriseBeforeOppDrawTrigger` already verified
    // availability, but a race (another effect just consumed the
    // Wheels mid-prompt) could leave us empty-handed. Refuse the
    // redirect cleanly so opp's draw still resolves.
    const paid = await deleteCybugFuel(engine, pi, FUEL_CARD);
    if (!paid) return null;

    const count = sourceInfo?.count || 0;
    if (count > 0) {
      // Der Beherrscher zieht dieselbe Anzahl. `_skipBatchHook`
      // bleibt gesetzt: diese Ziehung ist die FOLGE der gegnerischen,
      // kein eigener Effekt-Draw. Ohne den Riegel liefe sie erneut
      // durch `BEFORE_DRAW_BATCH` (Intrude & Co. wuerden die Kopie
      // kopieren) und oeffnete ein weiteres Vor-Zieh-Fenster —
      // Centipede koennte sich selbst hochschaukeln.
      await engine.actionDrawCards(pi, count, {
        source: CARD_NAME,
        _skipBatchHook: true,
      });
    }

    engine.log('cybug_centipede_draw', {
      player: ps.username,
      count, drawer: sourceInfo?.drawingPlayer,
    });
    engine.sync();

    // Bewusst `null`: nur `{ drawRedirected: true }` wuerde die
    // Ziehung des Gegners abbrechen. Das Fenster laeuft danach
    // weiter durch die restlichen Surprises — richtig so, eine
    // zweite Centipede darf auf dieselbe Ziehung reagieren.
    return null;
  },

  hooks: {
    /**
     * On-death recovery — best-effort pull of a single Wheels from
     * discard back to the controller's hand. Filtered to THIS
     * specific Cybug CENTIPEDE instance via `instId` match so
     * board-wide creature deaths don't all run this. Engine fires
     * `onCreatureDeath` for the dying card itself, so `ctx.card` is
     * the dying instance and the id comparison is a true equality.
     */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || !ctx.card) return;
      if (death.instId !== ctx.card.id) return;
      const pi = death.owner;
      await recoverCybugFuel(ctx._engine, pi, FUEL_CARD, CARD_NAME);
    },
  },
};
