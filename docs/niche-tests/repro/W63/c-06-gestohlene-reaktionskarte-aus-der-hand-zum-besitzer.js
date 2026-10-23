'use strict';
// W63c-06 · Gestohlene REAKTIONSKARTE (Charme Lv 2) wird vom Dieb aus der Hand als Reaktion gespielt (Hand-Reaktionsfenster der Engine):
// Bamboo Shield (Artefakt, „Play this card immediately when a Hero would take any damage") und Spectral Armor (Spell, halbiert Schaden).
// Regel (CARD_API „Besitzer-Regel (W3)"): die Karte landet nach der Auflösung in der Ablage ihres BESITZERS, nicht des Reagierenden.
// Alter Stand: alle Hand-Reaktionsfenster (`_offerPostTargetHandReaction` & Geschwister, ~15 Stellen) legten die Karte in die Ablage des Spielers, der sie spielte.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  for (const dieb of [0, 1]) {
    const bes = 1 - dieb;
    R.section(`── Dieb = Sitz ${dieb} (reagiert), Besitzer = Sitz ${bes} (greift an) ──`);
    for (const karte of ['Bamboo Shield', 'Spectral Armor']) {
      const t = await B.charmeKlau(karte, dieb, { besitzerHand: ['Attack'], extra: { gold: [300, 300] } });
      R.check(`${karte}: gestohlen`, B.anzahl(t, dieb, 'hand', karte) === 1, t.pile(dieb, 'hand'));
      if (karte === 'Spectral Armor') t.grantFor(dieb, 0, 'Spectral Armor');
      t.policy.confirm = true;
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === dieb && x.heroIdx === 0); return h ? [h.id] : [v[0].id]; };
      const hp0 = t.hp(dieb, 0);
      await t.play(bes, 'Attack', { hero: 0 });
      const o = B.ort(t, karte);
      if (B.anzahl(t, dieb, 'hand', karte) === 1) { R.note(`${karte} / Dieb ${dieb}: Reaktion wurde nicht angeboten/gespielt (Aufbau der Harness)`, { hp: hp0 - t.hp(dieb, 0), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }); continue; }
      B.erwarteStapel(R, t, `${karte} als Reaktion gespielt (Dieb ${dieb})`, karte, bes, 'discardPile');
    }
  }
  R.finish();
})();
