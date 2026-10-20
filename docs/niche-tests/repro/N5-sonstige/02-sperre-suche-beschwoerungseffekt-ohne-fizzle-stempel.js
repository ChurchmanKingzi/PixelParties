'use strict';
// N5-02 · Country/Metal/Rap Harpyformer und Red Dragoneer: unter Such-Sperre (Harpyformer auch unter Hand-Sperre) fragen sie nach der Suche,
// finden nichts — und stempeln den Beschwörungseffekt NICHT als „gefizzelt" (`counters._summonFizzledTurn`). Sandy Blob („when the on-summon effect of a
// Creature you control activates") feuert deshalb trotz leerem Effekt.
// Ruling W11/R4 (Al): „Nein, die sollen auch nicht auslösen. Nur ein wirklich feuernder Effekt löst Sandy Blob aus!" — leeres Suchen/kein Treffer/abgelehntes „you may" ⇒ `summonEffektFizzelt(…, {stumm:true})`.
//   Gegenprobe im Skript: ohne Sperre, ohne Treffer im Deck bleibt der Blob stumm (✓); ohne Sperre, mit Treffer feuert er (✓).
// Erwartet: Blob stumm, wenn die Sperre die Suche verhindert. Beobachtet: Blob feuert (50 Schaden).
// Aufruf: node docs/niche-tests/repro/N5-sonstige/02-sperre-suche-beschwoerungseffekt-ohne-fizzle-stempel.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const FAELLE = [['Country Harpyformer', 'Adventurousness'], ['Metal Harpyformer', 'Fighting'], ['Rap Harpyformer', 'Decay Magic'], ['Red Dragoneer', 'Blue-Ice Dragon']];
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const [nm, ziel] of FAELLE) {
      for (const [sperre, deckTreffer, sollFeuern] of [['keine', true, true], ['keine', false, false], ['search', true, false], ['hand', true, false]]) {
        if (sperre === 'hand' && nm === 'Red Dragoneer') continue;   // Dragoneer prüft handLocked bereits
        const hand = [[], []]; hand[seat] = [nm];
        const deck = [[], []]; deck[seat] = deckTreffer ? [ziel, H.INERT.filler, H.INERT.filler] : [H.INERT.filler, H.INERT.filler];
        const t = await H.fresh({ active: seat, hand, deck });
        t.put(seat, 1, 0, 'Sandy Blob');
        const ps = t.gs.players[seat];
        if (sperre === 'search') ps.searchLocked = true;
        if (sperre === 'hand') ps.handLocked = true;
        t.policy.confirm = true;
        t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: ziel }) });
        t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === opp).id];
        const hp0 = t.hp(opp, 0);
        await t.play(seat, nm, { hero: 0 });
        const feuerte = hp0 - t.hp(opp, 0) === 50;
        R.check(`${nm} · Sitz ${seat} · Sperre ${sperre} · Treffer im Deck ${deckTreffer}: Sandy Blob ${sollFeuern ? 'feuert' : 'bleibt stumm'}`, feuerte === sollFeuern, { feuerte, karteAufHand: t.pile(seat, 'hand').length });
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
      }
    }
  }
  R.finish();
})();
