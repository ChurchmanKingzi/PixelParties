// ═══════════════════════════════════════════
//  CARD EFFECT: "Spirit of the Barbarian Sword"
//  Creature (Normal, Lv0, 100 HP, Summoning Magic)
//
//  „This Creature can only be summoned by a Hero equipped with
//   \"Legendary Sword of a Barbarian King\". When you summon this
//   Creature, send all Areas on the board to the discard pile. Then, if
//   you have sent at least 1 Area, deal 100 damage to all targets your
//   opponent controls. You may once per turn send all Areas on the
//   board to the discard pile (min. 1) to bring a level 3 or lower Area
//   from your deck directly into play.\"
//
//  Drei Teile
//  ──────────
//  ① BESCHWOERUNGSSPERRE ueber `canPlayWithHero` — derselbe Vertrag wie
//     bei „Spirit of the Ultimate Gun\", nur mit dem Schwert.
//  ② BEIM BESCHWOEREN: erst alle Areas abraeumen (`removeAllAreas`,
//     derselbe Weg wie Reality Crack), dann — NUR wenn dabei wirklich
//     mindestens eine fiel — 100 Schaden auf alles, was der Gegner
//     kontrolliert. Die Reihenfolge steht so im Text und ist auch
//     mechanisch wichtig: eine Area, die Schaden veraendert, ist im
//     Moment des Schlags schon weg.
//  ③ AKTIVEFFEKT: dieselbe Abraeumung als KOSTEN (min. 1, sonst gar
//     nicht aktivierbar), dafuer eine Area bis Level 3 aus dem DECK
//     direkt ins Spiel. Eignung ueber `isTutorableArea` aus
//     `_area-shared` — dieselbe Regel wie Reality Crack, Planet in a
//     Bottle und Cooldin, also inklusive Area-ATTACKS wie Blood Rock
//     und mit effektivem (rabattiertem) Level.
//
//  Auftritt (Als Vorgabe 5.9.): feurige Schwertstreiche auf ALLEN
//  gegnerischen Zielen GLEICHZEITIG — `flaming_slash`, einmal je Ziel
//  im selben Moment ausgeloest, danach faellt der Schaden.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isTutorableArea } = require('./_area-shared');

const CARD_NAME = 'Spirit of the Barbarian Sword';
const SWORD = 'Legendary Sword of a Barbarian King';
const DAMAGE = 100;

/** Traegt dieser Held das Schwert? (Nach EFFEKTIVER Identitaet.) */
function hatSchwert(engine, pi, heroIdx) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && c.owner === pi && c.heroIdx === heroIdx
    && !c.faceDown && (c.counters?._effectOverride || c.name) === SWORD);
}

/** Liegt mindestens eine Area auf dem Brett? */
function areaCount(gs) {
  return (gs.areaZones || []).reduce((n, z) => n + ((z || []).length), 0);
}

/** Alle Ziele, die der Gegner kontrolliert — Helden UND Kreaturen. */
function gegnerZiele(engine, pi) {
  const gs = engine.gs;
  const oppIdx = pi === 0 ? 1 : 0;
  const ziele = [];
  for (let p = 0; p < (gs.players || []).length; p++) {
    const ps = gs.players[p];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (engine.heroSideOf(p, hero) !== oppIdx) continue;
      ziele.push({ type: 'hero', owner: p, heroIdx: hi, hero });
    }
  }
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== oppIdx) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    ziele.push({ type: 'creature', owner: inst.owner, heroIdx: inst.heroIdx, inst });
  }
  return ziele;
}

/** Feurige Streiche auf allen Zielen — gleichzeitig, dann der Schaden. */
async function feuerschlag(engine, pi, inst) {
  const ziele = gegnerZiele(engine, pi);
  if (ziele.length === 0) return;

  for (const z of ziele) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'flaming_slash', owner: z.owner, heroIdx: z.heroIdx,
      zoneSlot: z.type === 'hero' ? -1 : z.inst.zoneSlot,
    });
  }
  engine.sync();
  await engine._delay(300);          // Klinge sichtbar, dann trifft sie

  // Erst die Kreaturen (ein Stapel — gleichzeitig), dann die Helden.
  const kreaturen = ziele.filter(z => z.type === 'creature');
  if (kreaturen.length > 0) {
    await engine.processCreatureDamageBatch(kreaturen.map(z => ({
      inst: z.inst, amount: DAMAGE, type: 'creature',
      source: inst, sourceOwner: pi, animType: 'none',
    })));
  }
  for (const z of ziele.filter(x => x.type === 'hero')) {
    if (z.hero.hp <= 0) continue;
    await engine.actionDealDamage(inst, z.hero, DAMAGE, 'creature');
  }
  engine.sync();
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  cpuMeta: { dealsDamage: true },

  /** ① „can only be summoned by a Hero equipped with …\" */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return hatSchwert(engine, pi, heroIdx);
  },

  /** ③ Kosten: es muss mindestens eine Area liegen, und das Deck etwas hergeben. */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (areaCount(engine.gs) < 1) return false;
    const cardDB = engine._getCardDB();
    return (engine.gs.players[pi]?.mainDeck || [])
      .some(n => isTutorableArea(cardDB[n], engine, pi));
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (areaCount(gs) < 1) return false;              // Kosten nicht zahlbar

    const cardDB = engine._getCardDB();
    const zaehler = {};
    for (const n of (ps.mainDeck || [])) {
      if (!isTutorableArea(cardDB[n], engine, pi)) continue;
      zaehler[n] = (zaehler[n] || 0) + 1;
    }
    const galerie = Object.entries(zaehler)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));
    if (galerie.length === 0) return false;

    const wahl = await ctx._engine.promptGeneric(pi, {
      type: 'cardGallery', cards: galerie, title: CARD_NAME,
      description: 'Send all Areas on the board to the discard pile and bring this Area from your deck into play.',
      confirmLabel: '🗡️ Raze and raise',
      cancellable: true,
    });
    const gewaehlt = wahl?.cardName;
    if (!gewaehlt || wahl?.cancelled) return false;   // spurlos, Sperre bleibt frei
    if ((ps.mainDeck || []).indexOf(gewaehlt) < 0) return false;

    // Ab hier laeuft es durch: Kosten zahlen …
    await engine.removeAllAreas(-2, CARD_NAME);

    // … und die neue Area aus dem Deck holen.
    const _taken_idx = await engine.takeFromPile(ps, 'deck', gewaehlt, { source: CARD_NAME, shuffle: true });   // v820: Stapel-Schicht
    if (!_taken_idx) return true;                          // Kosten sind bezahlt
    engine._broadcastEvent('deck_search_add', { cardName: gewaehlt, playerIdx: pi });

    const neu = engine._trackCard(gewaehlt, pi, 'hand', ctx.cardHeroIdx ?? -1, -1);
    await engine.runHooks('onPlay', {
      _onlyCard: neu, playedCard: neu, cardName: gewaehlt, zone: 'hand',
      heroIdx: ctx.cardHeroIdx ?? -1, _skipReactionCheck: true,
    });
    if (neu.zone !== 'area') await engine.placeArea(pi, neu);

    engine.sync();
    return true;
  },

  hooks: {
    /** ② Beim Beschwoeren: abraeumen, dann — wenn etwas fiel — dreinschlagen. */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;
      const pi = inst.controller ?? inst.owner;

      const gefallen = await engine.removeAllAreas(-2, CARD_NAME);
      if (!(gefallen > 0)) return;                     // „if you have sent at least 1\"
      // KEINE Pause dazwischen (Als Befund 5.9.): der Hieb folgt dem
      // Abraeumen unmittelbar, das ist eine Bewegung. `removeAllAreas`
      // bringt seine eigene Flugzeit schon mit.
      await feuerschlag(engine, pi, inst);
    },
  },
};
