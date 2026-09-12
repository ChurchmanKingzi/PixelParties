// ═══════════════════════════════════════════
//  CARD EFFECT: "The Weather Orchestra"
//  Creature (Summoning Magic Lv3 — seit v628, vorher Lv4; 50 HP)
//
//  „This card's level in your hand is reduced by the combined number
//   of all Singing Abilities attached to Heroes on the board. When you
//   summon this Creature, you may choose up to 3 different Artifacts
//   with a combined Cost of exactly 12 from your hand, deck or discard
//   pile and equip them to Heroes on the board without paying their
//   Costs. You may once per turn choose an Artifact equipped to a Hero
//   and send it to the discard pile."
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Level-Rabatt: `reduceCardLevel` auf der HAND-Instanz (Bonegrinder-
//    Vertrag), Wert = Singing-Abilities ALLER Helden BEIDER Seiten
//    (`countAbilitiesForSchool('Singing', …)`).
//  · Beschwoerung (`onPlay` in der Support Zone): Multi-Galerie ueber
//    alle ausruestbaren Artefakte aus Hand, Deck und Discard — je
//    (Name, Quelle) EIN Eintrag, der Spieler waehlt die Quelle selbst
//    (Barker-Muster, Als Vorgabe); `exactBudget: 12` + `distinctNames`
//    (Client-Galerie v628/v629; die Galerie graut alles aus, was die
//    Restsumme ueberschreitet, v630) und serverseitige Nachpruefung
//    (verschiedene Namen, Summe GENAU 12, hoechstens `cap`).
//    Obergrenze `cap` = min(3, freie Support Zones der EIGENEN Helden)
//    (Als Regel 29.8.); gibt es mit den verfuegbaren Karten keine
//    Kombination aus 1..cap verschiedenen Namen mit Summe 12, feuert
//    der Effekt gar nicht (kein Prompt). Dann je Artefakt ein Zielplatz
//    ueber `_orchestra-shared.equipDestinations` (BEIDE Seiten, lebende,
//    nicht eingefrorene Helden, `canEquipToHero`-Gate — Storm Pianos
//    „1 per game" greift hier mit) und das Ausruesten ueber
//    `equipArtifactToHero` (Hook-Kette, Auftritt, kein Gold).
//    Aus dem Discard: die Discard-out-Sperre gilt (Eye of Ren).
//  · Aktiver Effekt (`creatureEffect`, einmal pro Zug): ein Artefakt,
//    das irgendeinem Helden ausgeruestet ist, in den Discard — ueber
//    `actionMoveCard` (Defending the Gate, Instrument-Ausloeser laufen
//    dort). Genau die Zuendung fuer die drei Instrumente.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isEquipArtifact, equipDestinations, equipArtifactToHero } = require('./_orchestra-shared');

const CARD_NAME = 'The Weather Orchestra';
const EXACT_COST = 12;
const MAX_PIECES = 3;

function singingOnBoard(engine) {
  let n = 0;
  for (const ps of engine.gs.players || []) {
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      if (!ps.heroes[hi]?.name) continue;
      n += engine.countAbilitiesForSchool('Singing', ps.abilityZones?.[hi] || []);
    }
  }
  return n;
}

/** Freie Basis-Support-Zones (0-2) der eigenen, lebenden Helden. */
function ownFreeBaseZones(engine, pi) {
  const ps = engine.gs.players[pi];
  let n = 0;
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (!ps.heroes[hi]?.name || ps.heroes[hi].hp <= 0) continue;
    for (let si = 0; si < 3; si++) if (((ps.supportZones[hi] || [])[si] || []).length === 0) n++;
  }
  return n;
}

/** Gibt es eine Teilmenge aus hoechstens `maxN` Werten mit Summe genau `target`? */
function hasExactSubset(costs, target, maxN) {
  const vals = costs.filter(c => c > 0 && c <= target);
  const rec = (start, remaining, left) => {
    if (remaining === 0) return true;
    if (left === 0) return false;
    for (let i = start; i < vals.length; i++) {
      if (vals[i] <= remaining && rec(i + 1, remaining - vals[i], left - 1)) return true;
    }
    return false;
  };
  return rec(0, target, maxN);
}

function equippedArtifactTargets(engine) {
  const db = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    const cd = engine.getEffectiveCardData?.(inst) || db[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact') || hasCardType(cd, 'Creature')) continue;
    const side = inst.controller ?? inst.owner;
    out.push({ id: `equip-${side}-${inst.heroIdx}-${inst.zoneSlot}-${inst.id}`, type: 'equip', owner: side, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
  }
  return out;
}

module.exports = {
  activeIn: ['hand', 'support'],
  creatureEffect: true,

  reduceCardLevel(cardData, engine, ownerIdx, inst) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    if (!inst || inst.zone !== 'hand') return 0;
    return singingOnBoard(engine);
  },

  canActivateCreatureEffect(ctx) {
    return equippedArtifactTargets(ctx._engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const targets = equippedArtifactTargets(engine);
    if (targets.length === 0) return false;
    const picked = await engine.promptEffectTarget(pi, targets, {
      maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
      title: CARD_NAME, description: 'Choose an Artifact equipped to a Hero and send it to the discard pile.',
      confirmLabel: '🎼 Send it!', confirmClass: 'btn-danger', cancellable: true,
    });
    if (!picked || picked.length === 0) return false;
    const hit = targets.find(t => t.id === picked[0]);
    if (!hit?.cardInstance || hit.cardInstance.zone !== 'support') return false;
    await engine.actionMoveCard(hit.cardInstance, 'discard', -1, -1, { source: CARD_NAME });
    engine.log('weather_orchestra_discard', { player: engine.gs.players[pi]?.username, artifact: hit.cardName });
    engine.sync();
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const db = engine._getCardDB();

      // Kandidaten VON UEBERALL (Als Vorgabe 29.8., Barker-Muster): je
      // (Name, Quelle) EIN Eintrag — derselbe Name aus Hand, Discard und
      // Deck erscheint dreimal, der Spieler waehlt die Quelle selbst.
      // „different Artifacts" erzwingt die Galerie mit `distinctNames`.
      const cards = [];
      const add = (name, source) => {
        const cd = db[name];
        if (!cd || !isEquipArtifact(cd) || !((cd.cost || 0) > 0)) return;
        if (cards.some(c => c.name === name && c.source === source)) return;
        cards.push({ name, source, cost: cd.cost || 0 });
      };
      for (const n of (ps.hand || [])) add(n, 'hand');
      for (const n of (ps.discardPile || [])) add(n, 'discard');
      for (const n of (ps.mainDeck || [])) add(n, 'deck');
      cards.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
      if (cards.length === 0) return;

      // Obergrenze (Als Regel 29.8.): min(3, freie Support Zones der EIGENEN
      // Helden). Nur eine freie Zone → nur ein einzelnes Equip mit Kosten
      // genau 12 moeglich.
      const cap = Math.min(MAX_PIECES, ownFreeBaseZones(engine, pi));
      if (cap <= 0) { engine.log('weather_orchestra_no_zone', { player: ps.username }); return; }

      // Machbarkeit: gibt es ueberhaupt eine Kombination aus 1..cap
      // VERSCHIEDENEN Namen mit Summe genau 12? Sonst feuert der Effekt
      // schlicht nicht (kein Prompt).
      const distinctCosts = [...new Map(cards.map(c => [c.name, c.cost])).values()];
      if (!hasExactSubset(distinctCosts, EXACT_COST, cap)) {
        engine.log('weather_orchestra_no_combo', { player: ps.username, cap });
        return;
      }

      const result = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti', cards,
        selectCount: cap, minSelect: 1, costKey: 'cost', exactBudget: EXACT_COST, distinctNames: true,
        title: CARD_NAME,
        description: `Choose up to ${cap} different Artifacts with a combined Cost of EXACTLY ${EXACT_COST} — from your hand, deck or discard pile — and equip them to Heroes on the board for free.`,
        confirmLabel: '🎼 Equip!', confirmClass: 'btn-success', cancellable: true,
      });
      if (!result || result.cancelled) return;
      // Eintraege ueber die Indizes aufloesen (Quelle!); Fallback ueber Namen.
      const idxs = Array.isArray(result.selectedIndices) ? result.selectedIndices
        : (result.selectedCards || []).map(n => cards.findIndex(c => c.name === n));
      const chosen = idxs.map(i => cards[i]).filter(Boolean);
      const names = new Set(chosen.map(c => c.name));
      const total = chosen.reduce((s, c) => s + c.cost, 0);
      // Serverseitige Nachpruefung (CPU-Antworten laufen nicht durch den Client):
      // hoechstens 3, verschiedene Namen, Summe GENAU 12.
      if (chosen.length === 0 || chosen.length > cap || names.size !== chosen.length || total !== EXACT_COST) {
        engine.log('weather_orchestra_invalid', { player: ps.username, total, count: chosen.length });
        return;
      }

      let placed = 0;
      for (const c of chosen) {
        const dests = equipDestinations(engine, pi, c.name, { sides: [0, 1] });
        if (dests.length === 0) continue;
        const zoneTargets = dests.map(d => ({ id: `equip-${d.side}-${d.heroIdx}-${d.slotIdx}`, type: 'equip', owner: d.side, heroIdx: d.heroIdx, slotIdx: d.slotIdx, cardName: '' }));
        let dest = dests[0];
        if (dests.length > 1) {
          const ids = await engine.promptEffectTarget(pi, zoneTargets, {
            maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
            title: `${CARD_NAME} — Equip ${c.name}`, source: CARD_NAME,
            description: `Choose a Support Zone (any Hero on the board) for ${c.name}.`,
            confirmLabel: '🎼 Equip here!', confirmClass: 'btn-success', cancellable: false, greenSelect: true,
            previewCardName: c.name, exclusiveTypes: true, maxPerType: { equip: 1 },
          });
          const hit = ids && zoneTargets.find(t => t.id === ids[0]);
          if (hit) dest = dests.find(d => d.side === hit.owner && d.heroIdx === hit.heroIdx && d.slotIdx === hit.slotIdx) || dests[0];
        }
        const placedInst = await equipArtifactToHero(engine, pi, c.name, dest.side, dest.heroIdx, dest.slotIdx, { from: c.source, source: CARD_NAME });
        if (placedInst) placed++;
      }
      engine.log('weather_orchestra_equip', { player: ps.username, pieces: chosen.map(c => c.name), placed });
      engine.sync();
    },
  },
};
