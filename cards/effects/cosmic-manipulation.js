// ═══════════════════════════════════════════
//  CARD EFFECT: "Cosmic Manipulation"
//  Spell (Summoning Magic Lv2, Reaction)
//  Cosmic Depths archetype.
//
//  TRIGGER: you summon a Creature DIRECTLY FROM
//  YOUR DECK (e.g., via Arrival's second-half
//  summon, The Cosmic Depths Area, Cosmic
//  Manipulation's own re-summon chains, future
//  deck-summoners). Detected via the
//  `_summonedFromDeck` flag passed in hookExtras
//  by the summoning script.
//
//  EFFECT:
//  1. Draw cards equal to the summoned Creature's
//     level.
//  2. Shuffle FLOOR(N/2) cards from your hand back
//     into your deck.
//  3. Place 1 Change Counter on a card you control
//     that "can place Change Counters onto itself"
//     (Analyzer / Gatherer / Argos) per shuffled-
//     back card.
//
//  HOPT: 1 Cosmic Manipulation per turn.
//
//  Hooks via the engine's universal post-summon
//  hand-reaction window (see
//  _checkPostSummonHandReactions). Standard chain
//  reaction window doesn't fire on hand-summons
//  reliably for revives/effect-summons, so the
//  dedicated post-summon hook is the only path
//  that catches all deck-direct summon types.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  SELF_COUNTERING_CARDS, addChangeCounters,
} = require('./_cosmic-shared');

const CARD_NAME = 'Cosmic Manipulation';
const HOPT_KEY = 'cosmic-manipulation';

function hoptUsed(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn;
}
function stampHopt(gs, pi) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;
}

/** Cards on pi's side that are "self-countering" — Analyzer / Gatherer / Argos. */
function selfCounteringTargetsOnSide(engine, pi) {
  const out = [];
  // Argos (hero).
  const ps = engine.gs.players[pi];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (SELF_COUNTERING_CARDS.has(h.name)) {
      out.push({ kind: 'hero', owner: pi, heroIdx: hi, ref: h, cardName: h.name });
    }
  }
  // Analyzer / Gatherer (creatures).
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (!SELF_COUNTERING_CARDS.has(inst.name)) continue;
    out.push({
      kind: 'creature', owner: inst.owner, heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, ref: inst, cardName: inst.name,
    });
  }
  return out;
}

module.exports = {
  isPostSummonHandReaction: true, // Custom flag, see _checkPostSummonHandReactions.

  // Trigger only fires when the summon was DIRECT FROM DECK and we
  // haven't used Cosmic Manipulation this turn.
  postSummonReactionCondition(gs, summoningPi, engine, summonedInst, hookCtx) {
    if (hoptUsed(gs, summoningPi)) return false;
    if (!hookCtx?._summonedFromDeck) return false;
    return true;
  },

  async postSummonReactionResolve(engine, pi, summonedInst, hookCtx) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;
    if (hoptUsed(gs, pi)) return;
    stampHopt(gs, pi);

    const cardDB = engine._getCardDB();
    const cd = cardDB[summonedInst.name];
    const lvl = Math.max(0, cd?.level ?? 0);

    // ── Step 1: Draw N (= summoned Creature's level) ──
    if (lvl > 0 && !ps.handLocked) {
      await engine.actionDrawCards(pi, lvl);
    }

    // ── Step 2: Shuffle floor(N/2) cards from hand back into deck ──
    const shuffleTarget = Math.floor(lvl / 2);
    let shuffled = 0;
    if (shuffleTarget > 0 && (ps.hand || []).length > 0) {
      const eligibleIndices = ps.hand.map((_, i) => i);
      const cap = Math.min(shuffleTarget, ps.hand.length);

      const handPick = await engine.promptGeneric(pi, {
        type: 'pickHandCard',
        title: CARD_NAME,
        description: `Shuffle ${cap} card${cap === 1 ? '' : 's'} from your hand back into your deck.`,
        eligibleIndices,
        maxSelect: cap,
        minSelect: cap,
        confirmLabel: '🌌 Shuffle Back',
        cancellable: false,
      });
      const picks = handPick?.selectedCards || [];
      // Splice in DESCENDING index order so earlier removals don't
      // shift later indices.
      const idxs = picks.map(p => p.handIndex).sort((a, b) => b - a);
      for (const i of idxs) {
        if (i < 0 || i >= ps.hand.length) continue;
        const name = ps.hand[i];
        ps.hand.splice(i, 1);
        ps.mainDeck.push(name);
        shuffled++;
      }
      if (shuffled > 0) engine.shuffleDeck(pi, 'main');
    }

    // ── Step 3: Place 1 Change Counter per shuffled card on a self-
    //            countering card (Analyzer / Gatherer / Argos). One
    //            picker per counter — the player can spread or pile up
    //            counters as they choose.
    if (shuffled > 0) {
      for (let i = 0; i < shuffled; i++) {
        const targets = selfCounteringTargetsOnSide(engine, pi);
        if (targets.length === 0) {
          engine.log('cosmic_manip_counter_fizzle', {
            player: ps.username, reason: 'no_self_countering_cards',
            remaining: shuffled - i,
          });
          break;
        }
        if (targets.length === 1) {
          addChangeCounters(engine, targets[0].ref, 1);
          continue;
        }
        const entries = targets.map(t => ({
          id: t.kind === 'hero'
            ? `hero-${t.owner}-${t.heroIdx}`
            : `equip-${t.owner}-${t.heroIdx}-${t.slotIdx}`,
          type: t.kind === 'hero' ? 'hero' : 'equip',
          owner: t.owner, heroIdx: t.heroIdx,
          slotIdx: t.slotIdx, cardName: t.cardName, cardInstance: t.ref,
        }));
        const picked = await engine.promptEffectTarget(pi, entries, {
          title: CARD_NAME,
          description: `Place Change Counter ${i + 1}/${shuffled} on which of your cards?`,
          confirmLabel: '🌌 Place',
          confirmClass: 'btn-info',
          cancellable: false,
          exclusiveTypes: false,
          maxPerType: { hero: 1, equip: 1 },
        });
        if (!picked || picked.length === 0) break;
        const tgt = targets.find(t => {
          const id = t.kind === 'hero'
            ? `hero-${t.owner}-${t.heroIdx}`
            : `equip-${t.owner}-${t.heroIdx}-${t.slotIdx}`;
          return id === picked[0];
        });
        if (!tgt) break;
        addChangeCounters(engine, tgt.ref, 1);
      }
    }

    engine.log('cosmic_manipulation_resolve', {
      player: ps.username, drewN: lvl, shuffled,
    });
    engine.sync();
  },
};
