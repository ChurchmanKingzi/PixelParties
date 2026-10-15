'use strict';
// W13a · Q129 (allgemeine Regel für „automatische" Zusatzaktionen dieser Bauart) – hier: Learning (Ability, Lv3: nach einem Spell einen Spell aus der Hand als Zusatzaktion).
// Al, 15.10.2026: „Bricht man die Zielwahl … ab, soll die Karte gar nicht erst konsumiert werden. Bis man die committed hat, verbleibt sie einfach in Hand/Deck, erst danach
//   wird sie bewegt. Und once per turn/game wird natürlich auch erst dann konsumiert."
// Erwartet: Abbruch der Zielwahl des Learning-Gusses → Karte bleibt auf der Hand (nicht in der Ablage), Einmal-pro-Zug-Stempel frei, keine Wisdom-Kosten, Aktionszähler
//   unverändert; bestätigte Zielwahl → Karte in der Ablage, Stempel gesetzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function szene() {
    const t = await H.fresh({ hand: [['Haste', 'Burning Finger'], []], deckSize: 20,
      abilities: { 0: { 0: [['Learning', 'Learning', 'Learning'], ['Support Magic', 'Support Magic'], ['Destruction Magic', 'Destruction Magic']] } } });
    t.script.push({ match: d => d.type === 'pickHandCard' && d.title === 'Learning', answer: (d) => { const i = d.eligibleIndices[0]; return { handIndex: i, cardName: t.gs.players[0].hand[i] }; } });
    return t;
  }
  const key = 'learning:0:0:0';
  const ziel = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };

  R.section('Abbruch der Zielwahl des Zusatzgusses');
  {
    const t = await szene();
    let n = 0;
    t.targetFn = (valid) => { n++; return null; };   // Haste braucht keine Zielwahl; die erste Zielwahl ist die des Learning-Gusses (Burning Finger) → Abbruch
    const z0 = t.gs.players[0]._actionsPlayedThisPhase || 0;
    await t.play(0, 'Haste', { hero: 0, noGrant: true });
    R.check('Learning hat angeboten (Aufbau): Zielwahl des Zusatzgusses wurde geöffnet', n >= 1, n);
    R.check('Burning Finger bleibt auf der Hand', t.pile(0, 'hand').includes('Burning Finger'), t.pile(0, 'hand'));
    R.check('Burning Finger nicht in der Ablage', !t.pile(0, 'discardPile').includes('Burning Finger'), t.pile(0, 'discardPile'));
    R.check('Einmal-pro-Zug-Stempel frei', t.gs.hoptUsed?.[key] !== t.gs.turn, t.gs.hoptUsed);
    R.check('kein Schaden', t.hp(1, 0) === 800, t.hp(1, 0));
    R.check('Aktionszähler nur durch Haste erhöht (+1)', (t.gs.players[0]._actionsPlayedThisPhase || 0) - z0 <= 1, { z0, jetzt: t.gs.players[0]._actionsPlayedThisPhase });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.section('Bestätigte Zielwahl (Commit)');
  {
    const t = await szene();
    t.targetFn = ziel;
    await t.play(0, 'Haste', { hero: 0, noGrant: true });
    R.check('Burning Finger gewirkt (Gegner verliert HP)', t.hp(1, 0) < 800, t.hp(1, 0));
    R.check('Burning Finger liegt in der Ablage, nicht mehr auf der Hand', t.pile(0, 'discardPile').includes('Burning Finger') && !t.pile(0, 'hand').includes('Burning Finger'), { abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    R.check('Stempel gesetzt', t.gs.hoptUsed?.[key] === t.gs.turn, t.gs.hoptUsed);
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
