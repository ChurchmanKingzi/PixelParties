// ═══════════════════════════════════════════
//  CARD EFFECT: "Overheal Shock"
//  Spell (Support Magic Lv1, Attachment)
//
//  Attach to an opponent's Hero. Any healing
//  that Hero would receive is applied as damage
//  instead (checked in actionHealHero).
//
//  Sets hero.statuses.healReversed for visuals.
//  Cleared when the card leaves the zone.
//
//  First-turn-protected heroes: card is immediately
//  sent to the discard pile instead of attaching.
//
//  Inherent Action condition:
//  If the caster has Decay Magic 1+ OR
//  Support Magic 2+, this counts as an
//  inherent additional Action.
// ═══════════════════════════════════════════

// ── STELLSCHRAUBEN fuer die CPU-Bewertung (Als Zahlen, aenderbar) ────
// Wert des healReversed-Zustands je Heilquelle, die die anhaengende
// Seite noch legen kann. 20 ist bewusst konservativ gewaehlt: die
// Handkarte kostet die Eval rund 25, eine EINZELNE Heilquelle soll die
// Karte also gerade eben nicht rechtfertigen, ein echtes Heil-Deck
// (Heal Burn: 4x Heal, 3x Cure, Nao) dagegen deutlich.
// Groessenordnungs-Anker: der Gift-/Brand-Block in evaluateState
// bewertet erwarteten Schaden mit 0.5 × Menge; eine Heal-Stufe von 150
// entspraeche also 75. Der Deckel von 5 haelt den Beitrag bei maximal
// 100 — unter der Haelfte dessen, was der Ausruestungs-Bug gekostet
// hat, damit sich hier kein neues Uebergewicht einschleicht.
const HEAL_REVERSED_PER_SOURCE  = 20;
const HEAL_REVERSED_MAX_SOURCES = 5;
// ── ALS RULING 13.8.: „Schaden statt Heilung ist ein BOOLEAN." ───────
// Der Wert des Zustands haengt an der Heilung, die diese Seite noch
// legen kann — und das ist EIN geteilter Vorrat, kein Vorrat je Held.
// Ein zweiter geschockter Held verdoppelt ihn also nicht; er gibt nur
// Auswahl (falls der erste stirbt, gereinigt oder von Anti Magic
// geschuetzt wird). Deshalb wird der Vorrat auf alle geschockten Helden
// AUFGETEILT und um einen kleinen Deckungszuschlag je zusaetzlichem
// Helden erhoeht. Wirkung bei vollem Vorrat (100):
//   1 Held → 100 gesamt | 2 Helden → 115 | 3 Helden → 130
// Die zweite Shock ist damit +15 statt +100 wert — und eine zweite Kopie
// auf demselben Helden exakt 0 (Dedupe unten), kostet aber weiter eine
// Handkarte. Genau das gewuenschte „drastisch weniger".
const HEAL_REVERSED_COVERAGE_BONUS = 0.15;

/**
 * Wie viele Heilquellen kann diese Seite noch auf ein FREMDES Ziel
 * legen? Gezaehlt werden Hand und Nachziehstapel.
 *
 * Erkennung ueber den Kartentext, damit kein Namensregister gepflegt
 * werden muss: Effekt enthaelt "heal", aber NICHT "… you control" —
 * denn eine Heilung, die nur die eigene Seite treffen kann, laesst sich
 * durch Overheal Shock nicht in Schaden verwandeln. Gegen die echte
 * Kartenbank geprueft (13.8.): 52 Karten heilen ein frei waehlbares
 * Ziel, 25 nur die eigene Seite. Richtig einsortiert werden dabei u.a.
 * Heal und Cure (zaehlen) sowie Healing Melody und Lifeforce Howitzer
 * (zaehlen nicht).
 */
const HEAL_TEXT     = /\bheal/i;
const OWN_SIDE_ONLY = /(targets?|heroe?s?|creatures?|allies|ally)\s+you\s+control/i;

function countUsableHealSources(engine, pi) {
  const ps = engine.gs?.players?.[pi];
  if (!ps) return 0;
  const cardDB = engine._getCardDB();
  let n = 0;
  const scan = (list) => {
    for (const name of (list || [])) {
      const cd = cardDB[name];
      if (!cd) continue;
      const eff = cd.effect || '';
      if (!HEAL_TEXT.test(eff)) continue;
      if (OWN_SIDE_ONLY.test(eff)) continue;
      n++;
      if (n >= HEAL_REVERSED_MAX_SOURCES) return true;
    }
    return false;
  };
  if (scan(ps.hand)) return n;
  scan(ps.mainDeck);
  return n;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  // First-turn safety: Overheal Shock can ONLY attach to an opponent's Hero,
  // so when going first it is always wasted against the first-turn shield
  // (the onPlay handler just discards it). Tell the CPU never to play it on
  // such a turn. (spellPlayCondition below also gates this universally.)
  firstTurnSafe: false,
  // CPU target override. Pick an opponent Hero that does NOT already
  // carry an Overheal Shock (stacking has no extra value). Tiebreak by
  // current HP descending — more HP = more damage-return per future heal.
  // If every eligible hero already has OHS, decline (keeps the card in
  // hand for a later turn when a new valid target appears).
  //
  // ── GUARD-FALLE, 13.8. (dritter Fall dieser Art) ───────────────────
  // Hier stand `if (kind !== 'target') return undefined;`. Die Engine
  // meldet Ziel-Prompts aber mit ZWEI verschiedenen Vokabeln:
  //   • `promptEffectTarget` → 'effectTarget'
  //     (_engine.js `_getCpuTargetResponse`, _cpu.js Gehirn-Override)
  //   • der generische Ziel-Picker `cpuPickTargets` → 'target'
  // Overheal Shock ruft `promptEffectTarget`, traf also IMMER auf
  // 'effectTarget' und stieg an dieser Zeile aus. Der Vertrag unten war
  // auf dem direkten Pfad toter Code; entschieden hat stattdessen der
  // gelernte Target-Prior des Profils — und der zieht mit `hp:min +9.5`
  // genau den Helden mit der WENIGSTEN HP, also das Gegenteil dessen,
  // was hier steht. Dieselbe Falle wie bei the-yeeting.js und charme.js.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'target' && kind !== 'effectTarget') return undefined;
    const targets = promptData?.validTargets || [];
    if (!targets.length) return undefined;
    const heroHasOHS = (t) => {
      if (t.type !== 'hero') return false;
      const ps = engine.gs.players[t.owner];
      // Zwei Wege, dieselbe Frage (Als Boolean-Ruling): traegt der Held
      // den ZUSTAND schon, ist eine zweite Shock wertlos — unabhaengig
      // davon, wo die Karte liegt, die ihn gesetzt hat. Die Kartenabfrage
      // bleibt als zweite Sicherung stehen (Anti Magic kann den Zustand
      // loeschen, waehrend die Karte in der Zone bleibt; nachlegen waere
      // dort genauso vergeblich).
      if (ps?.heroes?.[t.heroIdx]?.statuses?.healReversed) return true;
      const zones = ps?.supportZones?.[t.heroIdx] || [];
      return zones.some(slot => (slot || []).includes('Overheal Shock'));
    };
    const heroEntries = targets.filter(t => t.type === 'hero');
    // Prefer heroes without OHS already.
    const freshHeroes = heroEntries.filter(t => !heroHasOHS(t));
    if (freshHeroes.length === 0) return []; // decline — nothing new to attach
    const hpOf = (t) => {
      const ps = engine.gs.players[t.owner];
      const hero = ps?.heroes?.[t.heroIdx];
      return hero?.hp || 0;
    };
    const sorted = [...freshHeroes].sort((a, b) => hpOf(b) - hpOf(a));
    return [sorted[0].id];
  },

  // Only report "can play" if at least one opponent Hero is eligible —
  // living, has a free Support Zone, AND isn't already carrying an OHS.
  // Without the OHS-absence check the card would spam-attach redundant
  // copies to the same hero.
  spellPlayCondition(gs, pi) {
    const oi = pi === 0 ? 1 : 0;
    // First-turn protection: the only valid targets are the opponent's
    // Heroes, but a first-turn-protected opponent can't be attached to — the
    // card would just fizzle to the discard pile for no effect. Treat it as
    // unplayable so neither the CPU nor a human wastes it (also grays it out
    // in hand for humans via getBlockedSpells).
    if (gs.firstTurnProtectedPlayer != null && oi === gs.firstTurnProtectedPlayer) return false;
    const ops = gs.players[oi];
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const hero = ops.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Traegt der Held den Zustand bereits, bringt eine zweite Shock
      // NICHTS (Boolean). Beide Wege geprueft — Zustand und Karte.
      if (hero.statuses?.healReversed) continue;
      const zones = ops.supportZones[hi] || [];
      // Already has an OHS attached → skip this hero.
      if (zones.some(slot => (slot || []).includes('Overheal Shock'))) continue;
      // Needs a free zone to accept the attachment.
      for (let si = 0; si < 3; si++) {
        if (((zones[si] || []).length === 0)) return true;
      }
    }
    return false;
  },

  inherentAction(gs, pi, heroIdx, engine) {
    const ps = gs.players[pi];
    const abZones = ps.abilityZones[heroIdx] || [[], [], []];
    const smLevel = engine.countAbilitiesForSchool('Support Magic', abZones);
    if (smLevel >= 2) return true;
    const dmLevel = engine.countAbilitiesForSchool('Decay Magic', abZones);
    if (dmLevel >= 1) return true;
    return false;
  },

  // ═══════════════════════════════════════════
  //  CPU-BEWERTUNG (gemessen am 13.8.)
  //
  //  Ausgangslage: die CPU spielte diese Karte nie und warf sie lieber
  //  ab. Nachgemessen mit `evaluateState` an einer echten Heal-Burn-
  //  Aufstellung (Kazena/Nao/Semi gegen Layn/Alice/Reiza):
  //
  //      abwerfen  Δ =  −25.3
  //      spielen   Δ = −215.3      (Gate-Schwelle ist +3)
  //      healReversed allein  Δ = 0.0
  //
  //  Die −215 setzten sich zusammen aus −25 Handkarte, −30 Slot und
  //  −160 dafuer, dass `mctsEnemyHeroDynamicValue` jede Nicht-Kreatur
  //  in der Support Zone eines Gegnerhelden als dessen AUSRUESTUNG
  //  zaehlt (`value += min(1.0, equipCount * 0.4)`). Gemessene
  //  Skalierung: 30 + 0.4 × HP des Wirts. Bitterste Pointe: der
  //  Ziel-Vertrag oben will den Helden mit der HOECHSTEN HP — genau den
  //  bestrafte die Eval am staerksten.
  //
  //  Die beiden falschen Vorzeichen raeumt jetzt `hostileAttachment`
  //  weg (generischer Vertrag in _cpu.js). Was die Karte WERT ist,
  //  meldet sie hier selbst.
  // ═══════════════════════════════════════════
  cpuMeta: {
    // Diese Karte liegt in der Support Zone des GEGNERS, gehoert aber
    // dem Angreifer und arbeitet gegen den Wirt. Damit ist sie weder
    // Ausruestung des Wirts noch sein Brett-Besitz.
    hostileAttachment: true,

    /**
     * Wert des healReversed-Zustands fuer die Seite, die ihn gesetzt hat.
     *
     * Vertrag `cpuInstBonus(engine, inst, ownerIdx)`: der Rueckgabewert
     * wird der Seite gutgeschrieben, die die Instanz KONTROLLIERT. Diese
     * Instanz liegt beim Wirt, und fuer den ist sie schaedlich — also
     * ein NEGATIVER Wert. Die Eval zieht ihn dem Wirt ab und schreibt
     * ihn damit automatisch dem Angreifer gut. Symmetrisch und ohne
     * Sonderfall: haengt der Gegner mir eine Shock an, verliere ich
     * genauso viel.
     *
     * Der Wert ist NULL, solange die anhaengende Seite gar keine
     * Heilung ins Ziel bringen kann — dann ist der Status wirklich
     * wertlos und die CPU soll die Karte auch nicht spielen.
     */
    cpuInstBonus(engine, inst, ownerIdx) {
      try {
        if (!inst || inst.zone !== 'support' || inst.name !== 'Overheal Shock') return 0;
        const gs = engine.gs;
        const hostPs = gs.players?.[ownerIdx];
        const hero = hostPs?.heroes?.[inst.heroIdx];
        if (!hero?.name || hero.hp <= 0) return 0;
        const hr = hero.statuses?.healReversed;
        if (!hr) return 0;

        // Nur die ERSTE Kopie auf diesem Helden zaehlt — der Status ist
        // binaer, eine zweite Shock bringt nichts (gleiche Bauart wie
        // der Dedupe in The Great Wall of Deri).
        const zones = hostPs.supportZones?.[inst.heroIdx] || [];
        let firstSlot = -1;
        for (let si = 0; si < zones.length; si++) {
          if ((zones[si] || []).includes('Overheal Shock')) { firstSlot = si; break; }
        }
        if (firstSlot !== inst.zoneSlot) return 0;

        const attacker = (typeof hr.appliedBy === 'number')
          ? hr.appliedBy
          : (ownerIdx === 0 ? 1 : 0);
        const sources = countUsableHealSources(engine, attacker);
        if (sources <= 0) return 0;

        // Geteilter Vorrat (Als Boolean-Ruling, siehe Konstanten oben):
        // wie viele LEBENDE Helden dieser Seite tragen den Zustand schon?
        let shocked = 0;
        for (const h of (hostPs.heroes || [])) {
          if (h?.name && h.hp > 0 && h.statuses?.healReversed) shocked++;
        }
        if (shocked < 1) shocked = 1;

        const pool  = HEAL_REVERSED_PER_SOURCE
          * Math.min(sources, HEAL_REVERSED_MAX_SOURCES);
        const total = pool * (1 + HEAL_REVERSED_COVERAGE_BONUS * (shocked - 1));
        return -(total / shocked);
      } catch { return 0; }
    },
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const oi = pi === 0 ? 1 : 0;
      const ops = gs.players[oi];

      // ── Build targets: opponent heroes + their free support zones ──
      const targets = [];
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        let hasFreeZone = false;
        for (let si = 0; si < 3; si++) {
          const slot = (ops.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) {
            hasFreeZone = true;
            targets.push({
              id: `equip-${oi}-${hi}-${si}`,
              type: 'equip',
              owner: oi,
              heroIdx: hi,
              slotIdx: si,
              cardName: '',
            });
          }
        }
        if (hasFreeZone) {
          targets.push({
            id: `hero-${oi}-${hi}`,
            type: 'hero',
            owner: oi,
            heroIdx: hi,
            cardName: hero.name,
          });
        }
      }

      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Select target ──
      let targetHeroIdx, targetSlot;

      const heroTargets = targets.filter(t => t.type === 'hero');
      const zoneTargets = targets.filter(t => t.type === 'equip');
      if (heroTargets.length === 1 && zoneTargets.length === 1) {
        targetHeroIdx = heroTargets[0].heroIdx;
        targetSlot = zoneTargets[0].slotIdx;
      } else {
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: 'Overheal Shock',
          description: 'Attach to an opponent\'s Hero. Healing on that Hero becomes damage.',
          confirmLabel: '⚡ Attach!',
          confirmClass: 'btn-danger',
          cancellable: true,
          exclusiveTypes: false,
          maxPerType: { hero: 1, equip: 1 },
        });

        if (!picked || picked.length === 0) {
          gs._spellCancelled = true;
          return;
        }

        const target = targets.find(t => t.id === picked[0]);
        if (!target) { gs._spellCancelled = true; return; }

        if (target.type === 'equip') {
          targetHeroIdx = target.heroIdx;
          targetSlot = target.slotIdx;
        } else {
          targetHeroIdx = target.heroIdx;
          for (let si = 0; si < 3; si++) {
            if (((ops.supportZones[targetHeroIdx] || [])[si] || []).length === 0) {
              targetSlot = si;
              break;
            }
          }
        }
      }

      const targetHero = ops.heroes[targetHeroIdx];
      if (!targetHero?.name || targetSlot === undefined) return;

      // ── First-turn protection: card is immediately discarded ──
      if (gs.firstTurnProtectedPlayer != null && oi === gs.firstTurnProtectedPlayer) {
        engine.log('equip_blocked', { card: 'Overheal Shock', target: targetHero.name, reason: 'shielded' });
        // Card goes to caster's discard (server handles hand removal via _spellPlacedOnBoard = false)
        return;
      }

      // ── Anti-Magic protection ──
      // Overheal Shock is a Lv 1 Attachment Spell. A target Hero with
      // `magic_immune.level >= 1` is immune to its effect. Direct
      // `targetHero.statuses.healReversed = …` assignment below
      // bypasses `addHeroStatus` (and therefore the engine's
      // centralized magic_immune gate), so mirror it here.
      if (engine._isHeroSpellProtected(targetHero, 'Overheal Shock')) {
        engine.log('equip_blocked', { card: 'Overheal Shock', target: targetHero.name, reason: 'magic_immune' });
        engine._playAntiMagicBlockedAnim(targetHero);
        return;
      }

      // ── Resistance gate ──
      // The full effect (zone placement + healReversed status) targets
      // an opponent hero, so it counts as a non-damaging effect that
      // Resistance can absorb. Fire `beforeHeroEffect` before any
      // mutation; on cancel, leave `_spellPlacedOnBoard` unset so the
      // server's standard discard path handles the spell normally.
      // The direct `targetHero.statuses.healReversed = …` assignment
      // below bypasses `addHeroStatus` and therefore Resistance's
      // `onStatusApplied` listener — this gate is the only safety net.
      const effectCtx = {
        playerIdx: oi, heroIdx: targetHeroIdx, hero: targetHero,
        effectType: 'attach', cancelled: false, _skipReactionCheck: true,
      };
      await engine.runHooks('beforeHeroEffect', effectCtx);
      if (effectCtx.cancelled) {
        engine.log('equip_blocked', { card: 'Overheal Shock', target: targetHero.name, reason: 'resistance' });
        return;
      }

      // ── Place card in opponent's Support Zone ──
      if (!ops.supportZones[targetHeroIdx]) ops.supportZones[targetHeroIdx] = [[], [], []];
      if (!ops.supportZones[targetHeroIdx][targetSlot]) ops.supportZones[targetHeroIdx][targetSlot] = [];
      ops.supportZones[targetHeroIdx][targetSlot].push('Overheal Shock');

      // Re-track the card instance in the opponent's support zone
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Overheal Shock' && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard('Overheal Shock', oi, 'support', targetHeroIdx, targetSlot);

      // Tell the server NOT to discard this card — it stays on the board
      gs._spellPlacedOnBoard = true;

      // Set healReversed status on the target hero
      if (!targetHero.statuses) targetHero.statuses = {};
      // Fuer die Messung: trug der Held den Zustand schon? (Boolean —
      // dann war dieser Einsatz eine Fehlinvestition.)
      const zielTrugSchon = !!targetHero.statuses.healReversed;
      targetHero.statuses.healReversed = { source: 'Overheal Shock', appliedBy: pi };

      engine.sync();

      // ── Play green+purple flash + skull particles on the target hero ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'overheal_shock_equip', owner: oi, heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(1000);

      // Fire zone enter hook
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('overheal_shock', {
        player: ps.username, target: targetHero.name, slot: targetSlot,
      });

      // ── EINSATZ-PROTOKOLL (Messstand, 13.8.) ───────────────────────
      // Am Objekt gefuehrt statt ueber engine.log(): log() schweigt im
      // Fast-Mode, und genau umgekehrt ist es hier gewollt — Rollouts
      // sollen NICHT mitzaehlen, echte Einsaetze schon. Der Modus kommt
      // aus den Stempeln, die doPlaySpell VOR dem onPlay setzt.
      if (!engine._inMctsSim && !engine._fastMode) {
        try {
          if (!Array.isArray(engine._shockLog)) engine._shockLog = [];
          engine._shockLog.push({
            zug: gs.turn,
            spieler: pi,
            caster: ps.heroes?.[heroIdx]?.name || '?',
            casterIdx: heroIdx,
            modus: gs._spellWasInherent ? 'frei'
              : (gs._spellConsumedMainAction ? 'main' : 'zusatz'),
            ziel: targetHero.name,
            zielIdx: targetHeroIdx,
            zielHp: targetHero.hp,
            zielHatteSchon: !!zielTrugSchon,
          });
        } catch { /* Messung darf das Spiel nie stoeren */ }
      }
      engine.sync();
    },

    /**
     * When Overheal Shock leaves the zone (destroyed, bounced, etc.),
     * check if any copies remain. If not, clear healReversed.
     */
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const card = ctx.card;
      if (!card || card.name !== 'Overheal Shock') return;
      const fromHeroIdx = ctx.fromHeroIdx;
      const ownerIdx = card.owner;
      if (ownerIdx == null || fromHeroIdx == null) return;

      const ps = gs.players[ownerIdx];
      if (!ps) return;
      const hero = ps.heroes?.[fromHeroIdx];
      if (!hero) return;

      // Check if any other Overheal Shock remains in this hero's support zones
      const supportZones = ps.supportZones[fromHeroIdx] || [];
      const stillHasShock = supportZones.some(slot =>
        (slot || []).includes('Overheal Shock')
      );

      if (!stillHasShock && hero.statuses?.healReversed) {
        delete hero.statuses.healReversed;
        engine.log('heal_reversed_cleared', { hero: hero.name });
        // Messung (13.8.): eine Shock, die das Brett verlaesst, BEVOR
        // eine Heilung sie eingeloest hat, ist verlorene Investition.
        // Der Bericht braucht die Zahl, um „14 gelegt, 0 umgewandelt"
        // aufzuloesen: liegt es am Entfernen oder am Nicht-Heilen?
        if (!engine._inMctsSim && !engine._fastMode) {
          try {
            engine._shockEntfernt = (engine._shockEntfernt || 0) + 1;
            if (hero.hp > 0) engine._shockEntferntLebend = (engine._shockEntferntLebend || 0) + 1;
          } catch { /* Messung darf nie stoeren */ }
        }
        engine.sync();
      }
    },
  },
};
