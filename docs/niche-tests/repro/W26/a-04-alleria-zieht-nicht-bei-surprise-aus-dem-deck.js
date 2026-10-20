'use strict';
// W26a · Entscheidung Al (21.10.2026, N4-04 Sabrina): Alleria („When a Surprise in this Hero's Surprise Zone activates, draw 1 card.") zieht NICHT, wenn eine Surprise aktiviert wird,
// die nie in ihrer Surprise Zone lag: aus dem Deck gesucht und sofort aktiviert (Sabrina, `fromDeck`) – analog Cute Spider (aus der Ablage/Hand, `fromDiscard`, W24d).
// Gegenproben: eine normale Surprise in Allerias Surprise Zone (Telekinesis-Aktivierung) → sie zieht; Brain Spider („as if placed in theirs") bleibt unberührt.
// Aufruf: node docs/niche-tests/repro/W26/a-04-alleria-zieht-nicht-bei-surprise-aus-dem-deck.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const ALLERIA = 'Alleria, the Queen of Spiders';
const SABRINA = 'Sabrina, the Psychic Witch';
const SURP = 'Skull Carpet Bombing';
const { loadCardEffect } = require('../../../../cards/effects/_loader');
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`Sitz ${seat}`);
    const heroes = [null, null]; heroes[seat] = [ALLERIA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
    const mk = async () => {
      const t = await H.fresh({ active: seat, heroes, hand: [[], []], deckSize: 30 });
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === opp && x.heroIdx === 0); return h ? [h.id] : [v[0].id]; };
      t.gs.activePlayer = seat; t.phase(3);
      return t;
    };
    // A) Gegenprobe: Surprise liegt in Allerias Surprise Zone (Telekinesis-Weg) → Alleria zieht
    { const t = await mk();
      t.putSurprise(seat, 0, SURP);
      const h0 = t.pile(seat, 'hand').length;
      await t.run(() => t.engine._activateSurprise(seat, 0, SURP, { telekinesis: true, activatorIdx: opp }, loadCardEffect(SURP)));
      const zug = t.logs.some(l => l.type === 'alleria_surprise_draw');
      R.check('A) Surprise aus Allerias Surprise Zone: Alleria zieht 1', zug && t.pile(seat, 'hand').length - h0 === 1, { zug, delta: t.pile(seat, 'hand').length - h0 });
      R.check('A) sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    // B) aus dem Deck aktiviert (der Weg von Sabrina) → Alleria zieht NICHT
    { const t = await mk();
      const ps = t.gs.players[seat];
      ps.mainDeck.splice(0, 0, SURP);
      await t.run(() => { const i = ps.mainDeck.indexOf(SURP); ps.mainDeck.splice(i, 1); return t.engine._activateSurprise(seat, 0, SURP, { telekinesis: true, forcedByCard: SABRINA, activatorIdx: opp }, loadCardEffect(SURP), { fromDeck: true, steuerer: seat }); });
      const zug = t.logs.some(l => l.type === 'alleria_surprise_draw');
      R.check('B) Surprise aus dem Deck aktiviert (fromDeck): Alleria zieht NICHT', !zug, { zug });
      R.check('B) die Surprise wurde tatsächlich aktiviert (Log)', t.logs.some(l => l.type === 'surprise_activated'), t.logs.filter(l => /surprise/.test(l.type)).map(l => l.type));
      R.check('B) sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    // C) echter Weg: Sabrina opfert eine Kreatur, sucht die Surprise im Deck (Sabrina als Held 0, Alleria als Held 1 – Alleria ist nicht der Aktivierende)
    { const hs = [null, null]; hs[seat] = [SABRINA, ALLERIA, H.BLANK_HEROES[2]];
      const t = await H.fresh({ active: seat, heroes: hs, hp: 400, deck: (() => { const d = [null, null]; d[seat] = [SURP, 'Heal', 'Heal', 'Heal', 'Heal', 'Heal']; return d; })() });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
      t.targetFn = (v) => [v[0].id];
      const k = t.put(seat, 0, 0, H.INERT.creature, { counters: { _cardDataOverride: Object.assign({}, H.DB[H.INERT.creature], { level: 3 }) } }); k.turnPlayed = 0;
      const r = await t.activateHero(seat, 0, { effect: SABRINA });
      const zug = t.logs.some(l => l.type === 'alleria_surprise_draw');
      R.check('C) Sabrina-Effekt lief (Surprise aus dem Deck aktiviert)', r === true && t.logs.some(l => l.type === 'sabrina_surprise_activated'), { r });
      R.check('C) Alleria (anderer Held) zieht nicht', !zug, { zug });
      R.check('C) sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})();
