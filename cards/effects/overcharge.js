// ═══════════════════════════════════════════
//  CARD EFFECT: „Overcharge"
//  Spell (Magic Arts, Level 0) — Normal
//
//  „Choose an Artifact equipped to a Hero you control and send it to
//   the discard pile. Then, choose an equippable Artifact with a Cost
//   between 1 and 10 Gold higher than the discarded one from your deck
//   and equip it to the same Hero. If the user has at least Magic Arts
//   1, this counts as an additional Action."
//
//  ── ALS VORGABE (5.9.) ─────────────────────────────────────────────
//  Waehlbar sind NUR Ausruestungen, fuer die es im Deck tatsaechlich
//  eine Aufwertung gibt (Kosten 1–10 hoeher). Ein Equip ohne
//  Nachfolger steht gar nicht erst zur Wahl — sonst wirft man seine
//  Ausruestung weg und bekommt nichts zurueck.
//
//  Dieselbe Pruefung sitzt als `spellPlayCondition` VOR dem Guss: gibt
//  es kein einziges taugliches Paar, ist die Karte ausgegraut. Das ist
//  die Lehre aus CARD_API („Gate on what the actor can actually
//  touch") — der Filter im Prompt allein wuerde die Karte spielbar
//  aussehen lassen und dann mit leerer Auswahl dastehen.
//
//  ── ABLAUF (Als Vorgabe 5.9., dritte Runde) ────────────────────────
//    1. Ausruestung waehlen, die weichen soll (entfaellt bei nur einer)
//    2. Ausruestung waehlen, die kommen soll  ← DAS IST DIE ZUSAGE
//    3. erst jetzt: die erste in die Ablage, die zweite aufs Brett
//
//  KEIN Abschluss-Confirm: der Klick in der Galerie ist die Zusage.
//  Deshalb wird die Galerie IMMER gezeigt, auch bei nur einem
//  Kandidaten — sie ist der einzige Punkt, an dem der Spieler zusagt,
//  und darf nie weggekuerzt werden. Ihr Text nennt beide Karten und den
//  Helden, der Spieler weiss also, was er auslost.
//
//  Ein Abbruch an JEDER Stelle vor dem Galerie-Klick bricht alles ab:
//  nichts wird abgelegt, nichts gezogen, die Karte bleibt in der Hand,
//  die Aktion ist nicht verbraucht — und der Gegner hat die Karte nicht
//  gesehen.
//
//  Dafuer braucht es zwei Dinge, die man leicht uebersieht:
//
//  • `gs._spellCancelled = true` auf JEDEM Abbruchweg. Ein blosses
//    `return false` laesst den Server den Guss als aufgeloest
//    verbuchen — Karte weg, Aktion weg. Der Abbruchzweig in
//    `doPlaySpell` erstattet dagegen die Heldenkosten, legt die Karte
//    zurueck, rollt die Aktionsbuchhaltung zurueck und wirft den
//    ausstehenden Reveal weg.
//
//  • `gs._holdCardReveal = true` fuer die Dauer der Auswahl.
//    `promptGeneric` feuert den Reveal bei jeder bestaetigten Antwort,
//    die Karte waere also schon nach dem ERSTEN Klick beim Gegner
//    gestreamt. Die Sperre haelt sie zurueck, bis bestaetigt wurde;
//    ein `finally` loescht sie in jedem Fall wieder.
//
//  ── AUFBAU ─────────────────────────────────────────────────────────
//  • Zielwahl auf dem Brett: `promptZonePick`. Der Spieler klickt die
//    Support Zone an, in der die Ausruestung liegt.
//  • Ablegen: `actionMoveCard(… , 'discard')` — „send to the discard
//    pile" ist eine Bewegung, KEINE Zerstoerung. `onCardLeaveZone`
//    laeuft mit, ATK-Boni und Anhaengsel werden also sauber
//    zurueckgenommen. Passiert erst NACH der Bestaetigung.
//  • Aufwerten: derselbe Ausruest-Ablauf wie in „Gate to the Armory" —
//    `safePlaceInSupport`, danach onPlay + onCardEnterZone von Hand
//    feuern (Vertrag: wer platziert, feuert die Hooks selbst) und den
//    oncePerGame-Riegel stempeln.
//  • Neue Ausruestung kommt in den GERADE FREI GEWORDENEN Platz —
//    „equip it to the same Hero", und der Platz ist der natuerliche.
//
//  ── „equippable" ───────────────────────────────────────────────────
//  Dieselbe Definition wie bei Gate to the Armory: Subtype Equipment,
//  kein `neverPlayable` (Modnir, Swellpnir — nur aus dem
//  Coolness-Stack), `canEquipToHero` erfuellt, oncePerGame nicht
//  verbraucht.
// ═══════════════════════════════════════════

const { hasCardType, heroAbilityLevel } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Overcharge';
const MIN_AUFSCHLAG = 1;
const MAX_AUFSCHLAG = 10;

/** Kosten einer Karte als Zahl (nicht gesetzt = 0). */
function kosten(cd) {
  return typeof cd?.cost === 'number' ? cd.cost : 0;
}

/**
 * Laesst sich `cardName` an diesen Helden ausruesten?
 * Deckungsgleich mit dem Gate in „Gate to the Armory".
 */
function istAusruestbar(engine, pi, heroIdx, cardName) {
  const cd = engine._getCardDB()[cardName];
  if (!cd || !hasCardType(cd, 'Artifact') || cd.subtype !== 'Equipment') return false;
  const script = loadCardEffect(cardName);
  if (script?.neverPlayable) return false;
  if (typeof script?.canEquipToHero === 'function') {
    try {
      if (!script.canEquipToHero(engine.gs, pi, heroIdx, engine)) return false;
    } catch { return false; }
  }
  if (script?.oncePerGame) {
    const key = script.oncePerGameKey || cardName;
    if (engine.gs.players[pi]?._oncePerGameUsed?.has(key)) return false;
  }
  return true;
}

/**
 * Aufwertungen im Deck fuer eine abgelegte Ausruestung — entdoppelt,
 * mit Stueckzahl, alphabetisch. Leeres Ergebnis heisst: dieses Equip
 * ist kein zulaessiges Ziel.
 */
function aufwertungenImDeck(engine, pi, heroIdx, altKosten) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const min = altKosten + MIN_AUFSCHLAG;
  const max = altKosten + MAX_AUFSCHLAG;
  const zaehler = new Map();
  for (const cn of (ps.mainDeck || [])) {
    const cd = cardDB[cn];
    if (!cd) continue;
    const k = kosten(cd);
    if (k < min || k > max) continue;
    if (!istAusruestbar(engine, pi, heroIdx, cn)) continue;
    zaehler.set(cn, (zaehler.get(cn) || 0) + 1);
  }
  return [...zaehler.entries()]
    .map(([name, count]) => ({ name, source: 'deck', count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Alle Ausruestungen auf eigenen Helden, FUER DIE ES EINE AUFWERTUNG
 * GIBT (Als Vorgabe). Liefert je Treffer Held, Platz, Name und die
 * bereits ermittelte Kandidatenliste.
 */
function zulaessigeZiele(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    // Eingefrorene oder bezauberte Helden nehmen keine neue Ausruestung
    // an — dieselbe Schranke wie im Server-Ausruestpfad.
    if (hero.statuses?.frozen || hero.statuses?.charmed) continue;
    const zonen = ps.supportZones?.[hi] || [];
    for (let si = 0; si < zonen.length; si++) {
      const name = (zonen[si] || [])[0];
      if (!name) continue;
      const cd = cardDB[name];
      if (!cd || !hasCardType(cd, 'Artifact') || cd.subtype !== 'Equipment') continue;
      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.name === name
        && c.heroIdx === hi && c.zoneSlot === si
        && (c.controller ?? c.owner) === pi);
      if (!inst) continue;
      const kandidaten = aufwertungenImDeck(engine, pi, hi, kosten(cd));
      if (kandidaten.length === 0) continue;     // ★ Als Vorgabe
      out.push({ heroIdx: hi, slotIdx: si, cardName: name, inst, hero, kandidaten });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hand'],

  /**
   * „If the user has at least Magic Arts 1, this counts as an
   * additional Action."
   *
   * Reine Aktionsoekonomie — die Karte bleibt ohne Magic Arts spielbar,
   * sie kostet dann nur die Aktion. Genau der Fall, fuer den
   * `inherentAction` als Funktion gedacht ist (Quick Attack, Overheal
   * Shock, Market Crash); ein `spellPlayCondition` daraus zu machen
   * waere falsch.
   */
  inherentAction: (gs, pi, heroIdx, engine) => {
    if (heroIdx == null || heroIdx < 0) return false;
    return heroAbilityLevel(engine, pi, heroIdx, 'Magic Arts') >= 1;
  },

  /**
   * Spielsperre: ohne ein einziges taugliches Paar (Ausruestung auf dem
   * Brett + Aufwertung im Deck) ist die Karte ausgegraut.
   */
  spellPlayCondition: (gs, pi, engine) => {
    if (!engine) return true;
    return zulaessigeZiele(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      /** Vollstaendiger Abbruch: Karte bleibt in der Hand, Aktion bleibt. */
      const abbrechen = () => { gs._spellCancelled = true; return false; };

      if (!ps) return abbrechen();

      const ziele = zulaessigeZiele(engine, pi);
      if (ziele.length === 0) return abbrechen();

      // Ab hier haelt die Sperre die Ankuendigung zurueck. Das `finally`
      // ganz unten loest sie in JEDEM Fall wieder — auch bei einem
      // Wurf aus einem Prompt heraus.
      gs._holdCardReveal = true;
      try {
        // ── 1) Ausruestung waehlen, die weichen soll ────────────────
        let gewaehlt = ziele[0];
        if (ziele.length > 1) {
          const zonen = ziele.map(z => ({
            heroIdx: z.heroIdx,
            slotIdx: z.slotIdx,
            label: `${z.hero.name} — ${z.cardName} (Slot ${z.slotIdx + 1})`,
          }));
          const picked = await ctx.promptZonePick(zonen, {
            title: CARD_NAME,
            description: 'Choose an equipped Artifact to overcharge. Only Artifacts with a valid upgrade in your deck are shown.',
            cancellable: true,
            // Hier wird eine KARTE gewaehlt, kein Platz: ein Klick auf
            // die Heldenkarte darf nicht stellvertretend dessen
            // linkeste Ausruestung nehmen (Als Befund 5.9.).
            heroShortcut: false,
          });
          if (!picked) return abbrechen();
          gewaehlt = ziele.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx);
          if (!gewaehlt) return abbrechen();
        }

        const { heroIdx, slotIdx, cardName: altName, inst: altInst, hero } = gewaehlt;
        const altKosten = kosten(engine._getCardDB()[altName]);

        // ── 2) Ausruestung waehlen, die kommen soll ─────────────────
        // Der Klick hier IST die Zusage — es folgt kein weiterer
        // Confirm. Die Galerie wird deshalb auch bei nur EINEM
        // Kandidaten gezeigt (Als Vorgabe 5.9.): sie ist der einzige
        // Punkt, an dem der Spieler zusagt. Wuerde sie bei einer
        // einzigen Karte uebersprungen, liefe der Effekt ohne jede
        // Rueckfrage durch.
        const kandidaten = aufwertungenImDeck(engine, pi, heroIdx, altKosten);
        if (kandidaten.length === 0) return abbrechen();

        const picked = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: kandidaten,
          title: CARD_NAME,
          description: `Choose an Artifact costing ${altKosten + MIN_AUFSCHLAG}–${altKosten + MAX_AUFSCHLAG} Gold from your deck. It replaces ${altName} on ${hero.name}, which is sent to the discard pile.`,
          confirmLabel: '⚡ Overcharge!',
          confirmClass: 'btn-success',
          cancellable: true,
        });
        if (!picked || picked.cancelled || !picked.cardName) return abbrechen();
        const neuName = picked.cardName;
        const neuKosten = kosten(engine._getCardDB()[neuName]);

        // ── 3) Zugesagt — ab hier wird die Karte wirklich eingesetzt.
        // Erst jetzt darf der Gegner sie sehen.
        const deckIdx = (ps.mainDeck || []).indexOf(neuName);
        if (deckIdx < 0) return abbrechen();
        if (!altInst || altInst.zone !== 'support') return abbrechen();

        gs._holdCardReveal = false;
        engine._firePendingCardReveal();

        // ── 3a) Alte Ausruestung in die Ablage ─────────────────────
        await engine.actionMoveCard(altInst, 'discard', -1, -1, { source: ctx.card });
        engine.sync();

        // ── 3b) Neue Ausruestung aus dem Deck in denselben Platz ───
        if (!(await engine.takeFromPile(ps, 'deck', deckIdx, { source: CARD_NAME }))) return;   // v820: Stapel-Schicht
        engine._broadcastEvent('play_card_transfer', {
          cardName: neuName,
          sourceOwner: pi, sourceZoneKind: 'deck', sourceHeroIdx: heroIdx, sourceZoneSlot: -1,
          targetOwner: pi, targetHeroIdx: heroIdx, targetZoneSlot: slotIdx,
          duration: 700,
        });
        await engine._delay(700);

        const placed = engine.safePlaceInSupport(neuName, pi, heroIdx, slotIdx);
        if (!placed?.inst) {
          // Platz wider Erwarten nicht frei — Karte zurueck ins Deck.
          // KEIN Abbruch mehr: die alte Ausruestung ist bereits abgelegt,
          // der Guss hat stattgefunden.
          ps.mainDeck.push(neuName);
          engine.shuffleDeck(pi, 'main');
          engine.sync();
          return true;
        }

        engine._broadcastEvent('summon_effect', {
          owner: pi, heroIdx, zoneSlot: placed.actualSlot, cardName: neuName,
        });

        // Vertrag: wer selbst platziert, feuert die Hooks von Hand.
        await engine.runHooks('onPlay', {
          _onlyCard: placed.inst, playedCard: placed.inst,
          cardName: neuName, zone: 'support', heroIdx,
          zoneSlot: placed.actualSlot, _skipReactionCheck: true,
        });
        await engine.runHooks('onCardEnterZone', {
          enteringCard: placed.inst, toZone: 'support',
          toHeroIdx: heroIdx, _skipReactionCheck: true,
        });

        const neuScript = loadCardEffect(neuName);
        if (neuScript?.oncePerGame) {
          const key = neuScript.oncePerGameKey || neuName;
          if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
          ps._oncePerGameUsed.add(key);
        }

        engine.shuffleDeck(pi, 'main');
        engine._broadcastEvent('deck_search_add', { cardName: neuName, playerIdx: pi });
        engine.log('overcharge_swap', {
          player: ps.username, hero: hero.name,
          from: altName, fromCost: altKosten,
          to: neuName, toCost: neuKosten,
        });
        engine.sync();

        const oi = pi === 0 ? 1 : 0;
        await engine.promptGeneric(oi, {
          type: 'deckSearchReveal',
          cardName: neuName,
          searcherName: ps.username,
          title: CARD_NAME,
          cancellable: false,
        });

        return true;
      } finally {
        delete gs._holdCardReveal;
      }
    },
  },
};
