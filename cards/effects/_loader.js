// ═══════════════════════════════════════════
//  CARD SCRIPT LOADER
//  Lazy-loads card effect files by card name.
//  Caches after first load. Gracefully returns
//  null for cards without effect scripts.
// ═══════════════════════════════════════════

const path = require('path');
const fs = require('fs');

const EFFECTS_DIR = path.join(__dirname);
const cache = new Map(); // normalizedName -> module | null

// ───────────────────────────────────────────────────────────────────
//  AUTO hand-lock tagging
// ───────────────────────────────────────────────────────────────────
// A card is "draw-only" if the only effectful engine calls it makes
// are drawing or tutor-adding cards to the caster's hand. Such cards
// should grey out automatically while the caster is hand-locked,
// because every effect they would perform is already gated by the
// hand-lock guards in the underlying primitives — running them would
// accomplish nothing but discard the card for no benefit.
//
// We decide by scanning the card's raw source text at load time:
//
//   • If the source references at least one name from DRAW_PATTERNS,
//     the card is a candidate.
//   • If the source ALSO references any name from NON_DRAW_PATTERNS,
//     the card has additional side-effects and is NOT draw-only.
//   • A manually declared `blockedByHandLock` on the module ALWAYS
//     wins — card authors can opt-in or opt-out explicitly.
//
// Blocklist approach (inverse "must NOT reference these") is safer
// than an allowlist: engine helpers evolve over time, so we'd rather
// a new "pay gold, do X" primitive accidentally leave cards out of
// auto-tagging than accidentally tag non-draw cards as draw-only.
//
// Limitations:
//   • Substring match, not AST — a local variable named `dealDamage`
//     would false-disqualify. Acceptable for first-party code.
//   • When adding a new non-draw engine action, append its name to
//     NON_DRAW_PATTERNS below.

const DRAW_PATTERNS = [
  'actionDrawCards', 'drawCards',
  'actionDrawFromPotionDeck',
  'actionAddCardToHand', 'addCardToHand',
  'actionAddCardFromDeckToHand',
  'searchDeckForNamedCard',
];

const NON_DRAW_PATTERNS = [
  // Damage / healing / HP
  'dealDamage', 'actionDealDamage', 'actionDealCreatureDamage',
  'healHero', 'reduceHp', 'increaseMaxHp', 'decreaseMaxHp',
  // Placement / destruction / movement
  'placeCreature', 'actionPlaceCreature',
  'destroyCard', 'actionDestroyCard',
  'moveCard', 'actionMoveCard',
  'placeArea', 'removeArea', 'removeAllAreas',
  'flipFaceUp', 'flipFaceDown',
  // Status / ability manipulation
  'addHeroStatus', 'removeHeroStatus', 'applyHeroStatus',
  'applyBurn', 'applyFreeze', 'applyStun',
  'actionApplyCreaturePoison',
  // Steal / revert
  'actionStealGold', 'actionStealFromHand',
  'actionStealHero', 'actionStealCreature',
  'revertStolenCreatures',
  // Discard / mill (affect hands/decks beyond simple draw)
  'actionDiscardCards', 'discardCards',
  'actionMillCards', 'millCards',
  'actionForceDiscard', 'actionPromptForceDiscard',
  // Chains / attacks / spells / sacrifice / ascension
  'executeAttack', 'executeSpell', 'executeCardWithChain',
  'resolveSacrificeCost',
  'performAscensionBonus',
  'actionRevive',
];

// ── „NUR Stapel-Bewegung" (v826, Al 8.9., Praezedenz `blockedByHandLock`) ──
// Karten, deren EINZIGER Effekt eine Entnahme aus Deck/Ablage ist
// (Magnetic Potion: „choose a card from your deck … add it to your
// hand"), sind unter der Stapel-Ausgangssperre (Knight of Kings [B])
// gar nicht erst spielbar — statt bezahlt zu werden und dann zu
// verpuffen. Auto-Erkennung fuer `resolve`-Module (Potions/Artefakte)
// und reine Handkarten mit `onPlay`; ein manuelles `blockedByPileLock`
// am Modul gewinnt immer. Ziehen (`actionDrawCards`) zaehlt NICHT als
// Stapel-Bewegung — Draws bleiben unter der Sperre erlaubt.
const PILE_PATTERNS = [
  'takeFromPile', 'takeFromPileSync', 'takeTop',
  'addFromPileToHand', 'actionAddCardFromDeckToHand', 'addCardFromDiscardToHand',
  'deleteFromPile', 'actionMillCards', 'millCards', 'actionRecycleCards',
  "summonFromPile(", "placeFromPile(",
];
const NON_PILE_PATTERNS = [
  'actionDrawCards', 'drawCards', 'actionDrawFromPotionDeck',   // echte Draws bleiben erlaubt
  ...NON_DRAW_PATTERNS.filter(p => !['actionMillCards', 'millCards', 'actionRevive'].includes(p)),
  'promptDamageTarget', 'promptMultiTarget', 'aoeHit', 'actionDealDamage',
  'actionGainGold', 'gainGold', 'actionSpendGold', 'actionSetHp',
  'applyCreatureStatus', 'actionNegateCreature', 'grantEffectImmunity', 'grantCreatureEffectImmunity',
  'attachToHero', 'summonCreatureWithHooks', 'placeArea', 'equipEffect',
  'addBuff', 'applyBuff', 'actionChangeLevel', 'actionChangeAtk', 'modifyAtk',
  'actionRevealHand', 'actionDiscardHandCard', 'actionShuffleHandIntoDeck',
  'returnToPile(',   // Rueckgabe = keine Entnahme
];
function detectPileOnly(sourceText) {
  sourceText = stripComments(sourceText);
  if (!sourceText) return false;
  if (!PILE_PATTERNS.some(p => sourceText.includes(p))) return false;
  if (NON_PILE_PATTERNS.some(p => sourceText.includes(p))) return false;
  // Geloescht-Stapel ist nicht gesperrt; Zugriff auf den GEGNER-Stapel
  // ist eigene Bewegung des Wirkenden und ebenfalls frei.
  if (/'deleted'|deletedPile/.test(sourceText)) return false;
  if (/\b(oppPs|ops|oppIdx|opponentIdx|oppPlayer)\b|1 - pi\b|players\[1 - /.test(sourceText)) return false;
  // summon/placeFromPile aus der HAND ist keine Stapel-Bewegung
  if (/FromPile\(\s*[\w.]+,\s*'hand'/.test(sourceText)
      && !/FromPile\(\s*[\w.]+,\s*'(deck|discard|deleted)'/.test(sourceText)
      && !/takeFromPile|addFromPileToHand|actionAddCardFromDeckToHand|addCardFromDiscardToHand|deleteFromPile|takeTop|actionMillCards|actionRecycleCards/.test(sourceText)) return false;
  return true;
}

// ── „NUR Beschwoerung/Platzierung" (v834, Al 8.9., Praezedenz blockedByHandLock) ──
// Karten, deren EINZIGER Effekt eine Beschwoerung oder Platzierung ist
// (Pawn Chain, Monster in a Bottle …), sind unter `ps.summonLocked`
// nicht aktivierbar — auch nicht in Reaktionsfenstern.
const SUMMON_PATTERNS = [
  'summonFromPile', 'placeFromPile', 'summonCreatureWithHooks', 'actionPlaceCreature',
  'placeFromHandOrDeck', 'summonFromHandOrDeck', 'safePlaceInSupport',
];
const NON_SUMMON_PATTERNS = [
  'actionDrawCards', 'drawCards', 'actionDrawFromPotionDeck',
  'addFromPileToHand', 'actionAddCardFromDeckToHand', 'addCardFromDiscardToHand', 'deleteFromPile',
  'actionMillCards', 'millCards', 'actionRecycleCards', 'takeTop',
  ...NON_DRAW_PATTERNS.filter(p => !['placeCreature', 'actionPlaceCreature', 'actionMillCards', 'millCards', 'actionRevive'].includes(p)),
  'promptDamageTarget', 'promptMultiTarget', 'aoeHit', 'actionDealDamage',
  'actionGainGold', 'gainGold', 'actionSpendGold', 'actionSetHp',
  'applyCreatureStatus', 'actionNegateCreature', 'grantEffectImmunity', 'grantCreatureEffectImmunity',
  'attachToHero', 'placeArea', 'equipEffect', 'addBuff', 'applyBuff', 'actionChangeLevel', 'actionChangeAtk', 'modifyAtk',
  'actionRevealHand', 'actionDiscardHandCard', 'actionShuffleHandIntoDeck', 'lockSummons',
];
/** Kommentare raus — die Muster-Erkennung soll nur CODE lesen (v834). */
function stripComments(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

function detectSummonOnly(sourceText) {
  sourceText = stripComments(sourceText);
  if (!sourceText) return false;
  if (!SUMMON_PATTERNS.some(p => sourceText.includes(p))) return false;
  if (NON_SUMMON_PATTERNS.some(p => sourceText.includes(p))) return false;
  return true;
}

function detectDrawOnly(sourceText) {
  sourceText = stripComments(sourceText);
  if (!sourceText) return false;
  const hasDraw = DRAW_PATTERNS.some(p => sourceText.includes(p));
  if (!hasDraw) return false;
  const hasNonDraw = NON_DRAW_PATTERNS.some(p => sourceText.includes(p));
  return !hasNonDraw;
}

/**
 * Normalize a card name to a filename.
 * "Arnold, the Maximum Lotl" → "arnold-the-maximum-lotl"
 */
function nameToFile(cardName) {
  return cardName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '');      // trim leading/trailing dashes
}

/**
 * Load a card's effect script. Returns the module or null.
 * Results are cached — safe to call repeatedly.
 */
// Raw-Name-Cache: nameToFile (toLowerCase + 2 Regex-Replaces) lief bei
// JEDEM Aufruf vor dem Slug-Cache-Check. In heißen Pfaden
// (_applyCardLevelReductions → _testLevelReqForZones, pro Handkarte ×
// Zone × MCTS-Rollout-Schritt) dominierte das laut V8-Profil die
// CPU-Zeit (Slip 'n Slide / Big Stomp >160s pro Spiel). Treffer kosten
// jetzt einen Map-Lookup; der Slug-Cache bleibt als zweite Ebene für
// Namensvarianten, die auf denselben Slug normalisieren.
const rawCache = new Map();

function loadCardEffect(cardName) {
  if (!cardName) return null;

  const rawHit = rawCache.get(cardName);
  if (rawHit !== undefined) return rawHit;

  const normalized = nameToFile(cardName);

  // Check cache first
  if (cache.has(normalized)) {
    const mod = cache.get(normalized);
    rawCache.set(cardName, mod);
    return mod;
  }

  // Try to load the file
  const filePath = path.join(EFFECTS_DIR, normalized + '.js');
  let mod = null;

  try {
    if (fs.existsSync(filePath)) {
      mod = require(filePath);

      // Validate minimum structure. Level-manipulation utility abilities
      // (Wisdom, Mana Mining, future ones) carry no hooks or type flags —
      // they plug into the engine's generic level-manipulation mechanism
      // via `reduceSpellLevel` / `coverLevelGap`, so those count as valid
      // exports too. `reduceCardLevel` is the board-wide sibling of
      // `reduceSpellLevel` (used by Elven Forager) and belongs in the
      // same bucket.
      // Validate minimum structure. Passive Hero scripts that only export
      // gate-style functions (canPlayCard, canBypassLevelReqForCard, etc.)
      // are valid — they plug into the engine's gate-checks without
      // needing hooks or type flags. Cute Princess Mary is the first such
      // hero; this list grows as future passive-gate hero scripts ship.
      const PASSIVE_GATE_FNS = [
        'canPlayCard',
        'canBypassLevelReqForCard',
        // Heldenseitige Gratis-Aktion (v601, Baaliel) — Zwilling des
        // Level-Bypasses, wird von `cardHasInherentAction` gelesen.
        'grantsInherentActionForCard',
        'canBypassFreeZoneRequirement',
        'canBypassLevelReq',
        'canSummon',
        'canActivate',
      ];
      const hasPassiveGate = PASSIVE_GATE_FNS.some(k => typeof mod[k] === 'function');
      // Action-economy / summon-cost entry points. Cards that ONLY plug
      // into these (Brain Spider: surprise-cost free-Action summon, no
      // other hooks) are still real effect scripts — the engine consults
      // `inherentAction` from `getHeroPlayableCards` and `beforeSummon`
      // from `doPlayCreature`. Without this bucket, a script that just
      // spreads `makeSurpriseCostSummon` would be nulled out here and
      // `loadCardEffect` would return null, breaking highlight + play.
      const hasEngineEntry = (typeof mod.inherentAction === 'function' || mod.inherentAction === true)
        || typeof mod.beforeSummon === 'function'
        // Rein passive Engine-Verträge ohne Hooks. `forceEndTurnOnUniqueResolves`
        // (Terror) wird in _engine.js ausgewertet, stand aber in KEINER der
        // Erkennungslisten — das Skript überlebte den Filter nur zufällig über
        // die generische `is*: true`-Regel unten, weil es nebenbei ein
        // bedeutungsloses `isPassive: true` trug. Beim Aufräumen dieses Flags
        // (Vertrags-Sweep 1.8.) fiel Terror deshalb komplett aus der Ladung.
        // Jetzt trägt der ECHTE Vertrag das Skript.
        || !!mod.forceEndTurnOnUniqueResolves
        // Area-Aktiveffekte. `areaEffect` + `onAreaEffect` werden von
        // `getActivatableAreas` / `activateAreaEffect` ausgewertet, standen
        // aber in KEINER Erkennungsliste. Die bestehenden Area-Karten
        // ueberlebten den Filter nur, weil sie NEBENBEI Hooks tragen — eine
        // Area, deren ganzer Inhalt der aktivierbare Effekt ist, fiel
        // komplett aus der Ladung und war im Spiel wirkungslos. Exakt die
        // Klasse, die der Terror-Kommentar direkt darueber beschreibt.
        || !!mod.areaEffect
        || typeof mod.onAreaEffect === 'function'
        // Zielschutz aus der Support Zone (v563). Dieselbe Klasse wie
        // die Area-Aktiveffekte darueber: eine Karte, deren GANZER
        // Inhalt der Vertrag ist, trug sonst nichts, was der Filter
        // kennt — sie fiel komplett aus der Ladung und war im Spiel
        // wirkungslos (Future Tech Jetpack, sofort beim ersten Laden
        // aufgefallen).
        || typeof mod.blocksTargeting === 'function'
        // Und der Selbstrabatt aus v541, aus demselben Grund.
        || typeof mod.selfCostReduction === 'function'
        // Aktivierung AUS DER ABLAGE (v582). Dieselbe Klasse wie die
        // Area-Aktiveffekte und `blocksTargeting`: eine Karte, deren
        // ganzer Inhalt dieser Vertrag ist, traegt sonst nichts, was
        // der Filter kennt. Future Tech Prototypes ueberlebte den
        // Filter bisher nur ZUFAELLIG ueber ihr `onIdentityExpire` —
        // eine kuenftige Ablage-Karte ohne Ablaufstempel waere still
        // aus der Ladung gefallen. (In der Gegenprobe aufgefallen.)
        || !!mod.discardEffect
        || typeof mod.onDiscardEffect === 'function'
        // Ruecknahme einer geliehenen Identitaet (v573). Wird vom
        // Zugende-Sweep `_expireBorrowedIdentities` gerufen, nicht ueber
        // die Hook-Kette — also wieder dieselbe Klasse: eine Karte,
        // deren ganzer Inhalt dieser Vertrag ist, faellt sonst aus der
        // Ladung. (Copy Device traegt zwar auch `resolve`, aber die
        // Liste soll den Vertrag trotzdem kennen.)
        || typeof mod.onIdentityExpire === 'function'
        // v668: Aufstiegs- und Umleitungsvertraege ohne Heldeneffekt —
        // Monia Bot ist ein reiner `heroRedirect`-Held mit
        // `ascensionCondition`; bisher trug jede Ascended-Karte nebenbei
        // `heroEffect` und fiel deshalb nie durch dieses Sieb.
        || typeof mod.ascensionCondition === 'function'
        || typeof mod.onAscensionBonus === 'function'
        || typeof mod.refreshAscensionReadiness === 'function'
        || mod.heroRedirect === true;
      if (!mod.hooks && !mod.effects && !mod.isPotion && !mod.isEquip && !mod.isTargetingArtifact && !mod.isReaction && !mod.actionCost && !mod.freeActivation && !mod.heroEffect && !mod.creatureEffect && !mod.equipEffect && !mod.isTargetRedirect && !mod.isSurprise && !mod.resolve && !mod.reduceSpellLevel && !mod.reduceCardLevel && !mod.coverLevelGap && !mod.abilitiesInSupportZones && !hasPassiveGate && !hasEngineEntry && !Object.keys(mod).some(k => k.startsWith('is') && mod[k] === true)) {
        console.warn(`[Loader] Card "${cardName}" (${normalized}.js) has no hooks, effects, or card type flags — ignored.`);
        mod = null;
      }

      // Auto-tag draw-only cards as blockedByHandLock — but ONLY on
      // modules that use the `resolve` entry point (non-equip
      // Artifacts, Potions). Those cards activate from hand as their
      // sole purpose; if their resolve is purely hand-additive, it's
      // worthless while hand-locked. Creatures/Attacks/Spells aren't
      // auto-tagged: they have implicit board presence or damage, and
      // their hand-adding sub-effects are already gated at the engine
      // primitive level (actionDrawCards etc. check handLocked).
      // A manual `blockedByHandLock` on the module always wins.
      if (mod && typeof mod.resolve === 'function'
          && !Object.prototype.hasOwnProperty.call(mod, 'blockedByHandLock')) {
        try {
          const src = fs.readFileSync(filePath, 'utf8');
          if (detectDrawOnly(src)) mod.blockedByHandLock = true;
        } catch { /* ignore — keep mod as loaded */ }
      }
      // v826: „nur Stapel-Bewegung" / v834: „nur Beschwoerung" — resolve-
      // Module UND reine Handkarten (kein activeIn ausser 'hand'; onPlay
      // ODER Reaktionsfenster).
      if (mod) {
        const handOnly = Array.isArray(mod.activeIn) && mod.activeIn.every(z => z === 'hand');
        if (typeof mod.resolve === 'function' || handOnly) {
          let src = null;
          try { src = fs.readFileSync(filePath, 'utf8'); } catch { /* ignore */ }
          if (src) {
            if (!Object.prototype.hasOwnProperty.call(mod, 'blockedByPileLock') && detectPileOnly(src)) mod.blockedByPileLock = true;
            if (!Object.prototype.hasOwnProperty.call(mod, 'blockedBySummonLock') && detectSummonOnly(src)) mod.blockedBySummonLock = true;
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Loader] Failed to load "${cardName}" (${normalized}.js):`, err.message);
    mod = null;
  }

  cache.set(normalized, mod);
  rawCache.set(cardName, mod);
  return mod;
}

/**
 * Check if a card has an effect script without loading it.
 */
function hasCardEffect(cardName) {
  if (!cardName) return false;
  const normalized = nameToFile(cardName);
  if (cache.has(normalized)) return cache.get(normalized) !== null;
  const filePath = path.join(EFFECTS_DIR, normalized + '.js');
  return fs.existsSync(filePath);
}

/**
 * Clear the cache (useful for hot-reloading during development).
 */
function clearCache() {
  for (const [key] of cache) {
    const filePath = path.join(EFFECTS_DIR, key + '.js');
    try { delete require.cache[require.resolve(filePath)]; } catch {}
  }
  cache.clear();
}

/**
 * List all available effect scripts (for debugging/admin).
 */
function listEffects() {
  try {
    return fs.readdirSync(EFFECTS_DIR)
      .filter(f => f.endsWith('.js') && !f.startsWith('_'))
      .map(f => f.replace('.js', ''));
  } catch { return []; }
}

module.exports = { loadCardEffect, hasCardEffect, clearCache, listEffects, nameToFile };
