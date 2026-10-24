'use strict';
// W71b-02 · Meditation: Leitung auf BEIDEN Sitzen — Auftritt erst nach den abbrechbaren Wahlen, Abbruch = nichts (Menü UND Galerie), beide Wege.
const W = require('../../lib/wire.js');
const CARD = 'Meditation';

(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const weg of ['hand', 'mischen']) {
      const label = `[S${seat}] ${CARD} (${weg})`;
      R.section(label);
      const mk = () => W.reicheSzene({ seat, karten: [CARD], board: async (t) => {
        t.grantFor(seat, 0, CARD);
        t.setDiscard(seat, ['Fireball', 'Icebolt', 'Explosion']);
      } });
      const answer = (e) => {
        if (e.kind !== 'generic') return undefined;
        if (e.d.type === 'optionPicker' && e.d.title === CARD) return { optionId: weg };
        if (e.d.type === 'cardGalleryMulti' && e.d.title === CARD) return { selectedCards: ['Fireball', 'Icebolt'], selectedIndices: [0, 1] };
        if (e.d.type === 'deckSearchReveal') return { confirmed: true };
        return undefined;
      };
      const d = await W.durchlauf(mk, seat, CARD, { seat, hero: 0, maxCancel: 4, answer });
      W.pruefeDurchlauf(R, label, d, { seat, nCanc: 2, nEcht: 2 });
      const c = d.clean;
      R.check(`${label}: gespielt, Meditation im Löschstapel des Spielers`, c.t.gs.players[seat].deletedPile.includes(CARD), c.t.gs.players[seat].deletedPile);
      if (weg === 'hand') {
        const rev = c.r.tl.filter(e => e.k === 'prompt' && e.d && e.d.type === 'deckSearchReveal');
        R.check(`${label}: ein einziges Reveal-Fenster, an den Gegner, mit beiden Karten`, rev.length === 1 && rev[0].pi === opp && rev[0].d.cardNames.length === 2, rev.map(r => [r.pi, r.d.cardNames]));
      }
      for (const { k, r, t } of d.cancels.filter(x => x.r.undone)) {
        R.check(`${label}: Abbruch an Stelle ${k} — Rundensperre frei, Ablage unverändert`, !Object.keys(t.gs.hoptUsed || {}).some(x => x.includes(CARD)) && t.gs.players[seat].discardPile.length >= 3, { hopt: t.gs.hoptUsed });
      }
    }
  }
  R.finish();
})();
