// ═══════════════════════════════════════════
//  CARD EFFECT: "Styx, the Opened Gate"
//  Ascended Hero — Stats = die der Grundform beim Aufstieg · PP MBS1
//
//  „You must play this card on top of a \"Styx, the Gate to the Spirit
//   World\" after Heroes have been revived at least 3 times this game.
//   This condition cannot be negated or substituted. This Ascended
//   Hero's stats are equal to its base Hero's stats when Ascending. You
//   may once per turn revive a defeated Hero either player controls for
//   the rest of the turn with 100 HP. You take control of the Hero while
//   it is revived by this effect."
//
//  ── AUFSTIEG ─────────────────────────────────────────────────────
//  • Zaehler `gs.heroRevivalCount` (Engine, `zaehleHeldenWiederbelebung`):
//    JEDE Heldenwiederbelebung beider Seiten, Extra-Leben und Ascended
//    Blooms Aufstieg aus dem Tod eingeschlossen (Als Ruling 28.9.).
//  • Zwei Riegel (CARD_API ①): `ascensionCondition` hier, die Anzeige
//    `refreshAscensionReadiness` am Basis-Styx.
//  • Nur auf den EIGENEN Styx (Als Ruling 28.9.) — das erzwingt
//    `performAscension` ohnehin (Held aus `players[pi]`).
//  • „cannot be negated or substituted": `ascensionConditionUnskippable`.
//
//  ── STATS ────────────────────────────────────────────────────────
//  In cards.json stehen HP und ATK auf null. `performAscension` rechnet
//  mit dem Delta der gedruckten max HP (`newCardData.hp || alte`) → 0
//  und behaelt `hero.atk` (`newCardData.atk || hero.atk`). Aktuelle HP,
//  max HP und ATK bleiben also 1:1 — samt aller +100-Boni der
//  Grundform (Als Vorgabe 28.9.: „passt").
//
//  ── HELDENEFFEKT ────────────────────────────────────────────────
//  • Ziel: jeder besiegte Held BEIDER Seiten, den eine Wiederbelebung
//    ueberhaupt erreicht (`canReviveHero`: max HP > 0).
//  • Wiederbelebt mit 100 HP (auf die max HP gedeckelt) und dem
//    Zwangstod am Zugende — derselbe Mechanismus wie Golden Ankh
//    (`forceKillAtTurnEnd`). Danach darf er wieder belebt werden.
//  • Gehoert der Held der Gegenseite, uebernimmt Styx' Spieler die
//    Kontrolle — OHNE Schutzklausel (`statuses.charmed.ohneSchutz`),
//    ohne Support-Zonen-Sperre. Die Kontrolle endet MIT DEM TOD
//    (`hero._kontrolleBisZumTod`, Engine `kontrolleBeimTodZurueckgeben`):
//    im Moment des Sterbens gehoert er wieder seinem Besitzer — DESSEN
//    Elixir of Immortality greift und belebt ihn unter DESSEN Kontrolle
//    (Als Ruling 28.9.).
//  • Boris & Co. (Als Ruling 28.9.): tote Helden haben keine eigenen
//    Effekte, koennen sich also nicht selbst schuetzen. Hat der Gegner
//    aber eine offene Karte, die Kontrolluebernahmen verbietet (Boris),
//    ist seine Seite NICHT waehlbar — die eigene bleibt es
//    (`borisHidesOpponentSide`, Muster `stealsFromEitherSide`).
// ═══════════════════════════════════════════

const CARD_NAME = 'Styx, the Opened Gate';
const BASIS = 'Styx, the Gate to the Spirit World';
const NOETIGE_WIEDERBELEBUNGEN = 3;
const REVIVE_HP = 100;
const ANIM = 'styx_gate_revival';
const ANIM_MS = 1500;

/** Besiegte Helden, die Styx gerade zurueckholen darf. */
function wiederbelebbareHelden(engine, pi) {
  const gs = engine.gs;
  const oi = pi === 0 ? 1 : 0;
  const gegnerVerborgen = engine.borisHidesOpponentSide(pi)
    || gs.firstTurnProtectedPlayer === oi;
  const ziele = [];
  for (let p = 0; p < 2; p++) {
    const heroes = gs.players[p]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const h = heroes[hi];
      if (!h?.name || h.hp > 0) continue;
      if (!engine.canReviveHero(h)) continue;
      // Wer kontrolliert den Toten? (dauerhafte Uebernahmen beachten)
      const seite = engine.heroSideOf(p, h);
      if (seite !== pi && gegnerVerborgen) continue;
      ziele.push({
        id: `hero-${p}-${hi}`, type: 'hero', owner: p, heroIdx: hi,
        cardName: h.name, _fremd: seite !== pi,
      });
    }
  }
  return ziele;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  requiresTarget: true,
  // Die Gegnerseite wird bei Boris ausgeblendet, die eigene bleibt nutzbar.
  stealsFromEitherSide: true,
  ascensionConditionUnskippable: true,
  // Die wiederbelebten Helden sterben am Zugende — die CPU soll den
  // Wert erst nach dem Zugende beurteilen (wie Golden Ankh).
  cpuMeta: { evaluateThroughTurnEnd: true },

  ascensionCondition(gs, pi, heroIdx) {
    const hero = gs?.players?.[pi]?.heroes?.[heroIdx];
    if (!hero || hero.name !== BASIS || !(hero.hp > 0)) return false;
    return (gs.heroRevivalCount || 0) >= NOETIGE_WIEDERBELEBUNGEN;
  },

  canActivateHeroEffect(ctx) {
    return wiederbelebbareHelden(ctx._engine, ctx.cardOwner).length > 0;
  },

  /**
   * CPU: lohnt sich nur, wenn der Zurueckgeholte in diesem Zug noch etwas
   * tun kann — er stirbt am Zugende wieder. Probe wie bei Golden Ankh:
   * HP kurz setzen, Aktionsquellen abfragen, zuruecksetzen.
   */
  cpuShouldUseHeroEffect(engine, pi) {
    for (const t of wiederbelebbareHelden(engine, pi)) {
      const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!hero) continue;
      const alt = { hp: hero.hp, charmedBy: hero.charmedBy };
      hero.hp = REVIVE_HP;
      if (t._fremd) hero.charmedBy = pi;
      let nuetzlich = false;
      try {
        if (t._fremd) nuetzlich = true;   // fremder Held: mindestens ein Angriff
        const effekte = engine.getActiveHeroEffects?.(pi);
        if (!nuetzlich && Array.isArray(effekte) && effekte.some(e => e.heroIdx === t.heroIdx)) nuetzlich = true;
        const spielbar = engine.getHeroPlayableCards?.(pi);
        if (!nuetzlich && t.owner === pi && spielbar?.own?.[t.heroIdx]?.length > 0) nuetzlich = true;
      } catch { /* Probe darf nie werfen */ } finally {
        hero.hp = alt.hp;
        if (alt.charmedBy === undefined) delete hero.charmedBy; else hero.charmedBy = alt.charmedBy;
      }
      if (nuetzlich) return true;
    }
    return false;
  },

  /** CPU-Ziel: am liebsten den staerksten fremden Helden, sonst den eigenen. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget' && kind !== 'target') return undefined;
    const ziele = payload?.validTargets || [];
    if (ziele.length === 0) return undefined;
    const pi = payload.playerIdx;
    const held = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    const wert = (t) => (engine.heroSideOf(t.owner, held(t)) !== pi ? 1000 : 0) + (held(t)?.atk || 0);
    const sortiert = ziele.slice().sort((a, b) => wert(b) - wert(a));
    return [sortiert[0].id];
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ziele = wiederbelebbareHelden(engine, pi);
    if (ziele.length === 0) return false;

    const wahl = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME, source: CARD_NAME,
      description: 'Revive a defeated Hero either player controls for the rest of the turn with 100 HP. You control it while it is revived.',
      confirmLabel: '👻 Open the Gate!', confirmClass: 'btn-success',
      cancellable: true, greenSelect: true,
      maxTotal: 1, minRequired: 1, allowDeadHeroes: true,
    });
    if (!wahl || wahl.length === 0) return false;
    const ziel = ziele.find(t => t.id === wahl[0]);
    if (!ziel) return false;
    const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (!hero?.name || hero.hp > 0) return false;

    // Kontrolle VOR der Wiederbelebung feststellen: nach ihr gilt er
    // als lebend, die Frage ist aber, wem der Tote gehoerte.
    const warFremd = engine.heroSideOf(ziel.owner, hero) !== pi;

    const ok = await engine.actionReviveHero(ziel.owner, ziel.heroIdx, REVIVE_HP, {
      source: CARD_NAME,
      forceKillAtTurnEnd: true,
      animationType: ANIM, animDuration: ANIM_MS, animDelay: ANIM_MS,
    });
    if (!ok) {
      engine.log('styx_gate_fizzle', { player: gs.players[pi]?.username, target: hero.name });
      engine.sync();
      return true;   // der Versuch lief — Einmal pro Zug ist verbraucht
    }

    if (warFremd && hero.hp > 0) {
      // Uebernahme ohne Schutz und ohne Zonensperre. Die Marke
      // `_kontrolleBisZumTod` gibt ihn im Moment des Sterbens zurueck.
      hero.charmedBy = pi;
      hero.charmedFromOwner = ziel.owner;
      hero.charmedHeroIdx = ziel.heroIdx;
      if (!hero.statuses) hero.statuses = {};
      hero.statuses.charmed = { controller: pi, appliedTurn: gs.turn, ohneSchutz: true };
      engine._heldenStatusVerursacher?.(hero.statuses.charmed, { appliedBy: pi });
      hero._kontrolleBisZumTod = { by: CARD_NAME, turn: gs.turn };
      engine.log('styx_gate_control', {
        player: gs.players[pi]?.username, target: hero.name,
        targetOwner: gs.players[ziel.owner]?.username,
      });
      engine.sync();
      await engine.runHooks('onTakeControl', {
        controllerPi: pi, originalOwnerPi: ziel.owner,
        targetType: 'hero', targetName: hero.name, targetHero: hero,
        heroIdx: ziel.heroIdx, kind: 'charm', sourceName: CARD_NAME,
      });
    }

    engine.log('styx_gate_revive', {
      player: gs.players[pi]?.username, target: hero.name,
      targetOwner: gs.players[ziel.owner]?.username, hp: hero.hp,
    });
    engine.sync();
    return true;
  },

  // Fuer Tests.
  _wiederbelebbareHelden: wiederbelebbareHelden,
};
