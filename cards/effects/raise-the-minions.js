// ═══════════════════════════════════════════
//  CARD EFFECT: "Raise the Minions!"
//  Spell (Summoning Magic Lv2, Normal, Skeletons)
//
//  Choose up to 3 "Skeleton" Creatures from your discard pile and
//  place them into free Support Zones of the user.
//
//  "User" = the spell's caster. Each placement targets one of the
//  caster's living Heroes' free Support Zones (any Hero, any free
//  slot — same scope as Skeleton Necromancer's tutor).
//
//  Implementation:
//    1. Gallery picker (up to 3 distinct copies — duplicates allowed
//       because multiple of the same Skeleton may be in discard).
//    2. For each picked Skeleton, prompt for a free zone (auto-pick if
//       only one exists) and place via `actionPlaceCreature`.
//    3. Placements fire `onPlay` / `onCardEnterZone` with
//       `_summonedFromDiscard: true` so Skullmael / Vacarn aura logic
//       picks up "discard summon" and lets the Skeleton act this turn.
// ═══════════════════════════════════════════

const {
  isSkeletonCreature,
  findSkeletonsInDiscard,
} = require('./_skeleton-shared');

const CARD_NAME = 'Raise the Minions!';
const MAX_RAISES = 3;

/** Free Support Zone descriptors for ONE specific Hero. */
function getFreeSupportZonesForHero(ps, heroIdx) {
  const zones = [];
  if (!ps) return zones;
  const hero = ps.heroes?.[heroIdx];
  // ★ ALS REGEL (18.8.): der Kartentext sagt „PLACE them into free
  // Support Zones of the user" — bei „place" ist der Zustand des
  // Helden komplett egal. Die frühere Zeile schloss einen GEFALLENEN
  // Nutzer aus und liess den Spruch dann ins Leere laufen.
  // Der Namens-Check bleibt: „of the user" verlangt, dass in der
  // Spalte ueberhaupt ein Held steht. Siehe CARD_API,
  // „place ignores the host Hero entirely".
  if (!hero?.name) return zones;
  const slots = ps.supportZones?.[heroIdx] || [];
  for (let si = 0; si < 3; si++) {
    if ((slots[si] || []).length === 0) {
      zones.push({ heroIdx, slotIdx: si, label: `${hero.name}${hero.hp <= 0 ? ' (KO)' : ''} — Slot ${si + 1}` });
    }
  }
  return zones;
}

/**
 * ★ W62a: freie Zonen des Helden PLUS — mit Alice-Teilung des Nutzers — die Zonen, in denen schon nur GLEICHNAMIGE Kreaturen
 * liegen („Creatures with identical names … share 1 Support Zone"). Freie zuerst. Ohne `name` nur die freien.
 */
function zonenFuerHeld(engine, ps, pi, heroIdx, name) {
  const frei = getFreeSupportZonesForHero(ps, heroIdx);
  if (!name || !ps.heroes?.[heroIdx]?.name) return frei;
  const { canShareInto } = require('./_alice-shared');
  const geteilt = [];
  for (let si = 0; si < 3; si++) {
    if (!canShareInto(engine, pi, heroIdx, si, name)) continue;
    const h = ps.heroes[heroIdx];
    geteilt.push({ heroIdx, slotIdx: si, shared: true, label: `${h.name}${h.hp <= 0 ? ' (KO)' : ''} — Slot ${si + 1} (×${(ps.supportZones[heroIdx][si] || []).length})` });
  }
  return [...frei, ...geteilt];
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'necromancy_summon' }, impactMs: 260 },

  // Player-wide gate (is this card playable AT ALL this turn?). True
  // iff the caster has at least one Skeleton in their discard pile AND
  // at least one of their living Heroes has a free Support Zone.
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    const skelette = findSkeletonsInDiscard(ps, engine);
    if (skelette.length === 0) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (getFreeSupportZonesForHero(ps, hi).length > 0) return true;
      if (engine && skelette.some(c => zonenFuerHeld(engine, ps, pi, hi, c.name).length > 0)) return true;   // W62a: geteilte Zone (Alice)
    }
    return false;
  },

  // Per-Hero gate. Card text restricts placement to the casting Hero's
  // OWN free Support Zones, so a Hero with no free slots can't cast
  // this Spell at all (the client greys the card out for that Hero
  // direct socket plays re-check at line 8271 of _engine.js).
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    const skelette = findSkeletonsInDiscard(ps, engine);
    if (skelette.length === 0) return false;
    return skelette.some(c => zonenFuerHeld(engine, ps, pi, heroIdx, c.name).length > 0);   // W62a: frei ODER geteilte Zone (Alice)
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Casting-Hero-scoped free zones. This Spell can only place onto
      // the casting Hero's own Support Zones (matches `canPlayWithHero`
      // — the per-Hero gate already refuses casting from a Hero with
      // no free zones, but re-check here as a defensive guard against
      // any race where a zone got filled between gate-check and
      // resolution).
      const initialHeroZones = getFreeSupportZonesForHero(ps, heroIdx);
      // W62a: Build the gallery from discard (deduped by name with counts so the player can revive multiples of the same Skeleton).
      // Nur Skelette, fuer die der Held eine Zone hat (frei, oder — mit Alice-Teilung — die Zone einer gleichnamigen Creature).
      const inDiscard = findSkeletonsInDiscard(ps, engine).filter(c => zonenFuerHeld(engine, ps, pi, heroIdx, c.name).length > 0);
      if (inDiscard.length === 0) { gs._spellCancelled = true; return; }
      const totalAvailable = inDiscard.reduce((n, c) => n + c.count, 0);
      // Cap is bounded by THREE constraints: the card's own MAX (3),
      // how many Skeletons exist in discard, and how many free Support
      // Zones the casting Hero has right now. The third constraint is
      // what the user explicitly asked for — the gallery shouldn't let
      // the player pick more Skeletons than there's space for.
      // W62a: Mit Alice-Teilung koennen gleichnamige Skelette in EINE Zone — dann begrenzt nicht die Zahl freier Zonen
      // (die Verteilung entscheidet sich erst beim Platzieren: ein nicht mehr platzierbares Skelett bleibt in der Ablage).
      const { sharingActive } = require('./_alice-shared');
      const cap = sharingActive(gs, pi) ? Math.min(MAX_RAISES, totalAvailable) : Math.min(MAX_RAISES, totalAvailable, initialHeroZones.length);

      const galleryCards = inDiscard.map(c => ({
        name: c.name, source: 'discard', count: c.count,
      }));

      const result = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: galleryCards,
        selectCount: cap,
        minSelect: 1,
        title: CARD_NAME,
        description: `Pick up to ${cap} "Skeleton" Creature${cap === 1 ? '' : 's'} from your discard pile to revive.`,
        confirmLabel: '💀 Raise!',
        confirmClass: 'btn-success',
        cancellable: true,
        allowDuplicates: true,
      });
      if (!result || result.cancelled || !Array.isArray(result.selectedCards) || result.selectedCards.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // Validate picks against actual discard contents — defensive
      // against client desync. Track remaining counts as we accept
      // names so duplicates only consume real copies.
      const remaining = {};
      for (const c of inDiscard) remaining[c.name] = c.count;
      const accepted = [];
      for (const name of result.selectedCards) {
        if (typeof name !== 'string') continue;
        if (!isSkeletonCreature(name, engine)) continue;
        if ((remaining[name] || 0) <= 0) continue;
        remaining[name]--;
        accepted.push(name);
        if (accepted.length >= cap) break;
      }
      if (accepted.length === 0) { gs._spellCancelled = true; return; }

      // Place each picked Skeleton. If we run out of free zones mid-way,
      // stop quietly — the rest just stay in discard. Zones are scoped
      // to the CASTING Hero only (recomputed each iteration since the
      // previous placement just consumed one of them).
      for (const name of accepted) {
        const zones = zonenFuerHeld(engine, ps, pi, heroIdx, name);   // W62a: + geteilte Zone (Alice)
        if (zones.length === 0) continue;
        let zone;
        if (zones.length === 1) {
          zone = zones[0];
        } else {
          const pick = await ctx.promptZonePick(zones, {
            title: CARD_NAME,
            description: `Place ${name} into a free Support Zone.`,
            cancellable: false,
          });
          zone = (pick && zones.find(z => z.heroIdx === pick.heroIdx && z.slotIdx === pick.slotIdx)) || zones[0];
        }

        // Per-summon Necromancy dark-magic burst. Mirrors the Necromancy
        // Ability's signature visual on the destination Support Zone —
        // every Skeleton this Spell raises shares the same flavor.
        // Plays BEFORE the splice + place so the animation lands on the
        // empty slot just before the Skeleton appears in it; matches
        // Skeleton Necromancer's existing pacing (800 ms dwell).
        engine._broadcastEvent('play_zone_animation', {
          type: 'necromancy_summon', owner: pi,
          heroIdx: zone.heroIdx, zoneSlot: zone.slotIdx,
        });
        await engine._delay(800);

        // v1389: Platzieren aus der Ablage über die EINE Stelle
        // (summonFromDiscard → actionPlaceCreature 'discard': Sperre,
        // Lethe-Stempel, Flug, Signal). Früher: eigene Entnahme plus
        // Sentinel `source: 'deck'` und Rückbuchung von Hand.
        const placeRes = await engine.summonFromDiscard(pi, pi, name, zone.heroIdx, zone.slotIdx, {
          mode: 'place', source: CARD_NAME,
          placeOpts: { countAsSummon: true, animationType: 'summon', fireHooks: true },
        });
        if (!placeRes?.inst) continue;   // Zone belegt / nicht belebbar — Karte bleibt in der Ablage
        engine.log('raise_the_minions', {
          player: ps.username, placed: name,
          heroIdx: zone.heroIdx, zoneSlot: zone.slotIdx,
        });
        engine.sync();
        await engine._delay(200);
      }

      // Al, Welle 10 (Q33): der Kartentext nennt KEIN Zugende („Immediately end
      // your turn" steht nicht auf der Karte) — Raise the Minions! beendet den
      // Zug nicht mehr (frueher: `gs._spellEndsTurn = true`).
    },
  },
};
