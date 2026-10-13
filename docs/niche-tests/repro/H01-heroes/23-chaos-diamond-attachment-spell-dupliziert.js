'use strict';
// H01-heroes-23 · Chaos-Diamond: ein gewirkter Attachment-Spell liegt danach doppelt vor (Ablage UND am Helden)
//
// Kartentext: „… your Potion Deck must consist of exactly 15 **Normal or Attachment** Spells with different names … You may spend your Action to reveal the top 2 cards of
//   your Potion Deck and immediately have this Hero perform all Spells among them in order as additional Actions, regardless of their levels."
// Aufbau: Sitz 0: Chaos-Diamond (Starthelden, `onGameStart` gefeuert), Potion Deck [<Attachment-Spell>, „Accusation"]; Aktivierung in der Action Phase, Ziele auf den Gegner-Helden 0.
// Erwartet: Der Attachment-Spell verlässt beim Wirken die Ablage und liegt genau einmal am Helden (Kartenbilanz ohne Differenz; wie bei jedem normal gespielten Attachment).
// Beobachtet: Der Skript-Ablauf legt die aufgedeckten Karten ZUERST in die Ablage und wirkt sie dort (`bereitsInAblage`); ein Attachment, das sich selbst auf das Brett legt,
//   bleibt dabei zusätzlich in der Ablage: z. B. Curse – Ablage ["Curse","Accusation"] UND eine Curse-Instanz im Support des Gegner-Helden; `censusDiff` „Curse: +1".
//   Trifft Curse, Decisive Defeat (am Gegner) und Energy Aura (am eigenen Helden). Die Karte existiert doppelt; fällt das Attachment später ab, landet eine zweite Kopie in der Ablage.
// Ursache: `_engine.js` `_castSpellImmediately` ~Z. 21925–21931: im Zweig `_aufsBrett` (Karte hat sich selbst aufs Brett gelegt) wird nur bei `fromZone !== 'deck'` aus dem Pool entfernt; Chaos-Diamond ruft
//   mit `fromZone: 'deck'` + `bereitsInAblage: true` (`chaos-diamond-the-cracked-keeper.js` ~Z. 150), die Ablage-Kopie wird nie entnommen.
const H = require('../../lib/h.js');
const CD = 'Chaos-Diamond, the Cracked Keeper';
(async () => {
  const R = H.runner();
  for (const att of ['Curse', 'Decisive Defeat', 'Energy Aura']) {
    const t = await H.fresh({ heroes: [[CD, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], potionDeck: [[att, 'Accusation'], []], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)], hand: [[], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1)?.id ?? valid[0].id];
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.gs.activePlayer = 0; t.resetActions(0);
    const vorher = t.census();
    const r = await t.activateHero(0, 0, { phase: 3 });
    const kopien = t.inst(c => c.name === att && (c.zone === 'discard' || c.zone === 'support')).map(c => `${c.owner}:${c.zone}`);
    R.check(`${att}: Aktivierung lief`, r === true, r);
    R.check(`${att}: Karte genau einmal vorhanden (Ablage ODER Brett)`, kopien.length === 1, kopien);
    R.check(`${att}: Kartenbilanz ohne Differenz`, t.censusDiff(vorher, t.census()).length === 0, t.censusDiff(vorher, t.census()));
    R.check(`${att}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
