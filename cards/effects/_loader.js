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

      // Validate minimum structure
      if (!mod.hooks && !mod.effects && !mod.isPotion && !mod.isEquip && !mod.isTargetingArtifact && !mod.isReaction) {
        console.warn(`[Loader] Card "${cardName}" (${normalized}.js) has no hooks, effects, or card type flags — ignored.`);
        mod = null;
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
