// ═══════════════════════════════════════════
//  CARD EFFECT: "Acid Vial"
//  Potion — Deal 150 unreducible, unredirectable,
//  unnegatable damage to any target (Hero or
//  Creature). Breaks through all protection
//  EXCEPT turn-1 protection.
//  Damage type: 'other'.
//  Hard once per turn.
//  Animation (Pixelart, public/app-fx-70.jsx): Spuckkugel wie im Trailer — die Kugel LÄDT über der Handkarte der gespielten Potion (0,7 s, Radius 2 → 7; die Karte fliegt nach einem Drittel der Animation (ca. 0,8 s) in den Gelöscht-Stapel, `_potion-hand-flight.js`),
//  fliegt 0,7 s im Bogen zum Ziel und schlägt dort ein (Ringe, Strahlen, Tropfen); der Schaden fällt erst beim Einschlag (SCHADEN_MS).
//  Rückfall des Clients (Retro, reduzierte Bewegung, `window.__ppFx70Aus`): der bisherige Säure-GUSS von oben (`acid_splash`, app-fx-9) — er wird
//  dann zum Einschlagszeitpunkt gezeigt. EINE Zeile zurück zum alten Guss-Look (sofort, ohne Wartezeit): `SPUCKKUGEL = false`.
// ═══════════════════════════════════════════

// Zeiten (ms) der Zonen-Animation `acid_spit` (app-fx-70.jsx, 30 Hz): Laden 700 + Flug 700 = Einschlag bei Bild 42 der Animation; `VORLAUF_MS` = Mount-Vorlauf im Client
// (ZONE_ANIM_MOUNT_DELAY_MS 100 + Aufbau, wie bei Tiger Kick/Venom Snake). Engine-Wartezeit = Animationszeit + Vorlauf, damit Zahl und HP-Balken beim Einschlag erscheinen.
const { quelle: handQuelle, warteMitAbflug, abflugNachDrittel } = require('./_potion-hand-flight');

const SPUCKKUGEL = true;   // false = der bisherige Säure-Guss von oben (`acid_splash`, Schaden sofort) — die einzige Stelle, die zwischen den beiden Looks umschaltet
const SPUCK_LADE_MS = 700;
const SPUCK_FLUG_MS = 700;
const VORLAUF_MS = 120;
const ABFLUG_MS = abflugNachDrittel(VORLAUF_MS, 2450);   // Animation 2,45 s (Laden 0,7 + Flug 0,7 + Nachspiel): die Handkarte verlässt die Hand erst nach einem Drittel davon (Nutzer 13.11.), also bei Ereignis + 120 + 817 ms
const SCHADEN_MS = SPUCK_LADE_MS + SPUCK_FLUG_MS + VORLAUF_MS;

module.exports = {
  // ★ Als Ruling (Al 26.10., Flame Avalanche: „Wenn du andere Schadenskarten unspielbar machst, müssen das Vial und Rockfall auch sein!"): die Karte richtet NUR Schaden an Zielen an —
  // unter der Schadenssperre (`ps.damageLocked`) unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten; Sperr-Stutzen `engine._cardBlockedBySearchLock`).
  blockedByDamageLock: true,
  isPotion: true,

  // Der Kartentext sagt "This damage cannot be reduced, REDIRECTED or
  // negated" — bisher stand die Nicht-Umleitbarkeit nur im Kommentar.
  // Als Ruling 8.8.: sie ist ein echtes Merkmal. Umleitende Effekte
  // (Bubbles) fragen dieses Flag auf dem Quell-Skript ab und lassen den
  // Schaden durchgehen. Rockfall trägt es NICHT: sein Text nennt nur
  // "reduced or negated", er bleibt also umleitbar.
  cannotBeRedirected: true,

  canActivate(gs, playerIdx) {
    // Hard once per turn
    const hoptKey = `acid-vial:${playerIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // At least one targetable hero must exist (not turn-1 protected)
    for (let pi = 0; pi < gs.players.length; pi++) {
      if (gs.firstTurnProtectedPlayer === pi) continue;
      for (const hero of (gs.players[pi]?.heroes || [])) {
        if (hero?.name && hero.hp > 0) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    const targets = [];
    // Heroes — alive only, and not turn-1-protected. `getHeroTargets`
    // already filters by alive; the first-turn-protection check stays
    // here as the only Acid-Vial-specific gate.
    // Creatures — `getCreatureTargets` already iterates every Support
    // Zone regardless of host-Hero state (creatures are independent
    // of their Hero) and filters by `hasCardType(cd, 'Creature')`,
    // which keeps Artifact-Creature hybrids (Powder Keg, Pollution
    // Spewer, …) included.
    for (let pi = 0; pi < gs.players.length; pi++) {
      if (gs.firstTurnProtectedPlayer !== pi) {
        targets.push(...engine.getHeroTargets(pi));
      }
      targets.push(...engine.getCreatureTargets(pi));
    }
    return targets;
  },

  targetingConfig: {
    title: 'Acid Vial',
    description: 'Deal 150 unreducible damage to any target. Bypasses all protection.',
    confirmLabel: '🧪 Splash! (150)',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
    // Per-target damage hint — read by the CPU's `inferDamage` so the
    // simulate-and-score targeting branch can correctly evaluate kill
    // shots and high-value picks. Without this the CPU treats Acid
    // Vial as 0-damage, all targets score 0, and tiebreaker randomness
    // wastes the splash on whichever hero rolls highest.
    baseDamage: 150,
  },

  validateSelection(selectedIds, validTargets) {
    return selectedIds && selectedIds.length === 1;
  },

  // ★ `'none'`: der Server schickt KEIN `potion_resolved` mit dem Guss mehr — die Spuckkugel (`acid_spit`) sendet `resolve` selbst (Quelle `von` = Handkarte der Potion, Ziel = gewähltes Ziel).
  animationType: SPUCKKUGEL ? 'none' : 'acid_splash',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;

    const gs = engine.gs;
    const DAMAGE = 150;

    // Claim HOPT
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`acid-vial:${pi}`] = gs.turn;

    const source = { name: 'Acid Vial', owner: pi, heroIdx: -1 };

    // Spuckkugel: lädt über der Handkarte, fliegt zum Ziel (app-fx-70). Das Ziel wird VOR dem Senden geprüft (kein Flug ins Leere), der Schaden folgt beim Einschlag.
    const spuck = async (zoneSlot) => {
      if (!SPUCKKUGEL) return;
      engine.sync();   // Zielwahl-Fenster schließen, bevor die Kugel fliegt (sonst steht „Splash!" über der Flugbahn)
      engine._broadcastEvent('play_zone_animation', {
        type: 'acid_spit', owner: target.owner, heroIdx: target.heroIdx, zoneSlot,
        von: handQuelle(engine, pi, 'Acid Vial'),   // Handplatz der Karte (Rückfall: Gelöscht-Stapel)
      });
      await warteMitAbflug(engine, pi, 'Acid Vial', SCHADEN_MS, ABFLUG_MS);
    };

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero || hero.hp <= 0) return;

      await spuck(-1);

      const { dealt } = await engine.actionDealTrueDamage(source, hero, DAMAGE, {
        type: 'potion',
        _skipReactionCheck: true,
      });

      // SC-Tracking (Brutal) macht seit v1381 `actionDealTrueDamage`
      // selbst — der fruehere Sonderblock hier ist entfallen.

    } else if (target.type === 'equip') {
      // Creature damage — dealTrueDamage wraps the batch internally, so
      // Monia can still react and the _damagedOnTurn tracker is set.
      const inst = engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (!inst) return;

      await spuck(target.slotIdx);

      await engine.actionDealTrueDamage(source, inst, DAMAGE, { type: 'potion' });
    }

    engine.sync();
  },
};
