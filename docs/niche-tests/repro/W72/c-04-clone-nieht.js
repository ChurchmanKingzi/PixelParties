'use strict';
// W72c-04 · Clone × Nieht, the Blitz Blade — „Niehts Bonusangriff SOLLTE Clone anbieten (falls sein once per turn noch nicht verbraucht ist)" (Al, 24.10.2026)
// Nieht: nach einer Attack, die genau 1 Ziel trifft und es nicht besiegt, darf er einmal pro Zug eine Lv-1-oder-niedriger-Attack aus der Hand als Zusatzaktion gegen dasselbe Ziel einsetzen
// (erzwungenes Ziel, `gs._forcedDamageTarget`). Beide Attacks sind „Normal Attacks, die der Held benutzt" — der Clone bietet EINE Kopie je Zug an (Reihenfolge der Hörer egal).
const H = require('../../lib/h.js');
const NIEHT = 'Nieht, the Blitz Blade';
const confirms = (t, titel) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === titel);
const nimmErste = (t) => t.script.push({ match: (d) => d.type === 'cardGallery' && d.title === NIEHT, answer: (d) => ({ cardName: d.cards[0].name }) });   // Nieht: die Bonus-Attack aus der Galerie wählen
const setAtk = (t, seat, hi, atk) => { t.gs.players[seat].heroes[hi].atk = atk; t.gs.players[seat].heroes[hi].baseAtk = atk; };

(async () => {
  const R = H.runner();

  R.section('A · beide Attacks von Nieht, ein Clone: genau eine Kopie');
  {
    const t = await H.fresh({ hand: [['Attack', 'Attack'], []], heroes: [[NIEHT, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    t.put(0, 0, 0, 'Clone'); setAtk(t, 0, 0, 100); nimmErste(t);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.setHand(0, ['Attack', 'Attack']);
    const r = await t.play(0, 'Attack', { hero: 0 });
    t.targetFn = null;
    R.check('gespielt', r === true, r);
    R.check('Nieht bot die Bonus-Attack an', confirms(t, NIEHT).length === 1, confirms(t, NIEHT).length);
    R.check('Clone bot genau EINE Kopie an (1 pro Zug)', confirms(t, 'Clone').length === 1, confirms(t, 'Clone').length);
    R.check('Schaden: Original 100 + Bonus-Attack 100 + eine Kopie 100 = 300', t.hp(1, 0) === 500, t.hp(1, 0));
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('B · Clone-Limit schon verbraucht: keine zweite Kopie für die Bonus-Attack');
  {
    const t = await H.fresh({ hand: [['Attack', 'Attack'], []], heroes: [[NIEHT, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    t.put(0, 0, 0, 'Clone'); setAtk(t, 0, 0, 100); nimmErste(t);
    t.gs.hoptUsed = { ...(t.gs.hoptUsed || {}), ['clone-copy:0']: t.gs.turn };
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.setHand(0, ['Attack', 'Attack']);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Clone-Limit verbraucht: keine Kopie, nur Original + Bonus (200)', confirms(t, 'Clone').length === 0 && t.hp(1, 0) === 600, [confirms(t, 'Clone').length, t.hp(1, 0)]);
  }

  R.section('C · ohne Nieht-Bonus (Clone-Limit frei): die Bonus-Attack allein wird kopiert, wenn die erste Kopie abgelehnt wurde');
  {
    const t = await H.fresh({ hand: [['Attack', 'Attack'], []], heroes: [[NIEHT, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    t.put(0, 0, 0, 'Clone'); setAtk(t, 0, 0, 100); nimmErste(t);
    let n = 0;
    t.script.push({ match: (d) => d.type === 'confirm' && d.title === 'Clone', answer: () => ({ confirmed: ++n === 2 }) });   // die erste Anfrage ablehnen, die zweite annehmen
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.setHand(0, ['Attack', 'Attack']);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('zwei Anfragen (je eine je Attack), die zweite angenommen → 300', confirms(t, 'Clone').length === 2 && t.hp(1, 0) === 500, [confirms(t, 'Clone').length, t.hp(1, 0)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
