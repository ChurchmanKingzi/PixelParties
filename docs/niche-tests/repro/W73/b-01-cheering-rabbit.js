'use strict';
// W73b-01 · Cheering Rabbit (Creature Normal Lv0, 30 HP)
// „The corresponding Hero deals 50 additional damage with the first Attack or Spell it uses each turn."
const H = require('../../lib/h.js');
const CARD = 'Cheering Rabbit';
const setAtk = (t, seat, hi, atk) => { t.gs.players[seat].heroes[hi].atk = atk; t.gs.players[seat].heroes[hi].baseAtk = atk; };
async function wirken(t, seat, hi, karte, ziele) {
  t.targetFn = (valid) => (typeof ziele === 'function' ? ziele(valid) : ziele).filter(id => valid.some(v => v.id === id));
  const hand = t.pile(seat, 'hand').slice();
  t.setHand(seat, [karte, ...hand.filter(n => n !== karte)]);
  const r = await t.play(seat, karte, { hero: hi });
  t.targetFn = null;
  return r;
}

(async () => {
  const R = H.runner();

  R.section('A · erster Attack +50, zweiter nicht');
  {
    const t = await H.fresh({ hand: [['Attack', 'Attack'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100);
    let v = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check(`erster Attack: 100 + 50 = 150 (HP ${v} → ${t.hp(1, 0)})`, v - t.hp(1, 0) === 150, [v, t.hp(1, 0)]);
    t.resetActions(0);
    v = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check('zweiter Attack: nur 100', v - t.hp(1, 0) === 100, [v, t.hp(1, 0)]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  {
    // nächster Zug: wieder der erste
    const t = await H.fresh({ hand: [['Attack', 'Attack'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    t.resetActions(0);
    t.gs.turn += 2;   // nächster eigener Zug
    const v = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check('im nächsten Zug zählt wieder der erste Attack: 150', v - t.hp(1, 0) === 150, [v, t.hp(1, 0)]);
  }
  {
    // Spell zuerst, danach ein Attack: der Spell war der erste, der Attack bekommt nichts
    const t = await H.fresh({ hand: [['Fireball', 'Attack'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100); t.grantFor(0, 0, 'Fireball');
    const ref = await H.fresh({ hand: [['Fireball', 'Attack'], []] });
    ref.grantFor(0, 0, 'Fireball'); setAtk(ref, 0, 0, 100);
    await wirken(ref, 0, 0, 'Fireball', ['hero-1-0']);
    const normal = 800 - ref.hp(1, 0);
    await wirken(t, 0, 0, 'Fireball', ['hero-1-0']);
    R.check(`Spell zuerst: +50 (Fireball ${normal} → ${800 - t.hp(1, 0)})`, 800 - t.hp(1, 0) === normal + 50, [normal, 800 - t.hp(1, 0)]);
    t.resetActions(0);
    const v = t.hp(1, 1);
    await wirken(t, 0, 0, 'Attack', ['hero-1-1']);
    R.check('der folgende Attack ist nicht der erste: 100', v - t.hp(1, 1) === 100, [v, t.hp(1, 1)]);
  }

  R.section('B · nur der Held des Kaninchens; andere Helden und Quellen unberührt');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100); setAtk(t, 0, 1, 100);
    const v = t.hp(1, 0);
    await wirken(t, 0, 1, 'Attack', ['hero-1-0']);     // Held 1 wirkt, das Kaninchen steht bei Held 0
    R.check('anderer Held: kein Bonus (100)', v - t.hp(1, 0) === 100, [v, t.hp(1, 0)]);
  }
  {
    // Kaninchen beim GEGNER (Held 0 der Gegnerseite): mein Attack bekommt keinen Bonus
    const t = await H.fresh({ hand: [['Attack'], []] });
    t.put(1, 0, 0, CARD); setAtk(t, 0, 0, 100);
    const v = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check('Kaninchen des Gegners wirkt nicht für meinen Helden', v - t.hp(1, 0) === 100, [v, t.hp(1, 0)]);
  }
  {
    // zwei Kaninchen am selben Helden: +100
    const t = await H.fresh({ hand: [['Attack'], []] });
    t.put(0, 0, 0, CARD); t.put(0, 0, 1, CARD); setAtk(t, 0, 0, 100);
    const v = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check('zwei Kaninchen: +100', v - t.hp(1, 0) === 200, [v, t.hp(1, 0)]);
  }
  {
    // gefroren → ruht
    const t = await H.fresh({ hand: [['Attack'], []] });
    const k = t.put(0, 0, 0, CARD); k.counters.frozen = 1; setAtk(t, 0, 0, 100);
    const v = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check('gefrorenes Kaninchen: kein Bonus', v - t.hp(1, 0) === 100, [v, t.hp(1, 0)]);
  }

  R.section('C · Kreaturen als Ziel, Flächenschaden, mehrere Treffer');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100);
    const ziel = t.put(1, 0, 0, H.INERT.big);
    const hp0 = ziel.counters.currentHp ?? t.engine._getCardDB()[H.INERT.big].hp;
    await wirken(t, 0, 0, 'Attack', ['equip-1-0-0']);
    R.check(`Kreatur als Ziel: 150 (HP ${hp0} → ${ziel.counters.currentHp})`, hp0 - ziel.counters.currentHp === 150, [hp0, ziel.counters.currentHp]);
  }

  R.section('D · Wechselwirkung: Shrink („becomes 1") und Stoneskin');
  {
    const t = await H.fresh({ hand: [['Attack', 'Shrink'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100); t.grantFor(0, 0, 'Shrink');
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return v ? [v.id] : undefined; };
    t.setHand(0, ['Shrink']);
    await t.play(0, 'Shrink', { hero: 0 });
    t.targetFn = null; t.resetActions(0);
    const v = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check('Shrink am Wirker: Schaden bleibt 1 (der Bonus wird abgewiesen)', v - t.hp(1, 0) === 1, [v, t.hp(1, 0)]);
  }

  R.section('E · mehrere aufeinanderfolgende Treffer (Chain Lightning: 200/150/100) und Flächenschaden');
  {
    const mk = async (mit) => {
      const t = await H.fresh({ hand: [['Chain Lightning'], []], hp: 5000 });
      t.grantFor(0, 0, 'Chain Lightning');
      if (mit) t.put(0, 0, 0, CARD);
      t.targetFn = (valid, cfg) => {
        const reihe = ['hero-1-0', 'hero-1-1', 'hero-1-2'];
        const gewaehlt = (t._cl = t._cl || []);
        const id = reihe.find(i => !gewaehlt.includes(i) && valid.some(v => v.id === i));
        if (id) gewaehlt.push(id);
        return id ? [id] : undefined;
      };
      t.setHand(0, ['Chain Lightning']);
      const r = await t.play(0, 'Chain Lightning', { hero: 0 });
      t.targetFn = null;
      return { t, r, schaden: [0, 1, 2].map(i => 5000 - t.hp(1, i)) };
    };
    const a = await mk(false), b = await mk(true);
    R.check(`Chain Lightning ohne Kaninchen: ${a.schaden} (Basis 200/150/100)`, a.r === true && a.schaden.reduce((x, y) => x + y, 0) > 0, a.schaden);
    const da = a.schaden.reduce((x, y) => x + y, 0), db = b.schaden.reduce((x, y) => x + y, 0);
    R.check(`mit Kaninchen: jeder Treffer +50 (Summe ${da} → ${db})`, db - da === 50 * a.schaden.filter(x => x > 0).length, [a.schaden, b.schaden]);
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
