'use strict';
// W13a · Q129 (H04-11, Taio, Absorber of the Mountain's Heart; Ascended-Taios zweite Aktion) · Al, 15.10.2026:
//   „Bricht man die Zielwahl von Ascended-Taios zweiter Aktion ab, soll die Karte gar nicht erst konsumiert werden. Bis man die committed hat, verbleibt sie
//    einfach in Hand/Deck, erst danach wird sie bewegt. Und once per turn/game wird natürlich auch erst dann konsumiert. Das sollte eine allgemeine Regel für ALLE
//    'automatischen' Zusatzaktionen dieser Bauart sein und gehört auch in die API!"
// Erwartet (Taio): Abbruch der Zielwahl im Nachguss → Karte bleibt in Hand bzw. Deck (Deck unverändert, nicht gemischt), Einmal-pro-Zug-Stempel frei, kein Schaden,
//   kein Gegner-Reveal; ein zweiter Versuch im selben Zug geht. Bestätigte Zielwahl (Commit) → Karte wandert in die Ablage (Deck: gemischt), Stempel gesetzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TA = "Taio, Absorber of the Mountain's Heart";
  const KEY = 'taio-mountains-heart-followup';
  const heroes = [['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief']];
  async function szene(quelle) {
    const dummies = Array.from({ length: 12 }, (_, i) => (i % 2 ? 'Heal' : 'Haste'));
    const t = await H.fresh({ heroes: [heroes[0]], hand: [quelle === 'hand' ? ['Burning Finger', 'Quick Attack', 'Burning Finger'] : ['Burning Finger', 'Burning Finger'], []],
      deck: [quelle === 'deck' ? [dummies[0], 'Quick Attack', ...dummies] : dummies, Array(10).fill(H.INERT.filler)] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setHero(0, 0, TA, 600);
    t.setAbilities(0, 0, [['Fighting', 'Fighting', 'Fighting'], ['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TA, answer: () => ({ cardName: 'Quick Attack', source: quelle }) });
    return t;
  }
  const hopt = (t) => t.gs.hoptUsed?.[`${KEY}:0`] === t.gs.turn;
  const ziel = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };

  for (const q of ['hand', 'deck']) {
    R.section(`── Quelle ${q}`);
    // (1) Abbruch der Zielwahl im Nachguss
    let t = await szene(q);
    const deckVorher = t.pile(0, 'mainDeck').slice();
    let n = 0;
    t.targetFn = (valid) => { n++; return n === 1 ? ziel(valid) : null; };   // 1. Zielwahl (Burning Finger) ok, 2. (Nachguss) Abbruch
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check(`${q}: Abbruch → Quick Attack nicht in der Ablage`, !t.pile(0, 'discardPile').includes('Quick Attack'), t.pile(0, 'discardPile'));
    R.check(`${q}: Abbruch → Quick Attack ${q === 'hand' ? 'noch in der Hand' : 'noch im Deck'}`, (q === 'hand' ? t.pile(0, 'hand') : t.pile(0, 'mainDeck')).includes('Quick Attack'), { hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck').length });
    if (q === 'deck') R.check('deck: Abbruch → Deck unverändert (Reihenfolge, nicht gemischt)', JSON.stringify(t.pile(0, 'mainDeck')) === JSON.stringify(deckVorher), { vorher: deckVorher.slice(0, 4), nachher: t.pile(0, 'mainDeck').slice(0, 4) });
    R.check(`${q}: Abbruch → Einmal-pro-Zug-Stempel frei`, !hopt(t), t.gs.hoptUsed);
    R.check(`${q}: Abbruch → kein Schaden durch den Nachguss (800 → 560)`, t.hp(1, 0) === 560, t.hp(1, 0));
    R.check(`${q}: Abbruch → keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    // (2) zweiter Versuch im selben Zug (zweites Burning Finger löst Taio erneut aus) und diesmal bestätigt
    t.targetFn = ziel;
    t.script.length = 0;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TA, answer: () => ({ cardName: 'Quick Attack', source: q }) });
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check(`${q}: zweiter Versuch im selben Zug: Quick Attack gewirkt (liegt in der Ablage)`, t.pile(0, 'discardPile').includes('Quick Attack'), t.pile(0, 'discardPile'));
    R.check(`${q}: Commit → Stempel gesetzt`, hopt(t), t.gs.hoptUsed);
    R.check(`${q}: Commit → Karte nicht mehr in ${q === 'hand' ? 'der Hand' : 'dem Deck'}`, !(q === 'hand' ? t.pile(0, 'hand') : t.pile(0, 'mainDeck')).includes('Quick Attack'), { hand: t.pile(0, 'hand') });
    R.check(`${q}: Commit → Gegner-Held verliert HP durch den Nachguss`, t.hp(1, 0) < 560, t.hp(1, 0));
    R.check(`${q}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('── Abbruch bereits in der Galerie: nichts verbraucht');
  {
    const t = await szene('hand');
    t.script.length = 0;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TA, answer: () => null });
    t.targetFn = ziel;
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Galerie abgelehnt: Quick Attack noch in der Hand, Stempel frei', t.pile(0, 'hand').includes('Quick Attack') && !hopt(t), { hand: t.pile(0, 'hand'), hopt: t.gs.hoptUsed });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
