// ═══════════════════════════════════════════
//  CARD EFFECT: „Phoenix Bombardment"
//  Spell (Destruction Magic Lv 2, PP ART)
//
//  „Reduce a target's HP to 1. Then, the user takes damage equal to the
//   amount of HP reduced by this effect. Immediately end your turn
//   afterwards. This Spell can never hit more than 1 target at a time."
//
//  BAUART
//  ──────
//  • ★ „REDUCE … TO 1" IST KEIN SCHADEN. Die HP werden GESETZT
//    (`hero.hp = 1` bzw. `inst.counters.currentHp = 1`) — das Muster
//    von Emergency Spell Armor, Paraseed Zombie und Guardian Angel.
//    Folgen, alle gewollt: keine Schadens-Hooks, keine Schilde, keine
//    Reduktion, kein Surprise-Fenster, und das Ziel STIRBT NICHT (es
//    bleibt bei 1). Max-HP bleiben unberuehrt — der Text spricht nur
//    von HP.
//
//  • Der Rueckstoss ist dagegen ECHTER Schaden: `amount = HP vorher − 1`,
//    Typ `'recoil'` (Schadenstabelle: „Schaden, der auf einen Treffer
//    hin zurueckschlaegt"). Er kann den Anwender toeten — wie bei
//    Phoenix Tackle ausdruecklich gewollt. `'recoil'` oeffnet kein
//    Surprise-Fenster, was fuer Selbstschaden richtig ist.
//
//  • Stand das Ziel schon auf 1 HP, ist die Senkung 0 — dann gibt es
//    auch keinen Rueckstoss. Der Zug endet trotzdem: der Zauber hat
//    aufgeloest.
//
//  • ★ „can never hit more than 1 target at a time" IST NICHT VON
//    SELBST ERFUELLT (Als Hinweis 12.9.). „Bomb Berserker Bartas" laesst
//    einen normalen Destruction-Zauber unter seiner eigenen Stufe ein
//    ZWEITES Ziel treffen, indem er `onPlay` ein zweites Mal faehrt.
//    Der Riegel dagegen ist der vorhandene Vertrag `neverMultiTarget`
//    am Skript (Basketskull sagt denselben Satz) — Bartas fragt ihn ab
//    und laesst die Karte dann in Ruhe. Die eigene Zielwahl mit
//    `maxTotal: 1` deckt nur die EINE Aufloesung ab, nicht den zweiten
//    Durchlauf.
//
//  • „Immediately end your turn afterwards" ueber die Terror-Mechanik
//    (`gs._terrorForceEndTurn` + `_terrorForceEndSource`): der Server
//    wartet, bis Prompts, Effekte und Kette durch sind, und faehrt dann
//    die End Phase. Bei abgebrochener Zielwahl passiert gar nichts —
//    weder Senkung noch Zugende.
//
//  • ANIMATION `phoenix_bombardment` (v960, Als Vorgabe): ein Schwarm
//    Phoenixe mit Feuerschweif kracht ins Ziel, je Vogel eine eigene
//    Explosion. Der Rueckstoss behaelt den vorhandenen `flame_strike`
//    auf dem Anwender.
// ═══════════════════════════════════════════

const CARD_NAME = 'Phoenix Bombardment';

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'phoenix_bombardment' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tor fuer Blinded — siehe `_hooks.js`.

  // ★ „This Spell can never hit more than 1 target at a time."
  // Vorhandener Vertrag; „Bomb Berserker Bartas" fragt ihn ab und
  // verzichtet dann auf sein Zweitziel (Basketskull ist der Vorlaeufer).
  neverMultiTarget: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const anwender = gs.players[ctx.cardHeroOwner ?? pi]?.heroes?.[heroIdx];
      if (!anwender?.name || anwender.hp <= 0) return;

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: "Reduce a target's HP to 1. You then take that much damage and your turn ends.",
        confirmLabel: '🔥 Bombard!',
        confirmClass: 'btn-danger',
        cancellable: true,
        maxTotal: 1,               // „never more than 1 target at a time"
      });
      if (!ziel) return;           // abgebrochen — kein Zugende

      // ── Senkung ermitteln und setzen ────────────────────────────────
      let vorher = 0;
      let opferName = ziel.cardName;
      if (ziel.type === 'hero') {
        const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (!held?.name || held.hp <= 0) return;
        vorher = held.hp;
        opferName = held.name;
      } else {
        const inst = ziel.cardInstance || engine.findCards({
          controller: ziel.owner, zone: 'support', heroIdx: ziel.heroIdx,
        }).find(c => c.zoneSlot === ziel.slotIdx);
        if (!inst) return;
        vorher = inst.counters?.currentHp ?? 0;
        if (vorher <= 0) return;
        opferName = inst.name;
      }

      const gesenkt = Math.max(0, vorher - 1);

      // Eigene Animation (v960, Als Vorgabe): ein Schwarm Phoenixe mit
      // Feuerschweif kracht ins Ziel, jeder Vogel mit eigener Explosion.
      engine._broadcastEvent('play_zone_animation', {
        type: 'phoenix_bombardment', owner: ziel.owner, heroIdx: ziel.heroIdx,
        zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
        duration: 1800,
      });
      await engine._delay(1150);       // der Schwarm ist durch, dann faellt der Wert

      if (ziel.type === 'hero') {
        const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (held) held.hp = 1;
      } else {
        const inst = ziel.cardInstance || engine.findCards({
          controller: ziel.owner, zone: 'support', heroIdx: ziel.heroIdx,
        }).find(c => c.zoneSlot === ziel.slotIdx);
        if (inst) inst.counters.currentHp = 1;
      }
      engine.sync();

      engine.log('phoenix_bombardment', {
        player: gs.players[pi]?.username,
        target: opferName, reduced: gesenkt, hero: anwender.name,
      });

      // ── Rueckstoss auf den Anwender ─────────────────────────────────
      if (gesenkt > 0 && anwender.hp > 0) {
        await engine._delay(220);
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: ctx.cardHeroOwner ?? pi, heroIdx, zoneSlot: -1,
        });
        await engine._delay(220);
        await ctx.dealDamage(anwender, gesenkt, 'recoil');
        engine.sync();
      }

      // ── „Immediately end your turn afterwards" ──────────────────────
      if (!gs.result) {
        gs._terrorForceEndTurn = pi;
        gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };
      }
      engine.sync();
    },
  },
};
