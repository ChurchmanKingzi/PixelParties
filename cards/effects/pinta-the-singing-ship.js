'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Pinta, the Singing Ship"
//  Hero — 400 HP / 0 ATK — Navigation + Singing — PP MSIN
//
//  „When this is one of your starting Heroes, your Potion Deck must
//   consist of exactly 15 Creatures with different names whose total
//   levels do not exceed 15. You may once per turn reveal the top card of
//   your Potion Deck and immediately summon it with this Hero as an
//   additional Action, if possible. Shuffle your Potion Deck afterwards.
//   You can only activate this effect if this was one of your starting
//   Heroes. If this is one of your starting
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
//     Stempel nicht: kein Effekt, keine Sperre. Eine UEBERNOMMENE Pinta
//     (Charme, Controlled Attack) laesst sich nur aktivieren, wenn das
//     Potion Deck des Uebernehmers zufaellig auf sie zugeschnitten ist
//     (er ist selbst mit Pinta gestartet): `darfAktivieren`. Der Effekt
//     greift dann auf SEIN Potion Deck.
//
//  3) EFFEKT (frei, Main Phase, hart einmal pro Zug und Spieler — die
//     Engine stempelt `heroHoptKey`): die oberste Karte des Potion Decks
//     wird AUFGEDECKT, „immediately … if possible" beschwoert Pinta sie, und
//     DANACH wird das Potion Deck gemischt („Shuffle your Potion Deck
//     afterwards"): so legt eine gerade unbeschwoerbare Creature den Effekt
//     nicht fuer mehrere Runden lahm. Gemischt wird in JEDEM Fall.
//
//     AUFDECKEN: die Karte fliegt vom Potion Deck in die MITTE des Feldes,
//     wird dort umgedreht und fliegt weiter (`mill_center_reveal`, wie
//     Chaos-Diamond, Heart of Cards, Surprise Party) — auf Pintas Platz,
//     wenn sie beschworen wird, sonst zurueck ins Potion Deck. Log „revealed".
//
//     BESCHWOEREN: der Effekt kostet KEINE Aktion; die BESCHWOERUNG ist die
//     Zusatzaktion (`alsZusatzaktion`): sie meldet sich als Aktion (Bleed,
//     Madame Guillotine …), und Aktionssperren des Helden/Spielers machen
//     sie unmoeglich. Beschwoerungsarten, die danach fragen, tun es nicht
//     mehr (Blue-Ice Dragon: `ctx._alsZusatzaktion`, bekommt Haste).
//
//     PLATZ: KEINE Zonenwahl — Pinta nimmt die ERSTE freie Zone. Einzige
//     Ausnahme: sind alle Zonen Pintas belegt und verlangt die aufgedeckte
//     Creature Opfer (Blue-Ice Dragon), waehlt der Spieler NACH dem
//     Aufdecken die Zone, in die sie soll — die Creature, die dort steht,
//     wird dadurch automatisch zu einem der Opfer (`_requiredSacrificeInstIds`
//     → `resolveSacrificeCost`), die uebrigen waehlt er wie gewohnt. Nur
//     Zonen, deren Creature als Opfer taugt, stehen zur Wahl; bleibt nur
//     eine, entfaellt auch diese Wahl.
//
//     „IF POSSIBLE" heisst: Pinta ist ein tauglicher Beschwoerer (lebendig,
//     nicht Frozen/Stunned/Webbed/Bound/Negated, Level-/Schulanforderung der
//     Karte erfuellt — Pinta selbst hat KEINE Summoning Magic), eine eigene
//     Zone ist frei (oder per Opfer frei zu machen), die Karte darf aus einem
//     Stapel beschworen werden (keine Artifact Creatures, nichts „nur aus der
//     Hand" wie Ifrit) und erfuellt ihre eigenen Bedingungen (`canSummon`).
//     Sonst wird nur aufgedeckt und gemischt; der Effekt ist trotzdem
//     verbraucht. Scheitert die Beschwoerung nach dem Aufdecken (negiert,
//     Opferwahl abgebrochen), liegt die Karte wieder im Potion Deck.
//     Beschwoeren aus dem Potion Deck ist NICHT „aus dem Deck" — das
//     Cosmic-Manipulation-Signal `_summonedFromDeck` bleibt aus.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { isSummonablePileCreature } = require('./_hooks');
const { starthelden } = require('./_potion-deck-hero-shared');
const { eligibleSummonZones, canHeroSummon } = require('./_summon-eligibility');

const CARD_NAME = 'Pinta, the Singing Ship';
const REVEAL_MS = 1100;    // Deck → Mitte → Umdrehen → Weiterflug (wie Chaos-Diamond)

/** Darf diese Karte ueberhaupt aus einem Stapel beschwoert werden — und erfuellt sie ihre eigenen Bedingungen? */
function beschwoerbareKarte(engine, pi, feld, heroIdx, name) {
  // Nur, was ein Effekt aus einem Stapel auf die eigene Seite beschwoeren darf (keine Artifact Creatures mit
  // festen Beschwoerungsbedingungen, kein Powder Keg) und nichts, das „nur aus der Hand" geht (Ifrit).
  if (!isSummonablePileCreature(engine._getCardDB()[name], name)) return false;
  if (loadCardEffect(name)?.summonOnlyFromHand) return false;
  // Die Karte muss ihre eigenen Bedingungen erfuellen (Blue-Ice Dragon: zwei Opfer …).
  return engine.isCreatureSummonable(name, feld, heroIdx, { beschwoerer: pi });
}

/** Pintas eigene freie Zonen, auf die `name` JETZT beschwoert werden koennte („if possible"). */
function moeglicheZonen(engine, pi, feld, heroIdx, name) {
  const hero = engine.gs.players[feld]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0 || !name) return [];
  if (!beschwoerbareKarte(engine, pi, feld, heroIdx, name)) return [];
  // Beschwoeren darf NUR dieser Held („with this Hero"); als Zusatzaktion gelten die Aktionssperren mit.
  return eligibleSummonZones(engine, pi, name, { nachKontrolle: true, alsAktion: true })
    .filter(z => z.heroIdx === heroIdx && (z.owner ?? pi) === feld);
}

/**
 * Sind ALLE Zonen Pintas belegt und verlangt die Karte Opfer: die Zonen, deren Creature als Opfer taugt. Die
 * Creature dort wird automatisch zu einem der Opfer. Die Karte nennt ihre Kosten ueber den Vertrag
 * `summonSacrificeSpec(engine)` (Blue-Ice Dragon); ohne ihn gibt es keinen Weg in eine belegte Zone.
 * Eintraege wie die von `eligibleSummonZones`, dazu `opferInstId`.
 */
function opferZonen(engine, pi, feld, heroIdx, name) {
  const hero = engine.gs.players[feld]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0 || !name) return [];
  if (!beschwoerbareKarte(engine, pi, feld, heroIdx, name)) return [];
  const spec = loadCardEffect(name)?.summonSacrificeSpec?.(engine, pi);
  if (!spec) return [];
  const cd = engine._getCardDB()[name];
  if (!canHeroSummon(engine, pi, heroIdx, cd, { alsAktion: true, physOwner: feld })) return [];
  const zonen = engine.gs.players[feld]?.supportZones?.[heroIdx] || [];
  const anzahl = Math.min(zonen.length, 3);
  for (let z = 0; z < anzahl; z++) if (!engine.supportSlotBelegt(feld, heroIdx, z)) return [];   // sonst nimmt Pinta die erste freie
  const opfer = engine.getSacrificableCreatures(pi);
  const out = [];
  for (let z = 0; z < anzahl; z++) {
    const eintrag = opfer.find(c => c.inst.zone === 'support' && c.inst.heroIdx === heroIdx
      && c.inst.zoneSlot === z && engine.physicalSide(c.inst) === feld);
    if (!eintrag) continue;
    if (!engine.canSatisfySacrifice(pi, { ...spec, requiredInstIds: [eintrag.inst.id] })) continue;
    out.push({
      heroIdx, slotIdx: z, label: `${hero.name} — Slot ${z + 1} (sacrifices ${eintrag.cardName})`,
      opferInstId: eintrag.inst.id,
      ...(feld !== pi ? { owner: feld } : {}),
    });
  }
  return out;
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
    const feld = ctx.cardHeroOwner ?? ctx.cardOwner;   // Styx 28.9.: Brettseite des Helden
    const hero = ctx.attachedHero ?? engine?.gs?.players?.[feld]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    const pi = starthelden.kontrolleur(hero, ctx.cardOwner);   // wer mit ihm handelt (auch Controlled Attack)
    // „You can only activate this effect if this was one of your starting Heroes." — eine übernommene
    // Pinta nur, wenn das Potion Deck des Übernehmers zufällig auf sie zugeschnitten ist.
    if (!starthelden.darfAktivieren(engine, hero, pi, feld, CARD_NAME)) return false;
    return starthelden.obersteKarten(engine, pi, 1).length > 0;
  },

  // Die CPU nutzt den Effekt, solange irgendeine Karte im Potion Deck beschwoerbar ist — die oberste direkt,
  // sonst mischt der Effekt eine beschwoerbare nach oben. Ist NICHTS beschwoerbar, spart sie sich den Aufwand.
  cpuShouldUseHeroEffect(engine, pi, heroIdx) {
    const hi = heroIdx ?? (engine?.gs?.players?.[pi]?.heroes || []).findIndex(h => h?.name === CARD_NAME);
    const hero = engine?.gs?.players?.[pi]?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0 || !starthelden.darfAktivieren(engine, hero, pi, pi, CARD_NAME)) return false;
    const deck = engine.gs.players[pi].potionDeck || [];
    return [...new Set(deck)].some(n =>
      moeglicheZonen(engine, pi, pi, hi, n).length > 0 || opferZonen(engine, pi, pi, hi, n).length > 0);
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
    // Ein uebernommener Pinta (Charme, Controlled Attack) ist KEIN Starthero des Uebernehmers: nur, wenn sein
    // Potion Deck zufaellig auf sie zugeschnitten ist (er selbst also mit Pinta gestartet ist).
    if (!starthelden.darfAktivieren(engine, hero, pi, feld, CARD_NAME)) return false;
    const oben = starthelden.obersteKarten(engine, pi, 1)[0];
    if (!oben) return false;

    // Der Auftritt: Pinta singt.
    engine._broadcastEvent('play_zone_animation', { type: 'music_notes', owner: feld, heroIdx, zoneSlot: -1 });
    await engine._delay(450);

    // ① PLAN — wohin soll die Karte? Erste freie Zone; sonst (alle belegt) bei Opferkosten die Zone, deren
    // Creature zum Opfer wird; mehrere solche Zonen = der Spieler waehlt NACH dem Aufdecken.
    let ziel = null;
    let zuWaehlen = null;
    const frei = moeglicheZonen(engine, pi, feld, heroIdx, oben);
    if (frei.length > 0) {
      ziel = frei[0];
    } else {
      const opfer = opferZonen(engine, pi, feld, heroIdx, oben);
      if (opfer.length === 1) ziel = opfer[0];
      else if (opfer.length > 1) zuWaehlen = opfer;
    }
    // Direkt auf den Platz fliegen kann sie nur auf der eigenen Brettseite (der Client sucht die Zone dort).
    const direkt = !!ziel && feld === pi;

    // ② AUFDECKEN — vom Potion Deck in die Mitte, umdrehen, dann weiter (auf den Platz oder zurueck ins Potion
    // Deck). Der Zustand bleibt waehrenddessen unveraendert; umgebucht wird erst danach.
    engine.log('hand_card_revealed', { player: ps.username, card: oben, by: CARD_NAME });
    engine._broadcastEvent('mill_center_reveal', {
      owner: pi, cardNames: [oben], revealMs: REVEAL_MS, from: 'potionDeck',
      dest: direkt ? 'support' : 'potionDeck',
      ...(direkt ? { destHeroIdx: ziel.heroIdx, destSlotIdx: ziel.slotIdx } : {}),
    });
    // Direkt auf den Platz: Umbuchen genau zur Landung (die Kopie am Ziel haelt die Luecke, s. Client
    // `MILL_REVEAL_HALTE_AM_PLATZ_MS`) — Klang und Erscheinen fallen mit dem Aufsetzen zusammen. Zurueck ins
    // Potion Deck: erst abwarten, bis die Karte dort liegt.
    await engine._delay(direkt ? REVEAL_MS : REVEAL_MS + 100);

    // ③ Mehrere Opfer-Zonen: jetzt, mit der Karte vor Augen, waehlen. Nicht abbrechbar („immediately").
    if (zuWaehlen) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME,
        description: `Summon ${oben} into which of ${hero.name}'s Support Zones? The Creature there is sacrificed for it.`,
        previewCardName: oben,
        zones: zuWaehlen, cancellable: false, heroShortcut: false,
      });
      ziel = zuWaehlen.find(z => z.heroIdx === wahl?.heroIdx && z.slotIdx === wahl?.slotIdx
        && (z.owner ?? pi) === (wahl?.owner ?? pi)) || zuWaehlen[0];
    }

    // ④ „immediately summon it with this Hero as an additional Action, if possible."
    if (ziel) {
      const inst = await engine.summonFromPile(pi, 'potionDeck', oben, ziel.heroIdx, ziel.slotIdx, {
        source: CARD_NAME,
        alsZusatzaktion: true,                       // „as an additional Action" ist eine Aktion
        flug: !direkt,                               // direkt: der Weg aus der Mitte war schon der Flug
        hookExtras: {
          _isNormalSummon: false,
          // Die Creature in der gewaehlten Zone wird automatisch zu einem der Opfer.
          ...(ziel.opferInstId ? { _requiredSacrificeInstIds: [ziel.opferInstId] } : {}),
        },
        ...(feld !== pi ? { heldSeite: feld } : {}),
      });
      engine.log('pinta_summon', { player: ps.username, card: oben, ok: !!inst });
    } else {
      engine.log('pinta_reveal_unsummonable', { player: ps.username, card: oben });
    }

    // ⑤ „Shuffle your Potion Deck afterwards." — in jedem Fall: so legt eine unbeschwoerbare Creature den
    // Effekt nicht fuer mehrere Runden lahm.
    engine.shuffleDeck(pi, 'potion');
    engine.sync();
    return true;
  },

  hooks: {
    // „starting Heroes" + „you can never draw cards from your Potion Deck".
    onGameStart: starthelden.onGameStart,
  },

  _test: { moeglicheZonen, opferZonen },
};
