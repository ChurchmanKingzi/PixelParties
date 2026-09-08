// ═══════════════════════════════════════════
//  CARD EFFECT: "Water Golem"
//  Creature (Surprise, Lv1, 100 HP, Summoning Magic)
//
//  „Activate this Surprise when a Surprise on your side of the board is
//   sent to the discard pile by an effect. Summon this Creature into a
//   free Support Zone of the user and choose a target your opponent
//   controls. While this Creature remains on the board, that target's
//   effects are negated.\"
//
//  Ausloeser
//  ─────────
//  Neues Engine-Fenster `surpriseSurpriseDiscardedTrigger` (v730). Es
//  haengt an `_fireBoardSentToDiscard` — also genau dort, wo die Engine
//  ohnehin weiss, dass eine BRETTKARTE durch einen EFFEKT abgelegt
//  wurde. Damit sind automatisch ausgeschlossen: Schadenstode,
//  Handabwuerfe und die Selbst-Ablage einer Surprise am Ende ihrer
//  eigenen Aufloesung (Als Vorgabe: „nur die Zerstoerung ANDERER
//  Surprises\"). Dieselbe Quelle, aus der die Aquatic-Serie ihren
//  `onBoardSentToDiscard`-Reiter bezieht — nur eben als Fenster fuer
//  ZUSCHAUER statt fuer die abgelegte Karte selbst.
//
//  Die abgelegte Karte hat ihre Zone in dem Moment schon verlassen und
//  kann sich deshalb gar nicht selbst anbieten; der Filter unten
//  schliesst den Fall zusaetzlich aus.
//
//  Negation
//  ────────
//  „While this Creature remains on the board\" ist ein ZUSTAND, kein
//  Ausloeser. Der Golem stempelt sein Ziel auf die eigene Instanz und
//  gleicht ab: zu Zug- und Phasenbeginn wird die Negation aufgefrischt
//  (Helden-Negation verfaellt sonst zum Zugende), beim Abgang faellt
//  sie. Bauform wie beim Paraseed-Gift.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Water Golem';

/** Das gestempelte Ziel eines Golems als lebendes Objekt. */
function zielVon(engine, inst) {
  const z = inst?.counters?._golemTarget;
  if (!z) return null;
  if (z.type === 'hero') {
    const hero = engine.gs.players[z.owner]?.heroes?.[z.heroIdx];
    return hero?.name ? { type: 'hero', hero, owner: z.owner, heroIdx: z.heroIdx } : null;
  }
  const t = engine.cardInstances.find(c => c.id === z.instId && c.zone === 'support');
  return t ? { type: 'creature', inst: t } : null;
}

/** Negation auflegen bzw. auffrischen. */
async function negationAuffrischen(engine, golem) {
  const ziel = zielVon(engine, golem);
  if (!ziel) return;
  if (ziel.type === 'hero') {
    if (ziel.hero.hp <= 0) return;
    if (ziel.hero.statuses?.negated) return;
    await engine.addHeroStatus(ziel.owner, ziel.heroIdx, 'negated', {
      source: CARD_NAME, _skipReactionCheck: true,
      // Zustandsgebunden: der Golem haelt sie aufrecht, ein Abfaenger
      // haette nichts davon (v718-Vertrag).
      noAbsorb: true,
      // v731: `sourceBound` nimmt die Negation aus dem Zugende-Ablauf
      // heraus — sie endet mit dem Golem, nicht mit der Runde. Der
      // Badge liest dieselbe Marke fuer seinen Tooltip.
      sourceBound: true,
    });
  } else {
    if (ziel.inst.counters?.negated) return;
    await engine.actionNegateCreature(ziel.inst, CARD_NAME, { selfInflicted: false });
    // Gegenstueck zu `sourceBound` beim Helden: der Badge soll auch
    // hier „solange der Golem steht" sagen statt „bis Zugende".
    if (ziel.inst.counters?.negated) ziel.inst.counters.negatedSourceBound = CARD_NAME;
  }
}

/** Negation zuruecknehmen — der Golem ist weg. */
async function negationLoesen(engine, golem) {
  const ziel = zielVon(engine, golem);
  delete golem.counters._golemTarget;
  if (!ziel) return;
  if (ziel.type === 'hero') {
    if (ziel.hero.statuses?.negated) {
      await engine.removeHeroStatus(ziel.owner, ziel.heroIdx, 'negated', { bypassUnhealable: true });
    }
  } else if (ziel.inst.counters?.negated) {
    delete ziel.inst.counters.negated;
    delete ziel.inst.counters.negatedSourceBound;
    engine.log('status_remove', { target: ziel.inst.name, status: 'negated', by: CARD_NAME });
  }
  engine.sync();
}

/** Alle Golems dieses Bretts abgleichen. */
async function alleGolemsAbgleichen(engine) {
  for (const inst of (engine.cardInstances || [])) {
    if (inst.name !== CARD_NAME) continue;
    if (inst.zone !== 'support') continue;
    if (!inst.counters?._golemTarget) continue;
    await negationAuffrischen(engine, inst);
  }
}

module.exports = {
  isSurprise: true,
  activeIn: ['surprise', 'support'],

  cpuMeta: {
    // Der Wert liegt in der Negation, nicht im Koerper.
    appliesStatus: true,
  },

  /**
   * Ausloeser: eine ANDERE Surprise meiner Seite ging per Effekt ab.
   *
   * `heroIdx` ist der Traeger dieses Golems, `info.fromHeroIdx` die
   * Zone, aus der die Karte verschwand. Faellt beides zusammen UND
   * traegt die abgelegte Karte denselben Namen, waere es dieser Golem
   * selbst — dann nicht.
   */
  surpriseSurpriseDiscardedTrigger: (gs, ownerIdx, heroIdx, info /*, engine */) => {
    if (!info?.cardName) return false;
    if (info.zoneOwner !== ownerIdx) return false;
    if (info.cardName === CARD_NAME && info.fromHeroIdx === heroIdx) return false;
    return true;
  },

  /**
   * Der Koerper wird von der Engine gesetzt (Creature-Surprise landet
   * automatisch in einer freien Support Zone des Aktivierers); hier
   * passiert bewusst nichts — die Zielwahl braucht die fertige
   * Instanz und laeuft deshalb in `onSurpriseCreaturePlaced`.
   */
  async onSurpriseActivate(/* ctx, sourceInfo */) {
    return null;
  },

  hooks: {
    // ── Zielwahl, sobald der Golem steht ─────────────────────────
    onSurpriseCreaturePlaced: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.surpriseCardName !== CARD_NAME) return;
      const golem = ctx.cardInstance;
      if (!golem || golem.id !== ctx.card.id) return;      // nur ich selbst

      const pi = ctx.surpriseOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const gs = engine.gs;
      const cardDB = engine._getCardDB();

      // „a target your opponent controls\" — Helden und Kreaturen der
      // Gegenseite, nach KONTROLLE (v718) statt nach Spalte.
      const ziele = [];
      for (let p = 0; p < (gs.players || []).length; p++) {
        const ps = gs.players[p];
        for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (engine.heroSideOf(p, hero) !== oppIdx) continue;
          ziele.push({
            id: `hero-${p}-${hi}`, type: 'hero', owner: p, heroIdx: hi, cardName: hero.name,
          });
        }
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        if ((inst.controller ?? inst.owner) !== oppIdx) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        ziele.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
          owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name, cardInstance: inst,
        });
      }
      if (ziele.length === 0) return;

      const wahl = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        description: "Choose a target your opponent controls. Its effects are negated while the Water Golem remains on the board.",
        confirmLabel: '🌊 Smother',
        confirmClass: 'btn-info',
        cancellable: false,
        previewCardName: CARD_NAME,
        maxTotal: 1, minRequired: 1,
        appliesStatus: true,
      });
      const gewaehlt = ziele.find(t => t.id === (Array.isArray(wahl) ? wahl[0] : wahl));
      if (!gewaehlt) return;

      golem.counters = golem.counters || {};
      golem.counters._golemTarget = gewaehlt.type === 'hero'
        ? { type: 'hero', owner: gewaehlt.owner, heroIdx: gewaehlt.heroIdx }
        : { type: 'creature', instId: gewaehlt.cardInstance?.id };

      engine._broadcastEvent('play_zone_animation', {
        type: 'water_wave',
        owner: gewaehlt.owner,
        heroIdx: gewaehlt.heroIdx,
        zoneSlot: gewaehlt.type === 'hero' ? -1 : gewaehlt.slotIdx,
      });
      await engine._delay(400);
      await negationAuffrischen(engine, golem);
      engine.sync();
    },

    // ── Zustand halten: Helden-Negation verfaellt sonst zum Zugende ─
    onTurnStart: async (ctx) => { await alleGolemsAbgleichen(ctx._engine); },
    onPhaseStart: async (ctx) => { await alleGolemsAbgleichen(ctx._engine); },

    // ── Abgang: die Negation faellt mit dem Golem ─────────────────
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.fromZone !== 'support') return;
      const weg = ctx.leavingCard || ctx._onlyCard;
      if (!weg || weg.id !== ctx.card.id) return;
      if (!weg.counters?._golemTarget) return;
      await negationLoesen(engine, weg);
    },

    // Todesfall im Schadens-Batch: dort laeuft `onCardLeaveZone` mit
    // `_onlyCard`, der Zweig oben greift also — dieser hier ist die
    // Sicherung fuer Wege, die nur den Tod melden.
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.creature?.instId !== ctx.card.id) return;
      if (!ctx.card.counters?._golemTarget) return;
      await negationLoesen(engine, ctx.card);
    },
  },
};
