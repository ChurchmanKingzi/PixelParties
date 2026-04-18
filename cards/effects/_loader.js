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

function detectDrawOnly(sourceText) {
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
function loadCardEffect(cardName) {
  if (!cardName) return null;

  const normalized = nameToFile(cardName);

  // Check cache first
  if (cache.has(normalized)) return cache.get(normalized);

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
      // exports too.
      if (!mod.hooks && !mod.effects && !mod.isPotion && !mod.isEquip && !mod.isTargetingArtifact && !mod.isReaction && !mod.actionCost && !mod.freeActivation && !mod.heroEffect && !mod.creatureEffect && !mod.equipEffect && !mod.isTargetRedirect && !mod.isSurprise && !mod.resolve && !mod.reduceSpellLevel && !mod.coverLevelGap && !Object.keys(mod).some(k => k.startsWith('is') && mod[k] === true)) {
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
    }
  } catch (err) {
    console.error(`[Loader] Failed to load "${cardName}" (${normalized}.js):`, err.message);
    mod = null;
  }

  cache.set(normalized, mod);
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
