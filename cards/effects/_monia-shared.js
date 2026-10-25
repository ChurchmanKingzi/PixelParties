// ═══════════════════════════════════════════
//  Shared helpers for the Monia family (v668).
//
//  Aufstieg „Cool Rescuer Monia" → „Monia Bot, the Foretold Rescuer of
//  Coolness": sie muss „Cool Tech Jetpack" tragen. Die Bereitschaft
//  pflegt der Basisheld ueber den sync-getriebenen Vertrag
//  `refreshAscensionReadiness` (Dajan-Muster) — das Jetpack kommt fast
//  nie ueber den normalen Spielweg (es wirft sich sofort ab), sondern
//  ueber Cool Repair, das seine eigenen Zonen-Hooks feuert; ein
//  sync-Refresh deckt alle Wege. Die Bedingung steht nur hier.
// ═══════════════════════════════════════════

const BASE_MONIA    = 'Cool Rescuer Monia';
const ASCEND_TARGET = 'Monia Bot, the Foretold Rescuer of Coolness';
const JETPACK_NAME  = 'Cool Tech Jetpack';

function findBaseMonia(engine, pi, heroIdx) {
  let hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  let actualOwner = pi;
  if (!hero || hero.name !== BASE_MONIA) {
    hero = null;
    for (let p = 0; p < engine.playerCount(); p++) {
      const h = engine.gs.players[p]?.heroes?.[heroIdx];
      if (h?.name === BASE_MONIA) { hero = h; actualOwner = p; break; }
    }
  }
  return hero ? { hero, actualOwner } : null;
}

/** Nach EFFEKTIVER Identitaet (Copy Device legt fremde Namen als Override). */
function hasEquipped(engine, owner, heroIdx, name, excludeInstId) {
  return engine.cardInstances.some(c =>
    c.id !== excludeInstId && c.owner === owner && c.zone === 'support'
    && c.heroIdx === heroIdx && (c.counters?._effectOverride || c.name) === name);
}

function moniaAscensionMet(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseMonia(engine, pi, heroIdx);
  if (!found || found.hero.hp <= 0) return false;
  return hasEquipped(engine, found.actualOwner, heroIdx, JETPACK_NAME, excludeInstId);
}

function checkMoniaAscension(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseMonia(engine, pi, heroIdx);
  if (!found) return;
  const { hero } = found;
  if (moniaAscensionMet(engine, pi, heroIdx, excludeInstId)) {
    if (hero.ascensionReady && hero.ascensionTarget === ASCEND_TARGET) return;
    hero.ascensionReady   = true;
    hero.ascensionTarget  = ASCEND_TARGET;
    hero.ascensionTargets = [ASCEND_TARGET];
  } else if (hero.ascensionReady) {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

// ═══════════════════════════════════════════
//  ★ W58a (Al, 22.10.2026) — „Whenever 1 or more Creatures either player controls would be affected by a card or effect, you may
//  discard 1 card to negate any effects that card or effect has on all Creatures." Die Einmal-pro-Zug-Sperre (`monia-protect`) ist weg.
//
//  Statt der Zugsperre gilt jetzt: JEDE Karte / JEDER Effekt, der mindestens eine Kreatur betreffen wuerde, oeffnet das Angebot erneut
//  (jede Annahme kostet erneut 1 Karte) — aber je Karte/Effekt nur EIN Angebot je Kontrolleur, auch wenn der Effekt mehrere Kreaturen
//  trifft oder in mehreren Schadensstapeln ablaeuft (Kettenblitz, Mehrfachziele, Statuswirkung auf jede Kreatur einzeln).
//
//  Buchfuehrung `gs._moniaAngebote` = [{ key, pi, seite }] fuer die LAUFENDE Aufloesung:
//    · `key`   Name der ausloesenden Karte/des Effekts (`quellName`), '' wenn unbekannt,
//    · `pi`    Kontrolleur der Monia, der gefragt wurde,
//    · `seite` geschuetzte Seite (angenommen) bzw. null (abgelehnt — nicht noch einmal fragen).
//  Sie endet mit der Aufloesung — dieselben Stellen wie die Schildmarke `_moniaShieldActive` (`engine.endeEffektImmunitaeten`, Monias
//  `afterSpellResolved`/`onTurnStart`). Die naechste Aktion/der naechste Effekt fragt also wieder.
// ═══════════════════════════════════════════

/** Name der Karte/des Effekts aus einer Quelle (String, Instanz oder { name | cardName }); sonst ''. */
function quellName(q) {
  if (!q) return '';
  if (typeof q === 'string') return q;
  return q.cardName || q.name || '';
}

/** Das angenommene Angebot dieser Aufloesung fuer diese Karte/diesen Effekt (egal welcher Kontrolleur), sonst undefined. */
function angenommenesAngebot(gs, key) {
  return (gs?._moniaAngebote || []).find(a => a.key === key && a.seite != null);
}

/**
 * Hat dieser Kontrolleur das Angebot fuer diese Karte/diesen Effekt in dieser Aufloesung schon abgelehnt?
 * ★ W71b: `seite` (optional) = Brettseite der Kreatur, um die es jetzt geht. Eine Ablehnung gilt fuer den GANZEN Effekt (`fuer` fehlt: Schadensstapel mit beiden Seiten zur Wahl) oder nur fuer die
 * Seite, die abgelehnt wurde (`fuer`: das Einzelfenster einer Kreatur) — trifft ein Effekt nacheinander erst eine Kreatur des Gegners (abgelehnt), dann eine eigene, fragt Monia fuer diese
 * eigene Seite noch einmal (ein Angebot je Karte/Effekt UND Seite).
 */
function angebotAbgelehnt(gs, key, pi, seite) {
  return (gs?._moniaAngebote || []).some(a => a.key === key && a.pi === pi && a.seite == null && (a.fuer == null || seite == null || a.fuer === seite));
}

/** Angebot festhalten: `seite` = geschuetzte Seite oder null (abgelehnt); `fuer` (nur bei Ablehnung, W71b) = die Seite, fuer die abgelehnt wurde (sonst: fuer den ganzen Effekt). */
function angebotMerken(gs, key, pi, seite, fuer) {
  if (!gs) return;
  if (!Array.isArray(gs._moniaAngebote)) gs._moniaAngebote = [];
  gs._moniaAngebote.push({ key, pi, seite: seite == null ? null : seite, ...(seite == null && fuer != null ? { fuer } : {}) });
}

/** Ende der Aufloesung: Schildmarke und Angebote fallen. */
function angeboteBeenden(gs) {
  if (!gs) return;
  delete gs._moniaShieldActive;
  delete gs._moniaShieldSource;
  delete gs._moniaAngebote;
  delete gs._kreaturFenster;   // W71b: Fenster-Buchführung von `engine.kreaturBetroffen`
}

module.exports = {
  BASE_MONIA, ASCEND_TARGET, JETPACK_NAME, hasEquipped, moniaAscensionMet, checkMoniaAscension,
  quellName, angenommenesAngebot, angebotAbgelehnt, angebotMerken, angeboteBeenden,
};
