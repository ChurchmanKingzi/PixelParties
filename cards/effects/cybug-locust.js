// ═══════════════════════════════════════════
//  CARD EFFECT: "Cybug LOCUST"
//  Creature (Summoning Magic Lv1, Surprise) — 10 HP
//
//  "Activate this Surprise when your opponent equips or attaches a card
//   to a Hero they control by deleting 1 "Treasure Hunter's Backpack"
//   from your hand or deck. That card is equipped/attached to the user
//   instead, then place this Creature into one of the user's free
//   Support Zones. When this Creature is defeated, add a "Treasure
//   Hunter's Backpack" from your discard pile to your hand."
//
//  Mechanics
//  ─────────
//   • Auslöser: `surpriseEquipTrigger` — das Fenster
//     `_checkSurpriseOnEquip` gab es SCHON. Es feuert aus
//     `onCardEnterZone`, sobald eine NICHT-Kreatur in einer Support
//     Zone landet, und scannt die Surprises der Gegenseite. Genau der
//     gebrauchte Moment; einziger bisheriger Nutzer: Afflicted Pests.
//   • Das Fenster feuert NACH dem Landen. Die Karte liegt also schon
//     beim Gegner, wenn wir dran sind — sie wird umgehängt, nicht
//     abgefangen. Deshalb ist die Reihenfolge unten wichtig:
//     `onCardLeaveZone` zieht einen Equip-Buff beim alten Träger
//     zurück, `onCardEnterZone` setzt ihn beim neuen. Beides erledigt
//     die Engine-Primitive.
//   • Ausrüst-Beschränkungen gelten auch hier: ein „Crusader's"-Artefakt
//     kann NUR auf eine Cecilia gestohlen werden. Geprüft über
//     `engine.canEquipCardToHero` schon im Auslöser, damit der Surprise
//     gar nicht erst angeboten wird.
//   • Als Definition (19.8.): **equip = Artifact, attach = Attack oder
//     Spell.** Gefiltert wird über das Datenfeld `subtype`, nicht über
//     `cardType` — Al hat das ausdrücklich so entschieden. Die
//     Zuordnung ist in `cards.json` eindeutig: `Equipment` ist immer
//     ein Artifact (94 Karten), `Attachment` immer Attack (2) oder
//     Spell (35). Ein `cardType`-Filter wäre viel weiter und würde
//     unter anderem `Crimson Web` (`Spell/Surprise`, hängt sich selbst
//     an einen Helden) mitnehmen.
//   • Als Vorgabe (19.8.): **LOCUST braucht ZWEI freie Support Zonen**
//     beim Träger — eine für die umgeleitete Karte, eine für die
//     Kreatur selbst. `_canHeroActivateSurprise` verlangt von sich aus
//     nur EINE; die zweite wird deshalb hier im Auslöser geprüft.
//     Ohne diese Prüfung würde der Treibstoff bezahlt und die Kreatur
//     fände danach keinen Platz mehr.
//   • Umzug über `engine.actionTransferAttachment` — eigens dafür
//     gebaute Primitive, bewusst getrennt von
//     `actionTransferCreature` (die feuert `onTakeControl`, dessen
//     Zuhörer für Kreaturen geschrieben sind und nicht auf den
//     Zieltyp filtern).
//   • `originalOwner` der umgeleiteten Karte bleibt beim Gegner — sie
//     wandert später in DESSEN Ablagestapel zurück. Das ist die
//     übliche Behandlung gestohlener Karten.
//   • Placement: Standard-Creature-Surprise — `_activateSurprise` setzt
//     die Kreatur nach `onSurpriseActivate` in die erste freie Support
//     Zone des Trägers.
//   • On-Death: 1 Treasure Hunter's Backpack aus dem Ablagestapel
//     zurück auf die Hand, über `instId` auf GENAU DIESE Kopie
//     gefiltert.
// ═══════════════════════════════════════════

const { deleteCybugFuel, recoverCybugFuel, hasCybugFuel } = require('./_cybug-shared');

const CARD_NAME = 'Cybug LOCUST';
const FUEL_CARD = "Treasure Hunter's Backpack";

// Als Definition (19.8.), über den Subtyp: equip = Equipment,
// attach = Attachment. Das ist das Feld, das die Kartendaten dafür
// führen — `cardType` sagt nur, welche Sorte Karte es ist.
const UMLEITBARE_SUBTYPEN = new Set(['Equipment', 'Attachment']);

// Der Träger braucht Platz für ZWEI Karten.
const BENOETIGTE_ZONEN = 2;

/** Freie Support-Slots eines Helden, als Indexliste. */
function freieZonen(gs, pi, heroIdx) {
  const zonen = gs.players[pi]?.supportZones?.[heroIdx] || [];
  const frei = [];
  for (let si = 0; si < 3; si++) {
    if (((zonen[si] || []).length === 0)) frei.push(si);
  }
  return frei;
}

module.exports = {
  isSurprise: true,
  activeIn: ['surprise', 'support'],

  // Der Auslöser ist ein konkretes Anlegen beim Gegner.
  canTelekinesisActivate: false,

  /**
   * Trigger: der GEGNER hat ein Artifact/Attack/Spell an einen eigenen
   * Helden gehängt, der Träger hat zwei freie Zonen, Treibstoff da.
   */
  surpriseEquipTrigger(gs, ownerIdx, heroIdx, info, engine) {
    if (!info) return false;
    if (info.equipOwner == null || info.equipOwner === ownerIdx) return false;
    const inst = info.cardInstance;
    if (!inst || inst.zone !== 'support') return false;
    const cd = engine?._getCardDB?.()[info.cardName];
    if (!cd || !UMLEITBARE_SUBTYPEN.has(cd.subtype)) return false;
    // ★ Ausruest-Beschraenkungen gelten auch beim Stehlen (Al 19.8.):
    // ein „Crusader's"-Artefakt kann NUR auf eine Cecilia wandern.
    // Ohne legalen Traeger ist die Karte kein Ziel — dann wird der
    // Surprise gar nicht erst angeboten.
    if (!engine?.canEquipCardToHero?.(info.cardName, ownerIdx, heroIdx)) return false;
    // Als Vorgabe: zwei freie Zonen, sonst gar nicht erst anbieten.
    if (freieZonen(gs, ownerIdx, heroIdx).length < BENOETIGTE_ZONEN) return false;
    return hasCybugFuel(gs, ownerIdx, FUEL_CARD);
  },

  /**
   * Kosten zahlen → die Karte auf den Träger umhängen.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return null;

    const inst = sourceInfo?.cardInstance;
    if (!inst || inst.zone !== 'support') return null;
    if ((inst.controller ?? inst.owner) === pi) return null;   // liegt schon bei uns

    const traegerHeroIdx = ctx.cardHeroIdx;
    const frei = freieZonen(gs, pi, traegerHeroIdx);
    // Erneut prüfen: zwischen Auslöser und jetzt kann sich das Brett
    // bewegt haben. Ohne zwei Zonen bliebe die Kreatur ohne Platz.
    if (frei.length < BENOETIGTE_ZONEN) return null;

    // Kosten ZUERST. Ist die Kopie zwischenzeitlich weg, scheitert die
    // Aktivierung sauber und die Karte bleibt beim Gegner.
    const bezahlt = await deleteCybugFuel(engine, pi, FUEL_CARD);
    if (!bezahlt) return null;

    const ergebnis = await engine.actionTransferAttachment(
      inst, pi, traegerHeroIdx, frei[0], { sourceName: CARD_NAME },
    );
    if (!ergebnis?.success) { engine.sync(); return null; }

    engine.log('cybug_locust_redirect', {
      player: ps.username,
      card: inst.name,
      from: gs.players[sourceInfo.equipOwner]?.username,
      hero: ps.heroes?.[traegerHeroIdx]?.name,
    });
    engine.sync();
    return { attachmentRedirected: true };
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
