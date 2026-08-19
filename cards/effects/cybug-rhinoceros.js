// ═══════════════════════════════════════════
//  CARD EFFECT: "Cybug RHINOCEROS"
//  Creature (Summoning Magic Lv1, Surprise) — 10 HP
//
//  "Activate this Surprise when your opponent places a card into an
//   Area or Support Zone by deleting 1 "Excavator Bucket" from your
//   hand or deck. Send that card to the discard pile and place this
//   Creature into one of the user's free Support Zones. If the sent
//   card was a Creature, this counts as defeating it. When this
//   Creature is defeated, add an "Excavator Bucket" from your discard
//   pile to your hand."
//
//  Mechanics
//  ─────────
//   • Auslöser: `surprisePlacementTrigger`, das NEUE Fenster
//     `_checkSurpriseOnPlacement`. Es ist das breiteste der
//     Platzierungs-Fenster und musste eigens gebaut werden:
//     `_checkSurpriseOnEquip` sieht nur Nicht-Kreaturen in Support
//     Zonen, `_checkSurpriseOnSummon` nur Kreaturen dort, und Areas
//     hatten überhaupt kein Fenster. Mit den alten Bausteinen hätte
//     diese Karte drei Flags gebraucht — und Areas trotzdem nie
//     gesehen.
//   • BEWEGUNGEN zählen nicht als Platzieren. `actionTransferCreature`
//     und `actionTransferAttachment` feuern ihren Enter-Hook mit
//     `_skipReactionCheck` und laufen damit an diesem Fenster vorbei.
//     Ein umgehängtes Equip (etwa durch Cybug LOCUST) löst RHINOCEROS
//     also nicht aus.
//   • Abräumen über `engine.actionDestroyCard` — der kanonische Weg.
//     Er erledigt Als Klausel „if the sent card was a Creature, this
//     counts as defeating it" von selbst: die Methode erkennt
//     Kreaturen und feuert dann `ON_CREATURE_DEATH`, bei
//     Nicht-Kreaturen und Areas nicht. Nichts davon muss hier
//     nachgebaut werden.
//   • Derselbe Weg bringt die üblichen Schutzrechte mit: Defending the
//     Gate, Cardinal-Beast-Immunität, Cosmic Malfunction, Monia. Eine
//     geschützte Karte bleibt also stehen — und weil die Kosten schon
//     bezahlt sind, ist das ein echter Fehlschlag. Bewusst so: die
//     Schutzeffekte sind Regeln des Spiels, kein Sonderfall dieser
//     Karte.
//   • Placement: Standard-Creature-Surprise — `_activateSurprise`
//     setzt die Kreatur nach `onSurpriseActivate` in die erste freie
//     Support Zone des Trägers. Nur EINE freie Zone nötig, denn die
//     abgeräumte Karte geht in die Ablage und nicht zu uns.
//   • On-Death: 1 Excavator Bucket aus dem Ablagestapel zurück auf die
//     Hand, über `instId` auf GENAU DIESE Kopie gefiltert.
// ═══════════════════════════════════════════

const { deleteCybugFuel, recoverCybugFuel, hasCybugFuel } = require('./_cybug-shared');

const CARD_NAME = 'Cybug RHINOCEROS';
const FUEL_CARD = 'Excavator Bucket';
// Standzeit des Erdrisses, bevor die Karte weggeraeumt wird.
const ERDRISS_MS = 620;

module.exports = {
  isSurprise: true,
  activeIn: ['surprise', 'support'],

  // Der Auslöser ist ein konkretes Platzieren beim Gegner.
  canTelekinesisActivate: false,

  /**
   * Trigger: der GEGNER hat eine Karte in eine Area- oder Support-Zone
   * gelegt, sie liegt noch da, und der Treibstoff ist bezahlbar.
   */
  surprisePlacementTrigger(gs, ownerIdx, heroIdx, info) {
    if (!info) return false;
    if (info.placerIdx == null || info.placerIdx === ownerIdx) return false;
    const inst = info.cardInstance;
    if (!inst) return false;
    // Die Karte muss noch dort liegen, wo sie gerade gelandet ist —
    // ein früheres Fenster (Afflicted Pests, ein Summon-Surprise) kann
    // sie schon abgeräumt haben.
    if (inst.zone !== 'support' && inst.zone !== 'area') return false;
    return hasCybugFuel(gs, ownerIdx, FUEL_CARD);
  },

  /**
   * Kosten zahlen → die platzierte Karte in die Ablage.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return null;

    const inst = sourceInfo?.cardInstance;
    if (!inst) return null;
    if (inst.zone !== 'support' && inst.zone !== 'area') return null;
    if ((inst.controller ?? inst.owner) === pi) return null;   // nur Gegnerkarten

    // Kosten ZUERST. Ist die Kopie zwischenzeitlich weg, scheitert die
    // Aktivierung sauber und die Karte bleibt liegen.
    const bezahlt = await deleteCybugFuel(engine, pi, FUEL_CARD);
    if (!bezahlt) return null;

    const warKreatur = !!sourceInfo.isCreature;
    const zone = inst.zone;

    // Als Vorgabe 19.8.: Erdriss auf der Karte, BEVOR sie entfernt wird.
    engine._broadcastEvent('play_zone_animation', {
      type: 'earth_rift', owner: inst.owner,
      heroIdx: zone === 'area' ? -1 : inst.heroIdx,
      zoneSlot: zone === 'area' ? -1 : inst.zoneSlot,
      zoneType: zone === 'area' ? 'area' : undefined,
    });
    await engine._delay(ERDRISS_MS);

    // Kanonischer Weg. `actionDestroyCard` erkennt Kreaturen selbst und
    // feuert dann den Todes-Hook — genau Als Klausel.
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
      inst,
      { sourceOwner: pi, sourceName: CARD_NAME },
    );

    const geschafft = inst.zone !== zone;
    engine.log('cybug_rhinoceros_bulldoze', {
      player: ps.username,
      card: inst.name,
      from: zone,
      wasCreature: warKreatur,
      removed: geschafft,
    });
    engine.sync();
    return { placementDestroyed: geschafft };
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || !ctx.card) return;
      if (death.instId !== ctx.card.id) return;
      await recoverCybugFuel(ctx._engine, death.owner, FUEL_CARD, CARD_NAME);
    },
  },
};
