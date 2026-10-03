// ═══════════════════════════════════════════
//  CARD EFFECT: "Elusive Hind"
//  Creature (Normal, Lv0, 1 HP, Summoning Magic) — PP MS1
//
//  „Summon this card into the free Support Zone of a Hero your opponent
//   controls. When this Creature would be affected by a card or effect,
//   its controller may discard 2 cards to negate any effects that card or
//   effect would have on it (including damage). When this Creature is
//   defeated, the player who summoned it may search their deck for up to 2
//   cards with different names, reveal them, and add them to their hand.
//   Summoning this Creature counts as an additional Action."
//
//  ── Umsetzung (Vorbilder: Plant Golem, Warrior of Teocuilatl, Divine Gift) ─
//  • Platzierung: `playOnAnyHeroSide` + `playOnOppSideOnly` (Drag aufs
//    Gegnerbrett bzw. Zonenwahl), `canSummon` verlangt eine freie Zone bei einem
//    lebenden Gegnerhelden; `onPlay` verlegt die Instanz dorthin und setzt NUR
//    `controller` = Gegner. Der Besitzer bleibt der BESCHWÖRER.
//  • `inherentAction: true` — die Beschwörung kostet keine Aktion.
//  • Schutz: zwei Wege wie bei Warrior/Cool Rescuer Monia —
//    `beforeCreatureAffected` (alles außer Schaden) und
//    `beforeCreatureDamageBatch` (Schaden). Es greift nur für DIESE Creature, und
//    bezahlt der KONTROLLEUR (der Gegner des Beschwörers) mit 2 Handkarten;
//    die Abwurf-Auswahl ist die Frage, ihr Cancel/Escape das „Nein"
//    (Hausregel v718). Mit weniger als 2 Handkarten gibt es keine Abfrage.
//  • Tod: der BESCHWÖRER (`cardOriginalOwner`) darf bis zu 2 Karten mit
//    verschiedenen Namen aus seinem Deck suchen (Mehrfach-Tutor → `_noKrates`).
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Elusive Hind';
const DISCARD_COST = 2;

function oppFreeZones(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const ops = engine.gs.players[oppIdx];
  const out = [];
  for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (engine.heroSideOf(oppIdx, h) !== oppIdx) continue;     // ein von mir übernommener Held ist kein „Hero your opponent controls"
    for (let si = 0; si < 3; si++) {
      if (((ops.supportZones?.[hi] || [])[si] || []).length === 0) out.push({ ownerIdx: oppIdx, heroIdx: hi, slotIdx: si });
    }
  }
  return out;
}

/**
 * Der Kontrolleur zahlt 2 Handkarten (Abwurf-Auswahl mit Cancel = „Nein").
 * true = bezahlt → die Wirkung wird negiert.
 */
async function bezahlen(engine, inst, ctrl, was) {
  const ps = engine.gs.players[ctrl];
  if (!ps || (ps.hand || []).length < DISCARD_COST) return false;
  const vorher = ps.hand.length;
  await engine.actionPromptForceDiscard(ctrl, DISCARD_COST, {
    costFor: CARD_NAME, costKind: 'protect',
    title: CARD_NAME, source: CARD_NAME, selfInflicted: true, cancellable: true,
    description: `Discard ${DISCARD_COST} cards to negate ${was} on ${CARD_NAME}?`,
  });
  return ps.hand.length === vorher - DISCARD_COST;
}

module.exports = {
  inherentAction: true,
  playOnAnyHeroSide: true,
  playOnOppSideOnly: true,   // eigene Zonen sind beim Ziehen kein Ziel
  activeIn: ['support'],

  canSummon: (ctx) => oppFreeZones(ctx._engine, ctx.cardOwner).length > 0,

  cpuMeta: {
    onDeathBenefit: 8,
    preferOpponentSupportZone: true,
  },

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      if ((inst.controller ?? inst.owner) === oppIdx) return;   // liegt schon beim Gegner

      // Ziel: Server-Hinweis (Drag aufs Gegnerbrett) oder Abfrage.
      let dest = null;
      const hint = gs._chillyWizardHint?.[pi];
      if (hint) delete gs._chillyWizardHint[pi];
      const free = oppFreeZones(engine, pi);
      if (hint && hint.ownerIdx === oppIdx && free.some(z => z.heroIdx === hint.heroIdx && z.slotIdx === hint.slotIdx)) dest = hint;
      if (!dest) {
        if (free.length === 0) return;
        if (free.length === 1) dest = free[0];
        else {
          const pick = await ctx.promptZonePick(free.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, ownerIdx: oppIdx })), {
            title: CARD_NAME, description: 'Choose a free Support Zone of a Hero your opponent controls for the Elusive Hind.', cancellable: false, previewCardName: CARD_NAME,
          });
          dest = pick && free.find(z => z.heroIdx === pick.heroIdx && z.slotIdx === pick.slotIdx) || free[0];
        }
      }

      // Verlegen: raus aus der eigenen Zone, rein in die gegnerische; Controller = Gegner, Besitzer bleibt.
      const fromPs = gs.players[pi];
      const fromSlot = fromPs.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
      if (fromSlot) { const i = fromSlot.indexOf(CARD_NAME); if (i >= 0) fromSlot.splice(i, 1); }
      const toPs = gs.players[oppIdx];
      if (!toPs.supportZones[dest.heroIdx]) toPs.supportZones[dest.heroIdx] = [[], [], []];
      toPs.supportZones[dest.heroIdx][dest.slotIdx] = [CARD_NAME];
      inst.heroIdx = dest.heroIdx;
      inst.zoneSlot = dest.slotIdx;
      inst.controller = oppIdx;
      engine._broadcastEvent('summon_effect', { owner: oppIdx, heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx, cardName: CARD_NAME });
      await engine._delay(200);
      engine.log('elusive_hind_placed', { player: fromPs.username, oppHero: toPs.heroes?.[dest.heroIdx]?.name });
      engine.sync();
    },

    // ── SCHADEN an dieser Creature ─────────────────────────────────
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (inst?.zone !== 'support') return;
      const ctrl = inst.controller ?? inst.owner;
      const mein = (ctx.entries || []).filter(e => !e.cancelled && e.inst && e.inst.id === inst.id);
      if (mein.length === 0) return;
      if (!(await bezahlen(engine, inst, ctrl, 'the damage'))) return;
      for (const e of mein) e.cancelled = true;
      engine.log('elusive_hind_negate', { player: engine.gs.players[ctrl]?.username, kind: 'damage' });
      engine.sync();
    },

    // ── alles andere (Gift, Status, Verschieben, Zielwahl …) ─────────
    beforeCreatureAffected: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (inst?.zone !== 'support' || ctx.cancelled) return;
      if (!ctx.creature || ctx.creature.id !== inst.id) return;
      const ctrl = inst.controller ?? inst.owner;
      if (!(await bezahlen(engine, inst, ctrl, 'that effect'))) return;
      ctx.cancelled = true;
      engine.log('elusive_hind_negate', { player: engine.gs.players[ctrl]?.username, kind: 'effect' });
      engine.sync();
    },

    // ── Tod: der Beschwörer sucht bis zu 2 Karten mit verschiedenen Namen ──
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.name !== CARD_NAME) return;
      if (death.instId != null && death.instId !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOriginalOwner ?? death.originalOwner ?? death.owner;     // der Beschwörer
      const ps = gs.players[pi];
      if (!ps || ps.handLocked || (ps.mainDeck || []).length === 0) return;

      const seen = new Set();
      const galerie = [];
      const zaehler = {};
      for (const n of ps.mainDeck) zaehler[n] = (zaehler[n] || 0) + 1;
      for (const n of Object.keys(zaehler).sort((a, b) => a.localeCompare(b))) {
        const b = baseCardName(n);
        if (seen.has(b)) continue;
        seen.add(b);
        galerie.push({ name: n, source: 'deck', count: zaehler[n] });
      }
      if (galerie.length === 0) return;
      const max = Math.min(2, galerie.length);
      const antwort = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti', searchToHand: true,
        cards: galerie, selectCount: max, minSelect: 1,
        title: CARD_NAME,
        description: `${CARD_NAME} was defeated — search your deck for up to ${max} card${max > 1 ? 's' : ''} with different names.`,
        confirmLabel: '🦌 Search!', confirmClass: 'btn-success', cancellable: true,
      });
      if (!antwort || antwort.cancelled || !Array.isArray(antwort.selectedCards) || antwort.selectedCards.length === 0) {
        engine.shuffleDeck(pi);                       // „search your deck" mischt auch ohne Treffer
        engine.sync();
        return;
      }
      const gewaehlt = [];
      const bases = new Set();
      for (const n of antwort.selectedCards) {
        if (typeof n !== 'string' || !(ps.mainDeck || []).includes(n)) continue;
        const b = baseCardName(n);
        if (bases.has(b)) continue;
        bases.add(b);
        gewaehlt.push(n);
        if (gewaehlt.length >= 2) break;
      }
      const geholt = [];
      for (const n of gewaehlt) {
        const ok = await engine.actionAddCardFromDeckToHand(pi, n, {
          source: CARD_NAME, reveal: false, _noKrates: true,   // Mehrfach-Tutor
        });
        if (ok) geholt.push(n);
      }
      if (geholt.length > 0) await engine.revealSearchedCards(pi, geholt, CARD_NAME);
      engine.shuffleDeck(pi);
      engine.log('elusive_hind_search', { player: ps.username, cards: geholt });
      engine.sync();
    },
  },

  /** CPU: wählt beim Todes-Tutor einfach die ersten passenden Karten. */
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'cardGalleryMulti' && payload.title === CARD_NAME) {
      return { selectedCards: (payload.cards || []).slice(0, payload.selectCount || 1).map(c => c.name) };
    }
    return undefined;
  },
};
