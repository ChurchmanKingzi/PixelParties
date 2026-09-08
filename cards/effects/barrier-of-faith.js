// ═══════════════════════════════════════════
//  CARD EFFECT: "Barrier of Faith"
//  Spell (Reaction, Lv1, Support Magic)
//
//  „Play this card immediately when a Hero you control would be
//   affected by a card or effect. Send 3/2/1 Abilities from that Hero
//   to the discard pile to negate any effects that card or effect
//   would have on the Hero, including damage."
//
//  Bauform (Schwester von Future Tech Escape Device)
//  ────────────────────────────────────────────────
//  • Post-Target-Fenster (`isPostTargetReaction`): feuert einmal je
//    Quelle, nachdem die Ziele feststehen — der einzige Moment, in dem
//    „would be affected" fuer JEDE Art von Wirkung greift, nicht nur
//    fuer Schaden. „a card or effect": keine Typ-Einschraenkung der
//    Quelle (anders als das Escape Device mit Attack/Spell).
//  • Der Schutz ist die Effekt-Immunitaet EINES Helden gegen die
//    laufende Aufloesung (`grantEffectImmunity`, v543): Schaden,
//    Status und alles, was ueber `addHeroStatus` laeuft. Andere Ziele
//    der Karte bleiben betroffen.
//  • 3/2/1 = Zahl der Abilities nach dem SUPPORT-MAGIC-LEVEL des
//    Casters (Lv1 → 3, Lv2 → 2, Lv3+ → 1). Caster ist ein Held, der
//    die Karte castfaehig ist; bei mehreren zaehlt der hoechste Stand
//    (weniger Abilities). Die Abilities kommen von „that Hero" — dem
//    geschuetzten; er braucht mindestens so viele Ability-KARTEN.
//  • Auswahl per Brett-Schleife (`_ability-cost-shared`, nur
//    Abilities, exakt N Stueck, nicht abbrechbar).
// ═══════════════════════════════════════════

const { sendables, abilityCardCount, sendCardsLoop, cpuSendFallback } = require('./_ability-cost-shared');

const CARD_NAME = 'Barrier of Faith';
const SCHOOL = 'Support Magic';

/** 3/2/1 nach dem Support-Magic-Level des Casters. */
function costFor(level) {
  return level >= 3 ? 1 : (level === 2 ? 2 : 3);
}

/**
 * Alle legalen Caster mit ihren Kosten (Als Vorgabe 6.9.: KEIN
 * automatischer Vorzug des hoechsten Levels — der Spieler waehlt).
 * Legal = castfaehig (Level, Status, Wisdom-Deckung mit ausreichender
 * Hand); `cost` = 3/2/1 nach dem Support-Magic-Level DIESES Helden,
 * inkl. Ability-Stapeln in Support Zones (Xal, Xalibur).
 * @returns {Array<{heroIdx, level, cost, wisdom}>}
 */
function legalCasters(engine, pi) {
  const ps = engine.gs.players[pi];
  const cd = engine._getCardDB()[CARD_NAME];
  const out = [];
  (ps?.heroes || []).forEach((h, hi) => {
    if (!h?.name || h.hp <= 0) return;
    if (!engine._canHeroActivateSurprise(pi, hi, CARD_NAME, { spellInHand: true })) return;
    const level = engine.effectiveSchoolLevelForCaster(SCHOOL, pi, hi);
    const wisdom = cd ? Math.max(0, engine.getWisdomDiscardCost(pi, hi, cd)) : 0;
    out.push({ heroIdx: hi, level, cost: costFor(level), wisdom });
  });
  return out;
}

function ownHeroTargets(pi, targetedHeroes) {
  return (targetedHeroes || []).filter(t => t.owner === pi && t.type === 'hero');
}

module.exports = {
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedHeroes /*, sourceCard, opts */) {
    const eigene = ownHeroTargets(pi, targetedHeroes);
    if (eigene.length === 0) return false;
    const casters = legalCasters(engine, pi);
    if (casters.length === 0) return false;
    const cheapest = Math.min(...casters.map(c => c.cost));
    // Mindestens ein betroffener Held hat genug Ability-Karten fuer
    // mindestens einen Caster.
    return eigene.some(t => abilityCardCount(sendables(engine, pi, t.heroIdx).abilities) >= cheapest);
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const casters = legalCasters(engine, pi);
    if (casters.length === 0) return {};
    const cardsOf = (hi) => abilityCardCount(sendables(engine, pi, hi).abilities);
    const eigene = ownHeroTargets(pi, targetedHeroes);
    // Nur Caster, fuer deren Kosten mindestens ein betroffener Held aufkommt.
    const nutzbar = casters.filter(c => eigene.some(t => cardsOf(t.heroIdx) >= c.cost));
    if (nutzbar.length === 0) return {};

    // 1) WER castet? Button-Auswahl der Helden (derselbe optionPicker
    //    wie beim Cast aus der Hand / im Ketten-Fenster), Kosten und
    //    Level je Held direkt am Button.
    let caster = nutzbar[0];
    if (nutzbar.length > 1) {
      const heroOptions = nutzbar.map(c => {
        const h = ps.heroes[c.heroIdx];
        return {
          id: `hero-${c.heroIdx}`,
          heroIdx: c.heroIdx,
          label: h?.name || `Hero ${c.heroIdx + 1}`,
          description: `Support Magic ${c.level} → send ${c.cost} Abilit${c.cost === 1 ? 'y' : 'ies'}${c.wisdom > 0 ? ` (Wisdom: discard ${c.wisdom})` : ''}.`,
          color: '#66ccff',
        };
      });
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `Pick which Hero casts ${CARD_NAME} — its Support Magic level sets the cost.`,
        options: heroOptions,
        cancellable: false,
      });
      const sel = heroOptions.find(o => o.id === choice?.optionId);
      if (sel) caster = nutzbar.find(c => c.heroIdx === sel.heroIdx) || caster;
    }
    const n = caster.cost;

    // 2) WER wird geschuetzt? („that Hero" — er zahlt die Abilities.)
    const kandidaten = eigene.filter(t => cardsOf(t.heroIdx) >= n);
    if (kandidaten.length === 0) return {};
    let ziel = kandidaten[0];
    if (kandidaten.length > 1) {
      const erlaubt = new Set(kandidaten.map(t => t.heroIdx));
      const auswahl = engine.getHeroTargets(pi).filter(t => erlaubt.has(t.heroIdx));
      if (auswahl.length > 1) {
        const wahl = await engine.promptEffectTarget(pi, auswahl, {
          title: CARD_NAME,
          description: `Choose which of your Heroes the barrier protects — it sends ${n} of its Abilities to the discard pile and ignores every effect of this card.`,
          confirmLabel: '✨ Protect!',
          confirmClass: 'btn-success',
          greenSelect: true,
          cancellable: false,
          maxTotal: 1,
        });
        const id = Array.isArray(wahl) ? wahl[0] : wahl;
        const g = auswahl.find(t => t.id === id);
        if (g) ziel = kandidaten.find(t => t.heroIdx === g.heroIdx) || ziel;
      }
    }

    // 3) Wisdom des gewaehlten Casters (das Post-Target-Fenster zieht
    //    sie nicht zentral ein).
    if (caster.wisdom > 0) {
      await engine.actionPromptForceDiscard(pi, caster.wisdom, {
        title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
      });
    }

    const hero = ps.heroes[ziel.heroIdx];
    const res = await sendCardsLoop(engine, pi, ziel.heroIdx, {
      cardName: CARD_NAME, kinds: ['ability'], min: n, max: n, amount: 0,
      confirmLabel: '✨ Send',
      describe: (sent, _a, remaining) => `Send ${remaining} more Abilit${remaining === 1 ? 'y' : 'ies'} attached to ${hero?.name || 'the Hero'} to the discard pile (${sent}/${n} sent).`,
    });
    if (res.aborted || res.sent < n) return {};
    engine._broadcastEvent('play_zone_animation', {
      type: 'barrier_of_faith', owner: pi, heroIdx: ziel.heroIdx, zoneSlot: -1,
    });
    await engine._delay(480);
    engine.log('barrier_of_faith', {
      player: ps.username, hero: hero?.name || ziel.cardName, sent: n,
      negated: sourceCard?.name || 'a card or effect',
    });
    engine.grantEffectImmunity(pi, ziel.heroIdx, sourceCard);
    engine.sync();
    return {};
  },

  /**
   * CPU — OB: nur gegen einen toedlichen Treffer (der Reaktions-Kanal
   * darf uebersteuern). WAS: Lernkanal, sonst Fremdschul-Abilities vor
   * Support Magic.
   */
  cpuMeta: {
    reactionHeuristic(engine /*, promptData */) {
      return engine._rxDamageCtx?.tag === 'lethal';
    },
  },
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    return cpuSendFallback(engine, promptData, { school: SCHOOL });
  },
};
