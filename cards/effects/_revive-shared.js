'use strict';
// ═══════════════════════════════════════════
//  SHARED: Wiederbelebung von Helden mit 0 max HP (v1466)
//
//  Als Vorgabe 27.9.: „Es ist theoretisch möglich, dass ein Hero 0 max
//  HP erreicht. Ein solcher Hero sollte unaffected für Effekte sein, die
//  ihn wiederbeleben und seine HP komplett/halb heilen (Elixir of
//  Immortality, Cheat Chair …). Effekte, die die max HP auf einen fixen
//  Wert setzen (Resuscitation Potion …), funktionieren dagegen.
//  Immortality sollte für 0-max-HP-Heroes also nie triggern und Karten
//  wie Cheat Chair nie ihre Aktivierung prompten."
//
//  Maßgeblich ist die max HP, die der Held NACH der Wiederbelebung
//  hätte: der feste Wert der Karte (`maxHpCap`), sonst seine eigene.
//  Bei 0 kann er keine HP tragen — voll/halb heilen ergibt 0, und
//  „revive it with 100 HP“ (Golden Ankh, Cottage at the Forest's Edge,
//  Cybug Scarab) wird wie überall auf die max HP gedeckelt, also
//  ebenfalls 0. Nur Karten, die die max HP selbst neu setzen
//  (Resuscitation Potion, Divine Gift of Death/Equality, Paraseed
//  Control), holen einen solchen Helden zurück.
//
//  Als eigenes Modul statt nur als Engine-Methode, weil einige
//  Kartenfunktionen (Golden Ankhs `canActivate`/`getValidTargets`)
//  keine Engine zur Hand haben. Die Engine delegiert hierher.
// ═══════════════════════════════════════════

/**
 * Die max HP, die `hero` nach einer Wiederbelebung hätte.
 * Ohne Zahl am Helden (Altstände) wie bisher 400.
 * @param {object} hero
 * @param {object} [opts]  `{ maxHpCap }`, wenn die Karte die max HP fest setzt
 */
function reviveMaxHp(hero, opts = {}) {
  if (opts && opts.maxHpCap != null) return opts.maxHpCap;
  return typeof hero?.maxHp === 'number' ? hero.maxHp : 400;
}

/**
 * Kann dieser Held überhaupt wiederbelebt werden? Nur die Frage der
 * max HP — ob er tot ist, prüft der Aufrufer wie bisher.
 */
function canReviveHero(hero, opts = {}) {
  if (!hero?.name) return false;
  return reviveMaxHp(hero, opts) > 0;
}

module.exports = { reviveMaxHp, canReviveHero };
