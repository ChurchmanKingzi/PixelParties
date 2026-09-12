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
//  · „level 1/2/3 or lower" haengt am SUPPORT-MAGIC-Level des NUTZERS:
//    wer Support Magic 2 hat, darf auf Beschwoerungen bis Level 2
//    reagieren.
//  · Die Karte BESCHWOERT — sie ignoriert also nichts. Die zweite
//    Kreatur muss vom selben Helden REGULAER beschwoerbar sein: sein
//    Summoning-Magic-Level muss reichen, eine Support Zone frei sein,
//    keine Sperre greifen, und die Karte selbst muss es zulassen
//    (`canSummon`). Daraus folgt die Spielbarkeit: Old Couple ist NUR
//    einsetzbar, wenn es im Deck wirklich eine solche Kreatur gibt.
//
//  ── WO DAS FENSTER HERKOMMT ───────────────────────────────────────
//  `onCreatureSummoned` stand seit jeher in der Fensterliste der
//  Engine, wurde aber nie gefeuert — v873 tut das an der einen Stelle,
//  durch die jede Beschwoerung laeuft (Hand, Effekt, Platzierung).
//
//  ── DIE SPERRE DANACH ─────────────────────────────────────────────
//  „You cannot summon Creatures for the rest of the turn afterwards."
//  = `ps.summonLocked`, derselbe Riegel, den die Engine ohnehin an
//  allen Beschwoerungswegen prueft. Er wird NACH der eigenen
//  Beschwoerung gesetzt — sonst blockierte er sich selbst.
// ═══════════════════════════════════════════

const { hasCardType, sameCardName, cardVariantTag } = require('./_hooks');

const CARD_NAME = 'Old Couple';

/** Support-Magic-Level des Helden, 0 wenn er die Karte gar nicht wirken darf. */
function supportLevel(engine, pi, heroIdx) {
  return engine.effectiveSchoolLevelForCaster('Support Magic', pi, heroIdx) || 0;
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

  // „with level 1/2/3 or lower" — die Stufe kommt vom NUTZER-Helden.
  // Das ist derselbe Held, der gleich beschwoeren soll („with the same
  // Hero"), also muss ER die Karte wirken koennen.
  const stufe = supportLevel(engine, pi, heroIdx);
  if (stufe <= 0) return null;
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

    const genommen = await engine.takeFromPile(ps, 'deck', gewaehlt, { source: CARD_NAME, shuffle: true });
    if (!genommen) return;

    engine._broadcastEvent('card_reveal', { cardName: gewaehlt, playerIdx: pi });
    await engine._delay(350);

    const res = await engine.summonCreatureWithHooks(gewaehlt, pi, heroIdx, slot, {
      source: CARD_NAME,
    });
    if (!res?.inst) {
      // Beschwoerung abgelehnt: die Karte gehoert zurueck ins Deck,
      // nicht in die Ablage — sie hat das Deck nie wirklich verlassen.
      ps.mainDeck.unshift(gewaehlt);
      engine.sync();
      return;
    }

    // „You cannot summon Creatures for the rest of the turn afterwards."
    // ERST JETZT setzen (siehe Kopfkommentar).
    ps.summonLocked = true;

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
