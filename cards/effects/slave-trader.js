'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Slave Trader"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic)
//
//  „You may discard a level 3 Creature from your hand to summon this Creature as an additional Action. You may once per turn reveal the top
//   card of your deck. If it is a Creature, immediately summon it as an additional Action with any of your Heroes, if possible. Otherwise,
//   put it on top or bottom of your deck (your choice)."
//
//  ── ① BESCHWÖRUNG ALS ZUSATZAKTION (gemeinsame Bauform, `_extra-summon-shared.js`) ──────────────────
//  Kosten: eine Creature mit WIRKSAMER Handstufe 3 aus der HAND abwerfen (`engine.effectiveCardLevel` mit `handIdx`: Handstufen-Effekte wie
//  Coreling/Cats zählen). Die Regel (Als Vorgabe 10.10.): Hat man keine Aktion (Main Phase / Action Phase ohne freie Aktion), MÜSSEN die
//  Kosten gezahlt werden; hat man eine frei (Action Phase), darf man wählen („Special": abwerfen, Aktion bleibt — „Normal": Aktion des
//  Helden). Ohne Lv-3-Creature auf der Hand nur der normale Weg. Effekt-Beschwörungen zahlen nichts.
//
//  ── ② EINMAL PRO ZUG: OBERSTE KARTE AUFDECKEN, CREATURE SOFORT BESCHWÖREN (`_deck-top-shared.js`) ───
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; der Effekt kostet keine Aktion — die BESCHWÖRUNG ist die
//  Zusatzaktion, `alsZusatzaktion`): die oberste Deckkarte wird aufgedeckt. Ist sie eine Creature, wird sie SOFORT (kein „may") mit einem
//  beliebigen deiner Helden beschworen, „if possible":
//    • tauglicher Beschwörer (lebendig, nicht Frozen/Stunned/Webbed/Bound/Negated, Level-/Schulanforderung der Karte erfüllt, keine
//      Beschwörungs-/Aktionssperre), eine freie Zone, die Karte darf aus einem Stapel beschworen werden (keine Artifact Creatures, nichts
//      „nur aus der Hand") und erfüllt ihre eigenen Bedingungen (`canSummon`) — dieselbe Prüfung wie Pinta.
//    • Mehrere mögliche Zonen: der Spieler wählt NACH dem Aufdecken (Zonenwahl mit Kartenvorschau, nicht abbrechbar); genau eine → direkt.
//    • Kein Platz / unbeschwörbar / Beschwörung scheitert („Otherwise") → der Spieler legt die Karte oben oder unten auf das Deck.
//  Aufdecken ist keine Suche (keine Such-Sperre). Das Beschwören aus dem Deck mischt NICHT (`shuffle: false`). Ohne Karte im Deck ist der
//  Effekt nicht aktivierbar.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `slave_chains` (Pixelart, Brett-Animation mit dem Händler als Ursprung und Ziel, Hülle `ppSalve`; Vorlage: das Kartenbild — der Händler mit der goldenen Kette): eine Kette
//  schnellt aus dem Platz des Händlers, klirrt, und Goldfunken stieben. Klänge in ZONE_ANIM_SFX; Log `slave_trader`.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { hasCardType, isSummonablePileCreature } = require('./_hooks');
const { eligibleSummonZones } = require('./_summon-eligibility');
const { makeDiscardCostSummon } = require('./_extra-summon-shared');
const { oberste, decke, obenOderUnten, cpuBehaeltOben } = require('./_deck-top-shared');

const CARD_NAME = 'Slave Trader';
const COST_LEVEL = 3;
const CHAIN_MS = 800;        // Länge bis zum Klirren (deckt sich mit `slave_chains` im Client; +100 ms Einbau-Versatz)

const kosten = makeDiscardCostSummon({
  cardName: CARD_NAME,
  eligible: (engine, pi, name, handIdx, cd) => hasCardType(cd, 'Creature') && engine.effectiveCardLevel(cd, pi, { handIdx }) === COST_LEVEL,
  description: `Discard a level ${COST_LEVEL} Creature from your hand to summon ${CARD_NAME} as an additional Action.`,
});

/** Zonen (aller kontrollierten Helden), in die `name` JETZT als Zusatzaktion beschworen werden könnte — leer = „if possible" scheitert. */
function moeglicheZonen(engine, pi, name) {
  const cd = engine._getCardDB()[name];
  if (!cd || !hasCardType(cd, 'Creature')) return [];
  if (!isSummonablePileCreature(cd, name)) return [];
  if (loadCardEffect(name)?.summonOnlyFromHand) return [];
  return eligibleSummonZones(engine, pi, name, { nachKontrolle: true, alsAktion: true })
    .filter(z => engine.isCreatureSummonable(name, z.owner ?? pi, z.heroIdx, { beschwoerer: pi }));
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: kosten.canSummon,
  inherentAction: kosten.inherentAction,
  beforeSummon: kosten.beforeSummon,
  cpuMeta: { cheatsActions: true },    // holt Beschwörungen ohne Aktion heraus (wie Pinta)

  /** Aktivierbar, solange das Deck nicht leer ist (Aufdecken ist keine Suche). */
  canActivateCreatureEffect(ctx) {
    return !!oberste(ctx._engine, ctx.cardOwner);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const ps = engine.gs.players[pi];
    const top = oberste(engine, pi);
    if (!ps || !top) return false;

    // Die Kette klirrt.
    engine._broadcastEvent('play_zone_animation', {
      type: 'slave_chains', zoneType: 'board', owner: inst.owner, heroIdx: -1, zoneSlot: -1, duration: CHAIN_MS + 400,
      targets: [{ owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, cardName: CARD_NAME }],
      originOwner: inst.owner, originHeroIdx: inst.heroIdx, originZoneSlot: inst.zoneSlot,
    });
    await engine._delay(CHAIN_MS);

    // ① PLAN — wohin soll die Creature? Genau eine Zone → direkt; mehrere → der Spieler wählt nach dem Aufdecken.
    const zonen = moeglicheZonen(engine, pi, top);
    const direkt = zonen.length === 1 ? zonen[0] : null;

    // ② AUFDECKEN — direkt auf den Platz, sonst zurück ins Deck.
    await decke(engine, pi, top, {
      source: CARD_NAME,
      dest: direkt ? 'support' : 'deck',
      ...(direkt ? { destHeroIdx: direkt.heroIdx, destSlotIdx: direkt.slotIdx } : {}),
    });

    // ③ „immediately summon it as an additional Action with any of your Heroes, if possible."
    let ziel = direkt;
    if (!ziel && zonen.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME,
        description: `Summon ${top} with which of your Heroes? (as an additional Action)`,
        previewCardName: top,
        zones: zonen, cancellable: false, heroShortcut: false,
      });
      ziel = zonen.find(z => z.heroIdx === wahl?.heroIdx && z.slotIdx === wahl?.slotIdx && (z.owner ?? pi) === (wahl?.owner ?? pi)) || zonen[0];
    }
    let beschworen = null;
    if (ziel && oberste(engine, pi) === top) {
      const feld = ziel.owner ?? pi;
      beschworen = await engine.summonFromDeck(pi, top, ziel.heroIdx, ziel.slotIdx, {
        source: CARD_NAME,
        shuffle: false,                                    // „reveal" mischt nicht
        flug: !direkt,                                     // direkt: der Weg aus der Mitte war schon der Flug
        hookExtras: { _isNormalSummon: false },
        summonOpts: { alsZusatzaktion: true },             // „as an additional Action" ist eine Aktion
        ...(feld !== pi ? { heldSeite: feld } : {}),
      });
    }

    // „Otherwise, put it on top or bottom of your deck (your choice)."
    let lage = null;
    if (!beschworen?.inst && oberste(engine, pi) === top) lage = await obenOderUnten(engine, pi, top, { source: CARD_NAME });
    engine.log('slave_trader', { player: ps.username, card: top, summoned: !!beschworen?.inst, placed: lage });
    engine.sync();
    return true;
  },

  /** CPU: Special statt Normal, eine gute Karte oben lassen, eine schwache nach unten. */
  cpuResponse(engine, kind, payload) {
    const r = kosten.cpuResponse(engine, kind, payload);
    if (r !== undefined) return r;
    if (kind !== 'generic' || !payload || payload.title !== CARD_NAME || payload.type !== 'confirm') return undefined;
    if (payload._topOrBottom) {
      const pi = engine._cpuPlayerIdx;
      return cpuBehaeltOben(engine, pi, payload.showCard) ? { confirmed: true } : null;
    }
    return undefined;
  },

  _test: { ...kosten._test, moeglicheZonen },
};
