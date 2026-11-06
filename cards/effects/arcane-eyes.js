// ═══════════════════════════════════════════
//  CARD EFFECT: "Arcane Eyes"
//  Creature (Normal, Lv 1, Summoning Magic, 30 HP)
//
//  „If at least one card in either player's hand is revealed and you do not control an "Arcane Eye" yet, summoning this Creature counts an additional Action. While you control this
//   Creature, your opponent cannot place or activate Surprises and must play with their hand revealed."
//
//  (Der Kartenname trägt ein S: „Arcane Eyes"; der Text sagt „Arcane Eye" — gemeint ist diese Karte. Gezählt werden Kopien mit dem Kartennamen.)
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  `inherentAction` (Muster Baby Spider): die Beschwörung zählt als zusätzliche Aktion, wenn (a) irgendeine Handkarte irgendeines Spielers AUFGEDECKT ist (`engine.anyHandCardRevealed()`: Luna Kiai,
//  Bamboo Shield, aufgedeckte Crystals, Madaga, dazu die Hand, die gegnerische Arcane Eyes ganz offenlegen) und (b) der Spieler noch keine aufgedeckte Arcane Eyes kontrolliert. Stand beim
//  Beschwören; ohne aufgedeckte Karte bleibt die Karte spielbar und kostet die Aktion.
//
//  ── „WHILE YOU CONTROL THIS CREATURE" ───────────────────────────────────
//  Ein dauernder Passiv der Karte, gelesen an EINER Stelle der Engine (`arcaneEyesFor`, `surprisesLockedFor`, `handsRevealedTo`): wirksam, solange die Karte aufgedeckt auf dem Brett steht und nicht
//  ruht (Frost, Betäubung, Negation lassen sie ruhen, `isCardPassiveDormant`) — Kontrolle statt Brettseite (`controller ?? owner`).
//   • „cannot place Surprises": `doPlaySurprise` (Hand, Crestinas Vorrat, geliehener Held, Bakhm-Zone), `actionSetSurpriseFromDeck`, die Platzierer aus dem Deck (Geheimraum, Box Spider, Trapping),
//     das Einsargen (Ushabti) und das Zurücksetzen einer Surprise-Kreatur (`surpriseCreatureReset`) — für den GEGNER der Augen.
//   • „cannot activate Surprises": `_canHeroActivateSurprise` (jedes Surprise-Fenster, Zielschutz, Schaden, Hand-Listen) und `_activateSurprise` (erzwungene Aktivierungen: Telekinesis, Baby Spider).
//     Bereits verdeckt liegende Surprises bleiben liegen; sie wirken wieder, sobald die Augen weg sind.
//   • „must play with their hand revealed": der Zustandsversand zeigt dem Kontrolleur der Augen die GANZE Hand des Gegners offen (`revealedHandCards`); das Gedächtnis der CPU (`sweepRevealedHands`) kennt sie.
//   Zwei gegnerische Arcane Eyes sperren sich gegenseitig (beide Spieler setzen/aktivieren keine Surprises, beide Hände liegen offen).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `arcane_eyes_open` (Pixelart): zwei Augen öffnen sich über der Zone, die Pupillen wandern, ein Abtaststrahl streicht nach unten.
// ═══════════════════════════════════════════

const CARD_NAME = 'Arcane Eyes';

/** Kontrolliert `pi` schon eine aufgedeckte Arcane Eyes? (die Karte in der Hand zählt nicht) */
function kontrolliertSchon(engine, pi, ausser = null) {
  return (engine.cardInstances || []).some(c => c.name === CARD_NAME && c.zone === 'support' && !c.faceDown
    && (c.controller ?? c.owner) === pi && c !== ausser);
}

module.exports = {
  activeIn: ['support'],

  /** „Summoning this Creature counts an additional Action": irgendeine Handkarte aufgedeckt UND noch keine eigene Arcane Eyes. */
  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    if (kontrolliertSchon(eng, pi)) return false;
    return eng.anyHandCardRevealed();
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const inst = ctx.card;
      engine._broadcastEvent('play_zone_animation', {
        type: 'arcane_eyes_open', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      engine.log('arcane_eyes_watching', { player: engine.gs.players[ctx.cardOwner]?.username });
      await engine._delay(700);
      engine.sync();
    },
  },
};
