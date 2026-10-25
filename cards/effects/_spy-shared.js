'use strict';
// ═══════════════════════════════════════════
//  GETEILTER BAUSTEIN: Spy in the Enemy's Camp — „Spionage-Marke" an einer Kreatur
//
//  „Play this card immediately when your opponent summons a Creature. You may activate that Creature's active effect during your turn as if you control it."
//
//  Die Reaktion läuft im KETTENFENSTER der Beschwörung (Bauform Off Duty): da liegt die Kreatur noch gar nicht auf dem Brett. Darum zwei Stufen:
//    1. `spyVormerken` (Resolve der Karte): merkt sich am Kettenglied der Beschwörung „Spion `spy` darf diese Kreatur später benutzen".
//    2. `spyKetteBeendet` (Ende von `executeCardWithChain`): wurde die Beschwörung negiert (Off Duty …), verfällt die Vormerkung; sonst ist sie scharf.
//    3. `spyLandung` (erster Schritt von `onCardEnterZone`, Engine `_runHooksImpl`): die gelandete Kreatur (Name + Beschwörer) bekommt die Marke
//       `counters._spyMask` (Bitmaske der Sitze, je ein Bit). Die Marke ist KEIN Status — Heilen/Cleanse kennt sie nicht; sie hängt an der Instanz und
//       endet damit, wenn die Kreatur das Brett verlässt (Tod, Rückkehr auf die Hand, Deck, Verbannung …: die Instanz geht, ein neues Beschwören beginnt ohne Marke).
//  Die Benutzung selbst (Klickweg + Kontrolle für die Dauer des Effekts) liegt in `server.js` `doActivateCreatureEffect` und `engine.getActivatableCreatures`.
// ═══════════════════════════════════════════

const MARKE = '_spyMask';

/** Hat `pi` Spionagezugriff auf diese Kreatur? */
function spyHat(inst, pi) {
  if (!inst || !Number.isInteger(pi)) return false;
  return (((inst.counters && inst.counters[MARKE]) || 0) & (1 << pi)) !== 0;
}

/** Sitze mit Spionagezugriff (für Anzeige/Protokoll). */
function spySitze(inst) {
  const m = (inst?.counters && inst.counters[MARKE]) || 0;
  const out = [];
  for (let i = 0; i < 8; i++) if (m & (1 << i)) out.push(i);
  return out;
}

/** Stufe 1: am Kettenglied der Beschwörung vormerken. */
function spyVormerken(engine, spy, link) {
  if (!link) return;
  const gs = engine.gs;
  if (!gs._spyVormerkungen) gs._spyVormerkungen = [];
  gs._spyVormerkungen.push({
    spy, linkId: link.id, name: link.cardName, summoner: link.owner, turn: gs.turn || 0, bereit: false,
  });
}

/** Stufe 2: die Kette der Beschwörung ist durch — negiert → verfällt, sonst scharf. Veraltete Einträge fallen heraus. */
function spyKetteBeendet(engine, link, negated) {
  const liste = engine.gs?._spyVormerkungen;
  if (!liste || liste.length === 0) return;
  const turn = engine.gs.turn || 0;
  engine.gs._spyVormerkungen = liste.filter(e => {
    if (e.turn !== turn) return false;                    // rundenfremd: nie gelandet (Platz voll, Bakhm …)
    if (e.linkId !== link.id) return true;
    if (negated) return false;
    e.bereit = true;
    return true;
  });
  if (engine.gs._spyVormerkungen.length === 0) delete engine.gs._spyVormerkungen;
}

/**
 * Stufe 3: eine Kreatur ist in eine Support Zone gelandet. Marke setzen, wenn eine scharfe Vormerkung auf (Name, Beschwörer) passt.
 * @returns {number[]} die Sitze, die die Marke bekamen
 */
function spyLandung(engine, enteringCard, summoningPi) {
  const liste = engine.gs?._spyVormerkungen;
  if (!liste || !enteringCard) return [];
  const turn = engine.gs.turn || 0;
  const neu = [];
  const rest = [];
  for (const e of liste) {
    if (e.turn !== turn) continue;
    if (e.bereit && e.name === enteringCard.name && e.summoner === summoningPi) neu.push(e.spy); else rest.push(e);
  }
  if (neu.length === 0) return [];
  if (rest.length > 0) engine.gs._spyVormerkungen = rest; else delete engine.gs._spyVormerkungen;
  if (!enteringCard.counters) enteringCard.counters = {};
  for (const s of neu) enteringCard.counters[MARKE] = (enteringCard.counters[MARKE] || 0) | (1 << s);
  try {
    engine._broadcastEvent('play_zone_animation', {
      type: 'spy_mark', owner: engine.physicalSide(enteringCard), heroIdx: enteringCard.heroIdx, zoneSlot: enteringCard.zoneSlot, duration: 1300,
    });
  } catch { /* Bild ist Beiwerk */ }
  try { engine.log('spy_marked', { creature: enteringCard.name, spies: neu.map(s => engine.gs.players[s]?.username) }); } catch { /* Protokoll ist Beiwerk */ }
  return neu;
}

module.exports = { MARKE, spyHat, spySitze, spyVormerken, spyKetteBeendet, spyLandung };
