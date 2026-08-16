// ═══════════════════════════════════════════
//  PIXEL PARTIES — TRAINING DATA RECORDER
//  Attached to a self-play engine to capture WHAT the pinned deck did
//  during one game, in a form a downstream learner (scripts/
//  train-deck-profile.js) can regress against the game outcome.
//
//  Captured per game (pinned side only):
//    • plays[cardName][bucket]      — Spell/Attack casts, Creature +
//                                     Artifact board entries, Potion uses,
//                                     bucketed early/mid/late by gs.turn.
//    • pairs["A|B"]                 — unordered same-turn co-plays of two
//                                     DIFFERENT card names. This is the
//                                     combo signal.
//    • abilities["Ability@Hero"]    — final stack level per (ability, hero)
//                                     at game end. This is the placement
//                                     signal ("where to attach").
//    • wentFirst, turns, outcome    — covariates + label.
//
//  The recorder wraps engine.runHooks the same way installCpuBrain does
//  (observe, never interfere) — a throw inside the observer must never
//  break the hook chain.
// ═══════════════════════════════════════════

'use strict';

// gs.turn is the GLOBAL turn counter (increments once per player turn,
// ~10 total in an average match). Buckets chosen so an average game
// touches all three.
/**
 * Unter welchem Namen werden Ability-Platzierungen dieses Helden
 * verbucht? Ohne Vertrag: der Kartenname. Mit
 * `cpuMeta.abilityIdentity`: der gemeinsame Schluessel aller Formen —
 * Abilities haengen am Heldenslot und ueberleben Auf-/Abstieg, es gibt
 * also nur EINEN Empfaenger, egal wie er gerade heisst.
 */
function abilityIdentityOf(engine, heroName) {
  try {
    const { loadCardEffect } = require('./_loader');
    const id = loadCardEffect(heroName)?.cpuMeta?.abilityIdentity;
    return (typeof id === 'string' && id) ? id : heroName;
  } catch { return heroName; }
}

function turnBucket(turn) {
  if (turn <= 4) return 'early';
  if (turn <= 9) return 'mid';
  return 'late';
}

/**
 * Attach a recorder to an engine. Call BEFORE engine.startGame().
 * Returns a collector object; call collector.finish(winnerIdx) once the
 * game is over to obtain the JSON-serialisable game record.
 */
function attachTrainingRecorder(engine, { pinnedIdx, pinnedName, opponentName, firstPlayer, allowedNames = null }) {
  const plays = Object.create(null);   // name -> { early, mid, late }
  const pairs = Object.create(null);   // "A|B" (sorted) -> count
  const revives = Object.create(null); // "Card→Hero" -> count | "Card→ability:X" -> max level
  // Kontext-Haupteffekt fürs Revive-Lernen: "Held X wurde in diesem
  // Spiel besiegt" — EREIGNISbasiert (onHeroKO), nicht Endstand-HP:
  // Ein erfolgreich wiederbelebter Held wäre am Ende lebendig und der
  // Kontext würde genau in Revive-Spielen fehlen. Ohne diesen
  // Regressor lud der (stark negative) Held-stirbt-Effekt komplett
  // auf die rev:-Interaktionsterme — die Revive-Regeln lernten
  // "Wiederbeleben = Niederlage" statt "Helden-Tod = Niederlage".
  const deadHeroes = Object.create(null); // heroName -> KO-Count
  const equips = Object.create(null);  // "Equip@Hero" -> count (Platzierungs-Lernen wie abilities)
  const locks = Object.create(null);   // "Card|lockTyp@heldBucket" -> count (Lock-Ordering-Lernen)
  // Lock-Flag-Baseline des gepinnten Spielers. Wird nach JEDEM live
  // beobachteten Hook aktualisiert — Fremd-Locks (Hammer Throw sperrt
  // den GEGNER) und Zugbeginn-Resets wandern so in die Baseline und
  // werden nie einem eigenen Play zugeschrieben.
  let prevLocks = { item: false, potion: false, creature: false, spell: false, skill: false };
  const readLocks = () => {
    const ps0 = engine.gs?.players?.[pinnedIdx] || {};
    const turn = engine.gs?.turn;
    // Zwei Lock-Mechanismen der Engine: persistente Flags (itemLocked …)
    // und selbst-ablaufende Zug-Stempel (_artifactLockTurn = gs.turn,
    // Boomerangs Mechanik — kein Flag-Feld!). handLocked ist bewusst
    // NICHT dabei: transiente Resolutionssperre, kein strategischer
    // Lock (erzeugte Fehleinträge für jede Karte, live beobachtet).
    return {
      item: !!ps0.itemLocked || ps0._artifactLockTurn === turn,
      potion: !!ps0.potionLocked,
      creature: !!ps0.creatureLocked,
      spell: ps0._spellLockTurn === turn,
      skill: ps0._skillLockTurn === turn,
    };
  };
  const LOCK_TYPE_TO_CARDTYPE = { item: 'Artifact', potion: 'Potion', creature: 'Creature', spell: 'Spell', skill: 'Ability' };
  // Nach einem aufgezeichneten Play prüfen, ob ES einen Lock gesetzt hat
  // (Flag jetzt an, in der Baseline aus). Kontext = wie viele Karten des
  // gesperrten Typs noch in der Hand liegen — GENAU die Information, die
  // "Boomerang mit 3+ Artefakten gespielt = Ordering-Fehler" von
  // "Boomerang als letztes Artefakt = korrekt" trennt.
  const recordLockContext = (name) => {
    const cur = readLocks();
    for (const [k, cardType] of Object.entries(LOCK_TYPE_TO_CARDTYPE)) {
      if (!cur[k] || prevLocks[k]) continue;
      const hand = engine.gs?.players?.[pinnedIdx]?.hand || [];
      const db = engine._getCardDB();
      let held = 0;
      for (const n of hand) {
        if (n === name) continue; // die Lock-Karte selbst zählt nicht
        if (cardType === '*' || db[n]?.cardType === cardType) held++;
      }
      const bucket = held >= 3 ? '3+' : String(held);
      const key = `${name}|${k}@${bucket}`;
      locks[key] = (locks[key] || 0) + 1;
    }
    prevLocks = cur;
  };
  let curTurn = -1;
  let curTurnNames = new Set();        // distinct names played THIS turn by pinned side

  // ── Advantage-Label-Grundlagen (ML-Upgrade) ──
  // playEvents: chronologische Play-Liste {n: name, t: turn} — erlaubt
  //   dem Trainer Per-Play-Beispiele statt Spiel-Aggregaten.
  // evalCurve: evaluateState(pinnedIdx) an jeder Zuggrenze — Zustand
  //   unmittelbar NACH Abschluss von Zug T landet in evalCurve[T]
  //   (inkl. dessen End-of-Turn-Effekten). Damit lässt sich ein Play
  //   bei Zug T als Delta evalCurve[T+2] − evalCurve[T−1] bewerten:
  //   kurzfristige Wirkung inkl. der Gegner-Antwort, und weil
  //   evaluateState Handgröße/eigene HP/Board einpreist, sind Recoil-
  //   und Handverbrennungs-Kosten automatisch im Label enthalten.
  const playEvents = [];
  const evalCurve = Object.create(null);
  // Gegner-Verhaltens-Fingerprint bis Zug 8 (für das Cluster-Feature):
  // atk = Attack-Casts, cre = Kreaturen-Summons, spl = Spell-Casts.
  // Bewusst NUR Verhalten, keine Identität.
  // ── Aktiveffekt-Tracking ──
  // Zählt echte Aktivierungen (Kreaturen-/Area-/Equip-Effekte) der
  // pinned Seite über den zentralen Log-Trichter (engine.log erhält
  // creature/area/equip_effect_activated aus UI- UND CPU-Pfaden).
  // Grundlage für den "nie aktiviert"-Report: Karten, die zwar gespielt
  // werden, deren Aktiveffekt aber nie feuert (Slippery-Ice-Klasse).
  const activations = Object.create(null);
  // ── T5: HANDKARTENFLUSS (31.7.) ───────────────────────────────────
  // Kumulative Zähler über das ganze Spiel, bei jedem eigenen Zugbeginn
  // in turnDiag.hf gespiegelt. Der Konsument DIFFERENZIERT zwei
  // aufeinanderfolgende Einträge und bekommt damit den Zufluss einer
  // vollen Runde (eigener Zug + Gegnerzug — Karten kommen auch dort
  // rein, z.B. Pure Advantage Camels Draw).
  //
  // ANLASS: nach v117 haben 74.6% der Züge ohne Kreatur-Eintritt gar
  // kein Material mehr auf der Hand (vorher 49.7%). Die Handgröße fällt
  // bis Zug 4 auf 1.38. Ob das ein ZUFLUSS-Problem (zu wenig gezogen)
  // oder ein ABFLUSS-Problem (Kosten fressen die Hand) ist, war mit den
  // vorhandenen Feldern nicht entscheidbar.
  //
  // ABSICHTLICH GETRENNTE ZÄHLER statt einer Summe: mehrere Suchpfade
  // loggen möglicherweise BEIDES (deck_search UND card_added_to_hand)
  // für dieselbe Karte. Getrennt gehalten lässt sich eine solche
  // Doppelzählung in der Auswertung gegen die tatsächliche
  // Handgrößen-Differenz erkennen, statt sie unsichtbar einzubacken.
  //   dw = draw + potion_draw   (beide landen in ps.hand, verifiziert)
  //   se = deck_search
  //   ah = card_added_to_hand + card_added_from_discard_to_hand
  //   st = hand_steal + hand_transfer
  //   di = discard              (beide Log-Stellen sind Hand→Discard)
  // Der ABFLUSS durch Plays steht bereits in playEvents, der Rest ergibt
  // sich als Residuum aus hn + Zufluss − Plays − di.
  const handFlow = { dw: 0, se: 0, ah: 0, st: 0, di: 0 };
  const HANDFLOW_EVENTS = {
    draw: 'dw', potion_draw: 'dw',
    deck_search: 'se',
    card_added_to_hand: 'ah', card_added_from_discard_to_hand: 'ah',
    hand_steal: 'st', hand_transfer: 'st',
    discard: 'di',
  };
  const menus = [];
  {
    // ── Hand-Reaktions-Plays (Als Idol-of-Crestina-Befund) ───────────
    // Die 8 Hand-Reaktionsfenster der Engine (_checkResourcePhaseReactions,
    // _check[Opp][Creature]PreDamageHandReactions, _checkAfter*Damage*,
    // _checkPostTargetHandReactions) aktivieren Karten AUS DER HAND per
    // direktem `hand.splice` + Push in discard/deleted — der CARD_MOVED-
    // Hook, auf dem die Zonen-Erfassung unten sitzt, feuert dabei NIE.
    // Reaktions-Spells/Attacks fielen trotzdem an (afterSpellResolved),
    // alle anderen Typen waren komplett unsichtbar: Idol of Crestina
    // resolvte in 392/598 Spielen (580 Suchen) und stand mit 0 Plays im
    // Report — kein cardValue, kein Timing, kein Paar, kein Label.
    // Die Fenster markieren ihren Transfer jetzt mit `asPlay: true`
    // (unfreiwillige Hand-Discards/Deletes tragen den Marker NICHT).
    const _econSnapshot = () => {
      try {
        const ps = engine.gs?.players?.[pinnedIdx];
        if (!ps) return null;
        const cardDB = engine._getCardDB();
        const gold = ps.gold || 0;
        let playable = 0, dsCreatures = 0, creatures = 0;
        const schoolLv = (school) => {
          let best = 0;
          for (const zone of (ps.abilityZones || [])) {
            let n = 0;
            for (const a of (zone || [])) {
              const ad = cardDB[a];
              if (a === school || ad?.name === school || (ad?.spellSchool1 === school)) n++;
            }
            if (n > best) best = n;
          }
          return best;
        };
        for (const cardName of (ps.hand || [])) {
          const cd = cardDB[cardName];
          if (!cd) continue;
          if (String(cd.cardType || '').includes('Creature')) {
            creatures++;
            let sc = null;
            try { sc = require('./_loader').loadCardEffect(cardName); } catch {}
            if (sc && (typeof sc.getBouncePlacementTargets === 'function'
              || typeof sc.canPlaceOnOccupiedSlot === 'function')) dsCreatures++;
          }
          switch (cd.cardType) {
            case 'Ability': case 'Potion': playable++; break;
            case 'Artifact': if ((cd.cost || 0) <= gold) playable++; break;
            default: {
              const lvl = cd.level || 0;
              const s1 = cd.spellSchool1 ? schoolLv(cd.spellSchool1) : 0;
              const s2 = cd.spellSchool2 ? schoolLv(cd.spellSchool2) : 0;
              if (lvl <= Math.max(s1, s1 + s2)) playable++;
            }
          }
        }
        return { t: engine.gs.turn, g: gold, h: (ps.hand || []).length,
          pl: playable, cr: creatures, ds: dsCreatures };
      } catch { return null; }
    };

    const origBroadcast = typeof engine._broadcastEvent === 'function'
      ? engine._broadcastEvent.bind(engine) : null;
    if (origBroadcast) {
      // ── Bounce-Swap-Historie (Als Auftrag) ──
    // Lauscht auf GENAU das Signal, das auch Siphems Counter füttert
    // (onCardsReturnedToHand, gefeuert von allen vier Return-Pfaden in
    // _deepsea-shared inkl. DDG-Tribut) — damit messen Tracking und
    // Counter-Quelle garantiert dasselbe. Sim-Guard wie bei den anderen
    // Wraps: Rollouts bouncen ständig und würden das Log fluten.
    // ── Pro-Zug-Ökonomie (Als Auftrag): Gold, Handgröße, spielbare
    // Karten, Deepsea-Kreaturen auf der Hand — zu Beginn jedes EIGENEN
    // Zuges. Als Hypothese: dem Deck gehen die Handkarten aus (Draw nur
    // über Teppes' Return-Trigger und Witchs On-Summon), 0.64 Plays/Zug
    // im Fehl-Cluster ≈ Topdeck-Modus. "Spielbar" ist eine bewusste
    // NÄHERUNG (Level vs Schul-Zähler je Held, Artefakt-Kosten vs Gold;
    // ohne Reduktionen/Bypässe/Zonen-Details) — für Trends gedacht,
    // nicht für Einzelzug-Exaktheit.
    const origRunHooks = engine.runHooks.bind(engine);
    engine.runHooks = function (hookName, hookCtx) {
      // ── ALS HAUPTMETRIK: gewichtete On-Summon-Trigger je eigenem Zug ──
      // Als Vorgabe: "Die Anzahl On-Summon-Trigger pro Runde sollte DIE
      // Metrik sein, wobei der Trigger von Dark Deepsea God DEUTLICH
      // wertvoller ist als andere."
      //
      // Gemessen wird am `onPlay`-Dispatch — dort feuert ein On-Summon-
      // Effekt tatsächlich, und zwar pfadunabhängig: normale Beschwörung,
      // Tausch-Wiedereintritt (tryBouncePlace) und Kopier-Retrigger
      // (Monstrosity) laufen alle hier durch. Das ist bewusst NICHT über
      // die Logs `creature_summoned` / `placement` gebaut: Swap-
      // Wiedereintritte emittieren gar kein `creature_summoned`, ein
      // Log-basierter Zähler hätte also genau den Motor übersehen.
      //
      // Gewicht je Karte über den Vertrag `cpuMeta.onSummonTriggerWeight`
      // (Default 1). Kein by-name im Kern — die 5 steht auf DDG selbst
      // und ist dort von Al justierbar.
      //
      // Referenzwerte aus der Erstmessung (30.7.):
      //   Al  4.49 Trigger/eigenem Zug (Median 4), 3.5% Null-Züge
      //   CPU 1.93 (Median 2), 34.4% Null-Züge
      // Zusammenhang zum Sieg im selben Datensatz: <1.5 → ~9% WR,
      // 2.0-3.0 → 42.5%, 3.0+ → 83.3%.
      try {
        if (!engine._inMctsSim && hookName === 'onPlay' && hookCtx) {
          const nm = hookCtx.cardName || hookCtx.card?.name || hookCtx.playedCard?.name;
          const owner = hookCtx.cardOwner
            ?? hookCtx.card?.controller ?? hookCtx.card?.owner
            ?? hookCtx.playedCard?.controller ?? hookCtx.playedCard?.owner;
          if (nm && owner === pinnedIdx) {
            const cd = engine._getCardDB()[nm];
            if (cd && cd.cardType === 'Creature') {
              let w = 1;
              try {
                const { loadCardEffect } = require('./_loader');
                const sc = loadCardEffect(nm);
                const raw = sc?.cpuMeta?.onSummonTriggerWeight;
                if (typeof raw === 'number' && raw > 0) w = raw;
              } catch { /* Default 1 */ }
              if (!engine._onSummonTriggerLog) engine._onSummonTriggerLog = [];
              // Grant-Geber mitschreiben (Kredit-Weitergabe): war dieser
              // Play durch eine Zusatz-Aktion finanziert, und von wem?
              let via = null;
              try {
                const gp = engine._grantProvider;
                if (gp && gp.forCard === nm && gp.owner === pinnedIdx
                  && gp.turn === (engine.gs?.turn || 0)) {
                  via = gp.name || null;
                  engine._grantProvider = null;   // nur einmal gutschreiben
                }
              } catch { /* optional */ }
              engine._onSummonTriggerLog.push({
                t: engine.gs?.turn || 0,
                n: nm,
                w,
                ...(via ? { via } : {}),
                // Wodurch kam der Trigger zustande? Trennt die drei
                // Quellen, damit der Report sagen kann, WO die Lücke
                // sitzt (Al: Swap 1.60/Zug, Normal 1.30, DDG 1.34).
                k: hookCtx._monstrosityCopy ? 'copy'
                  : hookCtx._viaBouncePlace ? 'swap' : 'summon',
              });
            }
          }
        }
      } catch { /* Telemetrie darf nie stören */ }
      try {
        if (!engine._inMctsSim && hookName === 'onCardsReturnedToHand'
            && hookCtx && hookCtx.ownerIdx === pinnedIdx
            && Array.isArray(hookCtx.returnedCards) && hookCtx.returnedCards.length) {
          if (!engine._bounceLog) engine._bounceLog = [];
          engine._bounceLog.push({
            t: engine.gs?.turn || 0,
            c: [...hookCtx.returnedCards],
            by: hookCtx.by || undefined,
          });
        }
      } catch { /* Telemetrie darf nie stören */ }
      return origRunHooks(hookName, hookCtx);
    };

    engine._broadcastEvent = function (type, data) {
        try {
          if (!engine._inMctsSim && type === 'play_pile_transfer'
              && data && data.asPlay && data.owner === pinnedIdx && data.cardName) {
            const cdR = engine._getCardDB()[data.cardName];
            // `asPlay: 'sole'` = einziges Play-Signal dieser Karte (Karten,
            // die sich per Hook selbst aus der Hand spielen, z.B. Divine
            // Gift of the Guardian) → typunabhängig zählen.
            // `asPlay: true` = Engine-Reaktionsfenster → Spell/Attack
            // überspringen, die sind über afterSpellResolved schon gezählt
            // (belegt: Golden Wings 22 Events, Idol of Crestina 0).
            const sole = data.asPlay === 'sole';
            if (sole || !cdR || (cdR.cardType !== 'Spell' && cdR.cardType !== 'Attack')) {
              recordPlay(data.cardName);
            }
          }
        } catch { /* Telemetrie darf das Spiel nie stören */ }
        return origBroadcast(type, data);
      };
    }

    const origLog = engine.log.bind(engine);
    // 'batch_reaction_fired' (Deepsea Idol — feuerte real 92× im
    // CC-Lauf, war aber unsichtbar: namensbasierter Discard-Push ohne
    // ZoneEnter) und 'discard_trigger_fired' (Glass of Marbles /
    // Skull Necklace — Discard-Fodder, deren "Einsatz" der Trigger
    // ist, nicht der Play) zählen als Aktivierungen.
    // Hand-Reaktionsfenster, die ihren Play nur per Log-Ereignis melden.
    const HAND_REACTION_PLAY_EVENTS = new Set([
      'creature_pre_defeat_reaction', 'post_summon_reaction',
      'creature_damage_batch_reaction', 'cd_movement_reaction',
      'opp_action_phase_reaction',
    ]);
    // Als Report "Crimson Web wird nie aktiviert": die Karte feuerte real
    // 233×, tauchte aber in `activations` mit 0 auf — `surprise_activated`
    // fehlte schlicht in dieser Menge, also war JEDE Surprise im Report
    // unsichtbar (gleiche Klasse wie der Deepsea-Idol-Fund, der seinerzeit
    // `batch_reaction_fired` hinzufügte). Mit ergänzt:
    //   • surprise_activated  — zentral in _activateSurprise, deckt alle
    //     fünf Aktivierungspfade ab, kein Overlap mit den anderen Events.
    //   • permanent_activated — gesetzte Permanents (server.js), bisher
    //     ebenfalls nur als Play sichtbar.
    //   • reaction_activated  — NUR mit source:'surprise'; die
    //     gleichnamige Hand-Variante ist ein normaler Cast und steckt
    //     bereits in den Plays (Gate weiter unten).
    // Grant-Lebenszyklus, Station "verfallen": die Engine loggt
    // additional_action_expired im Turn-Rollover (v54). Zusammen mit den
    // CPU-seitigen Zählern (erteilt/gefunden/ausgegeben) ergibt das die
    // vollständige Kette für Als "2+ dank Primordium".
    const GRANT_EXPIRE_EVENT = 'additional_action_expired';
    //   • ability_activated  — Free-Ability-Aktivierungen
    //     (doActivateFreeAbility) UND aktionskostende (doPlayAbility,
    //     trägt zusätzlich actionCost:true). Beide laufen über
    //     _setPendingPlayLog → _firePendingPlayLog → engine.log, tragen
    //     player+card und schließen sich gegenseitig aus, also keine
    //     Doppelzählung. GEFUNDEN 31.7. bei der Mawstruck-Auswertung:
    //     Leadership (5 Kopien, freeActivation, auf Lv3 netto +1 Karte
    //     JEDEN Zug) stand in zwei kompletten Datensätzen bei 0
    //     Aktivierungen — und zwar strukturell, weil dieses Event in
    //     ACT_EVENTS fehlte. Betroffen war JEDE Ability-Aktivierung in
    //     JEDEM Deck. Die Ability-PLATZIERUNG steckt weiterhin in
    //     `plays`, das ist ein anderes Feld — keine Kollision.
    const ACT_EVENTS = new Set(['creature_effect_activated', 'area_effect_activated', 'equip_effect_activated', 'batch_reaction_fired', 'discard_trigger_fired', 'surprise_activated', 'permanent_activated', 'reaction_activated', 'ability_activated']);
    engine.log = function (type, data) {
      if (!engine._inMctsSim && type === 'turn_start'
          && data && data.activePlayer === pinnedIdx) {
        const snap = _econSnapshot();
        if (snap) (engine._turnEconomyLog = engine._turnEconomyLog || []).push(snap);
        // ── T1: DIAGNOSE JE EIGENEM ZUG (31.7.) ────────────────────
        // Zwei Teile: (a) der ZUSTAND zu Zugbeginn — wie viele ALTE
        // (tauschbare) Körper stehen, wie viele Slots sind frei, wie
        // viele Helden leben, wie viele Grants sind offen; (b) die im
        // VORHERIGEN eigenen Zug aufgelaufenen Blocker-Zähler.
        // Erst beides zusammen beantwortet die offene Frage: die
        // Null-Quote steigt von 0% (Zug 1) auf über 70% (ab Zug 11),
        // und in 96% dieser Züge liegen spielbare Kreaturen bereit.
        try {
          const prev = engine._turnDiagLog && engine._turnDiagLog[engine._turnDiagLog.length - 1];
          if (prev && engine._turnBlockers) prev.blk = engine._turnBlockers;
          engine._turnBlockers = {};
          const gs2 = engine.gs, ps2 = gs2?.players?.[pinnedIdx];
          let bo = 0, zf = 0, ha = 0;
          if (ps2) {
            ha = (ps2.heroes || []).filter(h => h && (h.hp || 0) > 0).length;
            const zones = ps2.supportZones || [];
            for (let hi = 0; hi < zones.length; hi++) {
              for (let zi = 0; zi < (zones[hi] || []).length; zi++) {
                const cell = zones[hi][zi];
                if (!cell || !cell.length) { zf++; continue; }
              }
            }
            // Alte (tausch-taugliche) Körper über die Instanzen zählen —
            // `turnPlayed < aktuelle Runde` ist die Regel, an der die
            // gesamte Tausch-Kette hängt.
            for (const inst of (engine.cardInstances || [])) {
              if (inst?.owner !== pinnedIdx) continue;
              if (inst.zone !== 'support' && inst.location !== 'support') continue;
              if ((inst.turnPlayed || 0) < (gs2?.turn || 0)) bo++;
            }
          }
          let go = 0;
          try {
            for (const inst of (engine.cardInstances || [])) {
              if (inst?.owner !== pinnedIdx) continue;
              const aa = inst.counters?.aaGrants;
              if (aa) go += Object.values(aa).reduce((a, b) => a + (Number(b) || 0), 0);
            }
          } catch { /* optional */ }
          (engine._turnDiagLog = engine._turnDiagLog || []).push({
            t: gs2?.turn || 0, bo, zf, ha, go, blk: null,
            // T5: Handgröße + kumulativer Zufluss/Kosten-Abfluss zum
            // Zugbeginn. `hn` ist bewusst redundant zu turnEconomy.h —
            // so ist der Eintrag ohne Join auswertbar. `hf` ist eine
            // KOPIE der laufenden Zähler; die Differenz zweier Einträge
            // ergibt den Fluss einer vollen Runde.
            hn: (ps2?.hand || []).length,
            hf: { ...handFlow },
          });
        } catch { /* Telemetrie darf nie stören */ }
      }
      try {
        // ── Hand-Reaktionen OHNE play_pile_transfer ──────────────────
        // Fünf der 13 Hand-Reaktionsfenster (_checkCreaturePreDefeat-,
        // _checkPostSummon-, _checkCreatureDamageBatch-, _checkCdMovement-,
        // _checkOppActionPhaseHandReactions) broadcasten nur 'card_reveal'
        // statt play_pile_transfer — der asPlay-Marker erreicht sie nicht.
        // Sie loggen aber je ein eigenes Ereignis mit { card, player }.
        // (batch_reaction_fired bewusst NICHT hier: es feuert im selben
        // Fenster VOR dem Splice wie creature_damage_batch_reaction —
        // es bleibt reines Aktivierungs-Signal in ACT_EVENTS.)
        if (!engine._inMctsSim && data && HAND_REACTION_PLAY_EVENTS.has(type)) {
          const pinnedUser = engine.gs?.players?.[pinnedIdx]?.username;
          if (data.card && data.player && pinnedUser && data.player === pinnedUser) {
            const cdH = engine._getCardDB()[data.card];
            // Spell/Attack laufen bereits über afterSpellResolved.
            if (!cdH || (cdH.cardType !== 'Spell' && cdH.cardType !== 'Attack')) {
              recordPlay(data.card);
            }
          }
        }
        // "Place openly"-Potions (Elixir of Immortality & Co):
        // 'potion_placed_open' ist ihr einziger Play-Beleg — als Play zählen.
        if (!engine._inMctsSim && data && type === 'potion_placed_open') {
          const pinnedUser = engine.gs?.players?.[pinnedIdx]?.username;
          if (data.card && data.player && pinnedUser && data.player === pinnedUser) recordPlay(data.card);
        }
        // keepInHand-Gems (Magic Amethyst & Co): 'gem_kept_in_hand' ist
        // ihr einziger Play-Beleg (kein ZoneEnter) — als Play zählen.
        // Menü-Kanal (Als Auftrag, Bloody King Zi): Angebots-Menüs, bei
        // denen der GEGNER die finale Wahl trifft (Zi/Lamp/Crestina),
        // plus Chaos-Magic-Zufallsausgänge. menus[]-Einträge:
        // {s: Quelle, t: Zug, o: [Angebot]|null, c: gecastet/erhalten|null}
        if (!engine._inMctsSim && data && data.player === engine.gs?.players?.[pinnedIdx]?.username) {
          if (type === 'timeless_king_zi_offer') {
            menus.push({ s: 'Timeless King Zi', t: engine.gs?.turn || 0, o: (data.offered || []).slice(), c: data.chosen || null });
          } else if (type === 'magic_lamp_result') {
            menus.push({ s: 'Magic Lamp', t: engine.gs?.turn || 0, o: (data.offered || []).slice(), c: data.oppTook || null });
          } else if (type === 'crestina_creation_pick') {
            menus.push({ s: 'Crestina', t: engine.gs?.turn || 0, o: (data.offered || []).slice(), c: data.addedToHand || null });
          } else if (type === 'chaos_magic_become') {
            menus.push({ s: 'Chaos Magic', t: engine.gs?.turn || 0, o: null, c: data.spell || null });
          } else if (type === 'chaos_magic_fizzle') {
            menus.push({ s: 'Chaos Magic', t: engine.gs?.turn || 0, o: null, c: null });
          }
        }
        if (!engine._inMctsSim && data && type === 'gem_kept_in_hand') {
          const pinnedUser = engine.gs?.players?.[pinnedIdx]?.username;
          if (data.card && data.player && pinnedUser && data.player === pinnedUser) recordPlay(data.card);
        }
        if (!engine._inMctsSim && type === GRANT_EXPIRE_EVENT && data
            && data.player === pinnedUser) {
          engine._grantsExpired = (engine._grantsExpired || 0) + 1;
        }
        // ── T5: HANDKARTENFLUSS ─────────────────────────────────────
        // Reines Mitzählen, keine Verhaltensänderung. Nur die pinned
        // Seite (Log-Events tragen den USERNAME, nicht den Index) und
        // nie aus MCTS-Rollouts.
        if (!engine._inMctsSim && data && HANDFLOW_EVENTS[type]) {
          const pinnedUser2 = engine.gs?.players?.[pinnedIdx]?.username;
          if (data.player && pinnedUser2 && data.player === pinnedUser2) {
            handFlow[HANDFLOW_EVENTS[type]]++;
          }
        }
        if (!engine._inMctsSim && data && ACT_EVENTS.has(type)) {
          // Hand-Casts nicht als Aktivierung zählen — sie sind bereits
          // als Play erfasst; nur die Surprise-Zonen-Variante ist eine
          // echte Aktivierung einer gesetzten Karte.
          if (type === 'reaction_activated' && data.source !== 'surprise') {
            return origLog(type, data);
          }
          const who = data.player || data.activator;
          const pinnedUser = engine.gs?.players?.[pinnedIdx]?.username;
          const nm = type === 'area_effect_activated' ? data.area : data.card;
          if (nm && who && pinnedUser && who === pinnedUser) {
            activations[nm] = (activations[nm] || 0) + 1;
          }
        }
      } catch { /* Beobachter darf nie stören */ }
      return origLog(type, data);
    };
  }
  const oppIdx = pinnedIdx === 0 ? 1 : 0;
  const oppFingerprint = { dmg: 0, cre: 0, spl: 0 }; // dmg in Einheiten à 150 (siehe finish)
  let oppRawDmg = 0;
  const FP_TURN_LIMIT = 8;
  let lastEvalTurn = -1;
  const sampleEval = () => {
    try {
      if (engine._inMctsSim) return;
      const t = engine.gs?.turn;
      if (typeof t !== 'number' || t === lastEvalTurn) return;
      if (typeof engine._cpuEvaluateState !== 'function') return;
      if (lastEvalTurn >= 0) evalCurve[lastEvalTurn] = Math.round(engine._cpuEvaluateState(pinnedIdx));
      lastEvalTurn = t;
    } catch { /* Beobachter darf nie stören */ }
  };

  const flushTurnPairs = () => {
    const names = [...curTurnNames].sort();
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = `${names[i]}|${names[j]}`;
        pairs[key] = (pairs[key] || 0) + 1;
      }
    }
    curTurnNames = new Set();
  };

  const recordPlay = (name, casterHero, placedHero) => {
    if (name) recordLockContext(name);
    if (!name) return;
    // Deck-pool filter. "Controlled by pinnedIdx" is not the same as
    // "belongs to the pinned deck": nuisance creatures the OPPONENT
    // summons into our support zones (Plant Golem / Box Spider style)
    // count as controlled by us per the rules, and cards gifted into
    // our hand (Chatty Town Guard) can even be cast by us. None of
    // that is a decision the pinned deck's pilot can replicate, so it
    // must not enter the regression as "our play".
    if (allowedNames && !allowedNames.has(name)) return;
    const turn = engine.gs?.turn || 0;
    if (turn !== curTurn) { flushTurnPairs(); curTurn = turn; }
    const b = turnBucket(turn);
    // PP_PLAYLOG=1: chronologisches Log echter Plays (Deck-Analyse).
    if (process.env.PP_PLAYLOG === '1') console.log('[PLAYLOG] turn=' + turn + ' ' + name);
    if (!plays[name]) plays[name] = { early: 0, mid: 0, late: 0 };
    plays[name][b]++;
    // ctx: Was war beim Play VERFÜGBAR (eigene Hand + eigenes Board +
    // eigener Discard)? Grundlage der Uplift-Analyse im Trainer: Wert
    // von X mit Partner Y verfügbar vs. ohne — echte Abhängigkeiten
    // statt Adjazenz-Paaren. Post-Play-Zustand ist als Näherung
    // korrekt: die gespielte Karte ist aus der Hand, der Partner
    // (falls da) noch sichtbar.
    // Discard-Einträge tragen das Präfix "dc:" — die ZONE ist Teil der
    // Hypothese: "Cute Cat gespielt, während Grave Worm im FRIEDHOF
    // lag" (Discard-Trigger-Combo) ist eine andere Vorbedingung als
    // "Grave Worm lag auf der Hand". Ohne Präfix wären beide Zustände
    // im selben Arm verschmiert und Discard-Combos unmessbar (Als
    // Cute-Cat|Grave-Worm-Befund). Dedupe via Set: Kopien-Anzahl im
    // Discard wird bewusst nicht unterschieden.
    let ctx = null;
    try {
      const set = new Set(engine.gs?.players?.[pinnedIdx]?.hand || []);
      for (const inst of engine.cardInstances) {
        if (inst.owner === pinnedIdx && inst.zone === 'support' && inst.name && !inst.faceDown) set.add(inst.name);
      }
      set.delete(name);
      for (const dn of (engine.gs?.players?.[pinnedIdx]?.discardPile || [])) {
        if (dn) set.add(`dc:${dn}`);
      }
      if (set.size > 0) ctx = [...set].sort();
    } catch { /* Beobachter darf nie stören */ }
    // `h` = castender Held (nur via afterSpellResolved geliefert, also
    // Spells/Attacks) — Datengrundlage des Caster-Delta-Kanals: derselbe
    // Spell kann je nach Caster fundamental anders wirken (Ida macht
    // AoE zu Single-Target). Andere Play-Pfade (Creatures, Potions,
    // Abilities) haben keinen Caster im Sinne dieses Kanals.
    const ev = { n: name, t: turn };
    if (ctx) ev.ctx = ctx;
    if (casterHero) ev.h = casterHero;
    // `ph` = Ziel-Held einer Ability-Platzierung (Als Nao-Befund):
    // End-State-Ability-Features sind zeitkonfundiert — mit ph + t
    // kann der Trainer künftig Horizont-Features bauen ("Level bis
    // Zug X" statt "Level am Spielende").
    if (placedHero) ev.ph = placedHero;
    // `ds` = eigene Restdeck-Größe beim Play — Datengrundlage des
    // Deckout-Guard-Kanals ("welche Karten korrelieren, im Danger-
    // Bereich gespielt, mit eigenen Deckout-Losses?").
    const ds = engine.gs?.players?.[pinnedIdx]?.mainDeck?.length;
    if (typeof ds === 'number') ev.ds = ds;
    playEvents.push(ev);
    curTurnNames.add(name);
  };

  // ── Hook observer ──────────────────────────────────────────────────
  // NOTE: installCpuBrain also wraps runHooks. Order doesn't matter —
  // both call through to the original and only observe.
  // keepInHand-Artefakte (Magic Gems) erzeugen KEINEN ZoneEnter für die
  // Karte selbst — der afterArtifactUsed-Hook (server.js, Universal
  // observer) ist die verlässliche Play-Quelle und schließt die
  // Report-Unterzählung (Amethyst 3/700 trotz realer Plays).
  const origRunHooks = engine.runHooks.bind(engine);
  engine.runHooks = async function (hookName, hookCtx = {}) {
    const result = await origRunHooks(hookName, hookCtx);
    sampleEval();
    try {
      if (hookName === 'afterSpellResolved') {
        // Spells AND Attacks funnel through here. Only count the pinned
        // side, and skip rollout noise — MCTS simulations re-fire every
        // hook against snapshot state; recording them would poison the
        // dataset with hypothetical plays that never happened.
        if (!engine._inMctsSim && hookCtx.casterIdx === pinnedIdx) {
          // Caster-Held mitgeben (hookCtx.heroIdx): Grundlage für den
          // Held×Karte-Delta-Kanal im Trainer.
          const casterHero = engine.gs?.players?.[pinnedIdx]?.heroes?.[hookCtx.heroIdx]?.name || null;
          recordPlay(hookCtx.spellName || hookCtx.spellCardData?.name, casterHero);
        } else if (!engine._inMctsSim && hookCtx.casterIdx === oppIdx
            && (engine.gs?.turn || 99) <= FP_TURN_LIMIT) {
          const nm = hookCtx.spellName || hookCtx.spellCardData?.name;
          const ct = nm ? engine._getCardDB()[nm]?.cardType : null;
          if (ct === 'Attack' || ct === 'Spell') oppFingerprint.spl++;
        }
      } else if (hookName === 'afterDamage') {
        // Fingerprint: gegnerischer Schadensdruck auf UNSERE Helden bis
        // Zug 8 — die Aggro-Achse.
        if (!engine._inMctsSim && (engine.gs?.turn || 99) <= FP_TURN_LIMIT
            && typeof hookCtx.amount === 'number' && hookCtx.amount > 0) {
          try {
            const side = engine._findHeroOwner?.(hookCtx.target);
            if (side === pinnedIdx) oppRawDmg += hookCtx.amount;
          } catch { /* nie stören */ }
        }
      } else if (hookName === 'onCardEnterZone') {
        if (!engine._inMctsSim) {
          const card = hookCtx.enteringCard;
          // Fingerprint: gegnerische Kreaturen-Summons bis Zug 8.
          if (card && (card.controller ?? card.owner) === oppIdx
              && hookCtx.toZone === 'support'
              && (engine.gs?.turn || 99) <= FP_TURN_LIMIT) {
            const cdF = engine._getCardDB()[card.name];
            if (cdF && cdF.cardType === 'Creature') oppFingerprint.cre++;
          }
          // ── WER HAT GESPIELT vs. AUF WESSEN BRETT (6.8.) ──────────
          // Bisher wurde ein Zonen-Eintritts-Play ueber
          // `(controller ?? owner)` zugeordnet — also ueber die
          // BRETTSEITE. Fuer Karten, die man auf die GEGNERISCHE Seite
          // legt, ist das falsch: Powder Keg landet in der gegnerischen
          // Support Zone, die Instanz traegt dort owner/controller =
          // Gegner, und der Play des Piloten wurde dem GEGNER
          // zugeschrieben. Gemessen: der Planer waehlte Powder Keg 871×
          // aus (`artifactPicks` zaehlt NACH gold/canActivate/
          // cpuShouldPlay), in `plays` erschien sie in 27 von 738
          // Spielen. Vierter Fall dieser Klasse nach Boots of Hermes,
          // Cooldins Area und FCoH.
          //
          // `originalOwner` ist das kanonische "wessen Karte ist das"
          // und beantwortet damit "wer hat sie gespielt". Fuer alles
          // Normale ist es identisch mit owner — die Zuordnung aendert
          // sich AUSSCHLIESSLICH bei Cross-Side-Platzierungen. Bewusst
          // NICHT umgestellt: der Gegner-Fingerprint darueber, der will
          // wirklich "was steht auf dessen Brett".
          const playSide = card ? (card.originalOwner ?? (card.controller ?? card.owner)) : null;
          // Wirts-Helden- und Equip-Lookups bleiben an der BRETTSEITE —
          // bei einer Cross-Side-Platzierung steht der Wirts-Held auf
          // der anderen Seite, und ein Lookup in players[pinnedIdx]
          // haette dort stillschweigend den falschen Namen gestempelt.
          const zoneSide = card ? (card.controller ?? card.owner) : null;
          if (card && playSide === pinnedIdx) {
            const cd = engine._getCardDB()[card.name];
            // Support zone: Creatures + equipped Artifacts. Spell/Attack
            // attachments ALSO enter support zones but were already
            // counted via afterSpellResolved — filter by cardType to
            // avoid double counting.
            // Potions: verbraucht = Transfer aus der Hand in deleted/
            // discard/play-pile. Ohne diesen Stempel waren Potion-plays
            // unsichtbar (Elixir of Quickness war fälschlich "tot" im
            // Deck-Audit, obwohl der Draw nachweislich lief).
            if (cd && cd.cardType === 'Potion'
                && hookCtx.fromZone === 'hand'
                && ['deleted', 'discard', 'playPile', 'play', 'area'].includes(hookCtx.toZone)) { // 'area': Area-Karten (Slippery Ice) wurden nie als Play gezählt — Report zeigte 5% Spielrate bei 97% Aktivierungsrate
              recordPlay(card.name);
            }
            else if (hookCtx.toZone === 'support'
                && cd && (cd.cardType === 'Creature' || cd.cardType === 'Artifact')) {
              // Bei CREATURES ist der Wirts-Held eine eigene
              // Entscheidungsdimension und wurde bisher nicht erfasst:
              // Beatos Ascension zählt eine Summoning-Schule NUR, wenn
              // die Kreatur in IHRE Support Zone kommt (siehe
              // beato-the-butterfly-witch onCardEnterZone). In der
              // Auswertung der Trainingsläufe war der Summoning-Orb
              // deshalb als einziger der fünf Schulen unsichtbar. `ph`
              // trägt bereits genau diese Bedeutung ("Ziel-Held einer
              // Platzierung") bei Abilities — hier gespiegelt.
              const hostName = (cd.cardType === 'Creature' && typeof hookCtx.toHeroIdx === 'number')
                ? engine.gs?.players?.[zoneSide]?.heroes?.[hookCtx.toHeroIdx]?.name
                : null;
              recordPlay(card.name, undefined, hostName || undefined);
              // Equip-Platzierung: WELCHER Held das Equipment bekommt,
              // ist eine eigene Entscheidungsdimension (Summoning
              // Circle@Arthor erfüllt dessen Ascension, @sonstwem ist
              // er fast wertlos) — analog zu den Ability-Platzierungen.
              if (cd.cardType === 'Artifact'
                  && (cd.subtype || '').toLowerCase() === 'equipment'
                  && typeof hookCtx.toHeroIdx === 'number') {
                const heroName = engine.gs?.players?.[zoneSide]?.heroes?.[hookCtx.toHeroIdx]?.name;
                if (heroName) {
                  const key = `${card.name}@${heroName}`;
                  equips[key] = (equips[key] || 0) + 1;
                }
              }
            }
            // Ability zone: fires in doPlayAbility AFTER the negation
            // check — a clean "ability successfully attached" signal.
            // Crucially, the tracked instance still carries the REAL
            // card name here (Performance is recorded as 'Performance',
            // not as the ability it visually transforms into).
            else if (hookCtx.toZone === 'ability' && cd && cd.cardType === 'Ability') {
              const phName = typeof hookCtx.toHeroIdx === 'number'
                ? engine.gs?.players?.[pinnedIdx]?.heroes?.[hookCtx.toHeroIdx]?.name
                : null;
              recordPlay(card.name, undefined, phName || undefined);
            }
          }
        }
      } else if (hookName === 'onReactionActivated') {
        // Reaction Spells/Artifacts that go through the chain system.
        // Recorded at declaration — a later counter-negation doesn't
        // undo the pilot's decision, which is what we're correlating
        // with outcomes.
        if (!engine._inMctsSim && hookCtx.reactionOwner === pinnedIdx) {
          recordPlay(hookCtx.reactionCardName);
        }
      } else if (hookName === 'afterTargetRedirect') {
        // Hand-based redirect cards (Martyry, Challenge) — resolve via
        // _checkTargetRedirect, outside the chain system, and get their
        // own dedicated observer hook there.
        if (!engine._inMctsSim && hookCtx.redirectOwner === pinnedIdx) {
          recordPlay(hookCtx.redirectCardName);
        }
      } else if (hookName === 'onAscension') {
        // Ascended-Hero-Karten sind Hand-Plays (Beato, the Eternal
        // Butterfly liegt 2× im Main Deck), laufen aber über
        // performAscension statt über einen der Spell-/Creature-Pfade —
        // ohne diesen Listener wäre der zentrale Pivot-Moment eines
        // Ascension-Decks in den Trainingsdaten unsichtbar.
        if (!engine._inMctsSim && hookCtx.playerIdx === pinnedIdx) {
          recordPlay(hookCtx.newHeroName);
        }
      } else if (hookName === 'onSurpriseActivated') {
        // Face-down Surprises flipping face-up.
        if (!engine._inMctsSim && hookCtx.surpriseOwner === pinnedIdx) {
          recordPlay(hookCtx.surpriseCardName);
        }
      } else if (hookName === 'onHeroKO') {
        // Kontext-Haupteffekt fürs Revive-Lernen: Payload hat KEIN
        // playerIdx — Owner kommt aus gs._heroKOContext (direkt vor dem
        // Hook gesetzt), Fallback: Helden-Suche auf der pinned-Seite.
        if (!engine._inMctsSim && hookCtx.hero?.name) {
          let owner = engine.gs?._heroKOContext?.heroOwner;
          if (owner === undefined) {
            owner = (engine.gs?.players?.[pinnedIdx]?.heroes || []).includes(hookCtx.hero) ? pinnedIdx : -1;
          }
          if (owner === pinnedIdx) deadHeroes[hookCtx.hero.name] = (deadHeroes[hookCtx.hero.name] || 0) + 1;
        }
      } else if (hookName === 'onHeroRevive') {
        // Revive context tagging. A revive card's value is extremely
        // situational: it depends on WHO comes back and — often more
        // importantly — WHAT that hero can cast this turn (revive-to-
        // attack / revive-to-cast lines). We record both dimensions:
        //   "Golden Ankh→Nao, …"              → identity (unique effect)
        //   "Golden Ankh→ability:Support Magic" → castable schools,
        //                                        value = stack level
        // The engine's generic actionReviveHero passes the reviving
        // card's name as `source`, so this covers Golden Ankh,
        // Reincarnation, Resuscitation Potion, Elixir of Immortality
        // and every future revive card without per-card code. Hero-
        // effect revives (Broghan, Mirjam) fall out via the deck-pool
        // filter — they're not hand-card decisions.
        if (!engine._inMctsSim && hookCtx.playerIdx === pinnedIdx) {
          const src = hookCtx.source;
          const heroName = hookCtx.hero?.name;
          if (src && heroName && (!allowedNames || allowedNames.has(src))) {
            const idKey = `${src}→${heroName}`;
            revives[idKey] = (revives[idKey] || 0) + 1;
            const zones = engine.gs?.players?.[pinnedIdx]?.abilityZones?.[hookCtx.heroIdx] || [];
            for (const slot of zones) {
              if (!slot || slot.length === 0) continue;
              const abKey = `${src}→ability:${slot[0]}`;
              revives[abKey] = Math.max(revives[abKey] || 0, slot.length);
            }
          }
        }
      } else if (hookName === 'afterArtifactUsed') {
        // One-shot / targeting Artifacts (Magnetic Glove, Golden Ankh,
        // Beer, …) — fired by server.js doUseArtifactEffect. Equipment
        // and Artifact-Creatures are NOT double counted here: they
        // route through doPlayArtifact and are recorded via
        // onCardEnterZone instead.
        if (!engine._inMctsSim && hookCtx.playerIdx === pinnedIdx) {
          recordPlay(hookCtx.artifactName);
        }
      } else if (hookName === 'afterPotionUsed') {
        if (!engine._inMctsSim && hookCtx.potionOwner === pinnedIdx) {
          recordPlay(hookCtx.potionName);
        }
      }
    } catch (err) {
      // Observer must never break the game.
      console.error('[train-recorder] observer threw:', err.message);
    } finally {
      // Lock-Baseline NUR an Phasen-/Zuggrenzen nachziehen. Ein Update
      // nach jedem Hook fräße den Diff auf: Zwischen dem Lock-Setzen in
      // der Karten-Resolution und dem afterArtifactUsed-Play-Signal
      // feuern zig Zwischen-Hooks (beforeDamage, onCardLeaveZone, …) —
      // die Baseline wäre beim recordPlay längst "item: true" (live so
      // beobachtet: Boomerang gespielt, locks-Sektion leer). An
      // Phasengrenzen feuert dagegen nie eine halbe Resolution, und
      // Fremd-Locks aus dem Gegnerzug wandern spätestens beim eigenen
      // Zugbeginn in die Baseline.
      if (!engine._inMctsSim && (hookName === 'onPhaseStart' || hookName === 'onTurnStart' || hookName === 'onPhaseEnd')) {
        try { prevLocks = readLocks(); } catch { /* nie das Spiel brechen */ }
      }
    }
    return result;
  };

  return {
    finish(winnerIdx, reason) {
      flushTurnPairs();
      oppFingerprint.dmg = Math.round(oppRawDmg / 150);
      // Letzten Zug in die Eval-Kurve stempeln (Endzustand des Spiels).
      try {
        if (lastEvalTurn >= 0 && typeof engine._cpuEvaluateState === 'function') {
          evalCurve[lastEvalTurn] = Math.round(engine._cpuEvaluateState(pinnedIdx));
        }
      } catch { /* nie stören */ }
      // Protection-Lernkanal: Entscheidungen der pinned Seite übernehmen.
      // Game-Start-Pick-Kanal (Bill/Barker/Sid): Helper-Entscheidungen
      // der pinned Seite + Matchup-Schlüssel des Gegners für spätere
      // matchup-konditionierte Auswertung.
      const gameStartPicks = (engine._gameStartLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ card, picks, src }) => ({ card, picks, src }));
      let oppHeroKey = null;
      try {
        const { heroKeyOf } = require('./_deck-profile');
        const oppHeroes = (engine.gs.players[pinnedIdx === 0 ? 1 : 0]?.heroes || [])
          .map(h => h?.name).filter(Boolean);
        oppHeroKey = heroKeyOf ? heroKeyOf(oppHeroes) : oppHeroes.join('|');
      } catch {}
      const protectionDecisions = (engine._protLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ card, ratio, lethal, confirmed }) => ({ card, ratio, lethal, confirmed }));
      // Zielwahl-Log (Target-Prior-Kanal): finale Picks der pinned Seite
      // als {c: Quellkarte, t: Zug, tags: Zielklassen}.
      const targetPicks = (engine._targetLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, tags }) => ({ c, t, tags }));
      // Surprise-Fire/Hold-Log der pinned Seite (Surprise-Lernkanal).
      const surpriseDecisions = (engine._surpriseLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, fired }) => ({ c, t, fired: fired ? 1 : 0 }));
      // Impact-Merkmale gespielter Schadenskarten (Schadens-Lernkanal):
      // Gesamtschaden, Hero-Kills, Creature-Kills je Play. Die relativen
      // Gewichte lernt der Trainer daraus selbst.
      const damageImpacts = (engine._damageImpactLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, dmg, hk, ck }) => ({ c, t, dmg, hk, ck }));
      // Fire/Hold-Log der Hand-Reaktionen (Reaktions-Lernkanal). `b` ist
      // der Schadenskontext-Bucket (own/opp × lethal/heavy/light) bzw.
      // ersatzweise die Zug-Phase.
      const reactionDecisions = (engine._reactionLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, b, fired }) => ({ c, t, b, fired: fired ? 1 : 0 }));
      // Status-Heilungs-Entscheidungen (Kanal: Coffee/Tea/Beer/Juice).
      // Placement-Entscheidungen (Support-Zonen-Ökonomie-Kanal).
      const placementDecisions = (engine._placementLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, tags }) => ({ c, t, tags: tags || [] }));
      // Ketten-Kanal: welche Kreatur wurde beim Swap zurückgebounct?
      // (Tags aus classifyBounceTags — Wert-Tertil, Level, Dublette,
      // Opfer-Bedingungs-Status.)
      const bounceDecisions = (engine._bounceDecisionLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, tags }) => ({ c, t, tags: tags || [] }));
      // Ausspiel-Reihenfolge-Kanal: welche Karte wurde als nächstes
      // gespielt, in welcher Lage (Tags aus classifyPlayOrderTags).
      const playOrderDecisions = (engine._playOrderLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, tags }) => ({ c, t, tags: tags || [] }));
      const statusHealDecisions = (engine._statusHealLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, tags, fired }) => ({ c, t, tags: tags || [], fired: fired ? 1 : 0 }));
      // Market-Crash-Kanal (Als Auftrag 16.8.): "Gold beider Seiten auf
      // 0" ist fast reine Zeitpunkt-Entscheidung. Gleiche Form wie der
      // Status-Heil-Kanal — gespielt/gehalten je Kontext, Tags aus
      // classifyMarketCrashTags (Modus, Phase, Vorsprung, Eigenopfer,
      // Gegner-Hunger, Beute).
      const marketCrashDecisions = (engine._marketCrashLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, tags, fired }) => ({ c, t, tags: tags || [], fired: fired ? 1 : 0 }));
      // Counter-Ausgabe-Kanal (Als Vorgabe 5.8.): "diesen Zähler jetzt
      // ausgeben oder für den Aufstieg aufheben?" — fired/held je
      // Entscheidung, Tags aus classifyCounterSpendTags.
      const counterSpendDecisions = (engine._counterSpendLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, tags, fired }) => ({ c, t, tags: tags || [], fired: fired ? 1 : 0 }));
      // Zugende-Form je eigenem Zug: asc = in Ascended Form geendet,
      // evo = Zählerstand, ca = ein Aufstieg wäre bezahlbar gewesen.
      // Der Trainer formt daraus die Belohnung für den Kanal darüber und
      // die Report-Kennzahl "Züge, die in der Basisform endeten".
      const formTurns = (engine._formTurnLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ t, asc, evo, ca, form, src, fit, desc, stack }) =>
          ({ t, asc, evo, ca, form, src, fit, desc, stack }));
      // Abstiege je Zug (Als Auftrag 6.8.). Eigenes Feld statt nur der
      // Zahl im formTurns-Stempel: der Stempel faellt nur, wenn der Zug
      // regulär bis zur End Phase läuft — Abstiege in abgebrochenen
      // Zügen wären sonst unsichtbar.
      const descends = (engine._descendLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ t, from, gain }) => ({ t, from, gain }));
      // Descend-Lernkanal: "jetzt abbauen oder weiterstapeln?"
      const descendDecisions = (engine._descendDecisionLog || [])
        .filter(e => e.pi === pinnedIdx)
        .map(({ c, t, tags, fired }) => ({ c, t, tags: tags || [], fired: fired ? 1 : 0 }));
      // Final ability placement snapshot: "Ability@HeroName" -> stack level.
      const abilities = Object.create(null);
      const ps = engine.gs?.players?.[pinnedIdx];
      const heroes = ps?.heroes || [];
      for (let hi = 0; hi < heroes.length; hi++) {
        const heroName = heroes[hi]?.name;
        if (!heroName) continue;
        for (const slot of (ps.abilityZones?.[hi] || [])) {
          if (!slot || slot.length === 0) continue;
          // Formen eines morphenden Helden teilen sich einen Prior-Satz,
          // wenn ihr Skript `cpuMeta.abilityIdentity` deklariert. Sonst
          // stempelt dieser Block die ENDFORM des Spiels als Ort der
          // Platzierung — und der Ability-Prior lernt in Wahrheit die
          // Winrate der Endform statt den Wert der Ability.
          const key = `${slot[0]}@${abilityIdentityOf(engine, heroName)}`;
          abilities[key] = Math.max(abilities[key] || 0, slot.length);
        }
      }
      let outcome = null; // 1 win, 0 loss, null tie/no-result (learner skips)
      if (winnerIdx === pinnedIdx) outcome = 1;
      else if (winnerIdx === (pinnedIdx === 0 ? 1 : 0)) outcome = 0;
      // Starthand + Mulligan-Entscheidung (vom Self-Play-Flow nach der
      // Mulligan-Phase auf engine._startHandInfo gestempelt). null bei
      // Alt-Läufen ohne Stempel — der Trainer überspringt solche Records
      // für den Starthand-Kanal.
      const shInfo = engine._startHandInfo?.[pinnedIdx] || null;

      // ── Hero-Effekt-Timing: "Held@hand:Bucket" → Anzahl ──
      const heroEffects = Object.create(null);
      for (const e of (engine._heroEffectLog || [])) {
        if (e.pi !== pinnedIdx) continue;
        const key = `${e.hero}@hand:${e.bucket}`;
        heroEffects[key] = (heroEffects[key] || 0) + 1;
      }

      // ── Board-Paare (Endstand-Snapshot): Ko-Präsenz zweier Karten ──
      // auf DEMSELBEN Helden (boardPairsSame) vs beide gelegt, aber auf
      // VERSCHIEDENEN Helden (boardPairsSplit). Der Trainer kontrastiert
      // beide — gleiche Karten, gleicher Spielkontext, nur die
      // Ko-Lokation unterscheidet sich. Das isoliert echte Same-Hero-
      // Synergien (Shield of Life + Lifeforce Howitzer) von "beide
      // Karten sind halt gut".
      const boardPairsSame = Object.create(null);
      const boardPairsSplit = Object.create(null);
      {
        const perHero = [];
        for (let hi = 0; hi < (heroes.length || 0); hi++) {
          const names = [];
          for (const slot of (ps?.supportZones?.[hi] || [])) {
            if (slot && slot.length > 0) names.push(slot[0]);
          }
          for (const slot of (ps?.abilityZones?.[hi] || [])) {
            if (slot && slot.length > 0) names.push(slot[0]);
          }
          perHero.push(names);
        }
        const flat = [];
        for (let hi = 0; hi < perHero.length; hi++) {
          for (const n of perHero[hi]) flat.push({ n, hi });
        }
        const seen = new Set();
        for (let i = 0; i < flat.length; i++) {
          for (let j = i + 1; j < flat.length; j++) {
            if (flat[i].n === flat[j].n) continue; // nur verschiedene Karten
            const key = [flat[i].n, flat[j].n].sort().join('|');
            const same = flat[i].hi === flat[j].hi;
            // Pro Spiel zählt jedes Paar höchstens 1× pro Kategorie;
            // liegt es sowohl same als auch split (Mehrfachkopien),
            // gewinnt same (die Synergie existierte).
            const tag = key + (same ? '#s' : '#x');
            if (seen.has(tag)) continue;
            seen.add(tag);
            if (same) boardPairsSame[key] = 1;
            else boardPairsSplit[key] = 1;
          }
        }
        for (const k of Object.keys(boardPairsSplit)) {
          if (boardPairsSame[k]) delete boardPairsSplit[k];
        }
      }
      return {
        deck: pinnedName,
        opponent: opponentName,
        startHand: shInfo ? shInfo.hand : null,
        mulliganed: shInfo ? (shInfo.mulliganed ? 1 : 0) : null,
        heroEffects,
        boardPairsSame,
        boardPairsSplit,
        pinnedIdx,
        wentFirst: firstPlayer === pinnedIdx ? 1 : 0,
        winnerIdx,
        reason: reason || null,
        outcome,
        turns: engine.gs?.turn || 0,
        plays,
        pairs,
        playEvents,
        evalCurve,
        // Voller Deck-Pool (Main + Potion) — Grundlage für den
        // Karten-Einsatz-Report des Trainers (nie/selten gespielte
        // Karten sind ohne die Soll-Liste unsichtbar).
        deckPool: allowedNames ? [...allowedNames].sort() : null,
        // Teilmenge des Pools mit aktivem Effekt (Skript-Contracts
        // areaEffect / creatureEffect+onCreatureEffect / onEquipEffect).
        activatablePool: (() => {
          if (!allowedNames) return null;
          try {
            const { loadCardEffect } = require('./_loader');
            return [...allowedNames].filter(n => {
              const s = loadCardEffect(n);
              return !!(s && (s.areaEffect || (s.creatureEffect && s.onCreatureEffect) || s.onEquipEffect));
            }).sort();
          } catch { return null; }
        })(),
        activations,
        oppFingerprint,
        abilities,
        protectionDecisions,
        targetPicks,
        surpriseDecisions,
        reactionDecisions,
        damageImpacts,
        // Bounce-Swap-Historie: jedes Return-to-Hand-Ereignis der
        // pinned-Seite mit Zug, zurückgegebenen Karten und Quelle.
        bounces: engine._bounceLog || [],
        // Pro-Zug-Ökonomie der eigenen Züge: {t, g:Gold, h:Handgröße,
        // pl:spielbar (Näherung), cr:Kreaturen, ds:Bounce-Linien-Kreaturen}
        turnEconomy: engine._turnEconomyLog || [],
        // T5: Handkartenfluss über das ganze Spiel (Zufluss getrennt nach
        // Quelle, plus Kosten-Abwürfe). Je-Zug-Auflösung steht in
        // turnDiag[].hf.
        handFlow,
        // T1: je eigenem Zug {t, bo=alte Körper, zf=freie Slots,
        // ha=lebende Helden, go=offene Grants, blk=Blocker dieses Zuges}
        turnDiag: (() => {
          try {
            const L = engine._turnDiagLog || [];
            if (L.length && engine._turnBlockers) L[L.length - 1].blk = engine._turnBlockers;
            return L;
          } catch { return engine._turnDiagLog || []; }
        })(),
        // T3: Mulligan-Entscheidungen samt Hand
        mulliganLog: (engine._mulliganLog || []).filter(e => e.pi === pinnedIdx),
        statusHealDecisions,
        marketCrashDecisions,
        counterSpendDecisions,
        formTurns,
        descends,
        descendDecisions,
        placementDecisions,
        bounceDecisions,
        // Swap-Diagnose (Als Auftrag): Zählerkette Verfügbarkeit →
        // Slot-Wahl → Wert-Gate. Beantwortet, ob ein ausgebliebener
        // Zyklus-Zug am Gate scheiterte oder dort nie ankam.
        swapDiag: (engine._swapDiag || [])[pinnedIdx] || {},
        grantsExpired: engine._grantsExpired || 0,
        // Als Hauptmetrik, roh je Trigger: {t: Zug, n: Karte, w: Gewicht,
        // k: 'summon' | 'swap' | 'copy'}. Bewusst UNAGGREGIERT — der
        // Trainer bildet daraus Trigger/Zug, Verteilung, Null-Quote und
        // die Kurve nach Zug-Index; jede spätere Auswertung kann andere
        // Schnitte legen, ohne dass neu gesammelt werden muss.
        onSummonTriggers: engine._onSummonTriggerLog || [],
        playOrderDecisions,
        // Tutor-/Such-Entscheidungen (Galerie-Picks, live vollzogen).
        tutorPicks: (engine._tutorPickLog || [])
          .filter(e => e.pi === pinnedIdx)
          .map(({ src, picked, t }) => ({ src, picked, t })),
        // Deepsea-Idol-Diagnose: Wie oft öffnete sich das Batch-Fenster?
        batchWindows: (() => {
          const b = engine._batchWindowStats || { calls: 0, ge2: 0, ge2own: [0, 0] };
          return { calls: b.calls, ge2: b.ge2, ge2ownPinned: (b.ge2own || [0, 0])[pinnedIdx] || 0, outcomes: b.outcomes || null };
        })(),
        // Hand-Reaktionsfenster-Diagnose (Als Gold-Frage): pro Karte
        // { seen, gold } — wie oft lag die Reaktion beim Fensteröffnen
        // auf der Hand, und wie oft scheiterte sie am Gold-Gate.
        reactionWindows: (engine._rxWindowStats || [])[pinnedIdx] || {},
        // Artifact-Pick-Verfügbarkeit (nur pinned-Seite): Karte kam als
        // Pass-Pick an (canActivate + Gold ok), unabhängig vom Gate.
        artifactPicks: (engine._artifactPickStats || [])[pinnedIdx] || {},
        gameStartPicks,
        oppHeroKey,
        revives,
        deadHeroes,
        menus: menus.length ? menus : undefined,
        equips,
        locks,
      };
    },
  };
}

module.exports = { attachTrainingRecorder, turnBucket };
