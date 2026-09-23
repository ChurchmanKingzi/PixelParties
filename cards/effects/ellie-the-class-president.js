'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Ellie, the Class President"  (v1307, neuer Text)
//  Creature — Summoning Magic Lv1
//
//  "You may immediately summon this Creature as an additional Action when
//   a Hero you control performs a Double Spell. You may once per turn use
//   a Double Spell from your hand as an additional Action with one of your
//   Heroes, but if you do, its level is increased by 1. You can only
//   control 1 "Ellie, the Class President"."
//
//  ① Aus der HAND nach einem aufgeloesten Double Spell eines eigenen
//     Helden (`afterSpellResolved`, Bauform wie Ethan, the Prodigy).
//     Mehrere Ellies auf der Hand → EIN Angebot je Spell.
//  ② Creature-Effekt: Held waehlen (Helden ohne wirkbaren Double Spell
//     ausgegraut), dann die gesperrte Zusatzaktion nur fuer Double
//     Spells — mit +1 Level (`mitLevelZuschlag`, Engine v1307). Der
//     Zuschlag gilt nur fuer die Voraussetzung (Ruling 4); Iceages
//     „+1 beim Wirken" setzt obendrauf.
//  ③ „only control 1": `beforeSummon`.
// ═══════════════════════════════════════════
const { istDoppelSpell, kontrolliert, sofortAusHandBeschwoeren } = require('./_double-shared');

const CARD_NAME = 'Ellie, the Class President';

function zuschlag(pi, heroIdx) {
  return { pi, heroIdx, amount: 1, filter: (cd) => istDoppelSpell(cd) };
}

/** Double Spells, die Held `hi` MIT dem +1 jetzt wirken koennte (synchron). */
function wirkbar(engine, pi, hi) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0 || engine.isHeroIncapacitated(pi, hi)) return [];
  const db = engine._getCardDB();
  const z = zuschlag(pi, hi);
  if (!engine._levelZuschlaege) engine._levelZuschlaege = [];
  engine._levelZuschlaege.push(z);
  try { return engine.getHeroEligibleActionCards(pi, hi).filter(n => istDoppelSpell(db[n])); }
  finally { engine._levelZuschlaege = engine._levelZuschlaege.filter(e => e !== z); }
}

module.exports = {
  activeIn: ['hand', 'support'],
  creatureEffect: true,

  async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, CARD_NAME); },

  hooks: {
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (ctx.card?.zone !== 'hand') return;
      const pi = ctx.cardOwner;
      if (ctx.casterIdx !== pi) return;
      if (!istDoppelSpell(ctx.spellCardData)) return;
      if (engine._ellieLetzterSpell === ctx.spellCardData && gs._ellieLetzterZug === gs.turn) return;
      engine._ellieLetzterSpell = ctx.spellCardData; gs._ellieLetzterZug = gs.turn;
      const ps = gs.players[pi];
      if (!(ps.hand || []).includes(CARD_NAME) || kontrolliert(engine, pi, CARD_NAME)) return;
      if (require('./_summon-eligibility').eligibleSummonZones(engine, pi, CARD_NAME).length === 0) return;
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
        message: `Summon ${CARD_NAME} from your hand as an additional Action?`,
        confirmLabel: '🎀 Summon!', cancelLabel: 'No', cancellable: true,
      });
      if (!engine._confirmSaidYes(ja)) return;
      const ok = await sofortAusHandBeschwoeren(engine, pi, CARD_NAME, { source: CARD_NAME });
      if (ok) engine.log('double_class', { player: ps.username, card: CARD_NAME, text: `summoned after ${ctx.spellName || 'a Double Spell'}` });
      engine.sync();
    },
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    return (engine.gs.players[pi]?.heroes || []).some((_, hi) => wirkbar(engine, pi, hi).length > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const ziele = (ps.heroes || []).map((h, hi) => ({
      id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h?.name,
      ...(wirkbar(engine, pi, hi).length > 0 ? {} : { ineligible: true }),
    })).filter(t => t.cardName && ps.heroes[t.heroIdx]?.hp > 0);
    const waehlbar = ziele.filter(t => !t.ineligible);
    if (waehlbar.length === 0) return false;
    let hi = waehlbar[0].heroIdx;
    if (waehlbar.length > 1) {
      const ids = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME, source: CARD_NAME,
        description: 'Choose a Hero to use a Double Spell from your hand (its level is increased by 1).',
        confirmLabel: '🎀 Go!', confirmClass: 'btn-success', greenSelect: true,
        cancellable: true, maxTotal: 1, _skipRedirectCheck: true, _skipPostTargetReactions: true,
      });
      const t = ziele.find(z => z.id === ids?.[0] && !z.ineligible);
      if (!t) return false;
      hi = t.heroIdx;
    }
    const db = engine._getCardDB();
    const res = await engine.mitLevelZuschlag(zuschlag(pi, hi), () => engine.performImmediateAction(pi, hi, {
      title: CARD_NAME,
      description: `${ps.heroes[hi].name} uses a Double Spell from your hand — its level is increased by 1!`,
      allowedCardTypes: ['Spell'],
      cardNameFilter: (n) => istDoppelSpell(db[n]),
    }));
    if (!res?.played) return false;
    engine.log('double_class', { player: ps.username, card: CARD_NAME, text: `${ps.heroes[hi]?.name} used ${res.cardName} (+1 level)` });
    engine.sync();
    return true;
  },

  cpuResponse(engine, kind, p) {
    if (kind === 'generic' && p?.title === CARD_NAME && p?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  _test: { wirkbar },
};
