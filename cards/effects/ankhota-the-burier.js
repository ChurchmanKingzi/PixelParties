'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Ankhota, the Burier"
//  Creature (Normal, Lv 2, Summoning Magic, 150 HP)
//
//  „Delete all Creatures that are moved from the board to anywhere else. Whenever one or more Creatures are deleted, the corresponding Hero's current and max HP and Attack stat
//   are increased by 10 times the number of Creatures deleted."
//  „Corresponding Hero" = der Held, in dessen Support Zone Ankhota steht (Brettseite des Platzes).
//
//  ── „DELETE ALL CREATURES THAT ARE MOVED FROM THE BOARD" ────────────────
//  Solange Ankhota aktiv auf dem Brett steht (Support Zone, offen, nicht Frost/Betäubung/Negation — der Hook-Filter), gilt es für JEDE Kreatur BEIDER Seiten und für Ankhota selbst:
//   • besiegt (Schaden, Brand, Gift) → Flag `deletesDefeatedCreaturesWhileOnBoard` (Engine `_gefalleneKreaturenGeloescht`, wie Spirit of the Super-Killing Knife);
//   • JEDER andere Weg vom Brett (zerstört, geopfert, zurück auf die Hand, ins Deck, in die Ablage, auf eine andere Zone …) → `onCardLeaveZone` setzt die Marke `_ankhotaLoescht`;
//     `_actionMoveCardKern` biegt das Ziel danach auf den Gelöscht-Stapel um (nach den anderen Umleitungen, z. B. `_returnToHand`).
//  Nicht betroffen: Umzug innerhalb der Support Zones (Brett → Brett), Tokens (landen ohnehin im Gelöscht-Stapel, sind keine Kreatur-KARTEN).
//
//  ── „WHENEVER ONE OR MORE CREATURES ARE DELETED" ────────────────────────
//  Jede Kreatur-KARTE, die in IRGENDEINEN Gelöscht-Stapel gelangt — auch aus Hand, Ablage oder Deck (Engine `_kreaturenGeloeschtMelden`, Hook `onCreaturesDeleted`). Mehrere Löschungen derselben
//  Auflösung zählen als EIN Ereignis mit der Gesamtzahl (Flächenschaden, Mill). Ankhotas Held bekommt dauerhaft +10 × Anzahl aktuelle und maximale HP (`increaseMaxHp`) sowie ATK
//  (`actionPermAtk`, überlebt Auf-/Abstieg). Ein besiegter Held bekommt nichts. Fällt Ankhota selbst mit (gleichzeitig gelöscht), bekommt ihr Held nichts — sie steht dann nicht mehr auf dem Brett;
//  eine zweite Ankhota auf dem Brett zählt die Löschung ebenfalls (jede für ihren Helden).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `ankhota_sandstorm` (Pixelart): ein Sandwirbel umkreist den Helden.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Ankhota, the Burier';
const PRO_KREATUR = 10;
const ANIM_MS = 1100;

module.exports = {
  activeIn: ['support'],
  neverMultiTarget: true,   // staendige Ersatzwirkung, kein Flaechenschlag (der Text-Waechter liest all Creatures)
  deletesCreaturesMovedFromBoard: true,   // Engine `ankhotaLoeschtVomBrett`: auch Sonderwege auf die Hand (Deepsea-Swap, Bounce …), die am zentralen Move vorbeilaufen
  deletesDefeatedCreaturesWhileOnBoard: true,   // besiegte Kreaturen (Schadens-Batch) werden gelöscht — s. Engine `_gefalleneKreaturenGeloescht`

  /** Engine-Hook `_kreaturenGeloeschtMelden`: `anzahl` Kreaturen wurden gelöscht. */
  async onCreaturesDeleted(engine, inst, anzahl) {
    if (!(anzahl > 0) || inst.zone !== 'support' || inst.faceDown) return;
    const feld = engine.physicalSide(inst);
    const heroIdx = inst.heroIdx;
    const hero = engine.gs.players[feld]?.heroes?.[heroIdx];
    if (!hero?.name || !(hero.hp > 0)) return;
    const gewinn = PRO_KREATUR * anzahl;

    await engine.showTriggeredEffect(CARD_NAME, { source: inst });
    engine._broadcastEvent('play_zone_animation', { type: 'ankhota_sandstorm', owner: feld, heroIdx, zoneSlot: -1 });
    await engine._delay(ANIM_MS * 0.55);
    engine.increaseMaxHp(hero, gewinn);
    engine.actionPermAtk(hero, feld, heroIdx, gewinn, CARD_NAME);
    engine.log('ankhota_gain', { player: engine.gs.players[engine.kontrolleurVon(inst)]?.username, hero: hero.name, creatures: anzahl, amount: gewinn });
    engine.sync();
    await engine._delay(ANIM_MS * 0.45);
  },

  hooks: {
    /** Jede Kreatur, die das Brett verlässt (Support Zone → anderswohin als Support/Gelöscht), wird gelöscht (die Engine liest die Marke in `_actionMoveCardKern`). */
    onCardLeaveZone: (ctx) => {
      const engine = ctx._engine;
      const weg = ctx.leavingCard;
      if (!weg || ctx.fromZone !== 'support') return;
      if (ctx.toZone === 'support' || ctx.toZone === 'deleted') return;
      const cd = engine.getEffectiveCardData(weg) || engine._getCardDB()[weg.name];
      if (!cd || !hasCardType(cd, 'Creature') || hasCardType(cd, 'Token')) return;
      weg._ankhotaLoescht = true;
    },
  },

  /** CPU: nichts zu entscheiden (rein passiv). */
};
