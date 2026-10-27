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
//     nie gesenkt und nie als Zusatzaktion angeboten. Verlässt die Kopie die Hand (gespielt, abgeworfen, gelöscht, zurückgemischt), tut die Statue nichts mehr — auch wenn
//     später wieder eine Kopie auf die Hand kommt.
//  ③ Zugende (`onTurnEnd`, nur im Zug des KONTROLLEURS, nur solange die Statue aufgedeckt auf dem Brett liegt und nicht ruht — Frost/Betäubung/Negation filtert `runHooks`,
//     zusätzlich `isCardEffectActive`): die Stufe der verknüpften Kopie sinkt um 1 (Handrabatt `_handLevelOffsetsTransient`, wie Looming Threat: summiert sich mit anderen
//     Senkungen derselben Kopie, wirkt nur in der Hand, nie unter 0). Ein Spell, der schon Stufe 0 hat (gedruckt oder durch andere Effekte), wird nicht weiter gesenkt:
//     „reduced to 0 BY THIS EFFECT" gilt nur für den Schritt 1 → 0. Verlässt die Statue das Brett, bleibt der gesenkte Stand der Kopie, es wird nur nicht mehr weiter gesenkt.
//  ④ „you may use it as an additional Action" — AUSLEGUNG: ein einmaliges Angebot im Moment, in dem DIESER Effekt die Stufe auf 0 bringt (engere Lesart; die weitere —
//     „solange die Kopie auf Stufe 0 liegt, kostet sie keine Aktion" — ist NICHT umgesetzt, Rückfrage an Al). Das Angebot ist die Standard-Zusatzaktion mit einem beliebigen
//     Helden (`performImmediateActionAnyHero`, abbrechbar = „may"; Helden/Ressourcen/Sperren prüft die Engine) und beschränkt sich auf GENAU diese Handkopie
//     (`eligibleHandIndices`: der Client graut gleichnamige andere Kopien aus, der Server lehnt sie ab). Kann kein Held die Kopie wirken, gibt es keine Frage. Nicht gespielt
//     = das Angebot verfällt; die Kopie bleibt auf Stufe 0 in der Hand.
//  ⑤ Animation `statue_magic` (Pixelart, `public/app-board.jsx`): Magie-Partikel auf der Handkarte (`play_hand_card_animation`, beide Seiten sehen die aufgedeckte
//     Karte) — Phase 'reveal' beim Aufdecken, 'tick' beim Senken, 'free' bei Stufe 0.
//  ⑥ Puzzle-Editor: Die Statue trägt Zustand (welche Handkarte). Im Statistik-Fenster der Statue (`app-puzzle.jsx`, Feld „Hand slot", 1-basiert) wird der Handplatz der gesuchten
//     Karte eingestellt (`statueHandSlot` in `_creatureStatuses`); `createPuzzleGame` (`server.js`, `pzStatue`) knüpft die Handkopie dort an die Statue (`_handStatueLink`) und deckt
//     sie dauerhaft auf. Die Stufe der Kopie stellt der Editor wie bei jeder Handkarte ein (Linksklick, `handLv` → `counters.levelSet`) — die Zugende-Senkung rechnet darauf weiter.
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

/** Ein Hand-Animationsereignis auf der Karte (`phase`: 'reveal' | 'tick' | 'free'). */
function animiere(engine, pi, idx, name, phase, duration) {
  engine._broadcastEvent('play_hand_card_animation', { owner: pi, handIdx: idx, cardName: name, animType: ANIM, phase, count: 1, duration });
}

/** Kann irgendein Held diese eine Handkopie jetzt als Zusatzaktion wirken? (Gleiche Prüfungen wie das Angebot selbst.) */
function kannWirken(engine, pi, name, idx) {
  const cd = engine._getCardDB()[name];
  if (!cd) return false;
  if (engine.additionalActionsLocked(pi) || engine.missionLockActive(pi)) return false;
  return engine._zusatzaktionsHelden(pi).some(({ seite, heroIdx }) =>
    heldKannHandeln(engine, seite, heroIdx)
    && engine.getHeroEligibleActionCards(pi, heroIdx, seite !== pi ? seite : null).includes(name)
    && engine._kopieStufeOk(pi, heroIdx, cd, idx, seite));
}

/** Ein gefrorener/betäubter/verwebter Held (oder einer, dem eine Karte/ein Heldenskript Aktionen verbietet) kann keine Zusatzaktion ausführen (Ruling Q137). */
function heldKannHandeln(engine, seite, heroIdx) {
  return engine.canHeroPerformAction(seite, heroIdx);
}

module.exports = {
  activeIn: ['support'],

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
      animiere(engine, pi, idx, name, 'reveal', 1300);
      await engine._delay(1000);
    },

    // ③ Zugende des Kontrolleurs: Stufe der verknüpften Kopie −1; bei Stufe 0 (durch DIESEN Effekt) das Angebot ④.
    onTurnEnd: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      if (!engine.isCardEffectActive(inst)) return;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      const idx = verknuepfteKopie(ps, inst.id);
      if (idx < 0) return;                                  // die Kopie ist nicht mehr auf der Hand: der Effekt tut nichts mehr
      const name = ps.hand[idx];
      const cd = engine._getCardDB()[name];
      if (!cd || cd.cardType !== 'Spell') return;
      const vorher = handStufe(engine, pi, name, idx);
      if (vorher <= 0) return;                              // schon Stufe 0: nichts zu senken, „reduced to 0 by this effect" kann nicht eintreten

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      if (!ps._handLevelOffsetsTransient) ps._handLevelOffsetsTransient = {};
      ps._handLevelOffsetsTransient[idx] = (ps._handLevelOffsetsTransient[idx] || 0) - 1;
      const nachher = handStufe(engine, pi, name, idx);
      engine.log('ancient_guardian_statue', { player: ps.username, card: name, text: `level reduced to ${nachher}` });
      engine.sync();
      animiere(engine, pi, idx, name, nachher === 0 ? 'free' : 'tick', nachher === 0 ? 1500 : 850);
      await engine._delay(nachher === 0 ? 1200 : 700);
      if (nachher !== 0) return;

      // ④ Stufe 0 durch diesen Effekt: „you may use it as an additional Action" — nur diese Kopie, nur wenn ein Held sie wirken kann.
      const jetzt = verknuepfteKopie(ps, inst.id);          // während der Animation kann sich die Hand bewegt haben: die Kopie neu über ihre Verknüpfung finden
      if (jetzt < 0 || ps.hand[jetzt] !== name || !kannWirken(engine, pi, name, jetzt)) return;
      await engine.performImmediateActionAnyHero(pi, {
        title: CARD_NAME,
        description: `"${name}" is now level 0 — you may use it as an additional Action with any Hero (or skip).`,
        cardNameFilter: (n) => n === name,
        heldenFilter: (seite, heroIdx) => heldKannHandeln(engine, seite, heroIdx),   // frostige/betäubte Helden bieten die Zusatzaktion nicht an
        eligibleHandIndices: [jetzt],
        cancellable: true,
      });
      engine.sync();
    },
  },

  /**
   * CPU: Spell-Wahl — der Spell der Stufe ≤ 4, den ein eigener Held am frühesten (und am stärksten) wirken kann: Punktzahl = Stufe × 10 − 12 × (Zugenden bis zur Spielbarkeit);
   * unspielbar (kein Held erreicht ihn auch bei Stufe 0) liegt weit hinten. Ohne Treffer greift die Standardwahl der CPU.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME || promptData?.type !== 'cardGallery') return undefined;
    const pi = engine._cpuPlayerIdx;
    const ps = engine.gs.players[pi];
    const db = engine._getCardDB();
    if (!ps || !Array.isArray(promptData.cards) || promptData.cards.length === 0) return undefined;
    let best = null, bestScore = -Infinity;
    for (const e of promptData.cards) {
      const cd = db[e.name];
      if (!cd) continue;
      let k = Infinity;
      (ps.heroes || []).forEach((h, hi) => {
        if (!h?.name || h.hp <= 0) return;
        for (let senk = 0; senk <= (cd.level || 0) && senk < k; senk++) {
          let ok = false;
          try { ok = engine.heroMeetsLevelReq(pi, hi, { ...cd, level: Math.max(0, (cd.level || 0) - senk) }); } catch { ok = false; }
          if (ok) { k = senk; break; }
        }
      });
      const score = k === Infinity ? -500 + (cd.level || 0) : (cd.level || 0) * 10 - k * 12;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best ? { cardName: best.name, source: best.source || 'deck' } : undefined;
  },
};
