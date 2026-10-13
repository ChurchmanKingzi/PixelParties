'use strict';
// M01-26 · Geliehener Held (Charme Lv3): das Spielgate `canPlayWithHero` von Knife Throw, Breaking Strike und Forceful Revival liest den gleichindizierten EIGENEN Helden statt des geliehenen
// Kartentexte: Knife Throw „Send an Artifact equipped to the user to the discard pile to play this card …", Breaking Strike „Discard any number of Artifacts equipped to the user …", Forceful Revival „… place it into a free Support Zone of the user."
// Engine-Vertrag (_engine.js ~43530 `heldSeiteFuer`): „Skripte lesen »this Hero«/»the user« in der richtigen Spalte: gs.players[engine.heldSeiteFuer(pi, heroIdx)].heroes[heroIdx]". Capture hält sich daran, die drei hier nicht.
// Aufbau: Sitz 0 Held 0 mit Charme Lv3 übernimmt Held 1 von Sitz 1 (der trägt Club of Gobbo bzw. Fighting Lv3); Sitz 0 spielt die Karte mit `t.play(0, card, { hero: 1, charmedOwner: 1 })`.
// Erwartet: Der geliehene Held ist der Nutzer: Knife Throw / Breaking Strike spielbar (sein Club), Forceful Revival spielbar (sein Fighting 3, freie Zone).
// Beobachtet: `play` meldet `false`, die Karte bleibt auf der Hand (das Gate schaut auf Sitz 0 / Held 1: kein Club, kein Fighting). Umgekehrt: trägt der EIGENE Held 1 den Club und der geliehene nicht, besteht das Gate und `onPlay` bricht danach ab.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const card of ['Heavy Hit', 'Knife Throw', 'Breaking Strike', 'Forceful Revival']) {   // Heavy Hit = Kontrolle (hat kein eigenes Gate)
    const fr = card === 'Forceful Revival';
    const t = await H.fresh({ hand: [[card], []], hp: 800, deckSize: 20, discard: [['Arcane Eyes'], []],
      abilities: { 0: { 0: [['Charme', 'Charme', 'Charme'], [], []] }, 1: { 1: [['Fighting', 'Fighting', 'Fighting'], [], []] } } });
    if (!fr) t.put(1, 1, 0, 'Club of Gobbo');
    t.gs.activePlayer = 0; t.phase(2);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1).id];
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    R.check(card + ': Vorbedingung Held 1 von Sitz 1 ist von Sitz 0 übernommen', t.hero(1, 1).charmedBy === 0, t.hero(1, 1).charmedBy);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Arcane Eyes' }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
    t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 0) || valid[0]).id];
    const r = await t.play(0, card, { hero: 1, charmedOwner: 1, noGrant: true, keepActions: true });
    R.check(card + (card === 'Heavy Hit' ? ' (Kontrolle)' : '') + ': mit dem geliehenen Helden spielbar', r === true && !t.pile(0, 'hand').includes(card), { r, hand: t.pile(0, 'hand') });
    R.check(card + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
