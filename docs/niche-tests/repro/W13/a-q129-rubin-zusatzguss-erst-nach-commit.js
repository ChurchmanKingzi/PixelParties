'use strict';
// W13a · Q129 (allgemeine Regel für „automatische" Zusatzaktionen dieser Bauart) – hier: Rubin, the Dragoneer Champion (nach einer Opfer-Beschwörung einen Destruction Spell aus der Hand
//   als Zusatzaktion). Al, 15.10.2026: „Bricht man die Zielwahl … ab, soll die Karte gar nicht erst konsumiert werden … Und once per turn/game wird natürlich auch erst dann konsumiert."
// Erwartet: Abbruch der Zielwahl → Zauber bleibt auf der Hand, Einmal-pro-Zug-Sperre frei, keine Wisdom-Kosten; bestätigte Zielwahl → Zauber in der Ablage, Sperre gesetzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const RUBIN = 'Rubin, the Dragoneer Champion';
  async function szene() {
    const t = await H.fresh({ heroes: [[RUBIN, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hand: [['Burning Finger', 'Heal'], []], deckSize: 20 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);
    t.script.push({ match: d => d.type === 'pickHandCard' && d.title === RUBIN, answer: (d) => { const i = d.eligibleIndices[0]; return { handIndex: i, cardName: t.gs.players[0].hand[i] }; } });
    const kreatur = t.put(0, 1, 0, H.INERT.creature); kreatur.turnPlayed = 5;
    return { t, kreatur };
  }
  const ausloesen = (t, k) => t.run(() => t.engine.runHooks('onCardEnterZone', { enteringCard: k, toZone: 'support', toHeroIdx: 1, _tributePaid: true }));
  const frei = (t) => t.gs.hoptUsed?.['rubin-dragoneer:0'] !== t.gs.turn;
  const ziel = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };

  R.section('Abbruch der Zielwahl');
  {
    const { t, kreatur } = await szene();
    let n = 0; t.targetFn = () => { n++; return null; };
    await ausloesen(t, kreatur);
    R.check('Aufbau: Zielwahl des Zusatzgusses wurde geöffnet', n >= 1, n);
    R.check('Burning Finger bleibt auf der Hand', t.pile(0, 'hand').includes('Burning Finger'), t.pile(0, 'hand'));
    R.check('Burning Finger nicht in der Ablage', !t.pile(0, 'discardPile').includes('Burning Finger'), t.pile(0, 'discardPile'));
    R.check('Einmal-pro-Zug-Sperre frei', frei(t), t.gs.hoptUsed);
    R.check('kein Schaden', t.hp(1, 0) === 800, t.hp(1, 0));
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.section('Bestätigte Zielwahl (Commit)');
  {
    const { t, kreatur } = await szene();
    t.targetFn = ziel;
    await ausloesen(t, kreatur);
    R.check('Burning Finger gewirkt', t.hp(1, 0) < 800, t.hp(1, 0));
    R.check('Burning Finger in der Ablage, nicht mehr auf der Hand', t.pile(0, 'discardPile').includes('Burning Finger') && !t.pile(0, 'hand').includes('Burning Finger'), { abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    R.check('Sperre gesetzt', !frei(t), t.gs.hoptUsed);
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
