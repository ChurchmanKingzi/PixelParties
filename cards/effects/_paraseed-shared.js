// ═══════════════════════════════════════════
//  SHARED HANDLER: Paraseed (v718)
//
//  Einzige Auslegungsstelle des Archetyps. Hier stehen
//  die vier Fragen, die mehrere Karten gleich
//  beantworten muessen:
//
//    1. Was ist „a \"Paraseed\"\"?
//    2. Welcher Held traegt gerade wie viele davon?
//    3. Wie kommt das unheilbare Gift auf den Wirt —
//       und wieder herunter?
//    4. Wer ist der „attacking or corresponding Hero\",
//       in dessen Zone sich die sterbende Paraseed
//       einnistet?
//
//  Als Rulings (4.9.):
//   • „defeated by a Hero or Creature\" umfasst Attacks,
//     Spells, Helden- und Creature-Effekte sowie
//     Abilities (Occultism), die an einen Helden
//     gebunden sind — ALLES ausser Artifacts und
//     Potions.
//   • „corresponding Hero\" = der Held, in dessen Support
//     Zone die toetende Karte liegt (Spielvokabular 8.8.).
// ═══════════════════════════════════════════

const { hasCardType, ZONES } = require('./_hooks');

const PARASEED_TOKEN = 'Paraseed';
const BLOOM = 'Bloom, the Maniacal Botanist';
const BLOOM_ASCENDED = '"Bloom", the Continent Corruptor';

/**
 * Namensbezug „a \"Paraseed\"\" — Teilstring im GANZEN Kartennamen
 * (Als Regel 8.8.), zusaetzlich auf Creatures eingeschraenkt.
 * „Paraseed Greenhouse\" / „Paraseed Control\" / „Paraseed Zombie\"
 * tragen den Namen ebenfalls, sind aber Spells und koennen nie in
 * einer Support Zone liegen — die Einschraenkung haelt die Absicht
 * des Textes und laesst zugleich eine kuenftige zweite
 * Paraseed-CREATURE automatisch mitzaehlen.
 */
function isParaseedCreature(cardName, engine) {
  if (!cardName || !cardName.includes(PARASEED_TOKEN)) return false;
  const cd = engine?._getCardDB?.()[cardName];
  if (!cd) return false;
  return hasCardType(cd, 'Creature');
}

/** Alle Paraseed-Instanzen in den Support Zones dieses Helden. */
function paraseedsOnHero(engine, physOwner, heroIdx, ignoreInstId) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (ignoreInstId && inst.id === ignoreInstId) continue;
    if (inst.zone !== ZONES.SUPPORT) continue;
    if (inst.heroIdx !== heroIdx) continue;
    // Support Zones haengen PHYSISCH an der Spalte — deshalb `owner`
    // und nicht `controller`: eine per Cross-Side-Platzierung in die
    // Gegenspalte gewanderte Paraseed vergiftet den Helden, unter dem
    // sie liegt, nicht den ihres Kontrolleurs.
    if (inst.owner !== physOwner) continue;
    if (!isParaseedCreature(inst.name, engine)) continue;
    out.push(inst);
  }
  return out;
}

/** Zaehlung fuer die beiden Bloom-Auren. */
function countParaseedsOnHero(engine, physOwner, heroIdx) {
  return paraseedsOnHero(engine, physOwner, heroIdx).length;
}

function heroHasParaseed(engine, physOwner, heroIdx, ignoreInstId) {
  return paraseedsOnHero(engine, physOwner, heroIdx, ignoreInstId).length > 0;
}

/**
 * Gift-Abgleich fuer EINEN Helden. Traegt er mindestens eine
 * Paraseed, ist er vergiftet — unheilbar (Kartentext: „That Hero's
 * Poison cannot be healed\"). Traegt er keine mehr, faellt das Gift
 * ab, das die Paraseed aufgelegt hat („but it is removed when this
 * Creature leaves the Hero's Support Zone\").
 *
 * Der Stempel `_paraseed` unterscheidet unser Gift von fremdem:
 * ein Gift, das Zsos'Ssar aufgelegt hat, ueberlebt den Abgang der
 * Paraseed und bleibt heilbar.
 */
async function syncParaseedPoison(engine, physOwner, heroIdx, ignoreInstId) {
  const hero = engine.gs.players[physOwner]?.heroes?.[heroIdx];
  if (!hero?.name) return;
  // `ignoreInstId`: der Verlass-Hook feuert, BEVOR die Karte aus der
  // Zone ausgebucht ist — die abgehende Instanz wird deshalb beim
  // Zaehlen uebergangen.
  const traegt = heroHasParaseed(engine, physOwner, heroIdx, ignoreInstId);
  const gift = hero.statuses?.poisoned;

  if (traegt) {
    if (gift?._paraseed) return;                     // steht schon
    if (gift) {
      // Fremdes Gift liegt bereits — es wird unheilbar und uebernimmt
      // den Stempel, damit es beim Abgang der Paraseed wieder faellt.
      gift.unhealable = true;
      gift._paraseed = true;
      gift.noAbsorb = true;
      engine.sync();
      return;
    }
    await engine.addHeroStatus(physOwner, heroIdx, 'poisoned', {
      unhealable: true, _paraseed: true, permanent: true,
      // `noAbsorb`: Abfang-Effekte (Resistance) sollen hier keine
      // Ladung verbrennen — das Gift liegt im naechsten Abgleich
      // ohnehin wieder auf (Als Ruling 4.9.).
      noAbsorb: true,
      source: PARASEED_TOKEN, _skipReactionCheck: true,
    });
    return;
  }

  if (gift?._paraseed) {
    // `bypassUnhealable`: die Karte nimmt ihr eigenes Gift zurueck,
    // das ist keine Heilung (dieselbe Ausnahme wie bei Resistance).
    await engine.removeHeroStatus(physOwner, heroIdx, 'poisoned', {
      bypassUnhealable: true,
    });
  }
}

/** Abgleich fuer das ganze Brett — nach Umzuegen und Wiederbelebungen. */
async function syncAllParaseedPoison(engine, ignoreInstId) {
  for (let pi = 0; pi < (engine.gs.players || []).length; pi++) {
    const heroes = engine.gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      await syncParaseedPoison(engine, pi, hi, ignoreInstId);
    }
  }
}

/**
 * „the attacking or corresponding Hero\" (Als Ruling 4.9.).
 *
 * Alles ausser Artifacts und Potions bindet an einen Helden:
 * Attacks und Spells an ihren Wirker, Helden-Effekte an den Helden
 * selbst, Creature-Effekte und Abilities an den Helden, in dessen
 * Zonen die Karte liegt. Genau diesen Helden liefert die Quelle
 * ohnehin als (owner|controller, heroIdx) mit.
 *
 * @returns {{owner:number, heroIdx:number}|null}
 */
function killerHeroOf(engine, source) {
  if (!source) return null;
  const heroIdx = source.heroIdx;
  if (!Number.isInteger(heroIdx) || heroIdx < 0) return null;

  const owner = source.owner ?? source.controller;
  if (!Number.isInteger(owner) || owner < 0) return null;

  // Artifacts und Potions binden NICHT an den Helden (Als Ruling).
  const cd = engine._getCardDB()[source.name];
  if (cd && (hasCardType(cd, 'Artifact') || hasCardType(cd, 'Potion'))) return null;

  // Statusschaden (Poison/Burn) traegt keinen echten Kartennamen und
  // faellt schon oben durch die heroIdx-Pruefung — hier nur noch die
  // Sicherung, dass die Spalte ueberhaupt einen Helden hat.
  const hero = engine.gs.players[owner]?.heroes?.[heroIdx];
  if (!hero?.name) return null;
  return { owner, heroIdx };
}

/** Erste freie Support Zone dieses Helden (place: Heldenzustand egal). */
function freeSlotOnHero(engine, physOwner, heroIdx) {
  const slots = engine.gs.players[physOwner]?.supportZones?.[heroIdx] || [];
  const anzahl = Math.max(3, slots.length);
  for (let si = 0; si < anzahl; si++) {
    if (!slots[si] || slots[si].length === 0) return si;
  }
  return -1;
}

module.exports = {
  PARASEED_TOKEN, BLOOM, BLOOM_ASCENDED,
  isParaseedCreature, paraseedsOnHero, countParaseedsOnHero, heroHasParaseed,
  syncParaseedPoison, syncAllParaseedPoison,
  killerHeroOf, freeSlotOnHero,
};
