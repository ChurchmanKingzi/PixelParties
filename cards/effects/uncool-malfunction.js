'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Uncool Malfunction"  (W76e)
//  Artifact (Normal, Cost 0)
//
//  „Name an Ability. Your opponent cannot activate the active effect of Abilities with that name during their next turn."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • „Name an Ability": derselbe Namens-Picker wie bei Luck/Accusation (`cardNamePicker`), aber die Liste enthält NUR Abilities mit einem AKTIVEN Effekt
//    (`GameEngine.abilityHasActiveEffect`: `onFreeActivate`, `onActivate` oder `actionCost` — Alchemy, Charme, Trade …). Passive Abilities (Toughness, Resistance …) stehen nicht zur Wahl.
//    Abbruch der Wahl = nichts ist passiert (die Karte bleibt auf der Hand, nichts bezahlt).
//  • Die Ansage ist OFFEN: der Gegner sieht die genannte Ability als Kartenbild (`card_reveal`), dazu steigt der Qualm (s. u.).
//  • „Your opponent cannot activate … during their next turn": Sperre je Name am GEGNER (`gs.players[opp]._abilityNameLocks[Basisname]`), Frist = ENDE seines nächsten Zuges
//    (`expiresAtTurn = Zug + 2`, `expiresForPlayer` = der Spieler; echte Züge zählen, `fristenNachSkip`). Gelesen vom EINEN Prädikat `engine._abilityNegatedOnHero` (alle Aktivierungswege:
//    Listen, CPU, beide Server-Tore) — sie sperrt AKTIVE Effekte, passive Effekte derselben Ability laufen weiter. Nach dem Namen („that name") zählt jede Kopie der Ability, in jeder
//    Zone und an jedem Helden, den der Gegner kontrolliert.
//  • Der Effekt trifft nur den Gegner: gegen den durch die Erste-Runden-Immunität geschützten Spieler unspielbar (`blockedByFirstTurnProtection`).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_zone_animation` `uncool_smoke` (Client, Pixelart) auf JEDER Kopie der Ability, die der Gegner kontrolliert — auch an besiegten Helden: dicker schwarzer Qualm steigt aus der
//  Ability-Zone auf. Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { baseCardName, hasCardType } = require('./_hooks');

const CARD_NAME = 'Uncool Malfunction';
const SMOKE_MS = 1500;

/** Alle Abilities (Namen) mit aktivem Effekt. */
function aktiveAbilities(engine) {
  const db = engine._getCardDB();
  const GE = engine.constructor;
  const { loadCardEffect } = require('./_loader');
  return Object.keys(db).filter(n => {
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Ability')) return false;
    try { return GE.abilityHasActiveEffect(loadCardEffect(n)); } catch { return false; }
  }).sort((a, b) => a.localeCompare(b));
}

/** Alle Kopien der Ability `name` in den Ability-Zonen von Helden, die `oi` kontrolliert (oder auf seiner Seite stehen, auch besiegte): [{ seite, heroIdx, zoneIdx }]. */
function kopienBeim(engine, oi, name) {
  const out = [];
  const key = baseCardName(name);
  for (let s = 0; s < engine.playerCount(); s++) {
    const ps = engine.gs.players[s];
    (ps?.heroes || []).forEach((h, hi) => {
      if (!h?.name) return;
      const kontrolle = engine.heroSideOf(s, h);
      if (kontrolle !== oi && !(s === oi && h.hp <= 0 && kontrolle === oi)) return;
      (ps.abilityZones?.[hi] || []).forEach((slot, zi) => {
        if (slot && slot.length && baseCardName(slot[0]) === key) out.push({ seite: s, heroIdx: hi, zoneIdx: zi });
      });
    });
  }
  return out;
}

module.exports = {
  blockedByHandLock: true,
  blockedByFirstTurnProtection: true,
  isTargetingArtifact: true,

  canActivate(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (gs.activePlayer !== pi) return false;
    return !eng || aktiveAbilities(eng).length > 0;
  },

  getValidTargets: () => [],
  targetingConfig: {
    description: 'Name an Ability. Your opponent cannot activate its active effect during their next turn.',
    confirmLabel: '💨 Malfunction!',
    confirmClass: 'btn-danger',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,

  /** CPU: die Ability des Gegners mit aktivem Effekt, die er am häufigsten führt (größte Wirkung); ohne Treffer die erste. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME || promptData.type !== 'cardNamePicker') return undefined;
    const pi = engine?._cpuPlayerIdx;
    const oi = engine.opponentOf(pi);
    const erlaubt = new Set(promptData.cardNames || []);
    const zaehler = new Map();
    for (const n of aktiveAbilities(engine)) {
      if (!erlaubt.has(n)) continue;
      const k = kopienBeim(engine, oi, n).length;
      if (k > 0) zaehler.set(n, k);
    }
    let beste = null;
    for (const [n, k] of zaehler) if (!beste || k > beste.k) beste = { n, k };
    return beste ? { cardName: beste.n } : undefined;
  },
  cpuShouldPlay(engine, pi) {
    const oi = engine.opponentOf(pi);
    return aktiveAbilities(engine).some(n => kopienBeim(engine, oi, n).length > 0);
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oi = engine.opponentOf(pi);
    if (!ps || !gs.players[oi]) return { cancelled: true };

    const namen = aktiveAbilities(engine);
    if (namen.length === 0) return { cancelled: true };
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardNamePicker',
      title: CARD_NAME,
      description: 'Name an Ability. Your opponent cannot activate the active effect of Abilities with that name during their next turn.',
      cardNames: namen,
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName || !namen.includes(wahl.cardName)) return { cancelled: true };
    const genannt = wahl.cardName;
    const key = baseCardName(genannt);

    // Die Ansage ist offen: der Gegner sieht die genannte Ability.
    engine._broadcastEvent('card_reveal', { cardName: genannt }, { toPlayers: [oi] });
    await engine._delay(900);

    // Qualm auf jeder Kopie beim Gegner (auch an besiegten Helden).
    const kopien = kopienBeim(engine, oi, genannt);
    for (const k of kopien) {
      engine._broadcastEvent('play_zone_animation', { type: 'uncool_smoke', zoneType: 'ability', owner: k.seite, heroIdx: k.heroIdx, zoneSlot: k.zoneIdx, duration: SMOKE_MS });
    }
    if (kopien.length) await engine._delay(520);

    // Sperre: bis zum Ende des nächsten Zuges des Gegners.
    const opp = gs.players[oi];
    if (!opp._abilityNameLocks) opp._abilityNameLocks = {};
    const expiresAtTurn = (gs.activePlayer === oi ? gs.turn + 3 : gs.turn + 2);   // eigener Zug T: Gegnerzug T+1, Ablauf zu Beginn von T+2 (im Gegnerzug gespielt: sein NÄCHSTER Zug T+2, Ablauf T+3)
    const vorher = opp._abilityNameLocks[key];
    opp._abilityNameLocks[key] = { expiresAtTurn: Math.max(expiresAtTurn, vorher?.expiresAtTurn || 0), expiresForPlayer: pi, by: pi, appliedTurn: gs.turn };
    engine.log('uncool_malfunction', { player: ps.username, ability: genannt, copies: kopien.length });
    engine.sync();
    await engine._delay(Math.max(0, SMOKE_MS - 1420));
    return true;
  },
};
