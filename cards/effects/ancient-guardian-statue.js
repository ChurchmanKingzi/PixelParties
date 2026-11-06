'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Ancient Guardian Statue"
//  Creature (Normal, Lv 1, 120 HP, Summoning Magic) — PP MSAZ
//
//  „When you summon this Creature, choose any level 4 or lower Spell from your deck and add it to your hand. It is permanently revealed.
//   At the end of each of your turns, if this Creature is still on the board, the Spell's level is reduced by 1. If the Spell's level is
//   reduced to 0 by this effect, you may use it as an additional Action."
//   (Al: „Wenn die exakte Kopie des Spells, die gesucht und revealed wurde, nicht mehr auf der Hand ist, tut der Effekt nichts mehr.")
//
//  ── Bauform ──────────────────────────────────────────────────────
//  ① Beschwörung (`onPlay`): Deck-Suche nach dem Such-Template (`_search-shared`): unter Hand-/Such-Sperre oder ohne Kandidat wirkt der Effekt nicht (stumme
//     Fizzel-Meldung für Sandy Blob, W11/R4), es gibt keine Frage. Pflichtwahl (nicht abbrechbar: „choose …") per Kartengalerie über die eindeutigen Spells der Stufe ≤ 4
//     im Deck; die Karte geht über `actionAddCardFromDeckToHand` (Such-Fenster: der Gegner sieht und bestätigt die Suche, Control Monitors/Atta/Krates greifen), ohne Mischen
//     (der Text verlangt keines). „Permanently revealed" = `revealHandCopy` (`_permanentlyRevealedHandIndices`, wie Bamboo Shield/Looming Threat): der Gegner sieht die Karte
//     samt gesenkter Stufe, solange sie auf DER Hand liegt.
//  ② IDENTITÄT STATT NAME: die gesuchte Handkopie trägt die Instanz-ID DIESER Statue im Handindex-Feld `_handStatueLink` (`_engine._registerBuiltinHandIndexedFields`; folgt der
//     physischen Kopie durch Hand-Splices und Umsortieren, fällt mit ihr aus der Hand). Mehrere Statuen = je Statue ihre eigene Kopie; eine gleichnamige andere Kopie wird
//     nie gesenkt und bekommt nie die Zusatzaktions-Marke. Verlässt die Kopie die Hand (gespielt, abgeworfen, gelöscht, zurückgemischt), tut die Statue nichts mehr — auch wenn
//     später wieder eine Kopie auf die Hand kommt.
//  ③ Zugende (`onTurnEnd`): die Statue liest die VERKNÜPFUNG, nicht ihren Kontrolleur (Al, W82-Antwort 3): sie senkt am Ende JEDES Zuges des Spielers, in dessen Hand die verknüpfte
//     Kopie liegt (= der Suchende, „each of YOUR turns" bleibt der Spieler, dem der Spell gehört) — auch wenn die Statue gestohlen/übernommen wurde und noch auf dem Brett steht.
//     Sie senkt nur, solange sie aufgedeckt auf dem Brett liegt und nicht ruht (Frost/Betäubung/Negation: `isCardEffectActive`). Senkung = Handrabatt `_handLevelOffsetsTransient`
//     (wie Looming Threat: summiert sich mit anderen Senkungen derselben Kopie, wirkt nur in der Hand, nie unter 0). Ein Spell, der schon Stufe 0 hat (gedruckt oder durch andere
//     Effekte), wird nicht weiter gesenkt. Verlässt die Statue das Brett, bleibt der gesenkte Stand der Kopie, es wird nur nicht mehr weiter gesenkt.
//  ④ „you may use it as an additional Action" (Al, W82-Antwort 1 + 5): KEIN Angebot und KEINE Zusatzaktions-Abfrage — die Statue gibt der Kopie nur den vorhandenen Status
//     „inherent additional Action": erreicht ihr Zugende-Schritt die Stufe 0 (der LETZTE Schritt 1 → 0 kommt von der Statue; Stufe 0 durch einen anderen Effekt allein genügt nicht,
//     auch eine vorher beschleunigt gesenkte Kopie zählt, wenn der letzte Schritt von der Statue kam), setzt sie die Marke `_handZusatzaktion[idx] = { source, instId }`
//     (Handindex-Feld, `_engine`). `engine.cardHasInherentAction` (die EINE Stelle der Aktionsprüfung: `validateActionPlay`, `doPlaySpell`, Spielbarkeitslisten, Aktionsverbrauch)
//     fragt `handKopieZusatzaktion` → dieses Skript (`handCopyAdditionalAction`): die Marke GILT, solange die Statue auf dem Brett liegt und wirkt (nicht frozen/stunned/negiert),
//     die Kopie noch an ihr hängt und ihre Stufe 0 ist; fällt eine Bedingung weg, ist der Spell wieder ein normaler Spell (Stufe bleibt 0, kostet aber eine Aktion). Nur Spells,
//     nie Reaction/Surprise (`handKopieZusatzaktion`). Die Marke gehört der Kopie, nicht dem Namen. Die übrigen Spielbarkeitsregeln (Held/Schule/Ressourcen) gelten normal;
//     der Spell wird wie jeder andere gespielt (Klick/Ziehen) und verbraucht keine Aktion. Der Handkarten-Tooltip erklärt es („Counts as an additional Action").
//  ⑤ Animation `statue_magic` (Pixelart, `public/app-board.jsx`, `ppSalve`): `play_zone_animation` (zoneType 'board') mit Ursprung = Zone der Statue (Augen glühen) und Ziel = die
//     aufgedeckte Handkarte (`targets[0].handIdx`): ein Magiefaden aus gedithertem Licht, Siegelringe, Partikel auf der Ellipse und die Stufenzahl, die auf einer Platte „herunterklickt"
//     (alte Zahl bricht in Splitter, neue fällt ein). `mode`: 'reveal' (Aufdecken, 1,5 s), 'tick' (Senkung, 1,5 s), 'free' (Stufe 0 erreicht: Aufleuchten, Ringe, Funkenregen, 2,1 s).
//     Beide Seiten sehen sie (die Karte ist aufgedeckt). Der Spielfluss wartet nur 1,0 s (tick/reveal) bzw. 1,5 s (free).
//  ⑥ Puzzle-Editor: Die Statue trägt Zustand (welche Handkarte). Im Statistik-Fenster der Statue (`app-puzzle.jsx`, Feld „Hand slot", 1-basiert) wird der Handplatz der gesuchten
//     Karte eingestellt (`statueHandSlot` in `_creatureStatuses`); `createPuzzleGame` (`server.js`, `pzStatue`) knüpft die Handkopie dort an die Statue (`_handStatueLink`), deckt
//     sie dauerhaft auf und setzt die Zusatzaktions-Marke, wenn der Editor der Karte die Startstufe 0 gibt (Linksklick, `handLv` → `counters.levelSet`; = „durch die Statue auf 0").
//  ⑦ CPU: Die Spell-Wahl läuft über den Standardweg der Galerie-Wahl der CPU (`pickBestGalleryCard`: Handwert + gelernter Quelle→Karte-Wert `setOfferValue` [Titel = Kartenname] +
//     Merkmalswert `poolFeatureValue`; die MCTS-Äste werden mit denselben Werten geordnet). Dazu steuert `cpuMeta.galleryValue` den Statuen-spezifischen Zuschlag bei (Erreichbarkeit
//     für die eigenen Helden, früher Stufe 0, Stufe-0-Spells sinnlos) — die Funktion ist klar austauschbar.
// ═══════════════════════════════════════════

const CARD_NAME = 'Ancient Guardian Statue';
const MAX_STUFE = 4;
const ANIM = 'statue_magic';

/** Eindeutige Spell-Namen der Stufe ≤ 4 im Hauptdeck (engere Lesart von „Spell": cardType „Spell", alle Untertypen). */
function kandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  for (const name of (ps?.mainDeck || [])) {
    if (gesehen.has(name)) continue;
    const cd = db[name];
    if (!cd || cd.cardType !== 'Spell' || (cd.level || 0) > MAX_STUFE) continue;
    gesehen.add(name);
    out.push({ name, source: 'deck' });
  }
  return out;
}

/** Handindex der Kopie, die an der Statue `statueId` hängt (oder -1). */
function verknuepfteKopie(ps, statueId) {
  const map = ps?._handStatueLink;
  if (!map) return -1;
  for (const k of Object.keys(map)) {
    if (map[k] !== statueId) continue;
    const idx = Number(k);
    if ((ps.hand || [])[idx]) return idx;
  }
  return -1;
}

/** Stufe dieser Handkopie in der Hand (gedruckt bzw. gesetzt, plus Handrabatte), nie unter 0 — dieselbe Rechnung wie die Gegneransicht (`revealedMitStufe`). */
function handStufe(engine, pi, name, idx) {
  const ps = engine.gs.players[pi];
  const cd = engine._getCardDB()[name];
  if (!cd) return 0;
  const gesetzt = engine._handLevelSetFor?.(pi, name, idx);
  const basis = typeof gesetzt === 'number' ? gesetzt : (cd.level || 0);
  const abzug = Math.min(0, ((ps._handLevelOffsets || {})[idx] || 0) + ((ps._handLevelOffsetsTransient || {})[idx] || 0));
  return Math.max(0, basis + abzug);
}

/**
 * Die Animation `statue_magic` (Zonen-Animation über dem Brett): ein Magiefaden von der Zone der Statue zur aufgedeckten Handkarte (`targets[0]` = Handplatz `handIdx`), Siegel, Partikel und die
 * Stufenzahl, die „herunterklickt" (`runde` = angezeigte Stufe + 1; `ppSalve` macht aus 0 eine 1). `mode`: 'reveal' | 'tick' | 'free'. Beide Seiten sehen sie (die Karte ist aufgedeckt).
 */
function animiere(engine, pi, idx, name, mode, stufe, statue, duration) {
  engine._broadcastEvent('play_zone_animation', {
    type: ANIM, zoneType: 'board', owner: statue.owner, mode, runde: stufe + 1, duration,
    originOwner: statue.owner, originHeroIdx: statue.heroIdx, originZoneSlot: statue.zoneSlot, originFallback: true,
    targets: [
      { owner: pi, hand: true, handIdx: idx, cardName: name },
      { owner: statue.owner, heroIdx: statue.heroIdx, zoneSlot: statue.zoneSlot },
    ],
  });
}


/** Stufe der Spells im Deck-Angebot für die CPU: wie früh kann ein eigener Held sie wirken (Zugenden bis zur Spielbarkeit)? Unerreichbar = Infinity. */
function zugendenBisSpielbar(engine, pi, cd) {
  const ps = engine.gs.players[pi];
  let k = Infinity;
  (ps?.heroes || []).forEach((h, hi) => {
    if (!h?.name || h.hp <= 0) return;
    for (let senk = 0; senk <= (cd.level || 0) && senk < k; senk++) {
      let ok = false;
      try { ok = engine.heroMeetsLevelReq(pi, hi, { ...cd, level: Math.max(0, (cd.level || 0) - senk) }); } catch { ok = false; }
      if (ok) { k = senk; break; }
    }
  });
  return k;
}

module.exports = {
  activeIn: ['support'],

  /**
   * CPU-Zuschlag für die Spell-Wahl der Galerie (`_cpu.pickBestGalleryCard` addiert ihn zum Handwert und zu den gelernten Werten — `setOfferValue`/`poolFeatureValue` unter dem
   * Titel „Ancient Guardian Statue"). Austauschbar: nur diese Funktion kennt die Statuen-Lage. Ein Spell, den kein eigener Held erreicht, liegt weit hinten; je früher spielbar und je
   * früher Stufe 0 (= Zusatzaktion), desto besser; ein Spell der Stufe 0 gewinnt nichts durch die Statue.
   */
  cpuMeta: {
    galleryValue(engine, pi, eintrag) {
      const cd = engine._getCardDB()[eintrag?.name];
      if (!cd) return 0;
      const stufe = cd.level || 0;
      if (stufe <= 0) return -25;
      const k = zugendenBisSpielbar(engine, pi, cd);
      if (k === Infinity) return -40;
      return 8 - 3 * stufe - 5 * k;
    },
  },

  /**
   * Engine-Vertrag der Zusatzaktions-Marke (`engine.handKopieZusatzaktion`): gilt die Marke der Handkopie `idx` JETZT? Statue lebt (auf dem Brett, aufgedeckt), wirkt (nicht
   * frozen/stunned/negiert — auch eine gestohlene Statue zählt), die Kopie hängt noch an ihr und ihre Stufe in der Hand ist 0.
   */
  handCopyAdditionalAction(engine, pi, idx, marke) {
    const inst = engine.cardInstances.find(c => c.id === marke?.instId);
    if (!inst || inst.zone !== 'support' || inst.faceDown || !engine.isCardEffectActive(inst)) return false;
    const ps = engine.gs.players[pi];
    const name = ps?.hand?.[idx];
    if (!name || (ps._handStatueLink || {})[idx] !== inst.id) return false;
    return handStufe(engine, pi, name, idx) === 0;
  },

  hooks: {
    // ① Beschwörung: Spell der Stufe ≤ 4 aus dem Deck suchen, auf die Hand, dauerhaft aufgedeckt, an diese Statue knüpfen.
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      const inst = ctx.card;
      if (!ps || !inst) return;
      const fizzle = () => engine.summonEffektFizzelt(inst, ctx.cardName, { stumm: true });   // W11/R4: wirkt nicht → Blob stumm

      // Suche unter Hand-/Such-Sperre oder Deck-Ausgangssperre: kein Angebot (Such-Template, Bauform ④).
      if (ps.handLocked || engine._isSearchBlocked(pi, {}, 'deck') || !engine.pileOutAllowed(pi, 'deck', {})) {
        engine.log('search_offer_skipped', { player: ps.username, card: CARD_NAME });
        return fizzle();
      }
      const auswahl = kandidaten(engine, pi);
      if (auswahl.length === 0) return fizzle();

      const picked = await ctx.promptCardGallery(auswahl, {
        searchToHand: true, searchPile: 'deck',   // Such-Template: die Abfrage ist als Hand-Suche gekennzeichnet
        title: CARD_NAME,
        description: `Choose a level ${MAX_STUFE} or lower Spell from your deck. It is added to your hand and permanently revealed; its level is reduced by 1 at the end of each of your turns while this Creature stays on the board.`,
        cancellable: false,
      });
      const name = picked?.cardName;
      if (!name || !auswahl.some(e => e.name === name) || !(ps.mainDeck || []).includes(name)) return fizzle();

      const ok = await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME, reveal: true });
      if (ok !== true) return;   // gesperrt/umgeleitet (Krates): die Karte ist nicht auf unserer Hand — nichts zu knüpfen

      // Die eben hinzugefügte Kopie: die letzte noch unverknüpfte gleichen Namens (sie wurde ans Ende der Hand gelegt).
      let idx = -1;
      for (let i = ps.hand.length - 1; i >= 0; i--) {
        if (ps.hand[i] === name && !(ps._handStatueLink && ps._handStatueLink[i])) { idx = i; break; }
      }
      if (idx < 0) return;   // die Kopie hat die Hand schon wieder verlassen (Reaktion auf das Hinzufügen)

      if (!ps._handStatueLink) ps._handStatueLink = {};
      ps._handStatueLink[idx] = inst.id;
      engine.revealHandCopy(pi, name, idx);                                             // dauerhaft aufgedeckt, solange sie auf der Hand liegt
      const oi = engine.opponentOf(pi);
      if (typeof engine.noteKnownCard === 'function') engine.noteKnownCard(oi, name, 'hand');   // Gedächtnis der CPU
      engine.log('ancient_guardian_statue', { player: ps.username, card: name, text: `searched ${name} (permanently revealed)` });
      engine.sync();
      animiere(engine, pi, idx, name, 'reveal', handStufe(engine, pi, name, idx), inst, 1500);
      await engine._delay(1000);
    },

    // ③ Zugende des Spielers, dem die verknüpfte Kopie gehört (nicht des Kontrolleurs der Statue): Stufe −1; Schritt 1 → 0 setzt die Zusatzaktions-Marke (④).
    onTurnEnd: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      if (!engine.isCardEffectActive(inst)) return;
      const pi = ctx.activePlayer;                          // der Spieler, dessen Zug endet
      const ps = engine.gs.players[pi];
      if (!ps) return;
      const idx = verknuepfteKopie(ps, inst.id);
      if (idx < 0) return;                                  // keine verknüpfte Kopie in der Hand dieses Spielers (oder sie ist weg): der Effekt tut nichts
      const name = ps.hand[idx];
      const cd = engine._getCardDB()[name];
      if (!cd || cd.cardType !== 'Spell') return;
      const vorher = handStufe(engine, pi, name, idx);
      if (vorher <= 0) return;                              // schon Stufe 0 (durch anderes): nichts zu senken, keine Marke

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      if (!ps._handLevelOffsetsTransient) ps._handLevelOffsetsTransient = {};
      ps._handLevelOffsetsTransient[idx] = (ps._handLevelOffsetsTransient[idx] || 0) - 1;
      const nachher = handStufe(engine, pi, name, idx);
      if (ps._handZusatzaktion) delete ps._handZusatzaktion[idx];   // eine alte Marke endet, sobald die Stufe wieder über 0 lag
      if (nachher === 0) {                                  // der LETZTE Schritt auf 0 kam von der Statue → die Kopie zählt als zusätzliche Aktion
        if (!ps._handZusatzaktion) ps._handZusatzaktion = {};
        ps._handZusatzaktion[idx] = { source: CARD_NAME, instId: inst.id };
      }
      engine.log('ancient_guardian_statue', { player: ps.username, card: name, text: `level reduced to ${nachher}` });
      engine.sync();
      animiere(engine, pi, idx, name, nachher === 0 ? 'free' : 'tick', vorher, inst, nachher === 0 ? 2100 : 1500);   // ≤ 1,6 s für die Senkung, ≤ 2,2 s bei Stufe 0
      await engine._delay(nachher === 0 ? 1500 : 1000);   // der Spielfluss wartet nur auf den Einschlag, der Rest läuft über dem Brett aus
    },
  },
};
