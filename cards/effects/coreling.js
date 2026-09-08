// ═══════════════════════════════════════════
//  CARD EFFECT: "Coreling"
//  Creature (Normal, Lv3, 100 HP, Summoning Magic)
//
//  „If you have defeated an opponent's target since the beginning of
//   this turn, this Creature's level in your hand becomes 0 and you may
//   summon this Creature during your first Power-Up Phase as an
//   additional Action if you have not summoned a \"Coreling\" yet this
//   turn. You may once per turn choose a target and deal 50 damage to
//   it. If there is an Area in play, deal 150 damage instead. If you
//   control \"Spirit of the Ultimate Gun\", this Creature may use this
//   effect the turn it is summoned.\"
//
//  Vier Klauseln
//  ─────────────
//  ① „level in your hand becomes 0\" — ueber
//    `ps._handLevelOffsetsTransient` (Vorbild Mischief Militia - Bear
//    Rider): dieselbe Karte, die der Client fuer die Anzeige liest und
//    `heroMeetsLevelReq` fuer die Spielbarkeit. WIRD, nicht „reduziert
//    um\": der Versatz ist immer −BASIS, also genau 0.
//  ② „summon … as an additional Action\" — `inherentAction` als
//    FUNKTION (v601): sie prueft die drei Bedingungen live.
//    „first Power-Up Phase\" ist die erste der beiden Main Phases
//    (`PHASES.MAIN1`).
//  ③ Aktiveffekt: einmal pro Zug (Engine-Standard je Instanz), ein Ziel
//    frei waehlbar, 50 Schaden — 150, wenn IRGENDEINE Area liegt, auch
//    die des Gegners („an Area in play\" ohne Besitzangabe).
//  ④ Haste durch „Spirit of the Ultimate Gun\": `counters._hasHaste`
//    ist die Marke, die Server und Client fuer die
//    Beschwoerungsstarre lesen. Sie wird LIVE nachgezogen (Vorbild
//    Chilly Dog) — der Spirit kann auch nach dem Coreling kommen.
//
//  Der Zaehlstempel fuer ① und ② kommt aus der ENGINE
//  (`_defeatedOppTargetTurn`, v744) — Gegenstueck zum vorhandenen
//  `_lastCreatureDefeatedTurn`, das die EIGENEN Gefallenen zaehlt.
//  Er MUSS dort liegen und nicht hier: eine Coreling, die erst nach
//  dem Kill auf die Hand kommt, hat ihn nicht beobachten koennen,
//  sieht ihn aber trotzdem.
//
//  Auftritt: eine Salve gezackter Blitze von Coreling zum Ziel
//  (Beam-Kanal im `bolt`-Modus, Vorbild Future Tech Barrage; der Kanal
//  legt `elem_lightning` selbst auf und zieht `electric_strike` als
//  Einschlag hinterher).
// ═══════════════════════════════════════════

const { PHASES } = require('./_hooks');

const CARD_NAME = 'Coreling';
const BASE_LEVEL = 3;
const SPIRIT = 'Spirit of the Ultimate Gun';
const DAMAGE = 50;
const DAMAGE_MIT_AREA = 150;
const BOLTS = 3;
const BOLT_ABSTAND_MS = 90;

/**
 * Habe ich seit Zugbeginn ein gegnerisches Ziel besiegt?
 *
 * Der Stempel kommt von der ENGINE (v744, `_defeatedOppTargetTurn`),
 * nicht von dieser Karte: eine Coreling, die erst NACH dem Kill gezogen
 * wird, muss ihn genauso sehen — sie kann ihn also nicht selbst
 * beobachtet haben.
 */
function hatGetoetet(gs, pi) {
  return gs.players[pi]?._defeatedOppTargetTurn === gs.turn;
}

/** Wurde in diesem Zug schon ein Coreling beschworen? */
function schonBeschworen(gs, pi) {
  return gs.players[pi]?._corelingSummonTurn === gs.turn;
}

/** Liegt irgendeine Area auf dem Brett? (Beide Seiten.) */
function areaLiegt(gs) {
  return (gs.areaZones || []).some(z => (z || []).length > 0);
}

function kontrolliertSpirit(engine, pi) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && !c.faceDown
    && (c.counters?._effectOverride || c.name) === SPIRIT
    && (c.controller ?? c.owner) === pi);
}

/** ① Handlevel setzen bzw. zuruecknehmen — fuer beide Spieler. */
function handLevelAbgleichen(engine) {
  const gs = engine.gs;
  let geaendert = false;
  for (let pi = 0; pi < (gs.players || []).length; pi++) {
    const ps = gs.players[pi];
    if (!ps) continue;
    const aktiv = hatGetoetet(gs, pi);
    for (let i = 0; i < (ps.hand || []).length; i++) {
      if (ps.hand[i] !== CARD_NAME) continue;
      if (!ps._handLevelOffsetsTransient) ps._handLevelOffsetsTransient = {};
      const alt = ps._handLevelOffsetsTransient[i];
      if (aktiv) {
        if (alt !== -BASE_LEVEL) { ps._handLevelOffsetsTransient[i] = -BASE_LEVEL; geaendert = true; }
      } else if (alt !== undefined) {
        delete ps._handLevelOffsetsTransient[i];
        geaendert = true;
      }
    }
  }
  // Nur bei echter Aenderung syncen — der Client zeichnet das Level
  // sonst erst beim naechsten beliebigen Sync neu.
  if (geaendert) engine.sync();
}

/** ④ Haste nachziehen, solange ein Spirit steht. */
function hasteAbgleichen(engine, inst) {
  if (!inst || inst.zone !== 'support') return;
  const pi = inst.controller ?? inst.owner;
  if (kontrolliertSpirit(engine, pi)) {
    if (!inst.counters) inst.counters = {};
    inst.counters._hasHaste = 1;
  } else if (inst.counters?._hasHaste && inst.turnPlayed === engine.gs.turn) {
    // Nur zuruecknehmen, solange die Starre ueberhaupt noch griffe —
    // ein spaeter verlorener Spirit soll keine alte Kreatur laehmen.
    delete inst.counters._hasHaste;
  }
}

module.exports = {
  activeIn: ['hand', 'support'],

  creatureEffect: true,

  cpuMeta: { dealsDamage: true },

  /** ② „as an additional Action\" — nur unter allen drei Bedingungen. */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    if (!hatGetoetet(gs, pi)) return false;
    if (gs.currentPhase !== PHASES.MAIN1) return false;   // „first Power-Up Phase\"
    if (schonBeschworen(gs, pi)) return false;
    return true;
  },

  canActivateCreatureEffect(ctx) {
    // Ein Ziel gibt es praktisch immer; die Engine prueft Starre und
    // Rundensperre selbst.
    return true;
  },

  /** ③ Der Aktiveffekt. */
  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const schaden = areaLiegt(gs) ? DAMAGE_MIT_AREA : DAMAGE;

    const ziel = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: schaden,
      title: CARD_NAME,
      description: `Deal ${schaden} damage to any target${schaden === DAMAGE_MIT_AREA ? ' (an Area is in play)' : ''}.`,
      confirmLabel: `⚡ Fire (${schaden})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!ziel) return false;                     // nichts passiert, Sperre bleibt frei

    // Blitzsalve von DIESER Kreatur (nicht vom Helden) zum Ziel.
    for (let b = 0; b < BOLTS; b++) {
      engine._broadcastEvent('play_beam_animation', {
        sourceOwner: inst.owner, sourceHeroIdx: inst.heroIdx, sourceZoneSlot: inst.zoneSlot,
        targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
        targetZoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
        color: '#bfe9ff', glow: '#5fb8ff',
        thickness: 0.8, duration: 620,
        impactAnim: 'electric_strike',
        impactOpacity: 0.8,
        bolt: true,
      });
      if (b < BOLTS - 1) await engine._delay(BOLT_ABSTAND_MS);
    }
    await engine._delay(320);

    if (ziel.type === 'hero') {
      const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (held && held.hp > 0) await ctx.dealDamage(held, schaden, 'creature');
    } else if (ziel.cardInstance) {
      await engine.actionDealCreatureDamage(
        inst, ziel.cardInstance, schaden, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }
    engine.sync();
    return true;
  },

  hooks: {
    // Der Kill-Stempel selbst kommt aus der Engine; hier wird nur das
    // Handlevel nachgezogen, sobald sich etwas geaendert haben kann.
    onHeroKO: async (ctx) => { handLevelAbgleichen(ctx._engine); },
    onCreatureDeath: async (ctx) => { handLevelAbgleichen(ctx._engine); },

    // ── Handlevel und Haste aktuell halten ───────────────────────
    onTurnStart: async (ctx) => {
      handLevelAbgleichen(ctx._engine);
      hasteAbgleichen(ctx._engine, ctx.card);
    },
    onPhaseStart: async (ctx) => {
      handLevelAbgleichen(ctx._engine);
      hasteAbgleichen(ctx._engine, ctx.card);
    },

    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const rein = ctx.enteringCard;
      handLevelAbgleichen(engine);
      if (!rein) return;
      // Ein Coreling betritt das Brett → Zugstempel fuer Klausel ②.
      if (rein.name === CARD_NAME && ctx.toZone === 'support') {
        const ps = engine.gs.players[rein.controller ?? rein.owner];
        if (ps) ps._corelingSummonTurn = engine.gs.turn;
      }
      // Ich selbst oder ein Spirit ist gekommen → Haste pruefen.
      hasteAbgleichen(engine, ctx.card);
    },

    onCardLeaveZone: async (ctx) => {
      handLevelAbgleichen(ctx._engine);
    },

    // Weitere Auffrischpunkte: eine frisch gezogene Kopie und das Ende
    // eines Kreatureffekts (dort faellt der haeufigste Kill).
    onCardAddedToHand: async (ctx) => { handLevelAbgleichen(ctx._engine); },
    afterCreatureEffect: async (ctx) => { handLevelAbgleichen(ctx._engine); },
    afterSpellResolved: async (ctx) => { handLevelAbgleichen(ctx._engine); },
  },
};
