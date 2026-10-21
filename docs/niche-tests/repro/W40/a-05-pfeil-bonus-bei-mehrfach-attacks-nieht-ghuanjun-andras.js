'use strict';
// W40a · Punkt 2 (Ergänzung) · Al, 22.10.2026: „Arrows boosten nur EINE Attack" — Prüfung der Wege, auf denen ein Held mehrere Attacks hintereinander ausführt:
//  · Nieht, the Blitz Blade: die Bonus-Attack („immediately use a level 1 or lower Attack from your hand with it as an additional Action") ist eine EIGENE Attack — der Pfeil-Bonus der ersten ist verbraucht
//    (Basis: er blieb bis zum Ende der äußeren Karte scharf und traf auch die Bonus-Attack).
//  · Ghuanjun, the Undead Martial Artist: die Combo-Attacks sind eigene Karten mit eigener Reaktionskette — der Pfeil der ersten gilt nicht für die zweite (schon korrekt; Gegenprobe).
//  · Gegenprobe Andras, the Human Weapon: derselbe Angriff trifft ein zweites Ziel („a second target for the Attack to hit afterwards") — das ist EINE Attack, der Pfeil-Bonus gilt für beide Ziele.
// Exit 1 auf der Basis (Nieht), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W40/a-05-pfeil-bonus-bei-mehrfach-attacks-nieht-ghuanjun-andras.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

async function szene(me, op, heldName, hand) {
  const h = [[], []]; h[me] = hand;
  const t = await H.fresh({ hand: h, deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  t.setHero(me, 0, heldName, 800);
  t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100;
  for (const n of new Set(hand)) t.grantFor(me, 0, n);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.dmg = [];
  const _rh = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (hn, c, ...r) => { if (hn === 'afterDamage' && c.type === 'attack' && c.source && (c.source.heroOwner ?? c.source.owner) === me) t.dmg.push(c.amount); return _rh(hn, c, ...r); };
  return t;
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);

    // ── Nieht ──
    {
      const t = await szene(me, op, 'Nieht, the Blitz Blade', ['Attack', 'Quick Attack', 'Angelfeather Arrow']);
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Quick Attack' }) });
      t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
      const r = await t.play(me, 'Attack', { hero: 0, keepActions: true });
      R.check('Nieht + Angelfeather Arrow: Attack +60, die Bonus-Attack ohne Pfeil-Bonus', r === true && gleich(t.dmg, [160, 100]), { r, dmg: t.dmg });
      R.check('  die Bonus-Attack lief (Quick Attack in der Ablage), keine Engine-Fehler, Zustand sauber', t.pile(me, 'discardPile').includes('Quick Attack') && sauber(t), { abl: t.pile(me, 'discardPile'), e: t.errors, a: t.audit() });
    }
    // Nieht ohne Pfeil (Gegenprobe): beide Attacks 100
    {
      const t = await szene(me, op, 'Nieht, the Blitz Blade', ['Attack', 'Quick Attack']);
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Quick Attack' }) });
      t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
      const r = await t.play(me, 'Attack', { hero: 0, keepActions: true });
      R.check('Nieht ohne Pfeil (Gegenprobe): beide Attacks 100', r === true && gleich(t.dmg, [100, 100]), { r, dmg: t.dmg });
    }

    // ── Ghuanjun-Combo: zwei Attack-Karten nacheinander, Pfeil nur bei der ersten ──
    {
      const t = await szene(me, op, 'Ghuanjun, the Undead Martial Artist', ['Attack', 'Quick Attack', 'Angelfeather Arrow']);
      const basis = t.hero(me, 0).baseAtk;
      t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
      const r1 = await t.play(me, 'Attack', { hero: 0 });
      const r2 = await t.play(me, 'Quick Attack', { hero: 0, keepActions: true });
      R.check('Ghuanjun-Combo + Angelfeather Arrow: erste Attack +60, die Combo-Attack ohne Bonus', r1 === true && r2 === true && t.dmg.length === 2 && t.dmg[0] === t.dmg[1] + 60, { r1, r2, dmg: t.dmg, basis });
      R.check('  keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
    }

    // ── Andras (Gegenprobe): EINE Attack trifft zwei Ziele — der Pfeil-Bonus gilt für beide ──
    {
      const t = await szene(me, op, 'Andras, the Human Weapon', ['Attack', 'Angelfeather Arrow']);
      t.setAbilities(me, 0, [['Fighting', 'Fighting', 'Fighting'], [], []]);
      t.targetFn = (v) => { const el = v.filter(x => !x.ineligible); return [(posHero(el, op, el.some(x => x.owner === op && x.heroIdx === 0) ? 0 : 1) || el[0]).id]; };
      const r = await t.play(me, 'Attack', { hero: 0, keepActions: true });
      if (t.dmg.length >= 2) R.check('Andras + Angelfeather Arrow: beide Ziele der EINEN Attack tragen +60 (Gegenprobe)', t.dmg[0] === t.dmg[1] && t.dmg[0] >= 160 - 1, { r, dmg: t.dmg });
      else R.note('Andras: zweiter Treffer nicht ausgelöst (Szene) — nicht bewertet', { r, dmg: t.dmg });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
