'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Arnold, the Maximum Lotl"
//  Hero — 450 HP, 80 ATK (jetzt; vorher 100), Startabilities Toughness + Training
//
//  „Whenever you attach an Ability to this Hero, increase its current and max HP by 40 and its Attack stat by 10."
//
//  ── NEUE WERTE / NEUER TEXT ─────────────────────────────────────────────
//  ATK 80 (vorher 100) und der neue Text (Datenänderung in `data/cards.json`; der alte „einmal pro Zug Kreatureneffekt"-Effekt entfällt vollständig).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  Auslöser `onCardEnterZone` (Bauform Kit / Alex): eine ABILITY kommt in eine Ability-Zone DIESES Helden (`toZone === 'ability'`, `toHeroIdx === cardHeroIdx`) und gehört dem
//  Kontrolleur („you attach"). Gilt für JEDES Anlegen — normal aus der Hand, per Effekt (Training, Wise Village Elder, Alex …), als zusätzliche Anlage, auch das Aufstocken eines
//  vorhandenen Stapels (Toughness 1 → 2). NICHT ausgelöst: die Startabilities (Aufbau legt sie ohne Hook), die Rückkehr einer verwahrten Ability (Madame Guillotine) und das
//  Anlegen an einen ANDEREN Helden. Jede Ability löst den Effekt einzeln aus (zwei Anlagen = 2 × (+40 HP, +10 ATK)).
//  Wirkung:
//    • aktuelle UND maximale HP +40 (`engine.increaseMaxHp`, `alsoHealCurrent: true`; respektiert eine HP-Obergrenze `maxHpCapped`),
//    • ATK +10 DAUERHAFT (`engine.actionPermAtk`: gebucht in `hero.permAtkDelta`, überlebt Aufstieg/Abstieg; läuft durch den ATK-Trichter, also auch unter Fluch/Doomed-Sperre
//      korrekt — dort landet der Zuwachs im Zwischenspeicher).
//  Ein gefallener Arnold (0 HP) bekommt nichts.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `arnold_flex` (Pixelart, ANIM_REGISTRY) über dem Helden: rosa Pixel-Kreuze (HP) und Aufwärtspfeile (ATK) steigen auf, die Kiemen blitzen. Klänge in
//  ZONE_ANIM_SFX; Log `arnold`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Arnold, the Maximum Lotl';
const HP_BONUS = 40;
const ATK_BONUS = 10;
const FLEX_MS = 1000;      // Länge von `arnold_flex` im Client

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'ability') return;
      if (ctx._verwahrungRueckkehr) return;                     // Rückkehr einer verwahrten Ability ist KEIN Anlegen (Madame Guillotine)
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;            // nur MEIN Held
      const entering = ctx.enteringCard;
      const seite = ctx.cardHeroOwner ?? ctx.cardOwner;         // Brettseite meines Helden
      // „you attach": die Ability gehört dem Kontrolleur (Kontrolle statt Seite)
      if (!entering || entering.owner !== seite) return;

      const engine = ctx._engine;
      const hero = engine.gs.players[seite]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'arnold_flex', owner: seite, heroIdx: ctx.cardHeroIdx, zoneSlot: -1, duration: FLEX_MS,
      });
      const hp = engine.increaseMaxHp(hero, HP_BONUS, { alsoHealCurrent: true, source: CARD_NAME });
      engine.actionPermAtk(hero, seite, ctx.cardHeroIdx, ATK_BONUS, CARD_NAME);
      engine.log('arnold', {
        player: engine.gs.players[ctx.cardOwner]?.username, hero: hero.name, ability: entering.name,
        hp: hp, atk: ATK_BONUS,
      });
      engine.sync();
    },
  },

  _test: { HP_BONUS, ATK_BONUS },
};
