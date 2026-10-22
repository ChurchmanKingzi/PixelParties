// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Fridge"
//  Normal Artifact — Manual activation only.
//  Choose ANY NUMBER of Equip Artifacts on the board and
//  move them to a different Hero of the same
//  controller (without paying Cost again).
//  Welle 12 (Q102, Al): erst alle Equips + deren Ziel-Zonen
//  wählen, dann werden alle gleichzeitig verschoben.
//
//  Equip detection covers three sources:
//  1. cardDB subtype === 'Equipment'
//  2. inst.counters.treatAsEquip (Initiation Ritual heroes)
//  3. script.isEquip === true (Flying Island, etc.)
//
//  An equip is only eligible if its controller
//  has another living Hero with a free base
//  Support Zone (slots 0–2, not island zones).
//
//  ★ W50a (Al, 22.10.2026): Erkennung, Zielhelden/-zonen und das Verschieben
//  stehen in `_equip-shared.js` (Baustein fuer Fridge UND Inheritance
//  Ceremony). Die Fridge bleibt die Karte mit der freien Heldenwahl: Quell-
//  und Zielheld gehoeren demselben Spieler, das darf auch der GEGNER sein.
//  Details: CARD_API „Welle 50 / W50a", Punkt 2.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const {
  istEquipKartenname, istUmhaengbaresEquip, umhaengZielHelden, umhaengFreieZonen, fuehreUmhaengenAus,
} = require('./_equip-shared');

// ★ W50a (Al, 22.10.2026): Erkennung, Zielhelden/-zonen und das Verschieben selbst stehen jetzt in `_equip-shared.js` (EIN Baustein fuer Slippery Fridge
// und Inheritance Ceremony: „Der Equip-Artifact-Teil sollte bei Ceremony genauso funktionieren wie bei Fridge"). Fridge bleibt die Karte mit der
// freien Heldenwahl: Quell- und Zielheld gehoeren demselben Spieler, das darf auch der GEGNER sein (Ceremony: nur eigene Helden).
// Neu fuer die Fridge gegenueber W49: versiegelte Zonen (Madame Guillotine) und Zonensperren (Puppets) zaehlen nicht als frei; Quell- und Zielheld muessen
// vom selben Spieler KONTROLLIERT werden (Charme/Uebernahme); die bewegte Ausruestung bekommt `_isMove` (Einmal-Wirkungen beim Anlegen feuern nicht neu);
// das Equip-Fenster (Afflicted Pests …) oeffnet fuer den AUSFUEHRENDEN der Fridge als Ausruestenden.

/** Zonen, in die ein Zielheld das Equip aufnehmen kann: leer, nicht versiegelt, nicht gesperrt. */
function _umhaengZiele(engine, inst, opts) {
  return umhaengZielHelden(engine, inst, opts);
}

function _findEligibleEquips(gs, engine) {
  const eligible = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (!istUmhaengbaresEquip(engine, inst)) continue;
    const ps = gs.players[engine.physicalSide(inst)];
    if (!ps) continue;
    const hero = ps.heroes?.[inst.heroIdx];
    if (!hero?.name || hero.hp <= 0) continue;
    if (_umhaengZiele(engine, inst).length === 0) continue;
    eligible.push(inst);
  }
  return eligible;
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi, engine) {
    // Erst-Runden-Immunität (Als Regel): Fridge bleibt in Runde 1
    // spielbar, aber NUR auf eigene Equips — die Karten des geschützten
    // Spielers sind unantastbar. Ohne diese Zeile meldete das Gate
    // "spielbar", weil es fremde Equips mitzählte, während der zentrale
    // Ziel-Filter sie im Picker anschließend entfernt hätte: Karte
    // gespielt, Gold weg, leerer Picker.
    const ftProtected = gs.firstTurnProtectedPlayer;
    if (!engine) return false;
    return _findEligibleEquips(gs, engine).some(inst => {
      const seite = engine.physicalSide(inst);
      return !(ftProtected != null && seite === ftProtected && pi !== ftProtected);
    });
  },

  animationType: 'none',

  // ── CPU-Auswahl (cpuResponse-Intercept, Muster Slippery Pengu) ─────
  // Fridge hatte KEINE eigene CPU-Logik — beide Prompts beantwortete der
  // generische Responder, dessen Bewertung Ascension-Fortschritt nicht
  // kennt. Live-Folge (Shadows over Blackport): Fridge zog Equips VON
  // Arthor weg, statt das zweite Ascension-Equip ZU ihm zu schieben.
  // Politik, in Prioritätsreihenfolge:
  //   1. VOLLENDER: Ein eigenes Equip, das ein anderer eigener Held für
  //      seine Ascension braucht (ascensionNeedsCard), wird dorthin
  //      bewegt — Arthors Circle von Jenny zu Arthor.
  //   2. SABOTAGE: Ein gegnerisches Ascension-Item (ascensionItems des
  //      nicht-aufgestiegenen Trägers) wird von diesem weggezogen.
  //   3. TRÄGER-SCHUTZ: Eigene Ascension-Items werden NIE vom
  //      nicht-aufgestiegenen Träger wegbewegt.
  //   4. Rest: Ziel per gelerntem equipPlacementBonus, sonst uniform.
  // Keine Rollouts — läuft in MCTS-Sims identisch und billig.
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const config = payload?.config;
    const title = config?.title || '';
    const validTargets = payload?.validTargets || [];
    const pi = payload?.playerIdx;
    if (typeof pi !== 'number') return undefined;
    const gs = engine.gs;

    const heroScript = (owner, hi) => {
      const name = gs.players?.[owner]?.heroes?.[hi]?.name;
      if (!name) return null;
      try { return loadCardEffect(name); } catch { return null; }
    };
    const heroAlive = (owner, hi) => {
      const h = gs.players?.[owner]?.heroes?.[hi];
      return !!(h?.name && h.hp > 0);
    };
    const needsForAscension = (owner, hi, equipName) => {
      if (!heroAlive(owner, hi)) return false;
      const script = heroScript(owner, hi);
      if (typeof script?.ascensionNeedsCard !== 'function') return false;
      try { return !!script.ascensionNeedsCard(equipName, null, engine, owner, hi); }
      catch { return false; }
    };
    const isProtectedOnBearer = (owner, hi, equipName) => {
      if (!heroAlive(owner, hi)) return false;
      const script = heroScript(owner, hi);
      return Array.isArray(script?.ascensionItems) && script.ascensionItems.includes(equipName);
    };
    const someOtherHeroNeeds = (owner, srcHi, equipName) => {
      for (let hi = 0; hi < (gs.players?.[owner]?.heroes || []).length; hi++) {
        if (hi === srcHi) continue;
        if (needsForAscension(owner, hi, equipName)) return hi;
      }
      return -1;
    };

    // ── Phase 1: Equip-Wahl ──
    if (title === 'Slippery Fridge') {
      const equips = validTargets.filter(t => t.type === 'equip');
      if (equips.length === 0) return [];
      // Priorität 1: eigener Vollender-Move
      for (const t of equips) {
        if (t.owner !== pi) continue;
        if (someOtherHeroNeeds(t.owner, t.heroIdx, t.cardName) >= 0) return [t.id];
      }
      // Priorität 2: Gegner-Sabotage (Ascension-Item vom Träger wegziehen)
      for (const t of equips) {
        if (t.owner === pi) continue;
        if (isProtectedOnBearer(t.owner, t.heroIdx, t.cardName)) return [t.id];
      }
      // Priorität 3: Träger-Schutz — geschützte eigene Equips aus dem Pool
      const pool = equips.filter(t => !(t.owner === pi && isProtectedOnBearer(t.owner, t.heroIdx, t.cardName)));
      if (pool.length === 0) return []; // nichts Sinnvolles → cancel, Karte bleibt in der Hand
      return [pool[Math.floor(Math.random() * pool.length)].id];
    }

    // ── Phase 2: Ziel-Wahl ──
    if (title.startsWith('Slippery Fridge — Move ')) {
      const equipName = title.slice('Slippery Fridge — Move '.length);
      const heroTargets = validTargets.filter(t => t.type === 'hero');
      const pickFor = (hi) => {
        const h = heroTargets.find(t => t.heroIdx === hi);
        if (h) return [h.id];
        const z = validTargets.find(t => t.type === 'equip' && t.heroIdx === hi);
        return z ? [z.id] : null;
      };
      const owner = (heroTargets[0] || validTargets[0])?.owner;
      // Vollender: der Held, der das Equip für seine Ascension braucht
      if (typeof owner === 'number') {
        for (const t of heroTargets.length ? heroTargets : validTargets) {
          if (needsForAscension(owner, t.heroIdx, equipName)) {
            const picked = pickFor(t.heroIdx);
            if (picked) return picked;
          }
        }
      }
      // Gelernte Platzierungs-Priors (nur für eigene Moves sinnvoll)
      if (owner === pi) {
        let deckProfile = null;
        try { deckProfile = require('./_deck-profile'); } catch {}
        if (deckProfile) {
          let bestHi = -1, bestV = 4; // Schwelle wie pickHeroForEquip
          const his = [...new Set(validTargets.map(t => t.heroIdx))];
          for (const hi of his) {
            const heroName = gs.players?.[pi]?.heroes?.[hi]?.name;
            if (!heroName) continue;
            const v = deckProfile.equipPlacementBonus(engine, pi, equipName, heroName);
            if (v > bestV) { bestV = v; bestHi = hi; }
          }
          if (bestHi >= 0) {
            const picked = pickFor(bestHi);
            if (picked) return picked;
          }
        }
      }
      // Fallback: uniform
      const t = validTargets[Math.floor(Math.random() * validTargets.length)];
      return t ? [t.id] : [];
    }

    return undefined;
  },

  // ── RESOLVE ────────────────────────────
  // Welle 12 (Q102, Al: „Ja, soll mehrere verschieben können. Das Prozedere ist: Erst alle Equips und deren Ziel-Zonen auswählen, dann werden
  // alle gleichzeitig verschoben."): ANY NUMBER of equipped Artifacts. Ablauf:
  //   1. Equip-Wahl (mehrere, abbrechbar — der Abbruch ist nur VOR der ersten Wahl möglich, Karte bleibt dann in der Hand);
  //   2. je gewähltem Equip eine Ziel-Zone (Pflichtwahl, nicht abbrechbar): freie Basiszone eines ANDEREN lebenden Helden desselben Spielers;
  //      bereits für ein anderes Equip gewählte Zonen sind belegt, Zonen, die durch die Wahl frei werden, zählen als frei (gleichzeitig);
  //   3. erst jetzt werden ALLE verschoben (zuerst alle Abgänge, dann alle Ankünfte): Boni wandern wie bisher (Welle 5).
  // Hat ein gewähltes Equip keine freie Zone mehr, bleibt es liegen.
  resolve: async (engine, pi) => {
    const gs = engine.gs;

    // ── Step 1: Find eligible equips ──
    const eligible = _findEligibleEquips(gs, engine);
    if (eligible.length === 0) return { cancelled: true }; // Fizzle — no valid targets

    const equipTargets = eligible.map(inst => ({
      id: `equip-${engine.physicalSide(inst)}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: engine.physicalSide(inst),
      heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot,
      cardName: inst.name,
      cardInstance: inst,
    }));

    // ── Step 2: Select the equips to move (cancellable — only here, before the first choice) ──
    const pickedIds = await engine.promptEffectTarget(pi, equipTargets, {
      maxTotal: equipTargets.length,   // „any number of Artifacts"
      title: 'Slippery Fridge',
      description: 'Select any number of equipped Artifacts to move.',
      confirmLabel: '🧊 Select!',
      confirmClass: 'btn-info',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: equipTargets.length },
    });

    if (!pickedIds || pickedIds.length === 0) return { cancelled: true };

    const gewaehlt = [];
    for (const id of pickedIds) {
      const t = equipTargets.find(q => q.id === id);
      if (t && !gewaehlt.includes(t.cardInstance)) gewaehlt.push(t.cardInstance);
    }
    if (gewaehlt.length === 0) return true;

    // ── Step 3: Destination per equip (mandatory) — all choices first, nothing moves yet ──
    // Zonen, die durch diese Wahl frei werden (Quellplätze der gewählten Equips), zählen als frei (gleichzeitiges Verschieben).
    const wirdFrei = (owner, hi, si) => gewaehlt.some(g => engine.physicalSide(g) === owner && g.heroIdx === hi && g.zoneSlot === si);
    const reserviert = new Set();   // `${seite}:${hi}:${si}`

    const plan = [];   // { inst, owner, srcHeroIdx, srcSlot, destHeroIdx, destSlot }
    for (const inst of gewaehlt) {
      const equipOwner = engine.physicalSide(inst);
      const srcHeroIdx = inst.heroIdx;
      const srcSlot = inst.zoneSlot;

      const heldenZiele = _umhaengZiele(engine, inst, { wirdFrei, reserviert });
      const destTargets = [];
      for (const z of heldenZiele) {
        for (const si of z.freie) {
          destTargets.push({
            id: `equip-${equipOwner}-${z.heroIdx}-${si}`,
            type: 'equip',
            owner: equipOwner,
            heroIdx: z.heroIdx,
            slotIdx: si,
            cardName: '',
          });
        }
        // Also allow clicking the hero directly (auto-picks first free slot)
        destTargets.push({
          id: `hero-${equipOwner}-${z.heroIdx}`,
          type: 'hero',
          owner: equipOwner,
          heroIdx: z.heroIdx,
          cardName: z.hero.name,
        });
      }

      if (destTargets.length === 0) continue; // keine freie Zone mehr — dieses Equip bleibt liegen

      const destIds = await engine.promptEffectTarget(pi, destTargets, {
        maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
        title: `Slippery Fridge — Move ${inst.name}`,
        description: `Select a Support Zone to move ${inst.name} to.`,
        confirmLabel: '🧊 Move!',
        confirmClass: 'btn-info',
        cancellable: false,
        greenSelect: true,
        exclusiveTypes: false,
        maxPerType: { hero: 1, equip: 1 },
      });

      if (!destIds || destIds.length === 0) continue; // Safety

      const dest = destTargets.find(t => t.id === destIds[0]);
      if (!dest) continue;

      let destHeroIdx, destSlot;
      if (dest.type === 'equip') {
        destHeroIdx = dest.heroIdx;
        destSlot = dest.slotIdx;
      } else {
        destHeroIdx = dest.heroIdx;
        const freeZones = umhaengFreieZonen(engine, equipOwner, destHeroIdx, { cardName: inst.name, instId: inst.id, wirdFrei, reserviert });
        if (freeZones.length === 0) continue;
        destSlot = freeZones[0];
      }
      reserviert.add(`${equipOwner}:${destHeroIdx}:${destSlot}`);
      plan.push({ inst, owner: equipOwner, srcHeroIdx, srcSlot, destHeroIdx, destSlot });
    }

    if (plan.length === 0) return true; // Fizzle

    // ── Step 4: Execute — ALLE gleichzeitig (gemeinsamer Baustein mit Inheritance Ceremony) ──
    await fuehreUmhaengenAus(engine, plan, { anleger: pi, logType: 'slippery_fridge_move' });

    engine.sync();
    return true;
  },
};
