// ═══════════════════════════════════════════
//  Shared helpers for the Fiona family.
//
//  Ascension of "Fiona, the Princess of Blackport" →
//  "Fiona, the Empty Vessel of a Forgotten Sorceress":
//  she must be equipped with "Forbidden Grimoire of a
//  Forgotten Sorceress" AND one or more Heroes.
//
//  ── WARUM EIN EIGENES FAMILIENMODUL ────────────────────────────────
//  Arthor haengt seine Bereitschaft an die BEIDEN Equip-Skripte
//  (Legendary Sword, Summoning Circle rufen checkArthorAscension).
//  Bei Fiona geht das nicht: „one or more Heroes" ist keine feste
//  Karte, sondern JEDER Held, der als Equipment in ihren Support
//  Zones liegt — heute ueber „Initiation Ritual" (Als Hinweis 30.8.,
//  legt einen Helden mit `treatAsEquip` an) und „???, the Shapeshifter".
//  Kuenftige Wege sollen ohne Anfassen dieser Datei zaehlen.
//
//  Deshalb sitzt die Bereitschaft am BASIS-HELDEN selbst: er lauscht
//  auf jedes Betreten/Verlassen seiner Support Zones und rechnet
//  neu (plus Spielstart/Zugstart als Netz). Die Bedingung selbst
//  steht nur EINMAL hier — die aszendierte Karte fragt sie ueber
//  `ascensionCondition` ab, der Basisheld ueber `checkFionaAscension`.
//  Zwei Wahrheiten waeren genau der Fehler, der beim Throne Robber
//  eine ganze Sitzung gekostet hat.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const BASE_FIONA    = 'Fiona, the Princess of Blackport';
const ASCEND_TARGET = 'Fiona, the Empty Vessel of a Forgotten Sorceress';
const GRIMOIRE_NAME = 'Forbidden Grimoire of a Forgotten Sorceress';

/**
 * Den Basis-Fiona-Helden an `heroIdx` finden — charm-tolerant wie
 * `checkArthorAscension`: `pi` ist meist der echte Besitzer, bei einem
 * gecharmten Helden aber der Charmer. Dann auf beiden Seiten nachsehen;
 * die Support-Karten haengen physisch an der Seite, auf der die Zone
 * liegt, also passt `c.owner === actualOwner` weiterhin.
 */
function findBaseFiona(engine, pi, heroIdx) {
  let hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  let actualOwner = pi;
  if (!hero || hero.name !== BASE_FIONA) {
    hero = null;
    for (let p = 0; p < 2; p++) {
      const h = engine.gs.players[p]?.heroes?.[heroIdx];
      if (h?.name === BASE_FIONA) { hero = h; actualOwner = p; break; }
    }
  }
  return hero ? { hero, actualOwner } : null;
}

/** Alle Karten in den Support Zones dieses Helden (ohne `excludeInstId`). */
function supportCards(engine, owner, heroIdx, excludeInstId) {
  return engine.cardInstances.filter(c =>
    c.id !== excludeInstId &&
    c.owner === owner && c.zone === 'support' && c.heroIdx === heroIdx,
  );
}

/**
 * Zaehlt die als Equipment angelegten HELDEN in den Support Zones.
 *
 * Ein Held kann nur als Equipment in einer Support Zone liegen —
 * deshalb reicht der Kartentyp (Basis- und Ascended Heroes zaehlen
 * beide: der Text sagt „Heroes"). Auf `counters.treatAsEquip` wird
 * bewusst NICHT bestanden: kuenftige Anlege-Wege kommen vielleicht
 * ohne den Zaehler aus.
 */
function equippedHeroCount(engine, owner, heroIdx, excludeInstId) {
  const cardDB = engine._getCardDB();
  let n = 0;
  for (const c of supportCards(engine, owner, heroIdx, excludeInstId)) {
    const cd = engine.getEffectiveCardData?.(c) || cardDB[c.name];
    if (!cd) continue;
    if (hasCardType(cd, 'Hero') || hasCardType(cd, 'Ascended Hero')) n++;
  }
  return n;
}

function hasGrimoire(engine, owner, heroIdx, excludeInstId) {
  return supportCards(engine, owner, heroIdx, excludeInstId)
    .some(c => c.name === GRIMOIRE_NAME);
}

/**
 * Die gedruckte Bedingung, an EINER Stelle:
 * lebende Basis-Fiona + Grimoire + mindestens ein angelegter Held.
 *
 * @param {string} [excludeInstId] - Instanz, die gerade die Zone
 *   verlaesst (aus onCardLeaveZone) und noch in cardInstances steht.
 */
function fionaAscensionMet(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseFiona(engine, pi, heroIdx);
  if (!found) return false;
  const { hero, actualOwner } = found;
  if (hero.hp <= 0) return false;
  if (!hasGrimoire(engine, actualOwner, heroIdx, excludeInstId)) return false;
  return equippedHeroCount(engine, actualOwner, heroIdx, excludeInstId) >= 1;
}

/**
 * Bereitschaft am Helden setzen/loeschen. Der Client bietet den
 * Aufstieg nur an, wenn `ascensionReady` UND `ascensionTarget(s)`
 * gesetzt sind — die Engine allein wuerde ihn durchlassen, aber es
 * gaebe keinen Klick (Throne-Robber-Lehre, 28.8.). Idempotent.
 */
function checkFionaAscension(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseFiona(engine, pi, heroIdx);
  if (!found) return;
  const { hero } = found;
  if (fionaAscensionMet(engine, pi, heroIdx, excludeInstId)) {
    hero.ascensionReady   = true;
    hero.ascensionTarget  = ASCEND_TARGET;
    hero.ascensionTargets = [ASCEND_TARGET];
  } else {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

module.exports = {
  BASE_FIONA, ASCEND_TARGET, GRIMOIRE_NAME,
  fionaAscensionMet, checkFionaAscension, hasGrimoire, equippedHeroCount,
};
