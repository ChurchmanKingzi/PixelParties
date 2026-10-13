'use strict';
// M01-10 · Inventing Lv3: die Namenssperre („You cannot play cards with that name this turn") gilt serverseitig nicht für Equipment, Abilities und Surprises
// Kartentext Inventing 3): „… search your deck for a card with a different name, reveal it and add it to your hand. You cannot play cards with that name this turn."
// Engine-Vertrag (CARD_API ~Z. 1970): `ps._creationLockedNames` wird von validateActionPlay (Spells/Attacks/Creatures), doUsePotion (server.js:11863) und doUseArtifactEffect (Z. 12058)
//   durchgesetzt; der Client graut alle Typen aus (app-board.jsx:33974). `doPlayArtifact` (Equipment), `doPlayAbility` und `doPlaySurprise` prüfen die Sperre NICHT.
// Aufbau: Held 0 mit Inventing Lv3 (3 Kopien); Hand [ZZ Filler]; Deck [<Karte>, ZZ Dummy]; Inventing: ZZ Filler abwerfen, <Karte> suchen. Danach <Karte> im selben Zug spielen.
// Erwartet: Spielen abgelehnt (false), Karte bleibt auf der Hand – für JEDEN Kartentyp.
// Beobachtet: Spell/Attack/Trank/Normal-Artefakt/Kreatur werden abgelehnt ✓; Club of Gobbo (Equipment), Fighting (Ability) und Bluff (Surprise) werden gespielt (true, Karte weg).
const H = require('../../lib/h.js');
const free = (t, seat, hi, zi) => { t.gs.activePlayer = seat; t.phase(2); return t.run(() => t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: zi })); };
(async () => {
  const R = H.runner();
  for (const [card, art] of [['Heal', 'Spell'], ['Healing Potion', 'Trank'], ['Cloud Pillow', 'Normal-Artefakt'], ['Club of Gobbo', 'Equipment'], ['Fighting', 'Ability'], ['Bluff', 'Surprise']]) {
    const t = await H.fresh({ hand: [['ZZ Filler'], []], deck: [[card, 'ZZ Dummy', 'ZZ Dummy'], []], gold: 100, abilities: { 0: { 0: [['Inventing', 'Inventing', 'Inventing'], [], []] } } });
    t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'ZZ Filler', handIndex: 0 }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: card }) });
    const r0 = await free(t, 0, 0, 0);
    R.check(`${art} (${card}): Inventing hat die Karte geholt`, r0 === true && t.pile(0, 'hand').includes(card), { r0, hand: t.pile(0, 'hand') });
    t.targetFn = (valid) => [valid[0].id];
    const r = await t.play(0, card, { hero: 0, zoneSlot: 1 });
    R.check(`${art} (${card}): Spielen im selben Zug wird abgelehnt`, r === false && t.pile(0, 'hand').includes(card), { r, hand: t.pile(0, 'hand') });
  }
  R.finish();
})();
