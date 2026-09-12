// ═══════════════════════════════════════════
//  Shared helpers for the Lolek family (v659).
//
//  Beide Formen ruesten „equippable Artifacts" aus Stapeln aus:
//    · Shard Knight: aus dem Discard, gegen den halben Preis.
//    · Mender: aus Deck ODER Discard, gratis, auf jeden eigenen Helden.
//  Der Vorgang steht EINMAL hier — Galerie (je Name+Quelle ein
//  Eintrag, Barker-Muster), Zielplatz ueber `equipDestinations`, das
//  Ausruesten ueber `equipArtifactToHero` (_orchestra-shared, v628:
//  entnimmt, legt, trackt, animiert, feuert onPlay/onCardEnterZone,
//  Discard-out-Sperre inklusive).
//
//  Aufstieg (Fiona-Muster, nicht Arthor): der BASIS-Held pflegt seine
//  Bereitschaft selbst ueber Enter/Leave seiner Support Zones, damit
//  „Diver Helmet" (bereits gebaut) nicht angefasst werden muss. Die
//  Bedingung steht nur hier; die Mender-Karte fragt sie ueber
//  `ascensionCondition` ab.
// ═══════════════════════════════════════════

const { isEquipArtifact, equipDestinations, equipArtifactToHero } = require('./_orchestra-shared');

const BASE_LOLEK    = 'Lolek, the Shard Knight';
const ASCEND_TARGET = 'Lolek, Mender of the Shattered Trident';
const TRIDENT_NAME  = 'Shattered Trident, Treasure of the Deepsea';
const HELMET_NAME   = 'Diver Helmet';

/** Halber Preis, aufgerundet — wie „Spirit of the Shattered Trident" es ausschreibt. */
function halfCost(cd) {
  return Math.ceil((cd?.cost || 0) / 2);
}

/**
 * Ausruestbare Artefakte aus den genannten Stapeln, je (Name, Quelle)
 * EIN Eintrag. `filter(name, cd, source)` kann Eintraege ausschliessen
 * (z.B. unbezahlbar).
 */
function equippableEntries(engine, pi, sources, filter) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const out = [];
  for (const source of sources) {
    const pool = source === 'deck' ? ps.mainDeck : source === 'discard' ? ps.discardPile : ps.hand;
    const seen = new Set();
    for (const name of (pool || [])) {
      if (seen.has(name)) continue;
      const cd = cardDB[name];
      if (!isEquipArtifact(cd)) continue;
      if (filter && !filter(name, cd, source)) continue;
      seen.add(name);
      out.push({ name, source });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

/** Kann `cardName` ueberhaupt irgendwo bei `pi` angelegt werden? */
function hasDestination(engine, pi, cardName) {
  return equipDestinations(engine, pi, cardName, { sides: [pi] }).length > 0;
}

/**
 * Galerie → Zielplatz → (Kosten) → Ausruesten.
 *
 * @param {object} opts
 *   title, description, confirmLabel, source (stabiler Galerie-`source`
 *   fuers CPU-Tutor-Lernen), costOf(name, cd) → Gold (optional).
 * @returns {boolean} true = ausgeruestet (HOPT verdient), false = Abbruch.
 */
async function chooseAndEquip(engine, pi, entries, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps || entries.length === 0) return false;
  const cardDB = engine._getCardDB();

  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: entries.map(e => ({ name: e.name, source: e.source })),
    title: opts.title,
    source: opts.source || opts.title,
    description: opts.description,
    confirmLabel: opts.confirmLabel || '🔱 Equip!',
    cancellable: true,
  });
  if (!picked || picked.cancelled || !picked.cardName) return false;
  const entry = entries.find(e => e.name === picked.cardName && e.source === picked.source)
    || entries.find(e => e.name === picked.cardName);
  if (!entry) return false;
  const cd = cardDB[entry.name];
  const cost = typeof opts.costOf === 'function' ? (opts.costOf(entry.name, cd) || 0) : 0;
  if (cost > 0 && !engine.canAffordGold(pi, cost, entry.name)) return false;

  const dests = equipDestinations(engine, pi, entry.name, { sides: [pi] });
  if (dests.length === 0) return false;
  let dest = dests[0];
  if (dests.length > 1) {
    const zoneTargets = dests.map(d => ({
      id: `equip-${d.side}-${d.heroIdx}-${d.slotIdx}`, type: 'equip',
      owner: d.side, heroIdx: d.heroIdx, slotIdx: d.slotIdx, cardName: '',
    }));
    const ids = await engine.promptEffectTarget(pi, zoneTargets, {
      maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
      title: `${opts.title} — Equip ${entry.name}`, source: opts.source || opts.title,
      description: cost > 0
        ? `Choose a Support Zone for ${entry.name} (pay ${cost} Gold).`
        : `Choose a Support Zone for ${entry.name}.`,
      confirmLabel: '🔱 Equip here!', confirmClass: 'btn-success',
      cancellable: true, greenSelect: true,
      previewCardName: entry.name, exclusiveTypes: true, maxPerType: { equip: 1 },
    });
    const hit = ids && zoneTargets.find(t => t.id === ids[0]);
    if (!hit) return false;
    dest = dests.find(d => d.side === hit.owner && d.heroIdx === hit.heroIdx && d.slotIdx === hit.slotIdx) || dests[0];
  }

  // Kosten erst, wenn der Platz steht — ein Abbruch kostet nichts.
  if (cost > 0) {
    await engine._payCardCost(pi, cost, { cardName: entry.name });
    engine._broadcastEvent('gold_change', { owner: pi, amount: -cost });
  }
  const inst = await equipArtifactToHero(engine, pi, entry.name, dest.side, dest.heroIdx, dest.slotIdx, {
    from: entry.source, source: opts.source || opts.title,
  });
  if (!inst) {
    // Discard-out-Sperre abgelehnt o.ae. — Gold zurueck.
    if (cost > 0) { ps.gold = (ps.gold || 0) + cost; engine._broadcastEvent('gold_change', { owner: pi, amount: cost }); }
    return false;
  }
  engine.log('lolek_equip', {
    player: ps.username, card: entry.name, from: entry.source, cost,
    hero: gs.players[dest.side]?.heroes?.[dest.heroIdx]?.name, by: opts.title,
  });
  return true;
}

// ─── Aufstieg ─────────────────────────────────────────────────────────

function findBaseLolek(engine, pi, heroIdx) {
  let hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  let actualOwner = pi;
  if (!hero || hero.name !== BASE_LOLEK) {
    hero = null;
    for (let p = 0; p < 2; p++) {
      const h = engine.gs.players[p]?.heroes?.[heroIdx];
      if (h?.name === BASE_LOLEK) { hero = h; actualOwner = p; break; }
    }
  }
  return hero ? { hero, actualOwner } : null;
}

function hasEquipped(engine, owner, heroIdx, name, excludeInstId) {
  return engine.cardInstances.some(c =>
    c.id !== excludeInstId && c.owner === owner && c.zone === 'support'
    && c.heroIdx === heroIdx && (c.counters?._effectOverride || c.name) === name);
}

/** Gedruckte Bedingung: lebende Basis-Lolek + Trident + Diver Helmet. */
function lolekAscensionMet(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseLolek(engine, pi, heroIdx);
  if (!found || found.hero.hp <= 0) return false;
  return hasEquipped(engine, found.actualOwner, heroIdx, TRIDENT_NAME, excludeInstId)
    && hasEquipped(engine, found.actualOwner, heroIdx, HELMET_NAME, excludeInstId);
}

function checkLolekAscension(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseLolek(engine, pi, heroIdx);
  if (!found) return;
  const { hero } = found;
  if (lolekAscensionMet(engine, pi, heroIdx, excludeInstId)) {
    hero.ascensionReady   = true;
    hero.ascensionTarget  = ASCEND_TARGET;
    hero.ascensionTargets = [ASCEND_TARGET];
  } else {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

module.exports = {
  BASE_LOLEK, ASCEND_TARGET, TRIDENT_NAME, HELMET_NAME,
  halfCost, equippableEntries, hasDestination, chooseAndEquip,
  lolekAscensionMet, checkLolekAscension, hasEquipped,
};
