'use strict';
const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Egg of God"  (v1357)
//  Creature — Summoning Magic Lv3, 50 HP
//
//  "Sacrifice a Creature you control that was not summoned this turn to
//   summon this Creature. Summoning this Creature counts as an additional
//   Action. Damage this Creature takes is negated. If you control this
//   Creature at the beginning of your turn, sacrifice it to search your
//   deck for any level 3 or lower Creature, except "The Egg of God", and
//   place it into the same Support Zone. That Creature may use its active
//   effect this turn."
//
//  ① BESCHWOERUNGSKOSTEN: genau 1 eigene Creature, NICHT in diesem Zug
//     beschworen — Bauform von Foresta / Blue-Ice Dragon (`beforeSummon` →
//     `resolveSacrificeCost`, abbrechbar ohne Kosten). Sind alle Zonen
//     voll, darf auf einen belegten Platz geworfen werden, dessen Tribut
//     dann Platz macht (`occupiedDropSlots`, wie Foresta).
//  ② „counts as an additional Action": `inherentAction: true`.
//  ③ „Damage … is negated": Engine-Vertrag `negatesOwnDamage` (v1357) —
//     negiert, nicht immun: `canBeNegated: false` kommt durch, eine selbst
//     negierte Egg auch. Zerstoeren ohne Schaden wirkt normal.
//  ④ ZUGBEGINN (`onTurnStart`, eigener Zug, Controller): Selbstopfer
//     (`engine.opfereKreatur`) → Galerie der Deck-Creatures mit effektivem
//     Level ≤ 3 ausser Egg → in DENSELBEN Platz platzieren (`placeFromPile`
//     aus dem Deck, gemischt) → `_hasHaste`: darf ihren Aktiveffekt sofort.
//     Leerlauf (Als Bestaetigung 24.9.): kein Kandidat im Deck oder Deck
//     gesperrt → die Egg loest gar nicht aus und bleibt liegen. Wird das
//     Opfer gerettet (Barrier of Undying), fizzelt die Suche (Als Ruling
//     23.9.). Die Such-Sperre greift NICHT (Deck → Brett, nicht Hand).
//  ⑤ BILDER (Als Vorgabe): goldene Partikel auf der Egg beim Erscheinen und
//     beim Ausloesen ihres Effekts — Zonen-Animation `egg_of_god_glow`.
// ═══════════════════════════════════════════
const { isPileCreature } = require('./_hooks');

const CARD_NAME = 'The Egg of God';
const TRIBUTES = 1;
const MAX_LEVEL = 3;
const GLANZ = 'egg_of_god_glow';

function makeSacrificeSpec(engine) {
  const turn = engine?.gs?.turn || 0;
  return {
    minCount: TRIBUTES,
    maxCount: TRIBUTES,
    filter: (c) => c?.inst?.turnPlayed !== turn,
    showFilteredAsIneligible: true,
    title: CARD_NAME,
    description: 'Sacrifice 1 of your Creatures that was not summoned this turn to summon The Egg of God.',
    confirmLabel: '🥚 Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
  };
}

// Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` = physische
// Seite des Helden (fehlt → pi); nur Helden, die `pi` kontrolliert.
function heroCanSummonHere(engine, pi, heroIdx, heroOwner = pi) {
  const hero = engine.gs.players[heroOwner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (engine.heroSideOf(heroOwner, hero) !== pi) return false;
  if (heroOwner === pi) return engine.heroMeetsLevelReq(pi, heroIdx, engine._getCardDB()[CARD_NAME]);
  return engine.heroMeetsLevelReq(heroOwner, heroIdx, engine._getCardDB()[CARD_NAME], { levelSourcePi: pi });
}

/** Mind. ein Opfer von DIESEM Helden. Styx 28.9.: `mustIncludeFromHeroOwner` = Seite des
 * Helden (geliehene Helden der Gegenspalte). */
function fullDropSpec(base, heroIdx, pi, heroOwner = pi) {
  // `mustIncludeFromHeroOwner` = Seite des Helden (Styx 28.9.): nur ein
  // Opfer aus DIESER Spalte schafft dort Platz; weitere Opfer bleiben frei.
  return { ...base, mustIncludeFromHeroIdx: heroIdx, mustIncludeFromHeroOwner: heroOwner };
}

/** Belegte Plaetze voller Helden, deren Tribut dort Platz macht (wie Foresta).
 *  Styx 28.9.: geliehene Helden der Gegenspalte — alle Helden, die `pi`
 *  kontrolliert; `owner` = physische Seite, nur gesetzt, wenn ≠ pi. */
function occupiedDropSlots(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const spec = makeSacrificeSpec(engine);
  const out = [];
  const helden = typeof engine.heroesControlledBy === 'function'
    ? engine.heroesControlledBy(pi)
    : (ps.heroes || []).map((hero, heroIdx) => ({ physOwner: pi, heroIdx, hero }));
  for (const { physOwner, heroIdx: hi } of helden) {
    const zones = gs.players[physOwner]?.supportZones?.[hi] || [];
    if ([0, 1, 2].some(z => !engine.supportSlotBelegt(physOwner, hi, z))) continue;
    if (!heroCanSummonHere(engine, pi, hi, physOwner)) continue;
    if (!engine.canSatisfySacrifice(pi, fullDropSpec(spec, hi, pi, physOwner))) continue;
    for (const z of [0, 1, 2]) {
      if ((zones[z] || []).length === 0) continue;
      out.push(physOwner !== pi ? { heroIdx: hi, slotIdx: z, owner: physOwner } : { heroIdx: hi, slotIdx: z });
    }
  }
  return out;
}

/** Deck-Creatures fuer die Suche (effektives Level ≤ 3, nicht Egg), Galerie-Form. */
// Styx 28.9.: geliehene Helden der Gegenspalte — `seite` = physische Seite
// des Zielplatzes (fehlt → pi), gegen die `isCreatureSummonable` fragt.
function suchKandidaten(engine, pi, heroIdx, seite = pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const zaehler = new Map();
  for (const n of (ps?.mainDeck || [])) {
    if (n === CARD_NAME) continue;
    const cd = db[n];
    if (!cd || !isPileCreature(cd)) continue;
    if (engine.effectiveCardLevel(cd, pi) > MAX_LEVEL) continue;
    if (heroIdx != null && !engine.isCreatureSummonable(n, seite, heroIdx, { _bypassBeforeSummon: true })) continue;
    zaehler.set(n, (zaehler.get(n) || 0) + 1);
  }
  return [...zaehler.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'deck', count }));
}

function glaenzen(engine, inst) {
  engine._broadcastEvent('play_zone_animation', {
    type: GLANZ, owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });
}

module.exports = {
  activeIn: ['support'],
  inherentAction: true,
  negatesOwnDamage: true,
  // Generischer Opfer-Vertrag (DDG-Bauform): die CPU plant auf die Kosten hin.
  sacrificeSpec: { minCount: TRIBUTES },
  cpuMeta: { onSummonTriggerWeight: 2 },

  canSummon(ctx) {
    const engine = ctx._engine;
    return engine.canSatisfySacrifice(ctx.cardOwner, makeSacrificeSpec(engine));
  },
  // Styx 28.9.: geliehene Helden der Gegenspalte — Bypass nur fuer eigene
  // Plaetze (gefragt wird nur fuer Helden der eigenen Spalte); Wurf auf
  // einen belegten Platz mit physischer Seite `heroOwner`.
  canBypassFreeZoneRequirement: (gs, pi, heroIdx, cardData, engine) =>
    occupiedDropSlots(gs, pi, engine).some(sl => sl.heroIdx === heroIdx && (sl.owner ?? pi) === pi),
  getBouncePlacementTargets: (gs, pi, engine) => occupiedDropSlots(gs, pi, engine),
  canPlaceOnOccupiedSlot: (gs, pi, heroIdx, slotIdx, engine, heroOwner = pi) =>
    occupiedDropSlots(gs, pi, engine).some(sl => sl.heroIdx === heroIdx && sl.slotIdx === slotIdx
      && (sl.owner ?? pi) === heroOwner),

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;
    // Styx 28.9.: geliehene Helden der Gegenspalte — physische Seite des
    // Zielhelden (fehlt → pi). Opfer zahlt `pi`.
    const heroOwner = (isSeat(engine, ctx.cardHeroOwner)) ? ctx.cardHeroOwner : pi;
    const allFullDrop = !!ps?._requestedBouncePlaceSlot;
    if (ps?._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;
    const base = makeSacrificeSpec(engine);
    const spec = allFullDrop
      ? { ...fullDropSpec(base, heroIdx, pi, heroOwner),
          description: `${base.description} It must come from the summoning Hero's Support Zones.` }
      : base;
    const ok = await engine.resolveSacrificeCost(ctx, spec);
    if (!ok || ok.extraPicked) return false;
    if (allFullDrop) {
      const frei = [0, 1, 2].find(z => !engine.supportSlotBelegt(heroOwner, heroIdx, z));
      if (frei == null) return false;
      await engine.actionPlaceCreature(CARD_NAME, pi, heroIdx, frei, {
        source: 'external', sourceName: CARD_NAME, fireHooks: true,
        ...(heroOwner !== pi ? { heldSeite: heroOwner } : {}),
      });
      ps._placementConsumedByCard = CARD_NAME;
    }
    return true;
  },

  hooks: {
    // „beim Erscheinen": goldene Partikel, sobald die Egg liegt.
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id || ctx.card.zone !== 'support') return;
      glaenzen(ctx._engine, ctx.card);
    },

    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const egg = ctx.card;
      if (!egg || egg.zone !== 'support' || egg.faceDown) return;
      const pi = egg.controller ?? egg.owner;
      if (gs.activePlayer !== pi) return;
      const ps = gs.players[pi];
      const heroIdx = egg.heroIdx, slotIdx = egg.zoneSlot;
      // Styx 28.9.: geliehene Helden der Gegenspalte — eine ueber einen
      // uebernommenen Helden beschworene Egg steht physisch bei `egg.owner`
      // (`physicalSide` liefert dort den Kontrolleur).
      const quer = egg.counters?.crossSideControlled != null;
      const seite = quer ? egg.owner
        : (engine.physicalSide ? engine.physicalSide(egg) : egg.owner);
      // Zielseite der Suche/Platzierung: nur bei der seitenfremd
      // beschworenen Egg die Gegenspalte, sonst wie bisher `pi`.
      const zielSeite = quer ? egg.owner : pi;

      // Leerlauf: nichts zu finden oder das Deck gesperrt → kein Ausloesen.
      if (!engine.pileOutAllowed(pi, 'deck', { source: CARD_NAME })) return;
      if (suchKandidaten(engine, pi, heroIdx, zielSeite).length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      glaenzen(engine, egg);
      await engine._delay(700);

      // Selbstopfer. Gerettet → die Suche fizzelt.
      const geopfert = await engine.opfereKreatur(egg, { name: CARD_NAME, owner: pi, heroIdx });
      if (!geopfert) {
        engine.log('egg_of_god_fizzle', { player: ps.username, reason: 'sacrifice_prevented' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'sacrifice_prevented' });
        return;
      }

      // ★ v1359 (Als Befund): das Opfer selbst kann den Platz sofort wieder
      // fuellen (Call of the Deepsea beschwoert in die frei gewordene Zone).
      // Dann KEINE Galerie — die Egg fizzelt sichtbar.
      if (engine.supportSlotBelegt(seite, heroIdx, slotIdx)) {
        engine.log('egg_of_god_fizzle', { player: ps.username, reason: 'zone_taken' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'zone_taken' });
        return;
      }
      const karten = suchKandidaten(engine, pi, heroIdx, zielSeite);
      if (karten.length === 0) {
        engine.log('egg_of_god_fizzle', { player: ps.username, reason: 'no_target' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'no_target' });
        return;
      }
      let gewaehlt = karten[0].name;
      if (karten.length > 1) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
          description: 'Choose a level 3 or lower Creature from your deck to place into the same Support Zone.',
          cards: karten, confirmLabel: '🐣 Hatch!', cancellable: false,
        });
        if (wahl?.cardName && karten.some(k => k.name === wahl.cardName)) gewaehlt = wahl.cardName;
      }

      // Derselbe Platz — inzwischen belegt (Corpse Cannibal o. ae.)? Dann fizzelt es.
      if (engine.supportSlotBelegt(seite, heroIdx, slotIdx)) {
        engine.log('egg_of_god_fizzle', { player: ps.username, reason: 'zone_taken' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'zone_taken' });
        return;
      }
      const res = await engine.placeFromPile(pi, 'deck', gewaehlt, heroIdx, slotIdx, {
        source: CARD_NAME, ...(zielSeite !== pi ? { heldSeite: zielSeite } : {}),
      });
      const neu = res?.inst || res;
      if (!neu) {
        engine.log('egg_of_god_fizzle', { player: ps.username, reason: 'place_refused' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'place_refused' });
        return;
      }
      // „That Creature may use its active effect this turn."
      neu.counters = neu.counters || {};
      neu.counters._hasHaste = true;
      engine.log('egg_of_god_hatch', {
        player: ps.username, card: CARD_NAME, target: gewaehlt,
        hero: gs.players[zielSeite]?.heroes?.[heroIdx]?.name || null,
      });
      engine.sync();
    },
  },

  // CPU: die staerkste Creature (hoechstes Level, dann HP).
  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME || p?.type !== 'cardGallery') return undefined;
    const db = engine._getCardDB();
    const pi = engine._cpuPlayerIdx;
    let best = null, bestWert = -Infinity;
    for (const c of (p.cards || [])) {
      const cd = db[c.name];
      if (!cd) continue;
      const wert = (engine.effectiveCardLevel(cd, pi) || 0) * 1000 + (cd.hp || 0);
      if (wert > bestWert) { bestWert = wert; best = c; }
    }
    return best ? { cardName: best.name, source: best.source } : undefined;
  },
};
