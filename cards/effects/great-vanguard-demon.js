// ═══════════════════════════════════════════
//  CARD EFFECT: "Great Vanguard Demon"
//  Creature (Summoning Magic Lv6, Normal, 200 HP) — PP MSHW, Secret Rare — Umsetzung 23.10.
//
//  „Reveal this card while it is in your hand. Whenever you play a Reaction Attack, Spell or Creature, reduce this card's level in your hand by 1.
//   When you summon this Creature, place a Demon Counter on all Creatures you control. You may once per turn choose a target and deal damage equal to
//   50 times the combined number of Demon Counters on all cards on the board to it."
//
//  ── ① Aufdecken (Al 23.10.) ─────────────────────────────────────────
//  Passiert IMMER, wenn die Karte auf die Hand kommt, egal wie und von wo: `revealOnEnterHand` (Engine stempelt an den Zugangswegen Ziehen, Suchen, Transfer)
//  UND `revealAlwaysInHand` — der Abgleich in `engine.sync()` deckt jede Handkopie auf, die irgendein Weg (direktes Schreiben der Hand, Puzzle-Aufbau,
//  Karten-Skripte ohne Hilfsfunktion) nicht selbst aufgedeckt hat. Die Marke fällt mit der Kopie aus der Hand (Handindex-Feld).
//
//  ── ② Stufensenkung in der Hand ─────────────────────────────────────
//  Jede eigene Reaction vom Typ Attack, Spell oder Creature (Untertyp Reaction — Artefakt- und Trank-Reactions stehen NICHT im Text) senkt die Stufe JEDER
//  Kopie in der Hand um 1, dauerhaft, solange die Kopie in der Hand bleibt (kein Zugablauf). Gespeichert als Handindex-Feld `_handLevelOffsetsTransient`
//  (Muster Looming Threat/Sparkfly Queen: wirkt nur in der Hand, folgt der physischen Kopie, summiert sich mit anderen Senkungen). Ausspielen, Zurückmischen,
//  Abwerfen oder Löschen: die Kopie verlässt die Hand, der Eintrag fällt weg — kommt sie wieder, steht sie wieder auf der gedruckten Stufe 6 (nichts wandert aufs Brett).
//  Die Stufe sinkt höchstens bis 0. „Whenever you play" = die Beobachter von `_card-played-shared.js` (Reaction-Spells/-Attacks über `afterSpellResolved`,
//  Reaction-Creatures über den Zonen-Eintritt bzw. das Hand-Spielsignal, genau einmal je Karte); wie bei Luck zählt eine negierte Reaction nicht.
//  Mehrere Kopien in der Hand senken zugleich, je Spielen genau einmal (die Kopie mit der kleinsten Id zählt für alle).
//
//  ── ③ Beschwörung ───────────────────────────────────────────────────
//  „place a Demon Counter on all Creatures you control" — jede eigene Creature auf dem Brett (auch der Dämon selbst), über `_demon-counter-shared.js`.
//  Es sind dieselben Demon Counter (`inst.counters.demonCounter`) wie bei Horned Demon: sein Schaden („50 × the number of counters on this Creature")
//  profitiert von ihnen, und ein Horned Demon ohne eigenen Zähler wird damit aktivierbar.
//
//  ── ④ Aktiver Effekt ────────────────────────────────────────────────
//  Einmal pro Zug, ohne Aktionskosten (Bauform Horned Demon): ein beliebiges Ziel (Held oder Creature, jede Seite), Schaden = 50 × alle Demon Counter auf
//  ALLEN Karten auf dem Brett (beide Seiten). Wie bei Horned Demon (Ruling 29.8.) erst ab 1 Zähler aktivierbar — kein 0-Schaden-„Treffer".
// ═══════════════════════════════════════════

const { demonCountersOn, placeDemonCounters } = require('./_demon-counter-shared');
const { kartenSpielBeobachter } = require('./_card-played-shared');
const { selbstsenkungZaehlt, hasCardType } = require('./_hooks');

const CARD_NAME = 'Great Vanguard Demon';
const DAMAGE_PER_COUNTER = 50;
const ANIM_STRIKE = 'demon_fire_pillar';
const BOARD_ZONES = new Set(['support', 'hero', 'ability', 'area', 'permanent', 'surprise']);
const REACTION_TYPES = new Set(['Attack', 'Spell', 'Creature']);

/** „the combined number of Demon Counters on all cards on the board" — beide Seiten, nur Karten auf dem Brett (nicht Hand/Stapel). */
function alleDemonCounter(engine) {
  let sum = 0;
  for (const inst of engine.cardInstances || []) {
    if (!BOARD_ZONES.has(inst.zone) || inst._deathResolved) continue;
    sum += demonCountersOn(inst);
  }
  return sum;
}

/** Eigene Creatures auf dem Brett (auch face-up Artifact-Creatures; keine verdeckten, keine sterbenden). */
function eigeneCreatures(engine, pi) {
  const cardDB = engine._getCardDB();
  return (engine.cardInstances || []).filter(inst => {
    if (inst.zone !== 'support' || inst.faceDown || inst._deathResolved) return false;
    if ((inst.controller ?? inst.owner) !== pi) return false;
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    return !!cd && hasCardType(cd, 'Creature');
  });
}

/** Ist `name` eine Reaction vom Typ Attack, Spell oder Creature? */
function istReactionAttackSpellOderCreature(engine, name) {
  const cd = engine._getCardDB()[name];
  return !!cd && String(cd.subtype || '').toLowerCase() === 'reaction' && REACTION_TYPES.has(cd.cardType);
}

/** Eine eigene Reaction wurde gespielt: jede Handkopie um 1 Stufe senken (Handindex-Feld, nur in der Hand wirksam). */
async function senkeStufe(ctx, gespielt, spieler) {
  const inst = ctx.card;
  if (inst?.zone !== 'hand') return;
  const engine = ctx._engine;
  const pi = inst.controller ?? inst.owner;
  if (spieler !== pi) return;                                                   // nur EIGENE Reactions
  if (!istReactionAttackSpellOderCreature(engine, gespielt)) return;
  // Je gespieltes Ereignis genau einmal, auch bei mehreren Kopien: die Kopie mit der kleinsten Id senkt ALLE Handkopien.
  if (!selbstsenkungZaehlt(engine, inst, CARD_NAME, pi, { zone: 'hand' })) return;
  const ps = engine.gs.players[pi];
  if (!ps?.hand) return;
  if (!ps._handLevelOffsetsTransient) ps._handLevelOffsetsTransient = {};
  let n = 0;
  for (let idx = 0; idx < ps.hand.length; idx++) {
    if (ps.hand[idx] !== CARD_NAME) continue;
    ps._handLevelOffsetsTransient[idx] = (ps._handLevelOffsetsTransient[idx] || 0) - 1;
    engine._broadcastEvent('play_hand_card_animation', { owner: pi, handIdx: idx, cardName: CARD_NAME, animType: 'hand_level_down', count: 1, duration: 800 });
    engine.log('hand_level_reduced', { player: ps.username, card: CARD_NAME, by: gespielt, offset: ps._handLevelOffsetsTransient[idx] });
    n++;
  }
  if (n > 0) engine.sync();
}

module.exports = {
  activeIn: ['hand', 'support'],
  revealOnEnterHand: true,
  revealAlwaysInHand: true,
  requiresTarget: true,
  creatureEffect: true,
  // „place a Demon Counter on all Creatures you control": trifft bei der Beschwörung 2+ Ziele in einem Schlag, ohne Schaden (AoE-Kennzeichnung, check-aoe-text).
  hitsMultipleTargets: true,

  /** Wie Horned Demon (Ruling 29.8.): erst ab 1 Demon Counter auf dem Brett — kein 0-Schaden-Treffer. */
  canActivateCreatureEffect(ctx) {
    return alleDemonCounter(ctx._engine) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const counters = alleDemonCounter(engine);
    if (counters <= 0) return false;
    const damage = counters * DAMAGE_PER_COUNTER;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Choose a target and deal ${damage} damage to it (${DAMAGE_PER_COUNTER} × ${counters} Demon Counter${counters === 1 ? '' : 's'} on the board).`,
      confirmLabel: `😈 ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_STRIKE, owner: target.owner, heroIdx: target.heroIdx, zoneSlot: impactSlot, intensity: counters,
    });
    await engine._delay(450);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('great_vanguard_demon_strike', {
      player: gs.players[pi]?.username, target: target.cardName, counters, damage,
    });
    engine.sync();
    return true;
  },

  hooks: {
    ...kartenSpielBeobachter(senkeStufe),

    /** „When you summon this Creature, place a Demon Counter on all Creatures you control." */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id || ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      placeDemonCounters(engine, eigeneCreatures(engine, pi), 1, CARD_NAME);
    },
  },
};

