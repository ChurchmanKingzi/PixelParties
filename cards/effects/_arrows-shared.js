// ═══════════════════════════════════════════
//  SHARED: Arrow archetype helpers
//
//  All "Arrow" Reaction Artifacts chain onto an
//  Attack performed by a Hero the Arrow's
//  controller owns, modify the Attack (damage +
//  post-hit rider like Burn / Poison / gold
//  gain / draw), and then self-discard. Their
//  trigger is identical; they differ only in
//  the modifier they arm the attacker with.
//
//  The shared mechanics:
//
//    1. `arrowTriggerCondition(gs, pi, engine,
//        chainCtx, opts)` — used by every Arrow's
//       `reactionCondition`. Gates on: the chain
//       is initiated by an Attack card OWNED by
//       `pi` (the Arrow's controller), whose
//       casting Hero is still alive. `opts.
//       requireSingleTarget` is accepted for
//       Golden Arrow's extra gate (always-true
//       in the current engine — every Attack
//       card resolves via a single promptDamage
//       Target call — but the gate stays in
//       place for future multi-target Attacks).
//
//    2. `armAttackerWithArrow(engine, pi,
//        modifier)` — called from an Arrow's
//       `resolve`. Looks up the attacker Hero
//       from the initial chain link's
//       `casterHeroIdx` and pushes a modifier
//       descriptor onto `hero._armedArrows`.
//       The array stays alive across every
//       `beforeDamage` / `afterDamage` fire of
//       the triggering Attack (covers multi-
//       target attacks correctly — every target
//       hit shares the armed mods) and is
//       cleared exactly once at Attack
//       resolution-end by `clearArmedArrows`.
//
//    3. `applyArrowsBeforeDamage(engine, source,
//        target, hookCtx)` — STUFE 1, invoked from
//       `_actionDealDamageImpl` right after the
//       `beforeDamage` hook. Applies:
//         • flat damage bumps (sum).
//         • stashes a provisional `preZeroDamage`
//           for the poison of Hydra Blood.
//       `applyArrowsZero(engine, source, target,
//        hookCtx)` — STUFE 2, die Null von Hydra
//       Blood Arrow (`setAmount0: true`): erst NACH
//       allen anderen Betragsänderungen (Als Ruling
//       Al 26.10.: „Immer Hydra Blood Arrow nach
//       ALLEN anderen Schadens-Modifikatoren!") —
//       Heldenpfad nach Multiplikatoren/Niu/Darge,
//       Kreaturenpfad am `_settleCreatureEntry`.
//       Der Endbetrag wird je Ziel gemerkt
//       (`_preZeroByTarget`) und ist die Basis der
//       Giftstapel (1 je volle 30). Quellen-seitig
//       unreduzierbarer Schaden (`_unreduzierbar`)
//       wird nicht genullt; Ziel-seitiges „cannot
//       be reduced" hält Hydra nicht auf.
//
//    4. `applyArrowsAfterDamage(engine, source,
//        target, dealt, origAmount, type)` —
//       invoked from `_actionDealDamageImpl`
//       after the `afterDamage` hook. Applies
//       per-target post-hit riders: Burn,
//       Poison (fresh stacks), hero-specific
//       gold gain + gold-lock. Does NOT pop
//       mods — they stay armed for any
//       remaining targets in the same AoE
//       Attack.
//
//    5. `clearArmedArrows(pi, engine)` — called
//       by server.js after the triggering
//       Attack's `afterSpellResolved` hook and
//       on the negate-branch. Walks every Hero
//       on `pi`'s side and deletes
//       `_armedArrows`. Idempotent — safe to
//       call even when no arrows are armed.
//
//  Hydra Blood specifically uses `setAmount0:
//  true` + `poisonStacksPer: 30` (the stack
//  count for each target is `floor(would-have-
//  damage / 30)`). Poisoned / Flame Arrow use
//  `applyPoison1` / `applyBurn`. Golden Arrow
//  uses `goldRatio: 10` and `goldLockAfter:
//  true`.
//
//  Als Ruling (Al 28.10.): ATTACKS OHNE SCHADEN
//  ─────────────────────────────────────────────
//  „Schadensstärkende Karten wie Magic Topaz oder die Arrows ließen sich an Alliance und andere Attacks anketten, die keinen Schaden
//  zufügen, und verpufften. Sie sollen schlicht nicht ankettbar sein, wenn die Attack mit ihnen nichts machen würde."
//  Eine Attack, die nie Schaden anrichtet (Alliance, Amazing Finding, Capture, Muscle Training …), sagt es im Skript: `dealsNoAttackDamage: true`.
//  `arrowTriggerCondition` bietet dann jeden Pfeil NICHT an, dessen Wirkung am Schaden/Treffer der Attack hängt (Standard: Angelfeather,
//  Magic Topaz, Flame, Poisoned, Golden, Hydra Blood). Ein Pfeil, dessen Wirkung auch ohne Attack-Schaden etwas tut (Rainbow's: zieht 2 Karten;
//  Bomb: 100 Schaden auf eine Gegnerkreatur; Racket: Gegnerkreatur zurück auf die Hand), setzt `opts.effektOhneAngriffsschaden` und
//  prüft selbst, ob sein eigener Teil ein Ziel hat. Neue Pfeile sind damit standardmäßig richtig.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/**
 * Reaction gate for every Arrow. Returns true iff:
 *   • A reaction chain is in progress
 *   • The chain's INITIAL link is an Attack card
 *   • That Attack's owner is `pi` (Arrow is chained onto an ally
 *     Attack, not the opponent's)
 *   • The casting Hero is still alive
 *
 * @param {object}  gs
 * @param {number}  pi
 * @param {object}  engine
 * @param {object}  chainCtx - { chain, eventDesc, ... }
 * @param {object}  [opts]
 * @param {boolean} [opts.requireSingleTarget] - Golden Arrow only. Currently
 *   a no-op because every PP Attack resolves with a single promptDamageTarget
 *   call, but the hook is in place for when multi-target Attacks ship.
 * @param {boolean} [opts.anyHero] - Hydra Blood Arrow: auch auf die Attack eines GEGNERISCHEN Helden.
 * @param {boolean} [opts.blockUnreducible] - Hydra Blood Arrow (Als Ruling Al 26.10.): nicht anbieten, wenn der Schaden der
 *   Attack unreduzierbar ist (`engine._attackSchadenUnreduzierbar`: Surefire Shot, Elixir of Strength, Club of Gobbo …).
 * @param {boolean} [opts.effektOhneAngriffsschaden] - Rainbow's/Bomb/Racket Arrow (Als Ruling Al 28.10.): die Karte tut auch an einer Attack
 *   ohne Schaden etwas (Karten ziehen, Gegnerkreatur treffen/zurückgeben) — sie darf dann auch an `dealsNoAttackDamage`-Attacks. Standard:
 *   an einer Attack ohne Schaden nicht ankettbar.
 */
/** Ist die auslösende Attack dieser Kette eine, die nie Schaden anrichtet (`dealsNoAttackDamage` im Skript, z. B. Alliance)? */
function attackDealsNoDamage(chainCtx) {
  const initial = chainCtx?.chain?.find(l => l.isInitialCard);
  if (!initial?.cardName) return false;
  const { loadCardEffect } = require('./_loader');
  return !!loadCardEffect(initial.cardName)?.dealsNoAttackDamage;
}

function arrowTriggerCondition(gs, pi, engine, chainCtx, _opts = {}) {
  if (!chainCtx?.chain || chainCtx.chain.length === 0) return false;
  const initial = chainCtx.chain.find(l => l.isInitialCard);
  if (!initial) return false;
  if (initial.cardType !== 'Attack') return false;
  // Als Ruling (Al 26.10.): Hydra Blood Arrow („when a Hero hits …", ohne „you control") darf auf die Attack JEDES Helden auslösen (`opts.anyHero`).
  if (initial.owner !== pi && !_opts.anyHero) return false;

  // Caster hero must exist and be alive. The INITIAL link uses `heroIdx`
  // (executeCardWithChain, see _engine.js:9042); the `casterHeroIdx`
  // field only shows up on REACTION links (_engine.js:9240). Accept
  // both so the gate is resilient to future field-name tweaks.
  const hiIdx = initial.heroIdx ?? initial.casterHeroIdx;
  if (hiIdx == null || hiIdx < 0) return false;
  // Styx 28.9.: geliehener Angreifer steht auf der Brettseite `casterOwner`.
  const hero = gs.players[initial.casterOwner ?? (_opts.anyHero ? initial.owner : pi)]?.heroes?.[hiIdx];
  if (!hero?.name || hero.hp <= 0) return false;

  // Als Ruling (Al 26.10.): „Eine andere Regel, die dann für ALLE True-Damage-Sources gelten soll: Diese können Hydra Blood Arrow schlicht nicht aktivieren." — ein Pfeil, der den
  // Schaden auf 0 SENKT (`opts.blockUnreducible`, Hydra Blood Arrow), wird nicht angeboten, wenn der Schaden der Attack QUELLEN-seitig unreduzierbar ist (Surefire Shot, Elixir of Strength,
  // Club of Gobbo …; EIN Prädikat: `engine._attackSchadenUnreduzierbar`). Das Fenster öffnet VOR der Zielwahl; ein bereitstehender Elixir sperrt Hydra bei JEDER Attack (Ruling Al 26.10.: „die müssen sich ausschließen“);
  // ZIEL-seitiges „cannot be reduced" (Tempeste, Brachion …) sperrt Hydra nicht.
  if (_opts.blockUnreducible && engine?._attackSchadenUnreduzierbar?.({ link: initial })) return false;

  // Als Ruling (Al 28.10.): Attack ohne Schaden (Alliance & Co.) — ein Pfeil, dessen Wirkung am Schaden hängt, hätte dort nichts zu tun: nicht ankettbar.
  if (!_opts.effektOhneAngriffsschaden && attackDealsNoDamage(chainCtx)) return false;

  // Future multi-target gate for Golden Arrow. Left intentionally true —
  // see header comment.
  // if (_opts.requireSingleTarget && attackIsMultiTarget(initial)) return false;

  return true;
}

/**
 * Register an arrow activation for `pi`'s triggering Attack. Called from
 * every Arrow's `resolve`. Two jobs:
 *   1. If `modifier` is supplied, push it onto the attacking Hero's
 *      `_armedArrows` list — the engine's damage-impl picks that up at
 *      `beforeDamage` / `afterDamage` time.
 *   2. Recompute and stash `hero._arrowsChainedCount` — the number of
 *      `isArrow`-tagged links in the reaction chain so far (Darge reads
 *      this at damage time; the chain itself is a local variable inside
 *      `_runReactionWindow` and is gone by the time the Attack resolves).
 *
 * The chain MUST be passed in — the reaction chain isn't stored on the
 * engine (it's a local inside `_runReactionWindow`), so helpers that
 * looked at `engine.chain` were reading the legacy-chain system and
 * always returning null. Arrow `resolve` signatures take `(engine, pi,
 * _sel, _val, chain, _idx)` from the reaction-runner wrapper, so
 * passing `chain` through is straightforward.
 *
 * Modifier fields supported (all optional):
 *   flatDamage    : number       — summed into hookCtx.amount
 *   setAmount0    : boolean      — forces hookCtx.amount = 0 (Hydra Blood)
 *   applyBurn     : boolean      — per-target burn at afterDamage
 *   applyPoison1  : boolean      — per-target 1-stack poison
 *   poisonStacksPer: number      — per-target floor(preZero / n) stacks
 *   goldRatio     : number       — per-target floor(dealt / n) gold to pi
 *   goldLockAfter : boolean      — set ps.goldLocked after first gain
 *   sourceCard    : string       — log label
 */
function armAttackerWithArrow(engine, pi, chain, modifier) {
  const hero = _findAttackerHero(engine, pi, chain, !!modifier?.anyHero);
  if (!hero) return false;
  if (modifier) {
    if (!Array.isArray(hero._armedArrows)) hero._armedArrows = [];
    hero._armedArrows.push({ ...modifier, ownerPi: pi });   // `ownerPi` = Spieler des Pfeils (bei Hydra Blood auf eine gegnerische Attack ≠ Angreifer)
  }
  hero._arrowsChainedCount = _countArrowLinks(chain);
  if (Array.isArray(chain)) _KETTEN.set(hero, chain);   // Pfeilsalve: die Kette bleibt (Verweis, kein Zustand) und wird beim Treffer fuer die Anzeige gelesen
  // Pfeilsalve: Schild bereitstellen; scharf wird es mit dem Ende der Kette (`reaction_chain_done`, siehe `_broadcastEvent`) — die Attack loest in aller Regel NACH der Kette auf (Zielwahl, Animation, Schaden).
  if (Array.isArray(chain) && !engine._pfeilSchild && !engine._fastMode && !engine._inMctsSim && engine.room) engine._pfeilSchild = { puffer: [], aktiv: false, davor: null };
  return true;
}

/**
 * For arrows that don't arm any damage/rider modifier (currently only
 * Racket Arrow — it bounces a creature at reaction time and leaves the
 * attack untouched). Still updates Darge's arrow count so the bonus
 * reflects that the arrow was played.
 */
function noteArrowActivated(engine, pi, chain) {
  return armAttackerWithArrow(engine, pi, chain, null);
}

function _findAttackerHero(engine, pi, chain, anyHero = false) {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const initial = chain.find(l => l.isInitialCard && l.cardType === 'Attack');
  if (!initial) return null;
  if (initial.owner !== pi && !anyHero) return null;
  const hiIdx = initial.heroIdx ?? initial.casterHeroIdx;
  if (hiIdx == null || hiIdx < 0) return null;
  // Styx 28.9.: Held auf der Brettseite (`casterOwner`), „you" bleibt `pi`.
  const hero = engine.gs.players[initial.casterOwner ?? (anyHero ? initial.owner : pi)]?.heroes?.[hiIdx];
  return hero?.name ? hero : null;
}

function _countArrowLinks(chain) {
  const { loadCardEffect } = require('./_loader');
  if (!Array.isArray(chain)) return 0;
  let n = 0;
  for (const link of chain) {
    if (link.isInitialCard) continue;
    if (link.negated) continue; // A negated arrow wasn't "played" in the effect sense.
    const script = loadCardEffect(link.cardName);
    if (script?.isArrow) n++;
  }
  return n;
}

/**
 * Apply armed-arrow damage modifiers, STUFE 1 (Erhöhungen). Runs immediately after the
 * `beforeDamage` hook. Mutates `hookCtx.amount`.
 *
 *   • Addiert die `flatDamage` aller Pfeile (Angelfeather +60 …).
 *   • Merkt einen VORLÄUFIGEN Betrag je Ziel für das Gift von Hydra Blood Arrow
 *     (`_preZeroDamage` / `_preZeroByTarget`): Treffer, die nie durch Stufe 2 laufen
 *     (True Damage), zahlen das Gift danach aus diesem Wert.
 *
 * Die Null von Hydra Blood Arrow setzt hier NICHT mehr: sie gehört in Stufe 2
 * (`applyArrowsZero`) — NACH allen anderen Betragsänderungen (Als Ruling Al 26.10.:
 * „Immer Hydra Blood Arrow nach ALLEN anderen Schadens-Modifikatoren!").
 */
function applyArrowsBeforeDamage(engine, source, target, hookCtx) {
  if (!source) return;
  const hero = heroFromSource(engine, source);
  if (!hero?._armedArrows?.length) return;
  if (hookCtx.type !== 'attack') return; // Arrows only care about attack damage.

  let flat = 0;
  for (const arrow of hero._armedArrows) {
    if (typeof arrow.flatDamage === 'number') flat += arrow.flatDamage;
  }

  // W49a (Ricochet, Folgetreffer): der Betrag steht fest („half as much as the previous one") — der Pfeil-Bonus steckt schon im Vorgaenger.
  if (flat && !hookCtx._kettenFolge) {
    hookCtx.amount = Math.max(0, hookCtx.amount + flat);
    if (hookCtx._kBase !== undefined) hookCtx._kBase += flat;   // W50a: Pfeil-Bonus gehoert zur Basis des Kettenbetrags (Ricochet-Kopf)
  }
  stashPreZero(hero, target, hookCtx.amount + (hookCtx._flatBonus || 0));
}

/** Merkt den „would have dealt"-Betrag für Hydra Blood Arrow: je Ziel (Mehrzielangriffe) und als Rückfall am Pfeil. */
function stashPreZero(hero, target, betrag) {
  for (const arrow of hero._armedArrows) {
    arrow._preZeroDamage = betrag;
    if (target) (arrow._preZeroByTarget || (arrow._preZeroByTarget = new Map())).set(target, betrag);
  }
}

/** Trägt dieser Held eine scharfe Hydra Blood Arrow (`setAmount0`, an der laufenden Attack gekettet)? Elixir of Strength nimmt ihn dann nicht als Ziel (gegenseitiger Ausschluss, Al 26.10.). */
function heroHatScharfeHydra(hero) {
  return !!hero?._armedArrows?.some(a => a.setAmount0);
}

/** Trägt der Angreifer eine scharfe Hydra Blood Arrow (`setAmount0`)? */
function hydraScharf(engine, source) {
  if (!source) return false;
  return heroHatScharfeHydra(heroFromSource(engine, source));
}

/** Wird die scharfe Hydra Blood Arrow diesen Treffer auf 0 setzen? Für Fenster, die VOR der Null nichts mehr sehen sollen (Reaktionen am Ziel). */
function hydraWirdNullen(engine, source, hookCtx) {
  if (hookCtx?.type !== 'attack' || !hydraScharf(engine, source)) return false;
  return !engine._attackSchadenUnreduzierbar?.({ hookCtx });
}

/**
 * Apply armed-arrow damage modifiers, STUFE 2 (die Null von Hydra Blood Arrow).
 *
 * Als Ruling (Al 26.10.): „Immer Hydra Blood Arrow nach ALLEN anderen Schadens-Modifikatoren!" — der Engine-Pfad ruft diese Stufe, wenn der Betrag feststeht
 * (Elixir/Anger/Pfeil-Boni, Hook-Boni, Buff-Multiplikatoren am Angreifer UND am Ziel, Niu/Darge-Boni; die Hand-Reaktionen, Einmal-Schilde und Deckel des Ziels folgen
 * danach und sehen schon die 0). Der ENDBETRAG ist der „would have dealt"-Betrag für die Giftstapel (1 je volle 30, `applyArrowsAfterDamage`). Gesenkt wird nur,
 * was reduzierbar ist: ein Treffer mit QUELLEN-seitig unreduzierbarem Schaden (`hookCtx._unreduzierbar`: Surefire Shot, Elixir of Strength, Club of Gobbo — siehe
 * `engine._attackSchadenUnreduzierbar`) bleibt, das Gift nach dem Endbetrag auch. ZIEL-seitiges „cannot be reduced" (Tempeste, Prophecy of Tempeste, Gigantisaur
 * Brachion, Monia Bot, Test Dummy …) hält Hydra nicht auf: die Null kommt VOR dem Treffer und umgeht Effekte am Ziel.
 *
 * @returns {boolean} true = der Betrag wurde auf 0 gesetzt
 */
function applyArrowsZero(engine, source, target, hookCtx) {
  if (!source || hookCtx?.type !== 'attack') return false;
  const hero = heroFromSource(engine, source);
  if (!hero?._armedArrows?.some(a => a.setAmount0)) return false;
  stashPreZero(hero, target, Math.max(0, hookCtx.amount || 0));
  if (engine._attackSchadenUnreduzierbar?.({ hookCtx })) return false;
  hookCtx.amount = 0;
  // Hydra Blood's "reduce damage to 0" is absolute — it takes
  // everything, including any multiplier-immune flat bonuses (Darge, Niu).
  hookCtx._flatBonus = 0;
  // v689 (Punkt vor Strich): auch die getrennt gesammelten Modifikatoren der Hook-Runde fallen — die Null ist absolut.
  hookCtx._flat = 0;
  hookCtx._mul = 1;
  hookCtx._zeroedByArrow = true;
  return true;
}

/**
 * Post-hit effects. Runs after the `afterDamage` hook. `dealt` is the
 * ACTUAL HP drop (can be 0 for Hydra Blood's zero-damage branch); the
 * original pre-zero amount is in `arrow._preZeroDamage`.
 *
 * Runs every arrow's rider against THIS target. Does NOT pop the
 * arrows — they persist for every subsequent target hit by the same
 * Attack (any future multi-target attacks). `clearArmedArrows` does
 * the cleanup after the Attack fully resolves.
 */
async function applyArrowsAfterDamage(engine, source, target, dealt, _origAmount, type) {
  if (type !== 'attack') return;
  if (!source || !target) return;
  const hero = heroFromSource(engine, source);
  if (!hero?._armedArrows?.length) return;
  const pi = source.owner ?? source.controller ?? -1;
  if (pi < 0) return;
  const ps = engine.gs.players[pi];

  // Resolve target location for status / poison / gold logging.
  const targetLoc = resolveTargetLocation(engine, target);
  if (!targetLoc) return;

  for (const arrow of hero._armedArrows) {
    // Burn rider (Flame Arrow).
    if (arrow.applyBurn) {
      await applyBurnToTarget(engine, pi, targetLoc, arrow.sourceCard || 'Arrow');
    }
    // 1-stack poison (Poisoned Arrow).
    if (arrow.applyPoison1) {
      await applyPoisonStacksToTarget(engine, pi, targetLoc, 1, arrow.sourceCard || 'Arrow');
    }
    // Would-have-damage-based poison (Hydra Blood Arrow). Uses the
    // pre-zero amount so the stacks are computed against what the
    // Attack WOULD have dealt before Hydra Blood zeroed it.
    if (typeof arrow.poisonStacksPer === 'number' && arrow.poisonStacksPer > 0) {
      const basis = arrow._preZeroByTarget?.has(target) ? arrow._preZeroByTarget.get(target) : (arrow._preZeroDamage || 0);   // je Ziel (Mehrzielangriff), sonst der letzte Wert
      const stacks = Math.floor(basis / arrow.poisonStacksPer);
      if (stacks > 0) {
        await applyPoisonStacksToTarget(engine, arrow.ownerPi ?? pi, targetLoc, stacks, arrow.sourceCard || 'Arrow');   // Quelle = Spieler des Pfeils (Hydra Blood auf gegnerische Attack)
      }
    }
    // Gold gain per N damage dealt (Golden Arrow).
    // W16d (A09-10): „hits EXACTLY 1 target" – ob der Angriff genau ein Ziel trifft, steht erst am Ende fest (Whirlwind Strike,
    // Ricochet & Co. treffen mehrere). Deshalb hier nur MITZÄHLEN (je Ziel); ausgezahlt wird in `clearArmedArrows`.
    if (typeof arrow.goldRatio === 'number' && arrow.goldRatio > 0) {
      if (!arrow._goldTreffer) arrow._goldTreffer = new Map();
      const key = targetLoc.kind === 'hero' ? `h${targetLoc.owner}-${targetLoc.heroIdx}` : `c${targetLoc.inst?.id}`;
      arrow._goldTreffer.set(key, (arrow._goldTreffer.get(key) || 0) + (dealt > 0 ? dealt : 0));
    }
  }
}

/**
 * Drop every armed arrow AND the Darge arrow-count stash from every
 * Hero of `pi`. Called after the triggering Attack's
 * `afterSpellResolved` hook and on negation.
 */
async function clearArmedArrows(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  // Styx 28.9.: auch geliehene Angreifer (Brettseite des Gegners).
  const helden = new Set(ps.heroes || []);
  if (typeof engine.heroesControlledBy === 'function') {
    for (const { hero } of engine.heroesControlledBy(pi)) helden.add(hero);
  }
  // W16d (A09-10): Golden Arrow zahlt erst jetzt – und nur, wenn der Angriff GENAU EIN Ziel getroffen hat.
  for (const hero of helden) {
    if (!hero?._armedArrows) continue;
    for (const arrow of hero._armedArrows) {
      if (!(arrow.goldRatio > 0) || !arrow._goldTreffer || arrow._goldTreffer.size !== 1) continue;
      const dealt = [...arrow._goldTreffer.values()][0];
      // Als Ruling (Al 26.10., Golden Arrow „Sperren"): die Gold-Sperre („You cannot gain or spend Gold for the rest of the turn afterwards") gilt auch bei
      // 0 Schaden / 0 Gold — NICHT hinter `dealt > 0` verstecken; Gold gibt es nur für echten Schaden.
      const gold = dealt > 0 ? Math.floor(dealt / arrow.goldRatio) : 0;
      if (gold > 0 && !ps.goldLocked) {
        await engine.actionGainGold(pi, gold);
        engine.log('arrow_gold_gain', { player: ps.username, gold, source: arrow.sourceCard || 'Arrow' });
      }
      if (arrow.goldLockAfter) {
        ps.goldLocked = true;
        engine.log('gold_locked', { player: ps.username, by: arrow.sourceCard || 'Golden Arrow' });
      }
    }
  }
  if (engine._pfeilSchild) pfeilSchildSchliessen(engine, engine._pfeilSchild);   // Attack zu Ende: Zurueckgehaltenes (kein Treffer, kein Salve) spielt jetzt noch
  for (const hero of helden) {
    if (!hero) continue;
    if (hero._armedArrows) delete hero._armedArrows;
    if (hero._arrowsChainedCount != null) delete hero._arrowsChainedCount;
    _KETTEN.delete(hero);
  }
}

// ───────────── Pfeilsalve (nur Darstellung) ─────────────
//
//  Haengen an einer Attack eines Helden ein oder mehr „Arrow"-Artefakte, ersetzt der Client die Standard-Angriffsanimation durch EINE Salve aller
//  tatsaechlich geschossenen Pfeile (public/app-fx-52.jsx). Die Regeln des Spiels aendern sich nicht: Schaden, Brand, Gift und Gold laufen wie bisher.
//  Der Server liefert nur die Anzeigedaten (`play_arrow_salvo`: Pfeile in Kettenreihenfolge, REELLER Schaden am Ziel, Status je Pfeil) und
//  haelt den HP-Abzug fuer die Dauer der Salve zurueck (`pfeilSalve` wartet, BEVOR die Engine die HP abzieht) — so zeigt der Client die HP und die
//  Status erst beim Einschlag des jeweiligen Pfeils, und der Zustand ist nach der Salve sofort richtig.
//  Waehrend der Aufloesung der Attack (`pfeilSchildOeffnen`) werden ihre Standard-Animationen zurueckgehalten (`engine._pfeilSchild`) und der Salve als
//  `ersatz` mitgegeben: spielt der Client die Salve nicht (Animationen aus, Retro, Fehler), spielt er sie selbst ab — „sonst laeuft alles unveraendert".
const _KETTEN = new WeakMap();   // Held -> Kettenfeld der Pfeile (Verweis; die `negated`-Marken liest `pfeilNamen` erst beim Treffer)
const PFEIL_SALVE_MS = 1550;     // Dauer der Salve (Wartezeit vor dem HP-Abzug); der letzte Einschlag liegt bei <= 1,41 s
const PFEIL_SCHILD_EVENTE = new Set(['play_zone_animation', 'play_projectile_animation', 'play_ram_animation', 'play_beam_animation', 'play_weapon_barrage', 'play_screen_shake', 'punch_impact', 'play_pusher_fling', 'play_card_throw']);

/** Namen der tatsaechlich geschossenen Pfeile in Kettenreihenfolge (nicht negiert, `isArrow` UND „Arrow" im Namen: Magic Topaz zaehlt nicht); Arrow Slit schiesst einen Pfeil ein zweites Mal (Mehrfach-Eintrag in `_armedArrows`). */
function pfeilNamen(chain, hero) {
  const { loadCardEffect } = require('./_loader');
  const out = [];
  for (const link of chain || []) {
    if (link.isInitialCard || link.negated || !/Arrow/.test(link.cardName || '')) continue;
    if (loadCardEffect(link.cardName)?.isArrow) out.push(link.cardName);
  }
  const imKette = {};
  for (const n of out) imKette[n] = (imKette[n] || 0) + 1;
  const bewaffnet = {};
  for (const a of hero?._armedArrows || []) if (a.sourceCard) bewaffnet[a.sourceCard] = (bewaffnet[a.sourceCard] || 0) + 1;
  for (const n in bewaffnet) for (let k = imKette[n] || 0; k < bewaffnet[n]; k++) out.push(n);
  return out;
}

/** Oeffnet das Schild um die Aufloesung der Attack, falls ihr Held Pfeile an der Kette hat. Rueckgabe: Schild (zum Schliessen) oder null. */
function pfeilSchildOeffnen(engine, chain, link) {
  try {
    if (engine._fastMode || engine._inMctsSim || engine._aborted || !engine.room) return null;
    const hero = _findAttackerHero(engine, link.owner, chain, true);
    const kette = hero && _KETTEN.get(hero);
    if (!kette || !pfeilNamen(kette, hero).length) return null;
    const schild = { puffer: [], aktiv: true, davor: engine._pfeilSchild || null };
    engine._pfeilSchild = schild;
    return schild;
  } catch (e) { return null; }
}

/** Schliesst das Schild; was nie zur Salve kam (Attack ohne Treffer), spielt jetzt doch. */
function pfeilSchildSchliessen(engine, schild) {
  if (!schild) return;
  if (engine._pfeilSchild === schild) engine._pfeilSchild = schild.davor || null;
  const rest = schild.puffer; schild.puffer = []; schild.aktiv = false; schild.fertig = true;
  for (const [ev, data, opts] of rest) { try { engine._broadcastEvent(ev, data, opts); } catch (e) { /* weiter */ } }
}

/**
 * Anzeige der Salve fuer EINEN Treffer (Aufruf in den Schadenswegen der Engine, NACH der Schadensberechnung und VOR dem HP-Abzug).
 * info = { amount (reeller Schaden dieses Treffers), hpVor, maxHp, kind: 'hero' | 'creature' }. Wartet die Dauer der Salve ab.
 * Status je Pfeil (Anzeige, vorausgesagt wie die Engine ihn gleich anwendet): Flame -> burn, Poisoned -> 1 Gift, Hydra Blood -> floor(Schaden-ohne-Null / 30) Gift.
 */
async function pfeilSalve(engine, source, target, info) {
  try {
    if (!source || !target || engine._fastMode || engine._inMctsSim || engine._aborted || !engine.room) return false;
    const hero = heroFromSource(engine, source);
    const kette = hero && _KETTEN.get(hero);
    if (!kette) return false;
    const namen = pfeilNamen(kette, hero);
    if (!namen.length) return false;
    const loc = resolveTargetLocation(engine, target);
    if (!loc) return false;
    const frei = (hero._armedArrows || []).slice();
    const arrows = namen.map((n) => {
      const k = frei.findIndex((a) => a.sourceCard === n);
      const a = k >= 0 ? frei.splice(k, 1)[0] : null;
      const pf = { n };
      if (a && a.applyBurn) pf.burn = 1;
      if (a && a.applyPoison1) pf.poison = 1;
      if (a && typeof a.poisonStacksPer === 'number' && a.poisonStacksPer > 0) {
        const basis = a._preZeroByTarget?.has(target) ? a._preZeroByTarget.get(target) : (a._preZeroDamage || 0);
        const st = Math.floor(basis / a.poisonStacksPer);
        if (st > 0) pf.poison = st;
      }
      if (a && a.setAmount0) pf.hydra = 1;
      return pf;
    });
    const amount = Math.max(0, Math.round(info.amount || 0)), hpVor = Math.max(0, Math.round(info.hpVor || 0));
    const seite = engine.physicalSide ? engine.physicalSide(loc.kind === 'creature' ? loc.inst : null) : null;
    const payload = {
      srcOwner: source.heroOwner ?? source.owner ?? -1, srcHeroIdx: source.heroIdx ?? -1,
      tgt: loc.kind === 'hero'
        ? { kind: 'hero', owner: loc.owner, heroIdx: loc.heroIdx }
        : { kind: 'creature', owner: seite ?? loc.owner, heroIdx: loc.heroIdx, zoneSlot: loc.slotIdx },
      vorBurn: loc.kind === 'hero' ? (target.statuses?.burned ? 1 : 0) : (target.counters?.burned ? 1 : 0),            // Status VOR der Salve (Anzeige zaehlt von hier weiter)
      vorPoison: loc.kind === 'hero' ? (target.statuses?.poisoned ? (target.statuses.poisoned.stacks || 1) : 0) : (target.counters?.poisoned ? (target.counters.poisonStacks || 1) : 0),
      arrows, total: amount, hpVor, hpNach: Math.max(0, hpVor - amount), maxHp: Math.max(1, Math.round(info.maxHp || (loc.kind === 'creature' ? engine._getCardDB?.()?.[target.name]?.hp : 0) || hpVor || 1)),
      seed: ((engine.gs?.turn || 1) * 131 + (engine._damageCallsTotal || 0) * 17 + namen.length) & 0xffff,
    };
    const sch = engine._pfeilSchild;
    if (sch && sch.aktiv) {                                    // die zurueckgehaltene Standard-Animation reist als Ersatz mit
      const t0 = sch.puffer.length ? sch.puffer[0][3] : 0;
      if (sch.puffer.length) payload.ersatz = sch.puffer.map(([ev, data, , t]) => [ev, data, t - t0]);   // Abstand zum ersten Ereignis (ms)
      sch.puffer = []; sch.aktiv = false; sch.fertig = true;   // ab hier laufen Folgeanimationen (Statuswirkungen, Reaktionen) wieder wie gewohnt
    }
    engine._broadcastEvent('play_arrow_salvo', payload);
    await engine._delay(PFEIL_SALVE_MS);
    return true;
  } catch (e) { try { console.error('[Pfeilsalve]', e.message); } catch (e2) { /* still */ } return false; }
}

// ───────────── internals ─────────────

/** Resolve the Hero object from an attack damage source. */
function heroFromSource(engine, source) {
  // Styx 28.9.: Angriffe geliehener Helden tragen `heroOwner` (Brettseite);
  // `owner` ist der Kontrolleur.
  const seite = source.heroOwner ?? source.owner ?? source.controller ?? -1;
  const hi = source.heroIdx ?? -1;
  if (seite < 0 || hi < 0) return null;
  return engine.gs.players[seite]?.heroes?.[hi] || null;
}

/** Collapse a damage-target (hero object OR creature instance) into a
 *  { kind, owner, heroIdx, slotIdx?, inst? } descriptor. */
function resolveTargetLocation(engine, target) {
  // Hero
  for (let p = 0; p < engine.playerCount(); p++) {
    const ps = engine.gs.players[p];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (ps.heroes[hi] === target) return { kind: 'hero', owner: p, heroIdx: hi };
    }
  }
  // Creature — target IS a CardInstance
  if (target?.zone === 'support' && typeof target.id === 'string') {
    return { kind: 'creature', owner: target.owner, heroIdx: target.heroIdx, slotIdx: target.zoneSlot, inst: target };
  }
  return null;
}

async function applyBurnToTarget(engine, pi, loc, sourceLabel) {
  if (loc.kind === 'hero') {
    // „the target" des Angriffs steht fest (Als Ruling 9.10.).
    await engine.addHeroStatus(loc.owner, loc.heroIdx, 'burned', {
      appliedBy: pi, _skipReactionCheck: true, festesZiel: true,
    });
  } else if (loc.kind === 'creature' && loc.inst) {
    const applied = await engine.applyCreatureStatus(loc.inst, 'burned', {
      sourceOwner: pi,
      source: sourceLabel,
    });
    if (applied) engine.log('creature_burned', { card: loc.inst.name, owner: loc.inst.owner, by: sourceLabel });
  }
}

async function applyPoisonStacksToTarget(engine, pi, loc, stacks, sourceLabel) {
  if (stacks <= 0) return;
  if (loc.kind === 'hero') {
    await engine.addHeroStatus(loc.owner, loc.heroIdx, 'poisoned', {
      addStacks: stacks, appliedBy: pi, _skipReactionCheck: true, festesZiel: true,   // „the target" des Angriffs (Als Ruling 9.10.)
    });
  } else if (loc.kind === 'creature' && loc.inst) {
    await engine.applyCreatureStatus(loc.inst, 'poisoned', {
      stacks, addStacks: true,
      sourceOwner: pi,
      source: sourceLabel,
    });
    engine.log('creature_poisoned', {
      card: loc.inst.name, owner: loc.inst.owner, stacks, total: loc.inst.counters?.poisonStacks, by: sourceLabel,
    });
  }
}

/**
 * Find the most recent Arrow chain link owned by `pi` that hasn't been
 * flagged as already-retriggered by an Arrow Slit. Used by Arrow Slit
 * to pick WHICH Arrow to re-activate.
 *
 * Pass `stopIdx` (Slit's own chain index) at resolve time so the scan
 * runs backwards from just BEFORE Slit — matching the card text's
 * "when you activate an Arrow Artifact". Without the stop index, an
 * Arrow chained ON TOP of Slit in the build phase would be picked
 * first because LIFO resolution processes higher indices first (and
 * they'd already be in the chain array at resolve time).
 *
 * At reactionCondition time the Slit isn't in the chain yet, so callers
 * pass no stopIdx and the scan simply goes from the end — which is
 * identically "the last arrow played so far". We tag the chosen link
 * with `_retriggeredByArrowSlit` so a subsequent Slit finds a
 * DIFFERENT arrow (multi-Slit stacking).
 */
function pickLastUntriggeredArrowLink(pi, chain, stopIdx = null) {
  const { loadCardEffect } = require('./_loader');
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const start = (typeof stopIdx === 'number' && stopIdx >= 0)
    ? stopIdx - 1
    : chain.length - 1;
  for (let i = start; i >= 0; i--) {
    const link = chain[i];
    if (link.isInitialCard) continue;
    if (link.owner !== pi) continue;
    if (link._retriggeredByArrowSlit) continue;
    const script = loadCardEffect(link.cardName);
    if (script?.isArrow) return link;
  }
  return null;
}

module.exports = {
  arrowTriggerCondition,
  attackDealsNoDamage,
  armAttackerWithArrow,
  noteArrowActivated,
  applyArrowsBeforeDamage,
  applyArrowsZero,
  heroHatScharfeHydra,
  hydraScharf,
  hydraWirdNullen,
  applyArrowsAfterDamage,
  clearArmedArrows,
  pfeilNamen,
  pfeilSchildOeffnen,
  pfeilSchildSchliessen,
  pfeilSalve,
  PFEIL_SCHILD_EVENTE,
  PFEIL_SALVE_MS,
  pickLastUntriggeredArrowLink,
};
