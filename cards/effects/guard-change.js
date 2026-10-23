// ═══════════════════════════════════════════
//  CARD EFFECT: "Guard Change"
//  Spell (Support Magic, Lv1, Normal)
//
//  "Choose any number of Creatures you control (min. 1) and place
//   them into free Support Zones of other Heroes you control. You can
//   also swap Creatures between Heroes you control. If the user has
//   at least Support Magic 2, this counts as an additional Action.
//   You can only play 1 "Guard Change" per turn."
//
//  ── Movement system ─────────────────────────────────────────────
//  A broader cousin of the Slippery archetype's interactive mover
//  (`_slippery-shared`): same click-a-Creature → click-a-destination
//  flow and `play_card_transfer` flight, but
//    • destinations are NOT restricted to neighbouring Heroes — any
//      free Support Zone on ANY OTHER Hero you control is legal;
//    • a Creature may instead be SWAPPED with another Creature on a
//      different Hero (both fly to their new zones simultaneously);
//    • each Creature may only be moved OR swapped once per cast.
//  Driven by the `guardChangeMove` prompt (frontend reuses the
//  Slippery render path, extended with swap highlighting).
//
//  ── Kontrolle statt Brettseite (W18b, Al 19.10.2026) ────────────
//  „Ja, sie dürfen bewegt werden (und eigene in die Zonen temporär
//   gestohlener Heroes). Es gibt ja bereits Funktionalität für
//   Creatures, die nicht auf der Seite ihres permanenten Kontrolleurs
//   sind." Angeboten werden alle Kreaturen, die ich KONTROLLIERE
//   (auch gestohlene/seitenfremde, `kontrolleurVon`), und alle freien
//   Zonen der Helden, die ich kontrolliere (eigene Spalte ohne die
//   abgegebenen, plus übernommene Helden der Gegenspalte,
//   `getFreeSupportZones(…, { nachKontrolle: true })`). Wechselt eine
//   Kreatur dabei die Brettseite, bleibt ihr Kontrolleur; `inst.owner`
//   folgt der Zone und die Seitenfremd-Marke (`crossSideControlled`)
//   wird passend gesetzt/gelöscht (`seiteWechseln`). Eine zeitweilig
//   gestohlene Kreatur, die auf meiner Seite landet, bleibt dort; mit
//   dem Ende des Diebstahls gehört sie wieder dem Besitzer und ist
//   dann seitenfremd (`_revertStolenCreatures`).
//
//  ── Action economy ──────────────────────────────────────────────
//  "If the user has at least Support Magic 2, this counts as an
//   additional Action." Modelled exactly like Shapeshift: dynamic
//   `inherentAction` (Main-Phase self-provide) + `_spellFreeAction`
//   (Action-Phase slot refund) when the casting Hero's Support Magic
//   level ≥ 2 (Performance on Support Magic counts via the engine
//   helper).
//
//  "You can only play 1 Guard Change per turn" — the HOPT registry
//  (`guard-change:<pi>`), claimed only AFTER ≥1 Creature actually
//  moved so a min-1 cancel doesn't burn the turn's use.
// ═══════════════════════════════════════════

const { hasCardType, kontrollRechteVon } = require('./_hooks');

const CARD_NAME = 'Guard Change';
const HOPT_KEY  = 'guard-change';

/** Casting Hero's Support Magic level (base + Performance wildcard). */
function supportMagicLevel(engine, pi, heroIdx) {
  if (!engine || heroIdx == null || heroIdx < 0) return 0;
  return engine.effectiveSchoolLevelForCaster('Support Magic', pi, heroIdx, pi);   // W4a: harte Negierung -> Stufe 0; W16g (S02-18): + Xals Support-Zonen-Stapel
}

/** Own support-zone CREATURE instances (NOT Equip Artifacts, which
 *  also live in Support Zones). Mirrors the engine's own
 *  support-creature gate: skip `treatAsEquip` and require an
 *  effective cardType of Creature. */
function ownSupportCreatures(engine, pi) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (engine.kontrolleurVon(inst) !== pi) continue;
    // W18b (Al 19.10., kehrt W16g um): auch gestohlene/seitenfremde Kreaturen (Kontrolle bei `pi`, Platz auf der Gegenseite) werden
    // angeboten; `moveCreature`/`swapCreatures` arbeiten über die Brettseite (`physicalSide`).
    if (inst.counters?.treatAsEquip) continue; // Equip Artifact, not a Creature
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

/** W18b: Gehört die Zone (Brettseite `seite`, Held `hi`) einem Helden, den `pi` kontrolliert? Eigene Spalte wie bisher (auch leere/tote
 *  Spalten — Kreaturen sind unabhängig von ihrem Helden), ausgenommen die an den Gegner abgegebenen Helden; Gegenspalte nur bei übernommenen Helden. */
function heldKontrolliert(engine, pi, seite, hi) {
  const hero = engine.gs.players[seite]?.heroes?.[hi];
  if (seite === pi) return !(hero?.name && engine.heroSideOf(pi, hero) !== pi);
  return !!hero?.name && engine.heroSideOf(seite, hero) === pi && kontrollRechteVon(hero).beschwoeren;
}

/** Free Support slots on every OTHER Hero I control (any column — not neighbour-restricted), eigene Spalte zuerst, dann übernommene
 *  Helden der Gegenseite. Jede Zone nennt ihre Brettseite (`owner`). */
function destsFor(engine, pi, inst) {
  const ps = engine.gs.players[pi];
  const aSeite = engine.physicalSide(inst);
  const out = [];
  for (let hi = 0; hi < 3; hi++) {
    if (aSeite === pi && hi === inst.heroIdx) continue;   // "other Heroes"
    if (!heldKontrolliert(engine, pi, pi, hi)) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) out.push({ owner: pi, heroIdx: hi, slotIdx: zi });
    }
  }
  for (const z of engine.getFreeSupportZones(pi, { nachKontrolle: true })) {
    if (z.owner === pi) continue;                           // eigene Spalte oben
    if (aSeite === z.owner && z.heroIdx === inst.heroIdx) continue;
    if (z.slotIdx >= 3) continue;                           // Insel-Zonen bleiben wie bisher draußen
    out.push({ owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx });
  }
  // ★ W63a (Al, 22.10.2026: „Solange der Effekt aktiv ist, kann eine Creature in eine geteilte Zone bewegt werden"): mit Alice-Teilung des Kontrolleurs auch die
  // Zone einer GLEICHNAMIGEN Creature eines ANDEREN Helden (`engine.beschwoerZonenFuer`, nach Kontrolle) — die Creatures teilen sich die Zone. Geteilte Zonen
  // stehen vorn (Al: erst die geteilte Zone, DANN die erste leere).
  const geteilt = engine.beschwoerZonenFuer(pi, inst.name, { nachKontrolle: true })
    .filter(z => z.shared && z.slotIdx < 3 && !(aSeite === z.owner && z.heroIdx === inst.heroIdx))
    .map(z => ({ owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx, shared: true }));
  return geteilt.length ? [...geteilt, ...out] : out;
}

/**
 * Build the movable-Creature list for the prompt. `movedIds` =
 * Creatures already moved/swapped this cast (each only once).
 */
function collectMovable(engine, pi, movedIds) {
  const creatures = ownSupportCreatures(engine, pi).filter(c => !movedIds.has(c.id));
  const list = [];
  for (const inst of creatures) {
    const dests = destsFor(engine, pi, inst);
    // Swap partners: another not-yet-moved own Creature on a
    // DIFFERENT Hero ("swap Creatures between Heroes you control").
    // W18b: beide Zonen müssen zu Helden gehören, die ich kontrolliere, und auf verschiedenen Helden liegen (Seite + Spalte).
    const aSeite = engine.physicalSide(inst);
    const swaps = !heldKontrolliert(engine, pi, aSeite, inst.heroIdx) ? [] : creatures
      .filter(o => o.id !== inst.id
        && !(engine.physicalSide(o) === aSeite && o.heroIdx === inst.heroIdx)
        && heldKontrolliert(engine, pi, engine.physicalSide(o), o.heroIdx)
        && tauschOhneMischung(engine, inst, o))   // W63a: ein Tausch mischt nie verschiedene Namen in einer geteilten Zone
      .map(o => o.id);
    if (dests.length === 0 && swaps.length === 0) continue;
    list.push({ inst, dests, swaps });
  }
  return list;
}

/**
 * ★ W63a: Beim TAUSCH zweier Kreaturen darf in keiner Zone eine Mischung verschiedener Namen entstehen. Liegt eine der beiden in einem Alice-Stapel
 * (Zone mit mehreren Kreaturen), bliebe dort nach dem Heraustauschen ein Namensgleiches zurueck — die ungleichnamige Tauschpartnerin koennte nicht
 * dazu. Getauscht wird also nur, wenn beide allein in ihrer Zone liegen oder beide denselben Namen tragen.
 */
function tauschOhneMischung(engine, a, b) {
  if (a.name === b.name) return true;
  const { stackAt } = require('./_alice-shared');
  const tiefe = (x) => stackAt(engine, engine.kontrolleurVon(x), x.heroIdx, x.zoneSlot, engine.physicalSide(x)).length;   // nur Kreaturen (keine Anhaengsel)
  return tiefe(a) <= 1 && tiefe(b) <= 1;
}

/** W18b: `inst` steht jetzt in einer Zone der Brettseite `neueSeite`. Der Kontrolleur bleibt; `owner` = Brettseite, die Seitenfremd-Marke
 *  (`crossSideControlled`) gilt genau dann, wenn Kontrolleur und Brettseite auseinanderfallen (Muster `actionTransferCreature`). */
function seiteWechseln(engine, inst, neueSeite) {
  inst.owner = neueSeite;
  inst.counters = inst.counters || {};
  const k = engine.kontrolleurVon(inst);
  if (k !== neueSeite) inst.counters.crossSideControlled = k;
  else delete inst.counters.crossSideControlled;
}

/** Single move: `inst` → a free slot on another Hero I control (destOwner = Brettseite der Zone). Mirrors the Slippery mover's
 *  animation/flow (creature_zone_move floater suppression + play_card_transfer flight + _isMove enter hook). */
async function moveCreature(engine, pi, inst, destOwner, destHeroIdx, destSlot) {
  const aSeite = engine.physicalSide(inst);
  const ps = engine.gs.players[aSeite];
  const dps = engine.gs.players[destOwner];
  if (!ps || !dps) return false;
  const sH = inst.heroIdx, sS = inst.zoneSlot;
  const sArr = (ps.supportZones?.[sH] || [])[sS] || [];
  const sIdx = sArr.indexOf(inst.name);
  if (sIdx < 0) return false;
  if (((dps.supportZones?.[destHeroIdx] || [])[destSlot] || []).length > 0
      && !require('./_alice-shared').canShareInto(engine, engine.kontrolleurVon(inst), destHeroIdx, destSlot, inst.name, destOwner)) return false;   // W63a: belegt nur ok, wenn geteilt (Alice)

  engine._broadcastEvent('creature_zone_move', { owner: aSeite, heroIdx: sH, zoneSlot: sS });
  sArr.splice(sIdx, 1);
  engine._broadcastEvent('play_card_transfer', {
    sourceOwner: aSeite, sourceHeroIdx: sH, sourceZoneSlot: sS,
    targetOwner: destOwner, targetHeroIdx: destHeroIdx, targetZoneSlot: destSlot,
    cardName: inst.name, duration: 500, particles: null,
  });
  engine.sync();
  await engine._delay(420);

  if (!dps.supportZones[destHeroIdx]) dps.supportZones[destHeroIdx] = [[], [], []];
  if (!dps.supportZones[destHeroIdx][destSlot]) dps.supportZones[destHeroIdx][destSlot] = [];
  dps.supportZones[destHeroIdx][destSlot].push(inst.name);
  inst.heroIdx = destHeroIdx;
  inst.zoneSlot = destSlot;
  if (destOwner !== aSeite) seiteWechseln(engine, inst, destOwner);
  engine.sync();

  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
    _skipReactionCheck: true, _isMove: true,
  });
  return true;
}

/** Swap two Creatures on different Heroes — BOTH fly to their new
 *  zones at the same time (both transfers broadcast before the
 *  shared delay, then both placed). W18b: auch über die Brettseiten hinweg. */
async function swapCreatures(engine, pi, a, b) {
  const aSeite = engine.physicalSide(a), bSeite = engine.physicalSide(b);
  const aPs = engine.gs.players[aSeite], bPs = engine.gs.players[bSeite];
  if (!aPs || !bPs) return false;
  const aH = a.heroIdx, aS = a.zoneSlot, bH = b.heroIdx, bS = b.zoneSlot;
  const aArr = (aPs.supportZones?.[aH] || [])[aS] || [];
  const bArr = (bPs.supportZones?.[bH] || [])[bS] || [];
  const aIdx = aArr.indexOf(a.name);
  const bIdx = bArr.indexOf(b.name);
  if (aIdx < 0 || bIdx < 0) return false;

  engine._broadcastEvent('creature_zone_move', { owner: aSeite, heroIdx: aH, zoneSlot: aS });
  engine._broadcastEvent('creature_zone_move', { owner: bSeite, heroIdx: bH, zoneSlot: bS });
  aArr.splice(aIdx, 1);
  bArr.splice(bIdx, 1);
  // Simultaneous: A → B's slot, B → A's slot (both overlays animate
  // concurrently — onCardTransfer keys each by a unique id).
  engine._broadcastEvent('play_card_transfer', {
    sourceOwner: aSeite, sourceHeroIdx: aH, sourceZoneSlot: aS,
    targetOwner: bSeite, targetHeroIdx: bH, targetZoneSlot: bS,
    cardName: a.name, duration: 500, particles: null,
  });
  engine._broadcastEvent('play_card_transfer', {
    sourceOwner: bSeite, sourceHeroIdx: bH, sourceZoneSlot: bS,
    targetOwner: aSeite, targetHeroIdx: aH, targetZoneSlot: aS,
    cardName: b.name, duration: 500, particles: null,
  });
  engine.sync();
  await engine._delay(420);

  if (!bPs.supportZones[bH]) bPs.supportZones[bH] = [[], [], []];
  if (!bPs.supportZones[bH][bS]) bPs.supportZones[bH][bS] = [];
  if (!aPs.supportZones[aH]) aPs.supportZones[aH] = [[], [], []];
  if (!aPs.supportZones[aH][aS]) aPs.supportZones[aH][aS] = [];
  bPs.supportZones[bH][bS].push(a.name);
  a.heroIdx = bH; a.zoneSlot = bS;
  aPs.supportZones[aH][aS].push(b.name);
  b.heroIdx = aH; b.zoneSlot = aS;
  if (aSeite !== bSeite) { seiteWechseln(engine, a, bSeite); seiteWechseln(engine, b, aSeite); }
  engine.sync();

  await engine.runHooks('onCardEnterZone', {
    enteringCard: a, toZone: 'support', toHeroIdx: bH,
    _skipReactionCheck: true, _isMove: true,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: b, toZone: 'support', toHeroIdx: aH,
    _skipReactionCheck: true, _isMove: true,
  });
  return true;
}

/**
 * Interactive Guard Change mode. Returns the number of distinct
 * Creatures repositioned (0 ⇒ caller cancels the Spell for min-1).
 */
async function runGuardChangeMode(engine, pi) {
  const movedIds = new Set();

  if (engine.isCpuPlayer && engine.isCpuPlayer(pi)) {
    // Lightweight CPU: one reposition so the cast isn't wasted, then
    // stop. Positional value is low; a deeper heuristic isn't worth
    // the MCTS cost here.
    const list = collectMovable(engine, pi, movedIds);
    // W18b: erst der Altweg (eigene Kreatur auf der eigenen Seite in eine eigene Zone), sonst irgendein Zug.
    const moveEntry = list.find(e => engine.physicalSide(e.inst) === pi && e.dests.some(d => d.owner === pi)) || list.find(e => e.dests.length > 0);
    if (moveEntry) {
      const d = moveEntry.dests.find(x => x.owner === pi && engine.physicalSide(moveEntry.inst) === pi) || moveEntry.dests[0];
      if (await moveCreature(engine, pi, moveEntry.inst, d.owner, d.heroIdx, d.slotIdx)) {
        movedIds.add(moveEntry.inst.id);
      }
    } else {
      const swapEntry = list.find(e => e.swaps.length > 0);
      if (swapEntry) {
        const partner = engine.cardInstances.find(c => c.id === swapEntry.swaps[0]);
        if (partner && await swapCreatures(engine, pi, swapEntry.inst, partner)) {
          movedIds.add(swapEntry.inst.id);
          movedIds.add(partner.id);
        }
      }
    }
    return movedIds.size;
  }

  for (let iter = 0; iter < 64; iter++) {
    const list = collectMovable(engine, pi, movedIds);
    if (list.length === 0) break;

    const result = await engine.promptGeneric(pi, {
      type: 'guardChangeMove',
      title: CARD_NAME,
      description: 'Move Creatures into free Support Zones of your other Heroes, or swap two Creatures between Heroes.',
      creatures: list.map(e => ({
        instId: e.inst.id,
        name: e.inst.name,
        owner: engine.physicalSide(e.inst),   // W18b: Brettseite (gestohlene Kreaturen stehen beim Gegner)
        heroIdx: e.inst.heroIdx,
        zoneSlot: e.inst.zoneSlot,
        dests: e.dests.map(d => ({ owner: d.owner, heroIdx: d.heroIdx, slotIdx: d.slotIdx, ...(d.shared ? { shared: true } : {}) })),
        swaps: e.swaps,
      })),
      doneLabel: movedIds.size > 0 ? '✓ Done' : '✕ Cancel',
      cancellable: false,
    });
    if (!result || result.done) break;

    const { instId, destHeroIdx, destSlot, swapWithInstId, destOwner } = result;
    const entry = list.find(e => e.inst.id === instId);
    if (!entry) continue;

    if (swapWithInstId != null) {
      if (!entry.swaps.includes(swapWithInstId)) continue;
      const partner = list.find(e => e.inst.id === swapWithInstId)?.inst;
      if (!partner) continue;
      if (await swapCreatures(engine, pi, entry.inst, partner)) {
        movedIds.add(entry.inst.id);
        movedIds.add(partner.id);
      }
    } else if (destHeroIdx != null && destSlot != null) {
      // W18b: `destOwner` (Brettseite der Zone) ist optional — ohne Angabe gilt die erste passende Zone (eigene Seite zuerst).
      const dz = entry.dests.find(d => d.heroIdx === destHeroIdx && d.slotIdx === destSlot && (destOwner == null || d.owner === destOwner));
      if (!dz) continue;
      if (await moveCreature(engine, pi, entry.inst, dz.owner, destHeroIdx, destSlot)) {
        movedIds.add(entry.inst.id);
      }
    }
  }
  return movedIds.size;
}

module.exports = {
  // ★ Z7b: FIZZELT die Karte (Wirker beim Auflösen handlungsunfähig, v1328), war sie GESPIELT → Stempel (Engine: `_noteFizzledPlay`).
  // Eine ganz NEGIERTE Karte stempelt nicht (Als Entscheidung, Welle 3).
  onFizzledPlay: ({ engine, gs, pi }) => { engine.claimHOPT(HOPT_KEY, pi); },

  // "Counts as an additional Action" when the caster has Support
  // Magic ≥ 2 — Main-Phase self-provide (mirrors Shapeshift).
  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return false;
    return supportMagicLevel(engine, pi, heroIdx) >= 2;
  },

  spellPlayCondition: (gs, pi, engine) => {
    // One Guard Change per turn.
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    if (!engine) return true; // optimistic without engine
    return collectMovable(engine, pi, new Set()).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Defensive: already used this turn (shouldn't be playable).
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) {
        gs._spellCancelled = true;
        return;
      }

      const movedCount = await runGuardChangeMode(engine, pi);

      // "min. 1" — nothing repositioned ⇒ the Spell does nothing;
      // return it to hand (no HOPT spent, no Action burned).
      if (movedCount === 0) {
        gs._spellCancelled = true;
        engine.log('guard_change_fizzle', { player: ps.username, reason: 'no_moves' });
        return;
      }

      // Commit the once-per-turn now that it actually did something.
      engine.claimHOPT(HOPT_KEY, pi);

      // Support Magic ≥ 2 → additional Action (Action-Phase refund;
      // the Main-Phase path is covered by `inherentAction` above).
      if (supportMagicLevel(engine, pi, ctx.cardHeroIdx) >= 2) {
        gs._spellFreeAction = true;
      }

      engine.log('guard_change', { player: ps.username, moved: movedCount });
      engine.sync();
    },
  },
};
