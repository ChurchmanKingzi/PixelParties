// ═══════════════════════════════════════════
//  CARD EFFECT: "Assault Eagle"
//  Creature (Summoning Magic Lv0, Normal, 50 HP)
//
//  "You may once per turn choose up to 3 different targets on the board
//   and deal 100 damage to them. Then, your opponent may choose up to the
//   same number of targets on the board and deal 50 damage to them."
//
//  Umsetzung
//  ─────────
//  • AKTIVER Effekt (`creatureEffect`), einmal pro Zug (Engine-Sperre
//    `creature-effect:<instId>`, gestempelt beim Rueckgabewert `true`),
//    keine Aktionskosten — der Text nennt keine.
//  • ERSTE HALBZEILE: der Kontrolleur waehlt 1–3 VERSCHIEDENE Ziele,
//    beliebige Seite, Helden und Creatures („on the board") — das Eagle
//    selbst eingeschlossen. Der Spieler waehlt, also bleibt `festesZiel`
//    aus (Submerged & Co. schuetzen, CARD_API „festesZiel"). 100 Schaden
//    auf jedes, als EIN Flaechenschlag (`beginAoeStrike`).
//  • ZWEITE HALBZEILE („Then, your opponent may choose …"): der GEGNER
//    waehlt bis zu so viele Ziele, wie der Kontrolleur gewaehlt hat — wieder
//    jedes Ziel auf dem Brett, ausdruecklich auch das Assault Eagle selbst
//    (Als Vorgabe 10.10.). „May": er darf verzichten (Abbruch = 0 Ziele).
//    Gewaehlt wird ueber `ctx.promptMultiTarget({ chooser })` — alle
//    Zielschutz-Regeln gelten aus SEINER Sicht, Quelle und Schaden bleiben
//    die der Karte (wie Kits zweiter Modus). 50 Schaden je Ziel.
//  • „Then": die zweite Haelfte laeuft, auch wenn das Eagle durch die erste
//    gefallen ist (es hat sich selbst gewaehlt) — die Schuesse beginnen
//    trotzdem an SEINEM Platz (der Platz bleibt im Brett).
//  • Abbruch VOR der ersten Wahl kostet nichts (Rueckgabe `false`).
//
//  Bilder (Als Vorgabe 10.10., PIXELART)
//  ─────────────────────────────────────
//  Beide Haelften sind Brett-Animationen (`zoneType: 'board'`) mit dem
//  Eagle als URSPRUNG (`originOwner`/`originHeroIdx`/`originZoneSlot`) und
//  allen Zielen in `targets` — Quelle → ALLE Ziele GLEICHZEITIG:
//    1. `gunfire_volley`   Pistolenschuesse (drei Schuss je Ziel) — Haelfte 1
//    2. `shockwave_volley` eine Welle je Ziel, alle treffen im selben
//                          Augenblick — Haelfte 2
//  Die Verzoegerungen bis zum Schaden (`*_HIT_MS`) liegen hinter dem
//  letzten Einschlag der Animation (Mount-Vorlauf 100 ms eingerechnet).
// ═══════════════════════════════════════════

const CARD_NAME     = 'Assault Eagle';
const MAX_TARGETS   = 3;
const FIRST_DAMAGE  = 100;
const ANSWER_DAMAGE = 50;

// Zeiten (ms) — gehoeren zu den Animationen `gunfire_volley` / `shockwave_volley` (app-board.jsx).
const GUNFIRE_MS  = 960;     // Lebensdauer der Schuss-Animation
const GUNFIRE_HIT_MS = 560;  // letzter Einschlag bei ~500 ms (inkl. Mount-Vorlauf) → danach der Schaden
const WAVE_MS     = 1000;    // Lebensdauer der Wellen-Animation
const WAVE_HIT_MS = 600;     // Wellenfront erreicht die Ziele bei ~560 ms (inkl. Mount-Vorlauf)

/** Ziele einer Wahl als Nutzlast der Brett-Animation (Held: zoneSlot -1). */
function zielPunkte(targets) {
  return targets.map(t => ({
    owner: t.owner, heroIdx: t.heroIdx,
    zoneSlot: t.type === 'hero' ? -1 : t.slotIdx,
    cardName: t.cardName,
  }));
}

/**
 * EIN Flaechenschlag: `amount` Schaden auf jedes gewaehlte Ziel (Helden ueber `ctx.dealDamage`, Creatures ueber
 * `actionDealCreatureDamage`) — wie Mr. Jiggles, mit Flaechenklammer fuer das Anti-AoE-Fenster.
 */
async function schlagen(ctx, targets, amount, source) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  await engine.beginAoeStrike(targets.length, {
    creatures: targets.filter(t => t.type !== 'hero').map(t => t.cardInstance).filter(Boolean),
    source, amount, type: 'creature', sourceOwner: pi,
  });
  try {
    for (const target of targets) {
      if (target.type === 'hero') {
        const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) await ctx.dealDamage(hero, amount, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(source, target.cardInstance, amount, 'creature',
          { sourceOwner: pi, canBeNegated: true });
      }
    }
  } finally {
    await engine.endMultiHit();
  }
}

module.exports = {
  // Vorlage fuer die Zielwahl-Kennzeichnung (Blinded, Dark Deal): der Effekt „waehlt Ziele".
  requiresTarget: true,
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;                 // Kontrolleur (Charme/Dark Deal eingerechnet)
    const oppPi = engine.opponentOf(pi);
    const seite = ctx.cardHeroOwner ?? pi;    // Brettseite, auf der das Eagle PHYSISCH steht
    const heroIdx = ctx.cardHeroIdx;
    const slot = ctx.card?.zoneSlot ?? -1;
    const source = { name: CARD_NAME, owner: pi, heroIdx };
    const username = gs.players[pi]?.username;

    // Ursprung der Schuesse: der Platz des Eagles (auch wenn es dort gleich faellt).
    const ursprung = { originOwner: seite, originHeroIdx: heroIdx, originZoneSlot: slot };

    // ① Der Kontrolleur waehlt bis zu 3 verschiedene Ziele.
    const first = await ctx.promptMultiTarget({
      types: ['hero', 'creature'],
      side: 'any',
      max: MAX_TARGETS,
      min: 1,
      baseDamage: FIRST_DAMAGE,
      damageType: 'creature',
      title: CARD_NAME,
      description: `Deal ${FIRST_DAMAGE} damage to up to ${MAX_TARGETS} different targets on the board.`,
      confirmLabel: `🔫 ${FIRST_DAMAGE} each!`,
      confirmClass: 'btn-danger',
      cancellable: true,
      noSpellCancel: true,      // ein Kreatureneffekt ist kein Zauber: keine Abbruchmarke hinterlassen
    });
    // Abbruch vor der Wahl kostet nichts: `false` haelt die Engine davon ab, die Sperre zu stempeln.
    if (!first || first.length === 0) return false;

    // Pistolenschuesse: von dem Eagle auf ALLE gewaehlten Ziele gleichzeitig.
    engine._broadcastEvent('play_zone_animation', {
      type: 'gunfire_volley', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1,
      duration: GUNFIRE_MS, targets: zielPunkte(first), ...ursprung,
    });
    await engine._delay(GUNFIRE_HIT_MS);
    await schlagen(ctx, first, FIRST_DAMAGE, source);
    engine.log('assault_eagle', {
      player: username, targets: first.map(t => t.cardName), damage: FIRST_DAMAGE,
    });
    await engine._delay(Math.max(0, GUNFIRE_MS - GUNFIRE_HIT_MS));   // Salve ausklingen lassen

    // ② „Then, your opponent may choose up to the same number of targets": der Gegner waehlt — auch das Eagle
    // selbst ist ein erlaubtes Ziel.
    const answer = await ctx.promptMultiTarget({
      chooser: oppPi,
      types: ['hero', 'creature'],
      side: 'any',
      max: first.length,
      min: 1,
      baseDamage: ANSWER_DAMAGE,
      damageType: 'creature',
      title: CARD_NAME,
      description: `${username}'s Assault Eagle: you may deal ${ANSWER_DAMAGE} damage to up to ${first.length} target${first.length > 1 ? 's' : ''} on the board.`,
      confirmLabel: `🌊 ${ANSWER_DAMAGE} each!`,
      confirmClass: 'btn-danger',
      cancellable: true,        // „may": verzichten ist erlaubt
      noSpellCancel: true,
    });
    if (answer && answer.length > 0) {
      // Eine Welle je Ziel, alle treffen im selben Augenblick.
      engine._broadcastEvent('play_zone_animation', {
        type: 'shockwave_volley', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1,
        duration: WAVE_MS, targets: zielPunkte(answer), ...ursprung,
      });
      await engine._delay(WAVE_HIT_MS);
      await schlagen(ctx, answer, ANSWER_DAMAGE, source);
      engine.log('assault_eagle_answer', {
        player: gs.players[oppPi]?.username, targets: answer.map(t => t.cardName), damage: ANSWER_DAMAGE,
      });
      await engine._delay(Math.max(0, WAVE_MS - WAVE_HIT_MS));
    }

    engine.sync();
    return true;
  },

  _test: { MAX_TARGETS, FIRST_DAMAGE, ANSWER_DAMAGE },
};
