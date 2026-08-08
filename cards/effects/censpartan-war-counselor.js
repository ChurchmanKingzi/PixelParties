// ═══════════════════════════════════════════
//  CARD EFFECT: "Censpartan War Counselor"
//  Creature (Summoning Magic Lv2, Normal) — 100 HP
//
//  EFFECT:
//   "You can only control 1 \"Censpartan War
//    Counselor\".
//    Other \"War Counselor\" Creatures you control
//    cannot be chosen by your opponent's cards and
//    effects. While you control fewer Creatures than
//    your opponent, you may once per turn choose
//    Creatures your opponent controls and defeat them
//    until your opponent controls the same number of
//    Creatures as you."
//
//  ── ① Der Schutzschirm ──
//  Gilt fuer die ANDEREN Ratgeber, nicht fuer
//  Censpartan selbst — er steht ungeschuetzt vorn.
//  Umgesetzt ueber die vorhandene Engine-Mechanik
//  `counters.untargetable_by_opponent` (+ `_pi`, wen
//  es aussperrt), die alle drei Zielwaehler bereits
//  auswerten; dasselbe Paar benutzt Golden Wings.
//
//  Der Schirm ist ein DAUERZUSTAND, die Counter sind
//  aber Momentaufnahmen — deshalb wird er nach jedem
//  Ereignis neu gesetzt, das das Feld veraendern kann
//  (Beschwoerung, Tod, Zonenwechsel, Zugbeginn).
//
//  Fremde Schirme werden nicht angetastet: gesetzt
//  wird nur, was noch keinen Schutz hat, und geloescht
//  nur, was Censpartan selbst gesetzt hat (Merker
//  `_censpartanShield`). Sonst koennte das Aufraeumen
//  hier einen Golden-Wings-Schirm mitreissen.
//
//  ── ② Der Ausgleich ──
//  Bedingung: ich kontrolliere WENIGER Kreaturen als
//  der Gegner — gezaehlt werden ALLE Kreaturen, nicht
//  nur Ratgeber. Dann werden genau so viele
//  gegnerische Kreaturen besiegt, dass beide Seiten
//  gleich viele haben. Die Auswahl trifft der Spieler,
//  die Anzahl ist vorgegeben (min = max = Differenz).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  WC,
  controlledWarCounselors,
  makeSingletonCanSummon,
} = require('./_war-counselor-shared');

const CARD_NAME = 'Censpartan War Counselor';

/** Alle Kreaturen, die `pi` offen im Support kontrolliert. */
function controlledCreatures(engine, pi) {
  return (engine.cardInstances || []).filter((inst) => {
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    if ((inst.controller ?? inst.owner) !== pi) return false;
    const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
    return !!cd && hasCardType(cd, 'Creature');
  });
}

/**
 * Schirm neu ausrichten: alle ANDEREN Ratgeber unter meiner Kontrolle
 * bekommen ihn, alles andere verliert ihn wieder — aber nur, wenn er von
 * hier kam.
 */
function resyncShield(engine, pi, selfId) {
  const oppIdx = pi === 0 ? 1 : 0;
  const shouldHave = new Set(
    controlledWarCounselors(engine, pi)
      .filter((inst) => inst.id !== selfId)
      .map((inst) => inst.id),
  );

  for (const inst of (engine.cardInstances || [])) {
    if (!inst?.counters) {
      if (!shouldHave.has(inst?.id)) continue;
      inst.counters = {};
    }
    const wants = shouldHave.has(inst.id);
    const ours = !!inst.counters._censpartanShield;

    if (wants && !ours) {
      // Fremden Schirm nicht ueberschreiben — dann ist ohnehin geschuetzt.
      if (inst.counters.untargetable_by_opponent) continue;
      inst.counters.untargetable_by_opponent = 1;
      inst.counters.untargetable_by_opponent_pi = oppIdx;
      inst.counters._censpartanShield = 1;
    } else if (!wants && ours) {
      delete inst.counters.untargetable_by_opponent;
      delete inst.counters.untargetable_by_opponent_pi;
      delete inst.counters._censpartanShield;
    }
  }
}

/** Nur dann aufrufen, wenn diese Kopie offen im Support steht. */
function resyncFromCtx(ctx) {
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support' || inst.faceDown) return;
  resyncShield(ctx._engine, ctx.cardOwner, inst.id);
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: makeSingletonCanSummon(CARD_NAME),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const mine = controlledCreatures(engine, pi).length;
    const theirs = controlledCreatures(engine, oppIdx).length;
    return theirs > mine;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const inst = ctx.card;

    const mine = controlledCreatures(engine, pi).length;
    const theirs = controlledCreatures(engine, oppIdx).length;
    const toDefeat = theirs - mine;
    if (toDefeat <= 0) return false;

    const picked = await ctx.promptMultiTarget({
      side: 'enemy',
      types: ['creature'],
      damageType: 'creature',
      dealsDamage: false,
      // ACHTUNG: promptMultiTarget liest `min`/`max`, nicht
      // minRequired/maxTotal (die heissen erst im Prompt-Payload so).
      min: toDefeat,
      max: toDefeat,
      title: CARD_NAME,
      description: `You control ${mine} Creature${mine !== 1 ? 's' : ''}, your opponent ${theirs}. Choose ${toDefeat} of their Creatures to defeat.`,
      confirmLabel: `⚔️ Defeat ${toDefeat}!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!picked || picked.length === 0) return false;

    let defeated = 0;
    for (const t of picked) {
      const victim = t.cardInstance;
      if (!victim || victim.zone !== 'support') continue;
      engine._broadcastEvent('play_zone_animation', {
        type: 'critical_slash', noLabel: true,
        owner: t.owner, heroIdx: t.heroIdx, zoneSlot: t.slotIdx,
      });
      await engine._delay(220);
      await engine.actionDestroyCard(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx }, victim,
      );
      defeated++;
    }

    engine.log('censpartan_equalize', {
      player: gs.players[pi]?.username, mine, theirs, defeated,
    });
    engine.sync();
    return true;
  },

  hooks: {
    // Der Schirm haengt am Feldzustand — nach jedem Ereignis, das ihn
    // aendern kann, neu ausrichten. Alle Hooks laufen ueber ALLE
    // Zuhoerer, ein Filter auf die gespielte Karte waere hier also
    // falsch: gerade FREMDE Beschwoerungen muessen den Schirm auslösen.
    onPlay: (ctx) => resyncFromCtx(ctx),
    onCardEnterZone: (ctx) => resyncFromCtx(ctx),
    onCardLeaveZone: (ctx) => resyncFromCtx(ctx),
    onCreatureDeath: (ctx) => resyncFromCtx(ctx),
    onTurnStart: (ctx) => resyncFromCtx(ctx),
  },
};
