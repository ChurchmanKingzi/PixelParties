'use strict';
// M01-17 · Hammer Throw: der Item Lock greift auch, wenn Escape die Attack (samt Schaden) negiert
// Kartentext Escape: „… Discard 1 card and negate ALL EFFECTS the Attack or Spell has on that Hero (including damage)." Hammer Throw (Skriptkopf): „If the attack is NOT NEGATED, the target's controller is Itemlocked for their next turn."
// Aufbau: Seed 1234, Zug 5; Sitz 1 Held 0 hat Fighting Lv2 und 30 HP, Hand [Escape, ZZ Filler]; Sitz 0 spielt Hammer Throw (40 ATK) auf Held 0; Escape-Frage „Ja".
// ★ UMGESTELLT in Welle 13 (Q139, Al: „Wenn NUR der Schaden verhindert wird, ja. Wenn die Karte insgesamt negiert wird, nein."):
//   Escape verhindert nur den Schaden → der Item Lock wird trotzdem gesetzt (vorher erwartete dieses Repro: Lock entfällt = ALTE Regel).
//   Ganz-Negierungen (Frost Rune, Invisibility Cloak …) setzen keinen Lock: siehe `W13/b-q139-hammer-throw-lock.js`.
// Erwartet: Escape negiert den Schaden (Held bleibt bei 30 HP); der Item Lock BLEIBT (Karte nicht insgesamt negiert).
// Ursache: `hammer-throw.js` (~Z. 99, 129-160): `let negated = false;` wird nie gesetzt/gelesen; das Rückgabeergebnis von `actionDealDamage` wird nicht ausgewertet, der Lock hängt nur an `gs.turn > 1`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const atk of ['Heavy Hit', 'Hammer Throw']) {
    const t = await H.fresh({ hand: [[atk], ['Escape', 'ZZ Filler']], hp: 800, abilities: { 1: { 0: [['Fighting', 'Fighting'], [], []] } } });
    t.hero(1, 0).hp = 30;
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    const r = await t.play(0, atk, { hero: 0 });
    const h = t.hero(1, 0);
    R.note(`${atk}: r=${r}; Ziel hp=${h.hp}, stunned=${!!h.statuses.stunned}, itemLocked(Sitz 1)=${t.gs.players[1].itemLocked}; Ablage Sitz 1=${JSON.stringify(t.pile(1, 'discardPile'))}`);
    R.check(`${atk}: Escape negiert den Schaden (Ziel bleibt bei 30 HP)`, h.hp === 30, h.hp);
    if (atk === 'Heavy Hit') R.check('Heavy Hit: Betäubung ebenfalls negiert (Kontrolle)', !h.statuses.stunned, h.statuses);
    else R.check('Hammer Throw: Item Lock bleibt, wenn nur der Schaden verhindert wird (Q139)', !!t.gs.players[1].itemLocked, t.gs.players[1].itemLocked);
    R.check(`${atk}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
