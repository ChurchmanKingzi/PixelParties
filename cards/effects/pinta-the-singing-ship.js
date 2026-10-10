'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Pinta, the Singing Ship"
//  Hero — 400 HP / 0 ATK — Navigation + Singing — PP MSIN
//
//  „When this is one of your starting Heroes, your Potion Deck must
//   consist of exactly 15 Creatures with different names whose total
//   levels do not exceed 15. You may once per turn reveal the top card of
//   your Potion Deck and immediately summon it with this Hero as an
//   additional Action, if possible. You can only activate this effect if
//   this was one of your starting Heroes. If this is one of your starting
//   Heroes, you can never draw cards from your Potion Deck."
//
//  ── DREI TEILE (Schwester von Chaos-Diamond) ──────────────────────
//  1) DECKBAU: eine Zeile in `public/potion-deck-clauses.js` — dort steht
//     die Klausel („exactly 15 Creatures …") fuer Deckbau, Server und
//     Seitenwechsel. Nichts davon gehoert in dieses Skript.
//
//  2) „STARTING HERO" + „you can never draw": das gemeinsame Geruest
//     `_potion-deck-hero-shared.js` (Stempel beim Spielstart, Zieh-Sperre
//     am Spieler). Ein spaeter ins Spiel gekommener Pinta traegt den
//     Stempel nicht: kein Effekt, keine Sperre.
//
//  3) EFFEKT (frei, Main Phase, hart einmal pro Zug und Spieler — die
//     Engine stempelt `heroHoptKey`): die oberste Karte des Potion Decks
//     wird AUFGEDECKT (beide Seiten sehen sie, Log „revealed"), und
//     „immediately … if possible" beschwoert Pinta sie. Der Effekt kostet
//     KEINE Aktion; die BESCHWOERUNG ist die Zusatzaktion
//     (`alsZusatzaktion`): sie meldet sich als Aktion (Bleed, Madame
//     Guillotine …), und Aktionssperren des Helden/Spielers (Divine Gift
//     of Skill, Duigno, Kent, Chalice) machen sie unmoeglich.
//
//     „IF POSSIBLE" heisst: Pinta ist ein tauglicher Beschwoerer (lebendig,
//     nicht Frozen/Stunned/Webbed/Bound/Negated, Level-/Schulanforderung der
//     Karte erfuellt — Pinta selbst hat KEINE Summoning Magic), ihre eigene
//     Support Zone ist frei, die Karte darf ueberhaupt aus einem Stapel
//     beschworen werden (keine Artifact Creatures, nichts „nur aus der Hand"
//     wie Ifrit) und erfuellt ihre eigenen Bedingungen (`canSummon`). Sonst bleibt die aufgedeckte Karte OBEN im Potion Deck
//     liegen; der Effekt ist trotzdem verbraucht (aufgedeckt ist aufgedeckt).
//     Stehen mehrere Zonen Pintas frei, waehlt der Spieler NACH dem
//     Aufdecken (nicht abbrechbar — „immediately").
//
//     Die Karte fliegt vom Potion Deck auf ihren Platz (`summonFromPile`
//     mit Quelle 'potionDeck'). Scheitert die Beschwoerung nach dem
//     Aufdecken (negiert, Beschwoerungssperre), liegt sie wieder oben.
//     Beschwoeren aus dem Potion Deck ist NICHT „aus dem Deck" — das
//     Cosmic-Manipulation-Signal `_summonedFromDeck` bleibt aus.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { isSummonablePileCreature } = require('./_hooks');
const { starthelden } = require('./_potion-deck-hero-shared');
const { eligibleSummonZones } = require('./_summon-eligibility');

const CARD_NAME = 'Pinta, the Singing Ship';
const REVEAL_MS = 1300;    // Aufdeck-Anzeige, bevor die Karte weiterfliegt

/** Pintas eigene freie Zonen, auf die `name` JETZT beschwoert werden koennte („if possible"). */
function moeglicheZonen(engine, pi, feld, heroIdx, name) {
  const hero = engine.gs.players[feld]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0 || !name) return [];
  // Nur, was ein Effekt aus einem Stapel auf die eigene Seite beschwoeren darf (keine Artifact Creatures mit
  // festen Beschwoerungsbedingungen, kein Powder Keg) und nichts, das „nur aus der Hand" geht (Ifrit).
  if (!isSummonablePileCreature(engine._getCardDB()[name], name)) return [];
  if (loadCardEffect(name)?.summonOnlyFromHand) return [];
  // Die Karte muss ihre eigenen Bedingungen erfuellen (Blue-Ice Dragon: zwei Opfer …).
  if (!engine.isCreatureSummonable(name, feld, heroIdx, { beschwoerer: pi })) return [];
  // Beschwoeren darf NUR dieser Held („with this Hero"); als Zusatzaktion gelten die Aktionssperren mit.
  return eligibleSummonZones(engine, pi, name, { nachKontrolle: true, alsAktion: true })
    .filter(z => z.heroIdx === heroIdx && (z.owner ?? pi) === feld);
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Kein `heroEffectActionCost`: „You may once per turn reveal …" steht ohne „spend your Action" da;
  // die Zusatzaktion steckt in der Beschwoerung selbst.

  // Fester CPU-Bonus fuer Effekte, die Aktionen herausschummeln (Als Auftrag 5.10., `_cpu.js`).
  cpuMeta: { cheatsActions: true },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const feld = ctx.cardHeroOwner ?? pi;   // Styx 28.9.: Brettseite des Helden
    const hero = ctx.attachedHero ?? engine?.gs?.players?.[feld]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    // „You can only activate this effect if this was one of your starting Heroes."
    if (!starthelden.istStartheldVon(hero, pi)) return false;
    return starthelden.obersteKarten(engine, pi, 1).length > 0;
  },

  // Die CPU deckt nur auf, wenn die oberste Karte auch beschworen werden kann (sonst Zeug ohne Ertrag).
  cpuShouldUseHeroEffect(engine, pi, heroIdx) {
    const hi = heroIdx ?? (engine?.gs?.players?.[pi]?.heroes || []).findIndex(h => h?.name === CARD_NAME);
    const hero = engine?.gs?.players?.[pi]?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0 || !starthelden.istStartheldVon(hero, pi)) return false;
    const oben = starthelden.obersteKarten(engine, pi, 1)[0];
    return !!oben && moeglicheZonen(engine, pi, pi, hi, oben).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    const feld = ctx.cardHeroOwner ?? pi;
    const hero = ctx.attachedHero ?? gs.players[feld]?.heroes?.[heroIdx];
    if (!ps || !hero?.name) return false;
    // Ein uebernommener Pinta (Charme, Controlled Attack) ist KEIN Starthero des Uebernehmers.
    if (!starthelden.istStartheldVon(hero, pi)) return false;
    const oben = starthelden.obersteKarten(engine, pi, 1)[0];
    if (!oben) return false;

    // Der Auftritt: Pinta singt.
    engine._broadcastEvent('play_zone_animation', { type: 'music_notes', owner: feld, heroIdx, zoneSlot: -1 });
    await engine._delay(450);

    // ① AUFDECKEN — beide Seiten sehen die Karte; sie bleibt im Potion Deck.
    engine._broadcastEvent('card_reveal', { cardName: oben });
    engine.log('hand_card_revealed', { player: ps.username, card: oben, by: CARD_NAME });
    await engine._delay(REVEAL_MS);

    // ② „immediately summon it with this Hero as an additional Action, if possible."
    const zonen = moeglicheZonen(engine, pi, feld, heroIdx, oben);
    if (zonen.length === 0) {
      engine.log('pinta_reveal_unsummonable', { player: ps.username, card: oben });
      engine.sync();
      return true;     // aufgedeckt ist aufgedeckt: der Effekt ist verbraucht, die Karte bleibt oben
    }

    let ziel = zonen[0];
    if (zonen.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME,
        description: `Summon ${oben} into which of ${hero.name}'s Support Zones?`,
        zones: zonen, cancellable: false,
      });
      ziel = zonen.find(z => z.heroIdx === wahl?.heroIdx && z.slotIdx === wahl?.slotIdx
        && (z.owner ?? pi) === (wahl?.owner ?? pi)) || zonen[0];
    }

    const inst = await engine.summonFromPile(pi, 'potionDeck', oben, ziel.heroIdx, ziel.slotIdx, {
      source: CARD_NAME,
      alsZusatzaktion: true,                       // „as an additional Action" ist eine Aktion
      hookExtras: { _isNormalSummon: false },
      ...(feld !== pi ? { heldSeite: feld } : {}),
    });
    engine.log('pinta_summon', { player: ps.username, card: oben, ok: !!inst });
    engine.sync();
    return true;
  },

  hooks: {
    // „starting Heroes" + „you can never draw cards from your Potion Deck".
    onGameStart: starthelden.onGameStart,
  },

  _test: { moeglicheZonen },
};
