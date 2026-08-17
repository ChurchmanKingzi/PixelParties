// ═══════════════════════════════════════════
//  CARD EFFECT: "Cecilia, the Harrowing Crusader"
//  Hero (400 HP / 80 ATK, Archetyp "Bad") — zwei Effekte:
//
//  1) DECKBAU: "When you play this Hero, you may play up to 5 copies
//     of any Attacks, Spells and Artifacts in your deck."
//     Bei einem Helden heisst "when you play this Hero" — wie bei
//     Nicolas — dass er im TEAM steht. Umgesetzt im Deck-Editor:
//     `getCardMax` in `public/app-shared.jsx` (`hasCeciliaCopyBonus`),
//     dazu die Auto-Kappung, wenn sie das Team wieder verlaesst.
//     HIER steht dazu nichts — Deckbauregeln liegen nicht im
//     Kartenskript, genau wie bei Nicolas.
//
//  2) AUFSTIEG: „Rescued Damsel Cecilia" verlangt eine Cecilia, „that
//     has been defeated at least once this game". DIESE Karte fuehrt
//     das Buch darueber (`hero._ceciliaDefeatedOnce`) und meldet dem
//     Client die Aufstiegsbereitschaft — Bauart wie `_arthor-shared`:
//     der BASISHELD setzt `ascensionReady`/`ascensionTarget`, die
//     Oberflaeche liest nur.
//
//     Ein eigener Merker statt `hero.diedOnTurn`: das Feld heisst
//     „an welchem Zug gestorben", wird bei einer Rettung durch einen
//     Hook wieder geloescht und gehoert der Engine-Buchhaltung. Der
//     Aufstieg verlangt einen LEBENDEN Helden (`performAscension`
//     prueft `hp > 0`), der Weg ist also „gestorben, wiederbelebt,
//     dann aufgestiegen" — und genau ueber eine Wiederbelebung muss
//     der Merker hinweghalten.
//
//  3) IM SPIEL: "You may once per turn spend all your Gold (at least 1)
//     to delete an Artifact from your discard pile and add a copy of it
//     from your deck to your hand."
//     Klassischer Heldeneffekt. Das Einmal-pro-Zug erledigt die Engine
//     ueber ihren HOPT-Schluessel `hero-effect:<Name>:<pi>:<heroIdx>`
//     (server.js `doActivateHeroEffect`) — das Skript zaehlt nichts
//     selbst mit.
//
//  ── AUSLEGUNG (Al gemeldet, nicht gefragt) ────────────────────────
//  Angeboten werden nur Artifacts, von denen auch WIRKLICH NOCH EINE
//  KOPIE IM DECK liegt. Der Text verlangt beides in einem Zug
//  ("delete … AND add a copy of it from your deck"); ohne diese
//  Einschraenkung waere die Auswahl eine Falle: das gesamte Gold waere
//  weg, die Karte geloescht, und die zweite Haelfte liefe ins Leere.
//  Dieselbe Linie wie beim Tuscan-Mystic-Ruling vom 16.8.
//
//  Aus demselben Grund kostet ein Abbruch nichts: bezahlt wird ERST
//  nach der Wahl.
//
//  ── RUECKGABEVERTRAG (Als Befund 17.8., hier zuerst schiefgegangen) ─
//  `onHeroEffect` MUSS bei jedem Abbruch **`false`** zurueckgeben. Die
//  Engine stempelt das Einmal-pro-Zug nur, wenn der Rueckgabewert
//  `!== false` ist (server.js `doActivateHeroEffect`) — und meldet den
//  Effekt sonst als "gefeuert", obwohl nichts geschah. Ein blosses
//  `return;` liefert `undefined` und gilt damit als Erfolg: der Zug
//  war verbraucht, ohne dass irgendetwas passiert ist.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Cecilia, the Harrowing Crusader';
const AUFSTIEG_ZIEL = 'Rescued Damsel Cecilia';

/**
 * Aufstiegsbereitschaft an den Client melden. Nur eine Anzeige — die
 * verbindliche Pruefung steht als `ascensionCondition` auf der
 * aufgestiegenen Karte, dort wo der Satz gedruckt ist.
 */
function meldeAufstieg(hero) {
  if (!hero || hero.name !== CARD_NAME) return;
  if (hero._ceciliaDefeatedOnce) {
    hero.ascensionReady = true;
    hero.ascensionTarget = AUFSTIEG_ZIEL;
  } else {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
  }
}

/**
 * Artifacts im Ablagestapel, zu denen es noch eine Kopie im Deck gibt.
 * Rueckgabe: Map Name → Anzahl im Ablagestapel (fuer die Galerie).
 */
function waehlbareArtefakte(engine, pi) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps) return new Map();
  const cardDB = engine._getCardDB();
  const imDeck = new Set(ps.mainDeck || []);
  const treffer = new Map();
  for (const name of (ps.discardPile || [])) {
    if (!imDeck.has(name)) continue;
    if (!hasCardType(cardDB[name], 'Artifact')) continue;
    treffer.set(name, (treffer.get(name) || 0) + 1);
  }
  return treffer;
}

module.exports = {
  activeIn: ['hero'],

  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // "spend all your Gold (at least 1)" — ohne Gold kein Effekt.
    if ((engine?.gs?.players?.[pi]?.gold || 0) < 1) return false;
    return waehlbareArtefakte(engine, pi).size > 0;
  },

  // CPU-Vertrag: der Effekt kostet ALLES Gold, taugt also nur, wenn das
  // Gold gerade ohnehin nicht besser angelegt ist. Der Wert steckt in
  // der zurueckgeholten Karte, nicht im Tempo — deshalb kein Drang, ihn
  // frueh im Zug zu zuenden.
  cpuShouldUseHeroEffect(engine, pi) {
    const ps = engine?.gs?.players?.[pi];
    if (!ps) return false;
    if ((ps.gold || 0) < 1) return false;
    return waehlbareArtefakte(engine, pi).size > 0;
  },

  cpuMeta: {
    // Der Effekt zieht eine Karte in die Hand — der Deckout-Waechter und
    // die Zieh-Kanaele sollen das sehen.
    activationDraws: 1,
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const gold = ps.gold || 0;
    if (gold < 1) return false;

    const treffer = waehlbareArtefakte(engine, pi);
    if (treffer.size === 0) return false;

    const galerie = [...treffer.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'discard', count }));

    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galerie,
      title: CARD_NAME,
      description: `Delete an Artifact from your discard pile and add a copy from your deck to your hand. This costs ALL your Gold (${gold}).`,
      cancellable: true,
    });
    // Abbruch: `false`, damit die Engine das Einmal-pro-Zug NICHT
    // stempelt und den Effekt nicht als gefeuert meldet.
    if (!wahl || wahl.cancelled || !wahl.cardName) return false;

    const gewaehlt = wahl.cardName;

    // Nach der Abfrage neu pruefen — zwischen Anzeige und Antwort kann
    // sich der Zustand geaendert haben (Reaktion, Abwurf, Mill).
    const discardIdx = (ps.discardPile || []).lastIndexOf(gewaehlt);
    const deckIdx = (ps.mainDeck || []).indexOf(gewaehlt);
    if (discardIdx < 0 || deckIdx < 0) return false;
    const goldJetzt = ps.gold || 0;
    if (goldJetzt < 1) return false;

    // ── 1) Kosten: das GESAMTE Gold ──────────────────────────────────
    // Ueber `actionSpendGold`, nicht `actionSetGold`: nur so feuern die
    // `afterResourceSpend`-Hooks (Debt-O-Tron-Modelle haengen daran).
    await engine.actionSpendGold(pi, goldJetzt);

    // ── 2) Ablagestapel → Loeschstapel ───────────────────────────────
    // Broadcast VOR der Zustandsaenderung, damit die fliegende Karte
    // startet, waehrend der Stapel noch den alten Stand zeigt (Muster
    // aus `_engine.js`, Surprise-Loeschung).
    const nochDa = (ps.discardPile || []).lastIndexOf(gewaehlt);
    if (nochDa >= 0) {
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: gewaehlt,
        from: 'discard', to: 'deleted',
      });
      ps.discardPile.splice(nochDa, 1);
      if (!ps.deletedPile) ps.deletedPile = [];
      ps.deletedPile.push(gewaehlt);
      // Die Instanz mitziehen, sonst haengt sie als Karteileiche mit
      // `zone: 'discard'` in `cardInstances`, obwohl der Stapel sie
      // nicht mehr fuehrt.
      const inst = (engine.cardInstances || []).find(
        c => c.name === gewaehlt && c.owner === pi && c.zone === 'discard');
      if (inst) inst.zone = 'deleted';
      engine.sync();
    }

    // ── 3) Kopie aus dem Deck auf die Hand ───────────────────────────
    // Ueber den kanonischen Helfer: er erledigt Deck-Splice, Handablage,
    // Instanzverfolgung, Suchanimation, Log, den
    // ON_CARD_ADDED_TO_HAND-Hook (Cosmic-Depths-Analyzer/Gatherer
    // haengen daran) und die Aufdeck-Abfrage beim Gegner.
    await engine.actionAddCardFromDeckToHand(pi, gewaehlt, {
      source: CARD_NAME,
      reveal: true,
    });

    engine.log('cecilia_artifact_recursion', {
      player: ps.username, card: gewaehlt, goldSpent: goldJetzt,
    });
    return true;
  },

  hooks: {
    /** „has been defeated at least once this game" — hier gebucht. */
    onHeroKO: (ctx) => {
      const hero = ctx.hero;
      if (!hero || hero.name !== CARD_NAME) return;
      hero._ceciliaDefeatedOnce = true;
      meldeAufstieg(hero);
    },

    // Anzeige nachziehen: der Merker ueberlebt Wiederbelebungen, die
    // Aufstiegsmarken koennten aber von anderer Seite geraeumt worden
    // sein — und ein im Puzzle gesetzter Merker hat nie einen KO
    // gesehen.
    onTurnStart: (ctx) => {
      const ps = ctx._engine?.gs?.players?.[ctx.cardOwner];
      const hero = ps?.heroes?.[ctx.card?.heroIdx];
      meldeAufstieg(hero);
    },
    onGameStart: (ctx) => {
      const ps = ctx._engine?.gs?.players?.[ctx.cardOwner];
      const hero = ps?.heroes?.[ctx.card?.heroIdx];
      meldeAufstieg(hero);
    },
  },

  // Fuer die aufgestiegene Form und Tests.
  _AUFSTIEG_ZIEL: AUFSTIEG_ZIEL,
};
