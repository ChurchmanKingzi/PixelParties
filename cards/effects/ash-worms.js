// ═══════════════════════════════════════════
//  CARD EFFECT: "Ash Worms"
//  Creature (Normal, Lv 1, 20 HP, Summoning Magic)
//
//  „When this Creature is deleted from anywhere, you may immediately summon
//   it as an additional Action with any Hero you control and draw 1 card. You
//   can only summon 1 \"Ash Worms\" per turn."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „deleted from anywhere": der universale Loesch-Haken der Engine
//    (`beforeDelete`, Muster Cute Hydra) feuert aus JEDEM Loeschweg (Hand,
//    Deck, Brett, Ablage …) zwischen Entnahme und Geloescht-Stapel. Die
//    Beschwoerung ersetzt dort den Stapel-Eintrag (`ctx.rescued`) — die Karte
//    ist also nie dauerhaft im Geloescht-Stapel; auf „deleted"-Ausloeser
//    ANDERER Karten wirkt das wie ein Loeschen mit sofortiger Rueckholung.
//  • „with any Hero you control": ein ganz normaler Beschwoerungsplatz
//    (`eligibleSummonZones`, nach Kontrolle — auch uebernommene Helden, Level-/
//    Schul-/Statuspruefung), als Zusatzaktion. Freiwillig (Ja/Nein, Zonenwahl),
//    nur 1 Beschwoerung je Zug und Spieler (`gs.hoptUsed`).
//  • „and draw 1 card": nach gelungener Beschwoerung 1 Karte ziehen.
// ═══════════════════════════════════════════

const { eligibleSummonZones } = require('./_summon-eligibility');

const CARD_NAME = 'Ash Worms';
const HOPT_KEY = 'ash-worms';

module.exports = {
  activeIn: ['support'],

  /** CPU: das Angebot immer annehmen (kostenlos, zieht eine Karte). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  async beforeDelete(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps || gs.result) return;
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return;   // 1 je Zug

    const zonen = eligibleSummonZones(engine, pi, CARD_NAME, { nachKontrolle: true });
    if (zonen.length === 0) return;

    const antwort = await engine.promptGeneric(pi, {
      type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
      message: `${CARD_NAME} was deleted${ctx.fromZone ? ` from ${ctx.fromZone}` : ''}! Summon it as an additional Action and draw 1 card?`,
      confirmLabel: '🪱 Summon!', cancelLabel: 'No', cancellable: true,
    });
    if (!antwort || antwort.cancelled || antwort.confirmed === false) return;

    let ziel = zonen[0];
    if (zonen.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME,
        description: `Summon ${CARD_NAME} into which Support Zone?`,
        zones: zonen, cancellable: true,
      });
      if (!wahl || wahl.cancelled) return;
      ziel = zonen.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx
        && (z.owner ?? pi) === (wahl.owner ?? pi));
      if (!ziel) return;
    }

    // Die verwaiste Quellinstanz (Hand/Brett) aufraeumen — die Karte wird neu beschworen.
    if (ctx.fromInstance) engine._untrackCard(ctx.fromInstance.id);

    const ausAblage = ctx.fromZone === 'discard';
    const ab = ausAblage ? (ctx.ablage || { name: CARD_NAME, pileOwner: pi, pi, lethe: 0, idx: null }) : null;
    const seite = ziel.owner ?? pi;
    const res = await engine.summonCreatureWithHooks(
      CARD_NAME, seite, ziel.heroIdx, ziel.slotIdx,
      { source: CARD_NAME, alsZusatzaktion: true,
        ...(seite !== pi ? { controller: pi } : {}),
        ...(ausAblage ? { hookExtras: engine.ablageHookExtras() } : {}) });
    if (!res?.inst) return;   // nicht beschworen → die Loeschung laeuft weiter
    if (ab) engine.ablageLandung(res.inst, ab, 'summon');

    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;
    ctx.rescued = true;

    await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
    engine.log('ash_worms', { player: ps.username, hero: ziel.label, fromZone: ctx.fromZone, source: ctx.source });
    engine.sync();
  },

  hooks: {},
};
