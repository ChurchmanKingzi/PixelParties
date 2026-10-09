// ═══════════════════════════════════════════
//  CARD EFFECT: "Old Couple"
//  Spell (Support Magic Lv1, Subtyp Reaction)
//
//  „Play this card immediately when you summon a Creature with level
//   1/2/3 or lower. Search your deck for a Creature with the same level
//   and a different name and immediately summon it as an additional
//   Action with the same Hero. You cannot summon Creatures for the rest
//   of the turn afterwards."
//
//  ── ALS VORGABEN (11.9.) ──────────────────────────────────────────
//  · „level 1/2/3 or lower" haengt am SUPPORT-MAGIC-Level des WIRKERS
//    (Old-Couple-Nutzer): wer Support Magic 2 hat, darf auf Beschwoerungen
//    bis Level 2 reagieren — auch wenn ein ANDERER Held beschworen hat.
//  · Die Karte BESCHWOERT — sie ignoriert also nichts. Die zweite
//    Kreatur muss vom selben Helden REGULAER beschwoerbar sein: sein
//    Summoning-Magic-Level muss reichen, eine Support Zone frei sein,
//    keine Sperre greifen, und die Karte selbst muss es zulassen
//    (`canSummon`). Daraus folgt die Spielbarkeit: Old Couple ist NUR
//    einsetzbar, wenn es im Deck wirklich eine solche Kreatur gibt.
//
//  ── WIRKER ≠ BESCHWOERER (Als Klarstellung, Kartentext) ────────────
//  Der Kartentext verlangt NICHT, dass der Old-Couple-Nutzer selbst
//  beschwoert hat. Zwei Rollen, die nicht derselbe Held sein muessen:
//    · WIRKER — ein eigener Held, der Old Couple wirken kann (Support
//      Magic). SEIN Support-Magic-Level bestimmt, bis zu welchem Kreatur-
//      Level die Karte reagieren darf („level 1/2/3 or lower"). Die Engine
//      bietet nur wirkfaehige Helden an; `reactionCasterAllowed` filtert
//      zusaetzlich aufs Level.
//    · BESCHWOERER — der Held, der die ausloesende Kreatur beschworen hat
//      („with the same Hero"): ER beschwoert auch den Partner aus dem
//      Deck (sein Summoning-Magic-Level, seine freie Support Zone).
//  Frueher musste der BESCHWOERER selbst Support Magic haben.
//
//  ── WO DAS FENSTER HERKOMMT ───────────────────────────────────────
//  `onCreatureSummoned` stand seit jeher in der Fensterliste der
//  Engine, wurde aber nie gefeuert — v873 tut das an der einen Stelle,
//  durch die jede Beschwoerung laeuft (Hand, Effekt, Platzierung).
//
//  ── DIE SPERRE DANACH ─────────────────────────────────────────────
//  „You cannot summon Creatures for the rest of the turn afterwards."
//  = `ps.summonLocked`, derselbe Riegel, den die Engine ohnehin an
//  allen Beschwoerungswegen prueft. Er wird VOR der Beschwoerung des
//  Partners gesetzt (Bugfix): dessen Beschwoerungs-Effekte (Cloudy Slime
//  „place a level 0 Creature …") laufen schon in
//  `summonCreatureWithHooks` und waeren sonst noch nicht gesperrt.
//  `summonCreatureWithHooks` selbst prueft `summonLocked` nicht — der
//  Riegel blockiert die eigene Beschwoerung also nicht. Scheitert sie,
//  wird er zurueckgenommen.
// ═══════════════════════════════════════════

const { hasCardType, hasNumericCreatureLevel, sameCardName, cardVariantTag } = require('./_hooks');

const CARD_NAME = 'Old Couple';

/** Support-Magic-Level des Helden, 0 wenn er die Karte gar nicht wirken darf. */
function supportLevel(engine, pi, heroIdx) {
  return engine.effectiveSchoolLevelForCaster('Support Magic', pi, heroIdx) || 0;
}

/** Hoechstes Support-Magic-Level unter den lebenden eigenen Helden (Wirker). */
function besteWirkerStufe(engine, pi) {
  let best = 0;
  (engine.gs.players[pi]?.heroes || []).forEach((h, hi) => {
    if (!h?.name || h.hp <= 0) return;
    best = Math.max(best, supportLevel(engine, pi, hi));
  });
  return best;
}

/**
 * Kann `heroIdx` diese Deck-Kreatur JETZT regulaer beschwoeren?
 * Bewusst dieselben Pruefungen wie der normale Beschwoerungsweg — die
 * Karte beschwoert, sie platziert nicht.
 */
function beschwoerbar(engine, pi, heroIdx, name, cd) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (ps?.summonLocked) return false;
  try {
    if (engine.getSummonBlocked(pi).includes(name)) return false;
  } catch { /* eine defekte Sperre darf die Karte nicht sprengen */ }
  if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) return false;       // Summoning-Magic-Stufe
  if (!engine.isCreatureSummonable(name, pi, heroIdx)) return false;  // Karteneigene Schranke
  const zonen = ps?.supportZones?.[heroIdx] || [];
  let frei = false;
  for (let z = 0; z < 3; z++) if ((zonen[z] || []).length === 0) { frei = true; break; }
  return frei;
}

/**
 * „a different name" (v875, Als Korrektur): verglichen wird der
 * BASISNAME. „[B]" und „[W]" sind Kosmetik — im Spiel heissen beide
 * Karten „Pawn of Kings", sind also derselbe Name und taugen NICHT als
 * Paar. Die Regel steht zentral in `_hooks` (`sameCardName`), damit
 * jeder Namensvergleich im Bestand dieselbe Antwort gibt.
 */

/** Anhaengsel einer Variante fuer die Galerie-Beschriftung. */
function variante(name) {
  const t = cardVariantTag(name);
  return t ? `[${t}]` : null;
}

/** Alle Deck-Kreaturen, die als Partner in Frage kommen. */
function partnerImDeck(engine, pi, heroIdx, level, ausgeschlossenerName) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  for (const name of (ps?.mainDeck || [])) {
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    if (sameCardName(name, ausgeschlossenerName)) continue;   // „a different name" (Basisname)
    const cd = cardDB[name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (!hasNumericCreatureLevel(cd)) continue;          // Artifact Creatures haben kein Level (Als Ruling 9.10.)
    if ((cd.level ?? 0) !== level) continue;            // „the same level"
    if (!beschwoerbar(engine, pi, heroIdx, name, cd)) continue;
    out.push(name);
  }
  return out;
}

/**
 * Das offene Beschwoerungs-Fenster auswerten: Wer hat beschworen, was,
 * und welcher eigene Held koennte Old Couple darauf wirken?
 * Liefert `{ pi, heroIdx, level, name }` oder null.
 */
function fensterPasst(gs, pi, engine, chainCtx) {
  // Zwei Quellen fuer dasselbe Fenster: beim PRUEFEN reicht die Engine
  // den Hook-Kontext im `chainCtx` durch, beim AUFLOESEN einer
  // Hand-Reaktion bekommt das Skript nur die Kette — dann steht das
  // Fenster in `engine._summonWindow` (v873).
  const ausKette = chainCtx?.hookName === 'onCreatureSummoned' ? (chainCtx.hookCtx || null) : null;
  const h = ausKette || engine?._summonWindow || {};
  if (!h || h.summonerIdx == null) return null;
  if (h.summonerIdx !== pi) return null;                 // „when YOU summon"
  const heroIdx = h.heroIdx;
  if (!(heroIdx >= 0)) return null;
  const hero = gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return null;

  // „with level 1/2/3 or lower" — die Stufe kommt vom WIRKER (irgendein
  // eigener Held mit Support Magic), nicht zwingend vom Beschwoerer.
  const stufe = besteWirkerStufe(engine, pi);
  if (stufe <= 0) return null;
  // Die beschworene Creature braucht ein Level — Artifact Creatures haben keins (Als Ruling 9.10.).
  const _beschworen = engine._getCardDB()[h.cardName];
  if (_beschworen && !hasNumericCreatureLevel(_beschworen)) return null;
  const level = h.level ?? 0;
  if (level > stufe) return null;

  if (partnerImDeck(engine, pi, heroIdx, level, h.cardName).length === 0) return null;
  return { pi, heroIdx, level, name: h.cardName };
}

module.exports = {
  isReaction: true,
  activeIn: ['hand'],

  // Ohne diese Bedingung meldete sich die Karte in JEDEM Kettenfenster
  // als spielbar (Lehre v830, Pawn Chain).
  reactionCondition: (gs, pi, engine, chainCtx) => !!fensterPasst(gs, pi, engine, chainCtx),

  /** Nur Helden, deren Support-Magic-Level fuer die Kreatur reicht, duerfen wirken. */
  reactionCasterAllowed(gs, pi, heroIdx, engine, chainCtx) {
    const fenster = fensterPasst(gs, pi, engine, chainCtx);
    if (!fenster) return false;
    return supportLevel(engine, pi, heroIdx) >= fenster.level;
  },

  async resolve(engine, pi, _selectedIds, _validTargets, _opts, chainCtx) {
    const gs = engine.gs;
    const treffer = fensterPasst(gs, pi, engine, chainCtx);
    if (!treffer) return;
    const { heroIdx, level, name } = treffer;

    const kandidaten = partnerImDeck(engine, pi, heroIdx, level, name);
    if (kandidaten.length === 0) return;

    let gewaehlt = kandidaten[0];
    if (kandidaten.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: kandidaten.map(n => ({
          name: n, source: 'deck',
          // Varianten derselben Figur sehen in der Galerie gleich aus.
          // Das Abzeichen nennt das Anhaengsel, damit „Pawn of Kings
          // [B]" und „[W]" unterscheidbar sind (v874).
          ...(variante(n) ? { label: variante(n) } : {}),
        })),
        title: CARD_NAME,
        // KEIN `showCard` hier: in einer Galerie ist die Seitenkarte der
        // AUSLOESER, nicht die eigene Karte — Old Couple selbst steht im
        // Aktivierungs-Prompt davor (v877, Als Korrektur).
        description: `Summon a level ${level} Creature with a different name than "${name}" from your deck — with the same Hero, as an additional Action.`,
        confirmLabel: '👵👴 Summon',
        cancellable: false,
      });
      if (wahl?.cardName && kandidaten.includes(wahl.cardName)) gewaehlt = wahl.cardName;
    }

    const ps = gs.players[pi];
    // Freier Platz wird hier noch einmal ermittelt: zwischen Pruefung
    // und Aufloesung kann die Kette das Brett veraendert haben.
    let slot = -1;
    for (let z = 0; z < 3; z++) {
      if (((ps.supportZones?.[heroIdx] || [])[z] || []).length === 0) { slot = z; break; }
    }
    if (slot < 0) return;

    const genommen = await engine.deckEntnahme(ps,  gewaehlt, { source: CARD_NAME, shuffle: true });
    if (!genommen) return;

    engine._broadcastEvent('card_reveal', { cardName: gewaehlt, playerIdx: pi });
    await engine._delay(350);

    // Sperre VOR der Beschwoerung (siehe Kopfkommentar); bei Scheitern zurueck.
    const warGesperrt = !!ps.summonLocked;
    ps.summonLocked = true;
    const res = await engine.summonCreatureWithHooks(gewaehlt, pi, heroIdx, slot, {
      source: CARD_NAME, hookExtras: engine.deckHookExtras(),   // v1393
    });
    if (!res?.inst) {
      ps.summonLocked = warGesperrt;
      // Beschwoerung abgelehnt: die Karte gehoert zurueck ins Deck,
      // nicht in die Ablage — sie hat das Deck nie wirklich verlassen.
      engine.deckRueckgabe(genommen);   // v1393
      engine.sync();
      return;
    }

    // „You cannot summon Creatures for the rest of the turn afterwards."
    // (Riegel steht seit vor der Beschwoerung, siehe oben.)

    engine.log('old_couple', {
      player: ps.username, trigger: name, summoned: gewaehlt,
      level, hero: ps.heroes?.[heroIdx]?.name,
    });
    engine.sync();
  },

  // Die CPU nimmt den ersten Kandidaten; ohne Eintrag lehnt der
  // generische Responder die nicht abbrechbare Galerie ab.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery') return undefined;
    const erste = (promptData.cards || [])[0];
    return erste ? { cardName: erste.name, source: erste.source } : undefined;
  },
};
