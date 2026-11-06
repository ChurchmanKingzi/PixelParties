// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Hydra"
//  Creature (Decay Magic + Summoning Magic Lv 5,
//  150 HP — Cute archetype, currently BANNED).
//
//  Four effects:
//
//  1. DELETE-RESCUE — "if would be deleted from
//     anywhere": implemented through the engine's
//     universal `beforeDelete(ctx)` callback.
//     The engine fires it from EVERY delete path
//     (mill-to-deleted, forced-discard with
//     deleteMode, hand-limit with deleteMode,
//     actionMoveCard to deleted) BEFORE the
//     destination push, giving Hydra a single
//     interception point regardless of where the
//     card lived. On rescue, Hydra summons a
//     fresh copy to the chosen Support Zone and
//     sets `ctx.rescued = true` so the engine
//     skips the actual deletion.
//
//  2. HEAD COUNTERS ON SUMMON — when summoned, the
//     player marks 2 or more cards in their hand as
//     ONE batch (`handPick`, min 2, max = whole
//     hand; the cards stay in hand until Confirm,
//     no Cancel — the discard is a mandatory cost).
//     W74b (Al): flow Batch → Confirm → Boris →
//     Abwurf → Counter:
//       a) the player marks the batch and presses
//          Confirm (X = number of marked cards);
//       b) Boris, the Guardian of Blackport (if the
//          Hydra's CONTROLLER has an effective one
//          and has not used his once-per-turn skip)
//          is asked ONCE for the whole batch
//          (`engine.borisVerzicht(pi, X, …)`);
//       c) no skip: all marked cards are discarded
//          ONE BY ONE (usual discard animation,
//          per-card `onDiscard` hooks, one
//          discard batch for Cute Bunny & co.);
//       d) skip: NOTHING is discarded — the discard
//          is a cost, and skipping a cost does not
//          negate the effect;
//       e) either way Hydra gains X + 1 Head
//          Counters (W71a: "that many +1"; with
//          skipped discard X = size of the batch).
//     The delete-rescue / place-from-discard paths
//     run through the very same `onPlay`.
//
//  HARD GATE — Hydra's `canSummon` REFUSES to
//  let the engine surface her as playable when
//  the controller has fewer than 2 OTHER cards
//  in hand (counting non-Hydra hand cards), since
//  she demands 2+ discards on entry. With Hydra
//  herself in hand, that means hand size ≥ 3
//  before the summon path is even offered.
//  Tutored summons (Hydra not in hand at decision
//  time) require hand size ≥ 2.
//
//  3. HOPT MULTI-TARGET DAMAGE — once per turn,
//     pick up to `headCounter` different targets
//     (heroes or creatures, any side) and deal
//     100 damage to each.
//
//  4. DEFEAT → DELETE — when Hydra dies, route
//     her from discard pile to deleted pile.
//     Listener fires AFTER the death moves her
//     into discardPile, so we splice and re-push.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Hydra';
const RESCUE_HAND_THRESHOLD = 3;
const SUMMON_DISCARD_MIN = 2;
const HOPT_DAMAGE = 100;
/** W71a (Al): "place that many Head Counters +1 on it" - X abgeworfene Karten geben X+1 Counter. */
const HEAD_BONUS = 1;

// ─── HELPERS ─────────────────────────────

/**
 * Heroes that can host a fresh Cute Hydra summon RIGHT NOW. Standard
 * gate plus the spell-school / Lv5 level requirement (handled
 * generically via `engine.heroMeetsLevelReq`).
 */
function getHostHeroes(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  if (ps.summonLocked) return [];
  const cardDB = engine._getCardDB();
  const cd = cardDB[CARD_NAME];
  if (!cd) return [];
  const out = [];
  // Kontrolle statt Seite (Styx 28.9.) — „a Hero that can summon it"
  // unter den Helden, die `pi` KONTROLLIERT; Pruefung an der physischen
  // Adresse. Ergebnis: `{ physOwner, heroIdx }`.
  for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(pi)) {
    if (!h?.name || h.hp <= 0) continue;
    if (!require('./_summon-eligibility').heroAgiert(h)) continue;   // Welle 11 (Al, R5): „summon" erfordert einen aktionsfähigen Beschwörer (nicht Frozen/Stunned/Webbed/Bound/Negated) — `heroAgiert`.
    // W63a (Al, 22.10.2026: Alices Effekt gilt fuer ALLE Beschwoerungs-Effekte): freie Zone ODER — mit Alice-Teilung — die Zone einer gleichnamigen Cute Hydra.
    if (!engine.hatBeschwoerZone(pi, CARD_NAME, { seite: physOwner, heroIdx: hi, nurBasis: true, namedHeroesOnly: true })) continue;
    if (!engine.heroMeetsLevelReq(physOwner, hi, cd, physOwner !== pi ? { levelSourcePi: pi } : {})) continue;
    out.push({ physOwner, heroIdx: hi });
  }
  return out;
}

/**
 * W74b: wie viele Karten die CPU abwirft (X): so viele, dass die Head Counter (X + HEAD_BONUS) die brauchbaren gegnerischen Ziele
 * decken - aber nie weniger als die Pflicht (SUMMON_DISCARD_MIN). Dieselbe Rechnung wie vorher je Klick ("Done" sobald Counter >= Ziele).
 */
function zaehleGegnerZiele(engine, pi) {
  const opp = engine.gs.players[engine.opponentOf(pi)];
  let viableTargets = 0;
  if (opp) {
    for (const h of (opp.heroes || [])) if (h?.name && h.hp > 0) viableTargets++;
    for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
      for (let z = 0; z < 3; z++) if ((opp.supportZones?.[hi]?.[z] || []).length > 0) viableTargets++;
    }
  }
  return viableTargets;
}

function cpuZielzahlAbwurf(engine, cpuIdx) {
  return Math.max(SUMMON_DISCARD_MIN, zaehleGegnerZiele(engine, cpuIdx) - HEAD_BONUS);
}

// ── W77b (Al, zu W74b-Frage 11): Kosten-Abwurf-Lernkanal ──────────────────────────────────────────────────────────────
// Grundversion bleibt; die CPU soll im TRAINING lernen, welche Karten sie nie oder nur unter Voraussetzungen abwerfen sollte und welche Ziele (Low-Worth Creatures) den
// Extra-Counter nicht wert sind. Dafuer traegt der Batch-Prompt die Kanal-Marken (`costFor` / `costKind` / `costTags`, siehe `_deck-profile.costDiscardTags`,
// `_decision-log` „Kosten-Abwurf-Lernkanal"), und nach dem Abwurf haengt `noteCostDiscardOutcome` die Groesse des Stapels an die Zeile. Keine eigene Lernlogik hier.
/** Lage-Tags VOR der Wahl: wie viele brauchbare gegnerische Ziele (Helden + Kreaturen) gibt es, wie viele davon sind Low-Worth (Kreaturen bis Stufe 1)? */
function lageTags(engine, pi) {
  const ziele = zaehleGegnerZiele(engine, pi);
  const tags = [ziele <= 1 ? 'hydraTargets0-1' : ziele <= 3 ? 'hydraTargets2-3' : ziele <= 5 ? 'hydraTargets4-5' : 'hydraTargets6+'];
  try {
    const oi = engine.opponentOf(pi);
    const kreaturen = engine.cardInstances.filter(c => (c.controller ?? c.owner) === oi && c.zone === 'support' && !c.faceDown && engine._getCardDB()[c.name]?.cardType === 'Creature');
    const billig = kreaturen.filter(c => (engine._getCardDB()[c.name]?.level || 0) <= 1).length;
    tags.push(kreaturen.length === 0 ? 'hydraNoCreatures' : billig === kreaturen.length ? 'hydraOnlyLowWorth' : billig > 0 ? 'hydraSomeLowWorth' : 'hydraNoLowWorth');
  } catch { /* ohne Tag */ }
  return tags;
}
/** Ausgangs-Tags NACH der Wahl: Stapelgroesse und ob die Counter (X + 1) mehr sind, als es brauchbare Ziele gibt (verschenkter Counter). */
function ausgangsTags(engine, pi, x) {
  const ziele = zaehleGegnerZiele(engine, pi);
  return [x <= 2 ? 'hydraX2' : x === 3 ? 'hydraX3' : 'hydraX4+', x + HEAD_BONUS > ziele ? 'hydraOverkill' : 'hydraNoOverkill'];
}

/**
 * W74b: die Antwort der Batch-Auswahl pruefen (der Server glaubt dem Client nicht): nur verschiedene Plaetze, Name stimmt noch.
 * Weniger als `minPick` gueltige Karten (kaputte/fehlende Antwort): der Rest wird von rechts aufgefuellt - der Abwurf ist
 * eine Pflichtkoste, genau wie der Notfall-Abwurf der Engine (`actionPromptForceDiscard`).
 * @returns {{handIndex:number, cardName:string}[]} aufsteigend nach Handplatz
 */
function pruefeAbwurfWahl(res, hand, minPick) {
  const sel = res && !res.cancelled && Array.isArray(res.selectedCards) ? res.selectedCards : [];
  const seen = new Set();
  const out = [];
  for (const g of sel) {
    if (!g || !Number.isInteger(g.handIndex) || seen.has(g.handIndex)) continue;
    if (hand[g.handIndex] == null || hand[g.handIndex] !== g.cardName) continue;
    seen.add(g.handIndex);
    out.push({ handIndex: g.handIndex, cardName: hand[g.handIndex] });
  }
  for (let i = hand.length - 1; i >= 0 && out.length < minPick; i--) {
    if (seen.has(i)) continue;
    seen.add(i);
    out.push({ handIndex: i, cardName: hand[i] });
  }
  return out.sort((x, y) => x.handIndex - y.handIndex);
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'hydra_goo' }, impactMs: 260,
  },

  // 'support' — HOPT effect, counter storage, defeat-redirect listener.
  // The delete-rescue (#1) does NOT go through `activeIn` filtering —
  // the engine calls `beforeDelete(ctx)` as a top-level script export
  // for any card name about to hit a deletedPile, regardless of
  // whether that card has a tracked instance anywhere.
  activeIn: ['support'],

  // ── CPU prompt overrides ──────────────────────────────────────────
  // Two Hydra-titled prompts route through here:
  //   • `confirm` "🐉 Summon!" (delete-rescue) — engine default would
  //     decline cancellable confirms, so override to confirm. Cost is
  //     the standard hand-discards fired via `onPlay` after the
  //     summon, which the brain answers (least-bad pick) below.
  //   • `handPick` (W74b: the ONE batch selection of the head-counter
  //     cost) — the CPU marks the least valuable cards: at least 2, and
  //     no more than it takes for the Head Counters (X + 1) to cover the
  //     viable enemy target pool (each Head Counter past that is wasted,
  //     the HOPT caps at "different targets" = headCounter). Each pick
  //     is delegated to the brain's own `forceDiscard` scorer (or the
  //     engine default without a brain: first eligible card), so the
  //     per-card valuation is the same one every other discard uses.
  //   • `forceDiscard` (title Hydra) — only used by the delegation above;
  //     defer to default (least-bad scoring).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    const type = promptData?.type;

    // Delete-rescue confirm — always summon. Default declines.
    if (type === 'confirm' && /Summon/i.test(promptData.confirmLabel || '')) {
      return { confirmed: true };
    }

    if (type === 'forceDiscard') return undefined;

    if (type === 'handPick' && promptData.hydraBatchDiscard) {
      // The prompt names its player (`controllerIdx`) - otherwise the CPU on seat 1 would count the targets of its OWN side.
      const cpuIdx = promptData.controllerIdx ?? engine._cpuPlayerIdx;
      const ps = engine.gs.players[cpuIdx];
      const eligible = (promptData.eligibleIndices || []).filter(i => ps?.hand?.[i] != null);
      if (!ps || eligible.length === 0) return { selectedCards: [] };
      const minPick = Math.min(promptData.minSelect ?? SUMMON_DISCARD_MIN, eligible.length);
      const want = Math.min(eligible.length, Math.max(minPick, cpuZielzahlAbwurf(engine, cpuIdx)));
      const rest = eligible.slice();
      const out = [];
      while (out.length < want && rest.length > 0) {
        const r = engine._getCpuGenericResponse(
          { type: 'forceDiscard', title: CARD_NAME, eligibleIndices: rest.slice(), controllerIdx: cpuIdx }, cpuIdx);
        let idx = r && Number.isInteger(r.handIndex) && rest.includes(r.handIndex) ? r.handIndex : rest[0];
        out.push({ handIndex: idx, cardName: ps.hand[idx] });
        rest.splice(rest.indexOf(idx), 1);
      }
      return { selectedCards: out };
    }

    return undefined;
  },

  // ── HARD SUMMON GATE ───────────────────────────────────────────
  // Hydra demands 2+ discards on entry. If the controller can't
  // afford that — i.e. the would-be hand AFTER Hydra leaves wouldn't
  // contain at least 2 cards — refuse the summon outright. The engine
  // checks this before surfacing Hydra as a playable Creature:
  //   • From-hand path: needs hand ≥ 3 (2 others + Hydra herself).
  //   • Tutor / placement path: needs hand ≥ 2 (Hydra isn't in hand).
  canSummon(ctx) {
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    const hand = ps.hand || [];
    // If Hydra is in hand, she'll leave on summon — the discardable
    // pool is hand minus 1. If she's elsewhere (deck-tutor, etc.),
    // hand is the discardable pool as-is.
    const hydraInHand = hand.includes(CARD_NAME);
    const discardablePool = hydraInHand ? hand.length - 1 : hand.length;
    return discardablePool >= SUMMON_DISCARD_MIN;
  },

  // ── 1. DELETE-RESCUE (universal) ───────────────────────────────
  // Engine entrypoint: `engine._tryBeforeDelete(...)`. Fires from
  // every delete path between source-zone removal and the deletedPile
  // push. By this point the card is already out of its old zone (or
  // has had its support-zone slot cleared), so a successful rescue
  // just needs to summon a fresh copy and untrack the orphan.
  async beforeDelete(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return;

    // Two preconditions on the controller side: 3+ cards in hand AND
    // at least one Hero who can host a fresh Lv5 Cute Hydra summon
    // RIGHT NOW (alive, not Frozen/Stunned, free Support slot, meets
    // school + level requirements; controller not summon-locked).
    if ((ps.hand || []).length < RESCUE_HAND_THRESHOLD) return;
    const hosts = getHostHeroes(engine, pi);
    if (hosts.length === 0) return;

    const confirmed = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `${CARD_NAME} would be deleted from ${ctx.fromZone || 'play'}! Summon her as an additional Action instead?`,
      confirmLabel: '🐉 Summon!',
      cancelLabel: 'No',
      cancellable: true,
      gerrymanderEligible: true, // True "you may" — opt-in rescue summon.
    });
    if (!confirmed || confirmed.cancelled || confirmed.confirmed === false) return; // ctx.rescued stays false → deletion proceeds

    // Pick destination Support Zone.
    // Kontrolle statt Seite (Styx 28.9.): Zonen tragen `owner` (physische Seite).
    let zones = [];
    for (const { physOwner, heroIdx: hi } of hosts) {
      const hName = engine.gs.players[physOwner].heroes[hi].name;
      // W63a: freie Zonen UND (Alice-Teilung) die Zone einer gleichnamigen Cute Hydra — `engine.beschwoerZonenFuer`
      for (const zz of engine.beschwoerZonenFuer(pi, CARD_NAME, { seite: physOwner, heroIdx: hi, nurBasis: true, namedHeroesOnly: true })) {
        zones.push({ owner: physOwner, heroIdx: hi, slotIdx: zz.slotIdx, label: `${hName} — Support ${zz.slotIdx + 1}${zz.shared ? ` (×${zz.stackDepth})` : ''}`, ...(zz.shared ? { shared: true, stackDepth: zz.stackDepth } : {}) });
      }
    }
    zones = require('./_alice-shared').geteiltZuerst(zones);   // W63a (Al): erst die geteilte Zone, DANN die erste leere
    if (zones.length === 0) return; // unreachable (host check passed) but safe

    let chosen;
    if (zones.length === 1) {
      chosen = zones[0];
    } else {
      const picked = await engine.promptGeneric(pi, {
        type: 'zonePick',
        zones,
        title: CARD_NAME,
        description: `Choose a Support Zone to summon ${CARD_NAME} into.`,
        cancellable: false,
      });
      chosen = zones.find(z => z.owner === (picked?.owner ?? pi) && z.heroIdx === picked?.heroIdx && z.slotIdx === picked?.slotIdx)
        || zones.find(z => z.heroIdx === picked?.heroIdx && z.slotIdx === picked?.slotIdx) || zones[0];
    }

    // Untrack the orphaned source instance (if any). For hand-deletes
    // this is the in-hand instance; for board-moves it's the support
    // instance; for deck-mills it's null.
    if (ctx.fromInstance) {
      engine._untrackCard(ctx.fromInstance.id);
    }

    // Summon a fresh Hydra. summonCreatureWithHooks → onPlay → effect
    // #2 (head counter setup with a fresh discard prompt).
    // v1389: Aus der ABLAGE gerettet → Beschwörung aus der Ablage
    // (Signal, SC; Als Ruling 25.9.). Andere Herkunft bleibt eine
    // normale Beschwörung.
    const ausAblage = ctx.fromZone === 'discard';
    const ab = ausAblage ? (ctx.ablage || { name: CARD_NAME, pileOwner: pi, pi, lethe: 0, idx: null }) : null;
    const res = await engine.summonCreatureWithHooks(
      CARD_NAME, chosen.owner, chosen.heroIdx, chosen.slotIdx,
      { source: CARD_NAME, ...(chosen.owner !== pi ? { controller: pi } : {}),
        ...(ausAblage ? { hookExtras: engine.ablageHookExtras() } : {}) }
    );
    if (ab && res?.inst) engine.ablageLandung(res.inst, ab, 'summon');

    // Stamp the rescue flag — engine reads this to skip the actual
    // pile push.
    ctx.rescued = true;

    engine.log('cute_hydra_delete_rescue', {
      player: ps.username, heroIdx: chosen.heroIdx,
      fromZone: ctx.fromZone, source: ctx.source,
    });
    engine.sync();
  },

  // ── 2. HEAD COUNTERS ON SUMMON ──────────────────────────────────
  // ★★ v1134: dasselbe Muster wie „Hell Fox" — die Karte routet ihren
  // Kadaver beim Tod von der Ablage ins Geloeschte um. Ohne diese
  // Deklaration fliegt sie sichtbar ZUERST zur Ablage, und der
  // Diff-Animator schickt sie gleich darauf ein zweites Mal weiter.
  deletesSelfOnDeath: true,

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;

      const engine = ctx._engine;
      // Kontrolle statt Seite (Styx 28.9.): ueber einen uebernommenen
      // Helden beschworen steht die Hydra auf der Gegenseite
      // (`cardOwner` = Feldseite) — abgeworfen wird aus der Hand des
      // Beschwoerers.
      const pi     = ctx.cardController ?? ctx.cardOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      if (!inst.counters) inst.counters = {};

      // W74b (Al): EINE Batch-Auswahl statt Einzel-Abwurf je Klick. Der Spieler markiert >= 2 Handkarten (bis zur ganzen Hand), die
      // bleiben bis zum Confirm auf der Hand; kein Abbrechen (Pflicht-Abwurf wie bisher, `canSummon` sichert die Mindestzahl).
      // Danach fragt Boris EINMAL fuer den ganzen Stapel; ohne Verzicht fliegen die Karten nacheinander in die Ablage.
      // Der Abwurf ist eine KOSTE: verzichtet Boris, entfaellt nur der Abwurf - die Counter (X + 1) bekommt die Hydra trotzdem.
      const handNow = ps.hand || [];
      let discarded = 0;
      let skipped = false;
      let batchSize = 0;
      if (handNow.length > 0) {
        const minPick = Math.min(SUMMON_DISCARD_MIN, handNow.length);
        const res = await engine.promptGeneric(pi, {
          type: 'handPick',
          title: CARD_NAME,
          description: `Mark ${minPick} or more cards from your hand to discard (up to ${handNow.length}). `
            + `Each becomes a Head Counter on ${CARD_NAME}, plus ${HEAD_BONUS} more.`,
          eligibleIndices: handNow.map((_, i) => i),
          minSelect: minPick,
          maxSelect: handNow.length,
          confirmLabel: '🐉 Discard marked cards',
          cancellable: false,
          hydraBatchDiscard: true,   // fuer cpuResponse (CPU-Batch)
          controllerIdx: pi,
          // W77b: Kosten-Abwurf-Lernkanal (`_decision-log` -> `_costDiscardLog`): der Abwurf ist die KOSTE fuer Counter = kuenftiger Schaden.
          costFor: CARD_NAME,
          costKind: 'damage',
          costTags: lageTags(engine, pi),
        });
        const chosen = pruefeAbwurfWahl(res, ps.hand || [], minPick);
        batchSize = chosen.length;
        // W77b: Ausgangs-Tags an die Zeile des Lernkanals (juengste Zeile dieser Quelle im Zug) — Stapelgroesse und Overkill.
        if (batchSize > 0) engine.noteCostDiscardOutcome(pi, CARD_NAME, ausgangsTags(engine, pi, batchSize));

        if (batchSize > 0) {
          // Boris, the Guardian of Blackport: EIN Abwurf-Stapel = EINE Frage (nur fuer den Kontrolleur; verbraucht/unwirksam = keine Frage).
          // Kein fremder Zwangsabwurf (selbst bezahlte Kosten) -> kein Ambush-Fenster, nur Boris.
          skipped = await engine.borisVerzicht(pi, batchSize, { source: CARD_NAME });
          if (!skipped) {
            // W16c (A04-16): die Abwuerfe sind EIN Batch, damit Cute Bunny ("2 or more ... through an effect") reagiert.
            await engine.withDiscardBatch(pi, { source: CARD_NAME }, async () => {
              // Nacheinander, von links nach rechts: jede Karte rueckt nach dem Abwurf eine Stelle auf (Index - bereits abgeworfene).
              for (const c of chosen) {
                const ok = await engine.actionDiscardHandCard(pi, c.cardName, c.handIndex - discarded, { source: CARD_NAME });
                if (!ok) break;
                discarded++;
                engine.sync();
              }
            });
          }
        }
      }

      if (discarded > 0 || skipped) {
        // W71a (Al): "place that many Head Counters +1 on it" = X+1. W74b: bei Boris-Verzicht ist X die Groesse des Stapels.
        const x = skipped ? batchSize : discarded;
        const gained = x + HEAD_BONUS;
        // Klang: kein Aufruf noetig - der Client vergleicht die Zaehler-Summen je Zustand (`ppZaehlerSummen`, app-board.jsx) und spielt bei jedem
        // Anstieg von `headCounter` (wie bei allen Feldern `…Counter(s)`) den Zaehler-Klang.
        inst.counters.headCounter = (inst.counters.headCounter || 0) + gained;
        engine.log('cute_hydra_head_counters', {
          player: ps.username, gained, discarded,
          ...(skipped ? { skippedByBoris: batchSize } : {}),
          total: inst.counters.headCounter,
        });
      } else {
        engine.log('cute_hydra_summon_no_counters', {
          player: ps.username, reason: 'no_discards',
        });
      }
      engine.sync();
    },

    // ── 4. DEFEAT → DELETE ──
    // Engine routes a dead Creature to its original owner's discardPile
    // BEFORE firing onCreatureDeath. Re-route by splicing the just-
    // pushed name from discardPile and pushing into deletedPile.
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;

      const engine = ctx._engine;
      const ownerPs = engine.gs.players[death.originalOwner ?? death.owner];
      if (!ownerPs) return;

      // v1389: Entnahme über die EINE Ablage-Stelle — und das Löschen
      // läuft jetzt durch die Rettung („would be deleted from anywhere").
      // Bis v1388 schob dieser Weg direkt in den Deleted Pile, die eigene
      // Rettung beim Tod griff also nie. Gerettet = aus der Ablage
      // beschworen (Als Ruling 25.9.).
      const ownerIdx = death.originalOwner ?? death.owner;
      const ab = await engine.ablageEntnahme(ctx.cardOwner, ownerIdx, CARD_NAME, { source: CARD_NAME, last: true });
      if (!ab) return; // Already routed elsewhere.
      const gerettet = await engine._tryBeforeDelete(CARD_NAME, ownerIdx, {
        fromZone: 'discard', source: CARD_NAME, ablage: ab,
      });
      if (gerettet) {
        engine.log('delete_rescued', { card: CARD_NAME, from: 'discard', source: CARD_NAME });
        return;
      }
      ownerPs.deletedPile.push(CARD_NAME);

      engine.log('cute_hydra_self_delete', {
        player: ownerPs.username,
      });
      engine.sync();
    },
  },

  // ── 3. HOPT MULTI-TARGET DAMAGE ────────────────────────────────
  creatureEffect: true,
  requiresTarget: true,   // Zielwahl-Effekt: Blinded sperrt ihn (siehe _hooks.js / getActivatableCreatures)

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    return !!(inst?.counters?.headCounter && inst.counters.headCounter > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst   = ctx.card;
    const pi     = ctx.cardOwner;
    if (!inst) return false;

    const heads = inst.counters?.headCounter || 0;
    if (heads <= 0) return false;

    // „Up to as many different targets as Head Counters": die Zahl begrenzen nur die Counter - NICHT die Ein-Ziel-Flaggen des Helden in
    // der Spalte (Toras „never more than 1 target with an Attack", Ida, Friedhelm): der Hydra-Schlag ist weder Attack noch Zauber des Helden
    // (`promptMultiTarget` nimmt Kreatureneffekte davon aus, Befund 31.10.: Hydra in Toras' Spalte traf nur 1 Ziel).
    const selected = await ctx.promptMultiTarget({
      side: 'any',
      types: ['hero', 'creature'],
      min: 1,
      max: heads,
      baseDamage: HOPT_DAMAGE,
      title: CARD_NAME,
      description: `Choose up to ${heads} different target${heads > 1 ? 's' : ''}. Deal ${HOPT_DAMAGE} damage to each.`,
      confirmLabel: `🐲 Strike! (${HOPT_DAMAGE} ×N)`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!Array.isArray(selected) || selected.length === 0) return false;

    const dmgSource = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx };

    // Hit each chosen target. Animation per target so multi-strike
    // plays clearly. Damage type 'creature' (general creature-effect
    // damage — not destruction, not status). Cute Hydra spits viscous
    // purple goo onto each target via the dedicated `hydra_goo`
    // animation (see ANIM_REGISTRY in app-board.jsx / app.jsx).
    // ★★ v1185: Flaechenklammer + Anti-AoE-Fenster. „Bis zu N
    // verschiedene Ziele, HOPT_DAMAGE auf jedes" ist ein Schlag auf
    // mehrere Ziele; die Koepfe schlagen weiter nacheinander zu.
    await engine.beginAoeStrike(selected.length, {
      creatures: selected.filter(t => t.type !== 'hero').map(t => t.cardInstance).filter(Boolean),
      heroes: selected.filter(t => t.type === 'hero'),   // W78 (Pythia): Helden, die dieser Schlag faellt, sind todgeweiht
      source: dmgSource, amount: HOPT_DAMAGE, type: 'creature', sourceOwner: pi,
    });
    try {
    for (const target of selected) {
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'hydra_goo',
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(200);

      if (target.type === 'hero') {
        const h = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (h && h.hp > 0) {
          await engine.actionDealDamage(dmgSource, h, HOPT_DAMAGE, 'creature');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          dmgSource, target.cardInstance, HOPT_DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }
    } finally {
      await engine.endMultiHit();
    }

    engine.log('cute_hydra_strike', {
      player: engine.gs.players[pi]?.username,
      targets: selected.map(t => t.cardName),
      damagePerTarget: HOPT_DAMAGE,
      headCounters: heads,
    });
    engine.sync();
    return true;
  },

  cpuMeta: {
    // Death routes to deletedPile (no recursion bait for opponents),
    // but the rescue-from-delete clause makes deletion costly.
    onDeathBenefit: 0,

    // Eval threat estimate — each Head Counter caps the number of
    // distinct targets the HOPT can hit for 100 each. Useful damage
    // tops out at the count of viable enemy targets, so we credit
    // 100 × min(heads, viableTargets) as the per-turn damage threat.
    // The evaluator iterates this for both sides (symmetric).
    threatScore(engine, inst, viableTargetsAgainstOpp) {
      if (inst.zone !== 'support') return 0;
      if (inst.faceDown) return 0;
      if (inst.counters?.negated || inst.counters?.nulled) return 0;
      const heads = inst.counters?.headCounter || 0;
      if (heads <= 0) return 0;
      if (viableTargetsAgainstOpp <= 0) return 0;
      return 100 * Math.min(heads, viableTargetsAgainstOpp);
    },
  },
};
