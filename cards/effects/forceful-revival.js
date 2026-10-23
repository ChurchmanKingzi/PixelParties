// ═══════════════════════════════════════════
//  CARD EFFECT: "Forceful Revival"
//  Attack (Fighting Lv1, Normal)
//
//  Effect (level scales with the user's effective
//  Fighting count — Heal's pattern):
//    Choose a level X-or-lower Creature from your
//    discard pile (X = caster's Fighting level)
//    and place it into a free Support Zone of the
//    user. The user takes damage equal to that
//    Creature's max HP. The placed Creature may
//    activate its active effect this turn (no
//    summoning sickness on the revived copy).
//
//  Implementation notes:
//    • Per-hero gate (`canPlayWithHero`): the user
//      must have a free Support Zone AND the
//      discard pile must contain at least one
//      Creature of level ≤ user's Fighting level.
//      `spellPlayCondition` is a cheap player-level
//      pre-filter (any free zone + any candidate).
//    • Placement uses `summonCreatureWithHooks`
//      (full onPlay + onCardEnterZone), then
//      overrides `inst.turnPlayed` to bypass
//      summoning sickness for THIS instance only.
//    • Self-damage uses `actionDealDamage` with the
//      attack as source so retaliation hooks /
//      damage-trackers see a normal attack-typed
//      hit. If it kills the user, that is intended.
// ═══════════════════════════════════════════

const { isSummonablePileCreature, hasCardType } = require('./_hooks');

const CARD_NAME = 'Forceful Revival';

function _fightingLevel(engine, ps, heroIdx) {
  return engine.heroSchoolLevel('Fighting', engine.gs.players.indexOf(ps), heroIdx);   // W4a: harte Negierung -> Stufe 0
}

function _eligibleCreatureNames(engine, ps, maxLevel, pi) {
  if (!ps || maxLevel <= 0) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  for (const cn of (ps.discardPile || [])) {
    if (!engine.darfAusAblageAufsFeld(cn)) continue;   // v1389: Gigantisaur, Ifrit
    if (seen.has(cn)) continue;
    const cd = cardDB[cn];
    if (!cd || !isSummonablePileCreature(cd, cn)) continue;
    if (hasCardType(cd, 'Token') || cd.subtype === 'Token') continue;
    // Effective level — Whoolmoth-style `reduceCardLevel` rebates
    // / Phatnir's Cool-Stack discount push the printed level down,
    // letting otherwise-out-of-range Creatures fall within the
    // Fighting cap. `pileSide: 'discard'` picks up Lethe per-pile
    // stamps so stamped Creatures correctly require more Fighting.
    const lvl = engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' });
    if (lvl > maxLevel) continue;
    seen.add(cn);
    out.push({ name: cn, source: 'discard', level: lvl });
  }
  out.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
  return out;
}

function _userHasFreeSupportSlot(ps, heroIdx) {
  const sup = ps?.supportZones?.[heroIdx] || [];
  return sup.some(slot => (slot || []).length === 0);
}

/**
 * ★ W62a: Platz des Nutzers fuer `name` — erste FREIE Zone, sonst (Alice-Teilung des Kontrolleurs `pi`) die Zone einer GLEICHNAMIGEN
 * Creature; -1 = keiner. Ohne `name` nur die freie Zone (Vorpruefung ohne Kartenwahl: `_userHasFreeSupportSlot` oder irgendein Kandidat teilt).
 */
function _userSlotFor(engine, ps, pi, hs, heroIdx, name) {
  const sup = ps?.supportZones?.[heroIdx] || [];
  // W63a (Al, 22.10.2026: „erst die geteilte Zone, sofern Alices Effekt aktiv ist, DANN die erste leere"): die Zone bestimmt der Zauber selbst —
  // zuerst die geteilte Zone einer gleichnamigen Creature, sonst die erste freie.
  if (name) {
    const { canShareInto } = require('./_alice-shared');
    for (let s = 0; s < 3; s++) if (canShareInto(engine, pi, heroIdx, s, name, hs)) return s;
  }
  return sup.findIndex(sl => (sl || []).length === 0);
}
function _userHasSlotFor(engine, ps, pi, hs, heroIdx, namen) {
  return _userHasFreeSupportSlot(ps, heroIdx) || namen.some(n => _userSlotFor(engine, ps, pi, hs, heroIdx, n) >= 0);
}

module.exports = {
  // Effective max-revivable-level scales with the caster's Fighting
  // count — flag for the CPU's ability-stacking scoring so a deck with
  // Forceful Revival keeps Fighting worth stacking past Lv1.
  cpuMeta: { scalesWithSchool: 'Fighting' },

  // Player-level cheap pre-filter so the card greys out in the hand
  // when no eligible target exists anywhere on the player's board.
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least one alive own hero with a free support slot AND a
    // candidate creature in discard at that hero's Fighting level.
    // Z1 (M01-26): auch geliehene Helden (Charme, Love Shot ...) sind "Nutzer" - Zonen/Fighting auf ihrer Brettseite.
    for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(pi)) {
      if (!h?.name || h.hp <= 0) continue;
      const hps = gs.players[physOwner] || ps;
      const lvl = _fightingLevel(engine, hps, hi);
      const namen = _eligibleCreatureNames(engine, ps, lvl, pi).map(c => c.name);
      if (!_userHasSlotFor(engine, hps, pi, physOwner, hi, namen)) continue;   // W62a: frei oder geteilt (Alice)
      if (namen.length > 0) return true;
    }
    return false;
  },

  // Per-hero gate: refuses heroes without a free slot or whose Fighting
  // level can't reach any creature in the discard pile.
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Z1 (M01-26): Zonen und Fighting-Stufe des NUTZERS = Brettseite (geliehener Held); Ablage bleibt beim Kontrolleur.
    const hps = gs.players[engine.heldSeiteFuer(pi, heroIdx)] || ps;
    const lvl = _fightingLevel(engine, hps, heroIdx);
    const namen = _eligibleCreatureNames(engine, ps, lvl, pi).map(c => c.name);
    return namen.length > 0 && _userHasSlotFor(engine, hps, pi, engine.heldSeiteFuer(pi, heroIdx), heroIdx, namen);   // W62a: frei oder geteilt (Alice)
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine    = ctx._engine;
      const gs        = ctx.gameState;
      const pi        = ctx.cardOwner;
      const heroIdx   = ctx.cardHeroIdx;
      const ps        = gs.players[pi];
      const hs        = ctx.cardHeroOwner ?? pi;   // Als Befund 29.9.: Brettseite des Nutzers
      const hps       = gs.players[hs] || ps;   // Zonen des Nutzers; Ablage bleibt beim Kontrolleur
      const userHero  = ctx.attachedHero || hps?.heroes?.[heroIdx];
      if (!ps || !userHero?.name || userHero.hp <= 0) {
        gs._spellCancelled = true;
        return;
      }

      const lvl = _fightingLevel(engine, hps, heroIdx);   // Als Befund 29.9.: Brettseite des Nutzers
      const gallery = _eligibleCreatureNames(engine, ps, lvl, pi).filter(g => _userSlotFor(engine, hps, pi, hs, heroIdx, g.name) >= 0);   // W62a: nur Karten mit Platz (frei oder geteilt)
      if (gallery.length === 0) { gs._spellCancelled = true; return; }   // Als Befund 29.9.: Brettseite des Nutzers; W62a: + geteilte Zone (Alice)

      // ── Pick a creature from the discard gallery ─────────────────
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery.map(g => ({ name: g.name, source: 'discard' })),
        title: CARD_NAME,
        description: `Choose a Lv${lvl} or lower Creature from your discard pile to revive on ${userHero.name}.`,
        confirmLabel: '⚡ Revive!',
        confirmClass: 'btn-warning',
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) {
        gs._spellCancelled = true;
        return;
      }
      const chosenName = picked.cardName;

      // Re-validate (state may have shifted during the prompt).
      const cardDB = engine._getCardDB();
      const cd = cardDB[chosenName];
      if (!cd || !isSummonablePileCreature(cd) || engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' }) > lvl) {
        gs._spellCancelled = true;
        return;
      }
      const dpIdx = (ps.discardPile || []).indexOf(chosenName);
      if (dpIdx < 0) { gs._spellCancelled = true; return; }
      if (_userSlotFor(engine, hps, pi, hs, heroIdx, chosenName) < 0) { gs._spellCancelled = true; return; }   // Als Befund 29.9.: Brettseite des Nutzers; W62a: frei oder geteilt (Alice)

      // ── Pop from discard and summon onto the user hero ───────────
      // v1389: Ablage → Feld über die EINE Stelle (Sperre, Lethe-Stempel,
      // Signal, Rückgabe bei Fehlschlag — alles in summonFromDiscard).
      // Eigene Animation (Als Vorgabe 26.9.): der Held RAMMT den freien
      // Support-Platz, im Moment des Aufpralls erscheint dort die Kreatur
      // und beide krachen zusammen (`gewaltsame_erweckung`). Der Rueckstoss
      // ist der Schaden am Helden. Dafuer muss der Zielplatz VOR dem
      // Anlauf feststehen; die Kreatur fliegt nicht aus der Ablage heran,
      // sie ERSCHEINT mit dem Aufprall.
      const freiSlot = _userSlotFor(engine, hps, pi, hs, heroIdx, chosenName);   // Als Befund 29.9.: Brettseite des Nutzers; W62a: erste freie, sonst geteilte Zone (Alice)
      if (freiSlot < 0) { gs._spellCancelled = true; return; }
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: hs, sourceHeroIdx: heroIdx,   // Als Befund 29.9.: Brettseite des Nutzers
        targetOwner: hs, targetHeroIdx: heroIdx, targetZoneSlot: freiSlot,
        cardName: userHero.name, duration: 1600,
      });
      // Aufprall bei 12 % des Anlaufs (≈190 ms); Zonen-Animationen haben
      // 100 ms Einhaengeverzug — also 90 ms vorher senden.
      await engine._delay(90);
      engine._broadcastEvent('play_zone_animation', {
        type: 'gewaltsame_erweckung', owner: hs, heroIdx, zoneSlot: freiSlot, duration: 900,   // Als Befund 29.9.: Brettseite des Nutzers
      });
      await engine._delay(100);

      const summonRes = await engine.summonFromDiscard(pi, pi, dpIdx, heroIdx, freiSlot, {
        source: CARD_NAME, flug: false, heldSeite: hs,   // Als Befund 29.9.: Brettseite des Nutzers
        summonOpts: { playSummonAnim: false },   // die Landung zeigt die eigene Animation
        hookExtras: { _isForcefulRevival: true },
      });
      if (!summonRes?.inst) {
        gs._spellCancelled = true;
        return;
      }

      const { inst } = summonRes;

      // Bypass summoning sickness for THIS instance only — the card text
      // explicitly grants "may activate its active effect this turn."
      // Mark the inst with the Haste flag rather than fake-aging
      // `turnPlayed`. The engine's creature-effect summoning-sickness
      // gates respect `counters._hasHaste`, while `turnPlayed` stays
      // at the real summon turn so "was summoned this turn" reads
      // (Alice the Puppeteer Girl, Hive's Crown, Singing's exclude-
      // fresh filter, etc.) correctly recognize this Creature as a
      // fresh summon.
      if (!inst.counters) inst.counters = {};
      inst.counters._hasHaste = true;

      // Der Held ist zurueck auf seinem Platz (Anlauf 1600 ms, Rueckkehr
      // bei 30 %), dann trifft ihn der Rueckstoss.
      await engine._delay(420);

      // ── Self-damage equal to the revived Creature's max HP ───────
      const maxHp = inst.counters?.maxHp ?? cd.hp ?? 0;
      if (maxHp > 0) {
        // Pre-resolution hook (Doq's guess, future "when this Hero
        // attacks" effects) fires BEFORE the damage. The damage is
        // self-inflicted on the user's own hero — pass that as the
        // target so listeners can see what's about to be hit.
        const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: hs };   // Als Befund 29.9.: Brettseite des Angreifers
        const selfTarget = { type: 'hero', owner: hs, heroIdx, cardName: userHero.name };   // Als Befund 29.9.: Brettseite des Nutzers
        const finalDmg = await engine._fireAttackDeclare(attackSource, selfTarget, maxHp);
        // Selbstkosten des Nutzers: kein 'Ziel' unter mehreren — Submerged/Stealth & Co. schuetzen nicht (Als Ruling 9.10.).
        await engine.actionDealDamage(attackSource, userHero, finalDmg, 'attack', { festesZiel: true });
      }

      engine.log('forceful_revival', {
        player: ps.username, hero: userHero.name,
        creature: chosenName, level: cd.level || 0,
        selfDamage: maxHp,
      });
      engine.sync();
    },
  },
};
