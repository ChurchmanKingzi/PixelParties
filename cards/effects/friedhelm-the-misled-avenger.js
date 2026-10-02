// ═══════════════════════════════════════════
//  HERO EFFECT: "Friedhelm, the Misled Avenger"
//
//  „You may spend your Action to use an Attack or Spell from your deck
//   with this Hero as if you played it from your hand. This Hero can
//   never perform more than 1 Action per turn."
//   (Kartentext gegenueber der Vorlage geaendert: der Einzelziel-Zusatz
//   „but if you do, that Attack or Spell cannot affect more than 1 target"
//   entfaellt; `data/cards.json` traegt den neuen Text.)
//
//  ZWEI TEILE (der fruehere dritte, „EIN ZIEL", ist weggefallen)
//
//   • AUS DEM DECK SPIELEN. Es gibt im Bestand keine zweite Karte, die
//     das tut — der Weg ist deshalb aus vorhandenen Stuecken gebaut:
//       1. Galerie ueber die Attacks und Spells im eigenen Deck, die
//          dieser Held ueberhaupt spielen koennte (Schul- und
//          Stufenpruefung wie beim Handspiel — sonst bietet die Karte
//          Zuege an, die der Server danach ablehnt).
//       2. `_castSpellImmediately(..., { fromZone: 'deck', pool,
//          poolIndex })` — dieselbe Bruecke, die die Sofortaktion
//          benutzt, nur direkt. Sie kann das Deck als Quelle von Haus
//          aus; die Karte wandert also NICHT erst auf die Hand.
//     Damit landet der Spieler sofort in der Zielwahl der Karte, statt
//     in einem zweiten Dialog, in dem er sie noch einmal ausspielen
//     muesste (Als Vorgabe 12.9.). Die Zielwahl ist NICHT abbrechbar —
//     `_forceNonCancellable` (v741).
//
//   • EINE AKTION JE ZUG — ZUSATZAKTIONEN ZAEHLEN MIT. `hero._maxActionsPerTurn = 1`
//     beim Spielbeginn — vorhandener Engine-Vertrag (wie Sol Rym, the Thunder
//     Djinn), den die Engine an mehreren Stellen liest (Aktivierungslisten,
//     Spielbarkeit, Sofortaktionen). „1 Action per turn" schliesst ausdruecklich
//     ZUSATZAKTIONEN ein (Quick Attack, Aggressive Town Guard, Coffee, …): jede
//     Aktion dieses Helden — regulaer, zusaetzlich oder inhaerent, von der Hand,
//     per Zusatzaktions-Abfrage oder ueber seinen eigenen Effekt — verbraucht die
//     eine Aktion. Dafuer lauscht er auf `onAnyActionResolved` (feuert JEDER
//     Aktionsweg; Waechter `check-action-hook`) und setzt `_actionsThisTurn` auf
//     mindestens 1; danach sperrt der Vertrag ihn fuer alles Weitere (Spielen,
//     Zusatzaktionen, Heldeneffekt).
//
//  AKTIONSKOSTEN: `heroEffectActionCost: true` — „spend your Action"
//  steht ausdruecklich da (★-Regel 7.9.). Die anschliessende
//  Sofortaktion ist die Karte, die damit bezahlt wurde, kein Zusatz.
// ═══════════════════════════════════════════

const CARD_NAME = 'Friedhelm, the Misled Avenger';

/** Attacks und Spells im Deck, die DIESER Held spielen koennte. */
function spielbareDeckkarten(engine, pi, heroIdx, feld = pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const db = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  for (const name of (ps?.mainDeck || [])) {
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    const cd = db[name];
    if (!cd) continue;
    if (cd.cardType !== 'Attack' && cd.cardType !== 'Spell') continue;
    // Schul- und Stufenpruefung wie beim Handspiel. Ohne sie bietet die
    // Karte Zuege an, die `validateActionPlay` danach ablehnt — und die
    // Karte waere aus dem Deck heraus und die Aktion weg.
    // `heroMeetsLevelReq` ist die Stelle, die auch
    // `getHeroPlayableCards` benutzt (mit levelOverrideCards,
    // bypassLevelReq, Performance und Wisdom). NICHT selbst nachbauen.
    // Als Vorgabe 29.9.: geliehener Friedhelm — Stufe am Helden (`feld`),
    // Ermaessigungen beim Kontrolleur (wie der Charme-Zweig).
    if (!engine.heroMeetsLevelReq(feld, heroIdx, cd, feld !== pi ? { levelSourcePi: pi } : {})) continue;
    // ★ GALERIE-EINTRAEGE SIND OBJEKTE (Als Befund 12.9.) ────────────
    // `promptCardGallery` erwartet `[{ name, source?, … }]`, keine
    // nackten Strings. Mit Strings oeffnet sich die Galerie und bleibt
    // LEER — die Karte sah aus, als faende sie nichts im Deck, obwohl
    // die Kandidatenliste voll war. Rueckgabe ist `{ cardName }`.
    out.push({ name, source: 'deck' });
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // „spend your Action" — ausdruecklich im Text.
  heroEffectActionCost: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Als Vorgabe 29.9.: ein uebernommener Friedhelm wirkt auf seiner
    // Brettseite (`_castSpellImmediately` mit `heroOwner`), Deck = Kontrolleur.
    const feld = ctx.cardHeroOwner ?? pi;
    const hero = ctx.attachedHero ?? engine?.gs?.players?.[feld]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    // Die Aktionsgrenze der Karte selbst: hat er schon gehandelt, ist
    // Schluss. Die Engine prueft das auch, aber ein toter Knopf ist
    // besser als eine abgelehnte Aktivierung.
    if (hero._maxActionsPerTurn && (hero._actionsThisTurn || 0) >= hero._maxActionsPerTurn) return false;
    return spielbareDeckkarten(engine, pi, ctx.cardHeroIdx, feld).length > 0;
  },

  cpuShouldUseHeroEffect(engine, pi) {
    const hi = (engine?.gs?.players?.[pi]?.heroes || []).findIndex(h => h?.name === CARD_NAME);
    if (hi < 0) return false;
    const hero = engine.gs.players[pi].heroes[hi];
    if (hero.hp <= 0) return false;
    if (hero._maxActionsPerTurn && (hero._actionsThisTurn || 0) >= hero._maxActionsPerTurn) return false;
    return spielbareDeckkarten(engine, pi, hi).length > 0;
  },

  cpuMeta: {
    // Verbraucht die Aktion des Zuges und spielt dafuer eine Karte aus
    // dem Deck — fuer die Aktionsplanung ein Aktionszug.
    usesAction: true,
  },

  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic') return undefined;
    const quelle = payload?.source || payload?.title;
    if (quelle !== CARD_NAME) return undefined;
    if (payload?.type !== 'cardGallery') return undefined;
    // Erste spielbare Karte — die Reihenfolge kommt aus dem Deck, eine
    // Bewertung einzelner Attacks/Spells gehoert in die Deckprofile,
    // nicht hierher.
    const karten = payload.cards || [];
    if (karten.length === 0) return undefined;
    // Eintraege sind Objekte `{ name, … }` — nicht der Eintrag selbst.
    return { cardName: karten[0]?.name ?? karten[0] };
  },

  hooks: {
    // „1 Action per turn" schliesst ZUSATZAKTIONEN ein: jede aufgeloeste Aktion DIESES Helden verbraucht die eine
    // Aktion — auch eine zusaetzliche/inhaerente von der Hand oder ueber seinen Effekt. Danach sperrt der
    // `_maxActionsPerTurn`-Vertrag ihn fuer alles Weitere.
    onAnyActionResolved: (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const feld = ctx.cardHeroOwner ?? pi;
      const hero = engine?.gs?.players?.[feld]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name) return;
      const handelnd = ctx.heroOwner ?? ctx.playerIdx;
      if (ctx.heroIdx !== ctx.cardHeroIdx || (handelnd !== pi && handelnd !== feld)) return;
      if (!hero._maxActionsPerTurn) hero._maxActionsPerTurn = 1;
      hero._actionsThisTurn = Math.max(hero._actionsThisTurn || 0, 1);
    },

    // „can never perform more than 1 Action per turn" — vorhandener
    // Engine-Vertrag, gesetzt wie bei Sol Rym.
    onGameStart: (ctx) => {
      const hero = ctx._engine?.gs?.players?.[ctx.cardOriginalOwner]?.heroes?.[ctx.cardHeroIdx];
      if (hero) hero._maxActionsPerTurn = 1;
    },
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    const feld = ctx.cardHeroOwner ?? pi;   // Als Vorgabe 29.9.: Brettseite des Helden

    const kandidaten = spielbareDeckkarten(engine, pi, heroIdx, feld);
    if (kandidaten.length === 0) return false;

    // Die Galerie haengt am ctx (`_createContext`), nicht an der Engine.
    const wahl = await ctx.promptCardGallery(kandidaten, {
      title: CARD_NAME,
      source: CARD_NAME,
      description: 'Choose an Attack or Spell from your deck to use with this Hero.',
      confirmLabel: '⚔️ Use it!',
      cancellable: true,
    });
    const name = wahl?.cardName || (typeof wahl === 'string' ? wahl : null);
    if (!name || !kandidaten.some(k => k.name === name)) return false;

    // ── DIREKT AUFLOESEN, KEIN UMWEG UEBER DIE HAND ──────────────────
    // `_castSpellImmediately` ist die Bruecke, die auch die Sofortaktion
    // benutzt — und sie kann `fromZone: 'deck'` von Haus aus. Die Karte
    // wandert also gar nicht erst auf die Hand, und der Spieler landet
    // sofort in der Zielwahl der Karte statt in einem zweiten Dialog,
    // in dem er sie noch einmal ausspielen muesste (Als Vorgabe 12.9.).
    const poolIndex = (ps.mainDeck || []).indexOf(name);
    if (poolIndex < 0) return false;

    // ★ AUFTRITT DER GESPIELTEN KARTE (Als Vorgabe 12.9.) ────────────
    // Beide Spieler sollen sehen, WAS aus dem Deck kommt — der
    // Standard-Auftritt links vom Battlefield. `deck_search_add` weiter
    // unten in der Bruecke ist etwas anderes: eine Suchanzeige, kein
    // Auftritt.
    // Der Zeitpunkt ist hier zulaessig, obwohl die Regel „erst nach dem
    // Commit" lautet: die Galerie-Wahl IST der Commit — die folgende
    // Zielwahl ist nicht abbrechbar (`_forceNonCancellable` unten).
    await engine.showTriggeredEffect(name, { playerIdx: pi });

    // Die Zielwahl ist NICHT abbrechbar: die Aktion ist bezahlt und die Karte verlaesst das Deck.
    // `_forceNonCancellable` ist der vorhandene Zaehler dafuer (v741), den auch der erzwungene Kreatureneffekt nimmt —
    // als Zaehler, nicht als Schalter, damit verschachtelte Aufloesungen sich nicht gegenseitig freigeben.
    engine._forceNonCancellable = (engine._forceNonCancellable || 0) + 1;
    try {
      const r = await engine._castSpellImmediately(pi, heroIdx, name, {
        fromZone: 'deck',
        pool: ps.mainDeck,
        poolIndex,
        by: CARD_NAME,
        ...(feld !== pi ? { heroOwner: feld } : {}),   // Als Vorgabe 29.9.
      });
      if (r?.cancelled) return false;
    } finally {
      engine._forceNonCancellable--;
    }

    engine.log('friedhelm_deck_play', { player: ps.username, card: name });
    engine.sync();
    return true;
  },
};
