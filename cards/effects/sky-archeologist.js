'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Sky Archeologist"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic)
//
//  „You may discard an Artifact with a Cost of 10 or more to summon this Creature as an additional Action. You may once per turn reveal the
//   top card of your deck. If it is an Artifact, you may immediately play it without paying its Cost. Otherwise, put it on top or bottom of
//   your deck (your choice)."
//
//  ── ① BESCHWÖRUNG ALS ZUSATZAKTION (gemeinsame Bauform, `_extra-summon-shared.js`) ──────────────────
//  Kosten: ein Artifact mit GEDRUCKTEN Kosten (Cost) ≥ 10 aus der HAND abwerfen (Anklicken der markierten Handkarte; Equipment wie
//  Normal/Reaction — jede Unterart, auch Artifact Creatures). Die Regel (Als Vorgabe 10.10.): Hat man keine Aktion (Main Phase / Action
//  Phase ohne freie Aktion), MÜSSEN die Kosten gezahlt werden — die Zusatzaktion ist der einzige Weg, Abbruch lehnt die Beschwörung ab.
//  Hat man eine Aktion frei (Action Phase), darf man wählen: „Special" (abwerfen, Aktion bleibt) oder „Normal" (Aktion des Helden).
//  Ohne Artifact ≥ 10 auf der Hand gibt es nur den normalen Weg. Effekt-Beschwörungen zahlen nichts.
//
//  ── ② EINMAL PRO ZUG: OBERSTE KARTE AUFDECKEN (`_deck-top-shared.js`, `_free-artifact-shared.js`) ─────
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; keine Aktion). Ablauf (Als Vorgabe 10.10.: „genau wie Slave Trader die oberste
//  Karte in die Bildschirmmitte ziehen und dort aufdecken"): die oberste Deckkarte fliegt in die Bildmitte, dreht sich um und BLEIBT dort liegen, bis der
//  Spieler entschieden hat (beide Spieler sehen sie).
//    • Ist sie ein ARTIFACT und spielbar → Abfrage „für 0 Gold spielen?". Ja: das Artifact wird SOFORT gespielt und wirkt auf der Stelle — es kommt NICHT auf die
//      Hand: Equipment wird an einen gewählten Helden gelegt (die Karte fliegt aus der Mitte auf den Platz), alles andere läuft über Zielwahl, Kettenfenster und
//      `resolve` im Gratis-Scope (`engine.kostenlosSpielen`) und landet danach in der Ablage (`_free-artifact-shared.js`).
//    • Ein ARTIFACT, das nicht gespielt wird — der Spieler lehnt ab, bricht die Zielwahl ab ODER es ist nicht spielbar (Equipment ohne freien Platz,
//      Artifact-Sperre, Reaction/Surprise/Area/Artifact Creature …) —, geht zurück ins Deck, wo es lag (oben): abgelehnt wird behandelt, als wäre es unspielbar
//      gewesen. KEINE Oben/Unten-Wahl.
//    • „Otherwise" = die aufgedeckte Karte ist KEIN Artifact: dann legt der Spieler sie oben oder unten auf das Deck (eigene Wahl, die Karte liegt dabei in der Mitte).
//  Aufdecken ist keine Suche (keine Such-Sperre). Ohne Karte im Deck ist der Effekt nicht aktivierbar.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `sky_dig` (Pixelart, Hülle `ppSalve`; Vorlage: das Kartenbild — der Archäologe mit der Spitzhacke) läuft AUF DEM DECK (Als Vorgabe
//  10.10.: „auf dem Deck angezeigt, nicht auf den Creatures selbst"; `originDeck` + Ziel `{ owner, deck: true }`): die Hacke schlägt zweimal zu, Staub und
//  Steinsplitter spritzen, beim zweiten Schlag blitzt ein Fund auf. Klänge in ZONE_ANIM_SFX; Log `sky_archeologist`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { makeDiscardCostSummon } = require('./_extra-summon-shared');
const { oberste, haltenImZentrum, gibFrei, obenOderUnten, cpuBehaeltOben } = require('./_deck-top-shared');
const { spielweg, spieleKostenlos } = require('./_free-artifact-shared');

const CARD_NAME = 'Sky Archeologist';
const MIN_COST = 10;
const DIG_MS = 800;          // Länge bis zum Fund (deckt sich mit `sky_dig` im Client; +100 ms Einbau-Versatz)

const kosten = makeDiscardCostSummon({
  cardName: CARD_NAME,
  eligible: (engine, pi, name, handIdx, cd) => hasCardType(cd, 'Artifact') && (cd.cost || 0) >= MIN_COST,
  description: `Discard an Artifact with a Cost of ${MIN_COST} or more to summon ${CARD_NAME} as an additional Action.`,
});

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: kosten.canSummon,
  inherentAction: kosten.inherentAction,
  beforeSummon: kosten.beforeSummon,

  /** Aktivierbar, solange das Deck nicht leer ist (Aufdecken ist keine Suche). */
  canActivateCreatureEffect(ctx) {
    return !!oberste(ctx._engine, ctx.cardOwner);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const top = oberste(engine, pi);
    if (!ps || !top) return false;

    // Die Hacke schlägt auf dem DECK zu.
    engine._broadcastEvent('play_zone_animation', {
      type: 'sky_dig', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: DIG_MS + 400,
      targets: [{ owner: pi, deck: true }],
      originOwner: pi, originDeck: true,
    });
    await engine._delay(DIG_MS);

    // Aufdecken: die Karte liegt in der Bildmitte, bis der Spieler entschieden hat.
    const key = await haltenImZentrum(engine, pi, top, { source: CARD_NAME });
    const istArtifact = hasCardType(engine._getCardDB()[top], 'Artifact');
    let gespielt = false;
    let lage = null;
    try {
      // „If it is an Artifact, you may immediately play it without paying its Cost."
      if (istArtifact && spielweg(engine, pi, top)) {
        const ja = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `${top} is an Artifact! Play it right now for 0 Gold?`,
          showCard: top,
          confirmLabel: '🪙 Play it for free!',
          cancelLabel: 'Not now',
          cancellable: true,
          gerrymanderEligible: false,
        });
        if (ja && !ja.cancelled) gespielt = await spieleKostenlos(engine, pi, top, { source: CARD_NAME, key });
      }
      // „Otherwise, put it on top or bottom of your deck (your choice)." gilt NUR für Karten, die kein Artifact sind — ein Artifact (abgelehnt, abgebrochen
      // oder unspielbar) bleibt, wo es lag: oben.
      if (!gespielt && !istArtifact) lage = await obenOderUnten(engine, pi, top, { source: CARD_NAME });
    } finally {
      // Nicht gespielt: die Karte fliegt aus der Mitte zurück ins Deck (auch wenn oben etwas schiefging).
      if (!gespielt) await gibFrei(engine, pi, key, top, { dest: 'deck' });
    }
    engine.log('sky_archeologist', { player: ps.username, card: top, played: gespielt || null, placed: lage });
    engine.sync();
    return true;
  },

  /** CPU: Special statt Normal, Artifact kostenlos spielen, eine gute Karte oben lassen, eine schwache nach unten. */
  cpuResponse(engine, kind, payload) {
    const r = kosten.cpuResponse(engine, kind, payload);
    if (r !== undefined) return r;
    // Equipment-Platz (Zonenwahl, abbrechbar): die CPU nimmt den ersten.
    if (kind === 'generic' && payload && payload.title === CARD_NAME && payload.type === 'zonePick') {
      const z = (payload.zones || [])[0];
      return z ? { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
    }
    if (kind !== 'generic' || !payload || payload.title !== CARD_NAME || payload.type !== 'confirm') return undefined;
    if (/Play it right now/.test(payload.message || '')) return { confirmed: true };
    if (payload._topOrBottom) {
      const pi = engine._cpuPlayerIdx;
      return cpuBehaeltOben(engine, pi, payload.showCard) ? { confirmed: true } : null;
    }
    return undefined;
  },

  _test: kosten._test,
};
