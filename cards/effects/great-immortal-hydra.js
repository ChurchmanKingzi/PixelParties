'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Great Immortal Hydra"  (Welle 6b)
//  Creature (Normal, Summoning Magic Lv0) — 50 HP
//
//  „Only 1 "Great Immortal Hydra" can be on the board at a time. Up to 3 times per turn, when this Creature would be defeated, it is fully healed instead. Then its level is increased by 1
//   and its current and max HP by 50. At the end of each of your turns, all Heroes you control take damage equal to 50 times this Creature's current level."
//
//  ── „ONLY 1 … ON THE BOARD AT A TIME" ───────────────────────────────────
//  BRETTWEIT, nicht je Spieler: solange irgendwo (beide Seiten, jede Kontrolle) eine aufgedeckte Hydra in einer Support Zone liegt, ist keine zweite beschwörbar. `canSummon` (Spielbarkeit),
//  `beforeSummon` (jede Beschwörung, auch aus Effekten) und die zentrale Engine-Sperre `nurEinerSchonKontrolliert` (Handkarten ausgrauen, Platzier-Effekte wie Drill Sergeant/Army of the Cute,
//  Übernahmen) lesen dieselbe Textklausel `Only 1 "X" can be on the board at a time`. Die Hydra selbst zählt bei einer Übernahme nicht mit (`ausser`).
//
//  ── SELBSTRETTUNG („WHEN THIS CREATURE WOULD BE DEFEATED, IT IS FULLY HEALED INSTEAD") ──
//  Engine-Vertrag `selfPreDefeat(engine, inst, source, amount, type, info) → Promise<boolean>` (W78, Infallible Oracle Pythia; `_checkCreaturePreDefeatHandReactions`): läuft an beiden Todeswegen —
//  tödlicher Schaden (Schadens-Batch) UND Zerstörung (`actionDestroyCard`) — VOR den Handreaktionen (kostet nichts, ist automatisch). Die Engine fragt nur, wenn die Hydra aufgedeckt in einer Support
//  Zone liegt und nicht ruht (Frozen/Stunned/Negated); Opferkosten sind kein „defeat" (`info.isSacrifice` → false), unaufhaltsame Zerstörung kennt kein Rettungsfenster. Bekannte Kante: trägt
//  die Hydra zugleich eine Extra-Life-Marke, wird im Schadens-Batch ZUERST diese verbraucht (Engine-Reihenfolge, wie bei Pythia). „Up to 3 times per turn": Zähler an der Instanz
//  (`counters._hydraRettung = { turn, n }`, `gs.turn`: jeder Zug, auch der des Gegners, zählt neu). Der 4. tödliche Treffer im selben Zug besiegt sie.
//  Ablauf: volle Heilung auf das AKTUELLE Maximum → Level +1 (`actionChangeLevel`) → Max-HP und aktuelle HP +50 (`increaseMaxHp`). Nach dem ersten Mal also: Lv1, 100/100; dann Lv2, 150/150 usw. Die
//  Heilung setzt die HP direkt (Ersatz des Todes, kein Heil-Effekt: Gift-Heilsperre, Zauber-Immunität und Schutzhooks reden nicht hinein).
//
//  ── ZUGENDE („ALL HEROES YOU CONTROL TAKE DAMAGE EQUAL TO 50 TIMES THIS CREATURE'S CURRENT LEVEL") ──
//  Am Ende jedes Zuges ihres KONTROLLEURS trifft die Hydra JEDEN Held unter seiner Kontrolle (auch geliehene; lebende) mit 50 × aktuellem Level als NORMALEN CREATURE-SCHADEN (`ctx.aoeHit`,
//  `damageType: 'creature'`, Quelle = die Hydra): Schilde, Schadenshooks, Immortal, Surprise-/Reaktionsfenster (auch Man-Eater Birds am eigenen Helden) und die Anti-AoE-Klammer (Interference)
//  gelten wie bei jedem Creature-Schaden. Level 0 (die Hydra war noch nie in Not) kostet nichts. Ruht die Karte (Frozen/Stunned/Negated), ruht auch dieser Effekt (Engine-Standard der Kreaturen-Hooks).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `hydra_regrow` (grüne Regeneration, Hälse und Köpfe wachsen aus der Karte; Pixelart) bei der Rettung, `hydra_drain` (grünes Sickern + rote Minuszeichen) auf jedem Helden zum Zugende —
//  `ppPunktBild`, Klänge in ZONE_ANIM_SFX. Logs `hydra_regrow`, `hydra_drain`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Great Immortal Hydra';
const RETTUNGEN_JE_ZUG = 3;
const DMG_JE_STUFE = 50;
const WACHS_HP = 50;
const HEIL_MS = 600;      // bis zum Blitz von `hydra_regrow` (deckt sich mit BLITZ im Client) — dann springen die HP
const NACH_MS = 800;      // Nachlauf der Regeneration (Köpfe wachsen, Kreuze steigen)
const SAUG_MS = 650;      // bis der Schaden fällt (deckt sich mit `hydra_drain`)
const SAUG_REST_MS = 450;

/** Liegt außer `inst` irgendwo eine aufgedeckte Hydra in einer Support Zone? (brettweit) */
function andereHydraAufBrett(engine, inst) {
  return engine.cardInstances.some(c => c !== inst && (!inst?.id || c.id !== inst.id) && engine.instHatName(c, CARD_NAME) && c.zone === 'support' && !c.faceDown);
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER: wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie.
  spellVisual: { impact: { type: 'hydra_regrow' }, impactMs: 700 },

  activeIn: ['support'],

  /** „Only 1 … on the board at a time": jede Beschwörung prüft es. */
  async beforeSummon(ctx) { return !andereHydraAufBrett(ctx._engine, ctx.card); },
  canSummon(ctx) { return !andereHydraAufBrett(ctx._engine, ctx.card); },

  /**
   * Engine-Vertrag `selfPreDefeat` (W78, Infallible Oracle Pythia): tödlicher Treffer / Zerstörung → volle Heilung, Level +1, +50 Max-HP und aktuelle HP. Höchstens 3× je Zug.
   * @returns {Promise<boolean>} true = gerettet (kein Tod)
   */
  async selfPreDefeat(engine, inst, source, amount, type, info) {
    if (info?.isSacrifice) return false;                       // Opferkosten sind kein „defeat"
    const gs = engine.gs;
    const z = inst.counters._hydraRettung;
    const n = z && z.turn === gs.turn ? z.n : 0;
    if (n >= RETTUNGEN_JE_ZUG) return false;
    inst.counters._hydraRettung = { turn: gs.turn, n: n + 1 };

    engine._broadcastEvent('play_zone_animation', {
      type: 'hydra_regrow', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, duration: 1550,
    });
    await engine._delay(HEIL_MS);

    // 1. volle Heilung (auf das Maximum VOR dem Wachstum)
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    const max = inst.counters.maxHp ?? cd?.hp ?? 0;
    inst.counters.currentHp = Math.max(1, max);
    // 2. Level +1, 3. Max-HP und aktuelle HP +50
    await engine.actionChangeLevel(inst, 1);
    engine.increaseMaxHp(inst, WACHS_HP, { source: inst });
    engine.log('hydra_regrow', {
      creature: inst.name, owner: inst.owner, rettungen: n + 1, level: engine.kreaturLevelJetzt(inst), maxHp: inst.counters.maxHp, hp: inst.counters.currentHp,
    });
    engine.sync();
    await engine._delay(NACH_MS);
    return true;
  },

  hooks: {
    /** Am Ende jedes Zuges des Kontrolleurs: alle Helden unter seiner Kontrolle nehmen 50 × Level Creature-Schaden. */
    async onTurnEnd(ctx) {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      const controller = inst.controller ?? inst.owner;
      if (engine.gs.activePlayer !== controller) return;                  // „each of YOUR turns"
      const level = engine.kreaturLevelJetzt(inst);
      if (level <= 0) return;
      const schaden = DMG_JE_STUFE * level;
      await ctx.aoeHit({
        side: 'own', types: ['hero'], damage: schaden, damageType: 'creature', sourceName: CARD_NAME,
        animationType: 'hydra_drain', animDelay: SAUG_MS,
      });
      engine.log('hydra_drain', { player: engine.gs.players[controller]?.username, damage: schaden, level });
      engine.sync();
      await engine._delay(SAUG_REST_MS);
    },
  },
};
