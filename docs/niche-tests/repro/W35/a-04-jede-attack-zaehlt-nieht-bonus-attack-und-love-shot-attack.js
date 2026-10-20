'use strict';
// W35a · Frage 4 (Ergänzung zu a-03) · Zusatzaktions-Attacks, die ihre Karten SELBST auffüren (nicht über `_castSpellImmediately`) – Fundstellen Nieht, the Blitz Blade („immediately use a level 1 or
// lower Attack from your hand with it as an additional Action") und Love Shot („perform an Attack or Spell from your hand with [an opponent's Hero]"): die Attack ist eine GESPIELTE Attack und
// zählt für Mirjam („never more than 1 Attack per turn" – Love Shot über einen Mirjam-Gegnerheld), `attacksPlayedThisTurn`, `heroesAttackedThisTurn`, `hero._attacksThisTurn`.
// Aufruf: node docs/niche-tests/repro/W35/a-04-jede-attack-zaehlt-nieht-bonus-attack-und-love-shot-attack.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const NIEHT = 'Nieht, the Blitz Blade', MIRJAM = 'Mirjam, the Fallen Cute Angel';
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const ps = (t, s) => t.gs.players[s];
const MODUS = process.argv[2] || 'nieht';

if (MODUS === 'nieht') {
  (async () => {
    const R = H.runner();
    for (const [me, op] of [[0, 1], [1, 0]]) {
      R.section(`Sitz ${me}: Nieht – Attack trifft genau ein Ziel, Bonus-Attack (Quick Attack, Stufe 1) als Zusatzaktion`);
      const hand = [[], []]; hand[me] = ['Attack', 'Quick Attack'];
      const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
      for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
      t.setHero(me, 0, NIEHT, 800);
      t.grantFor(me, 0, 'Quick Attack');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Quick Attack' }) });
      t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
      const hp0 = t.hp(op, 0);
      const r = await t.play(me, 'Attack', { hero: 0, keepActions: true });
      R.check('Attack gespielt, danach die Bonus-Attack (Quick Attack liegt in der Ablage)', r === true && t.pile(me, 'discardPile').includes('Quick Attack') && t.pile(me, 'discardPile').includes('Attack'), { r, abl: t.pile(me, 'discardPile') });
      R.check('beide Attacks haben getroffen (Schaden > Einzelschlag)', hp0 - t.hp(op, 0) >= 2 * 100 - 1, { dmg: hp0 - t.hp(op, 0) });
      R.check('Zähler: attacksPlayedThisTurn == 2 (Attack + Bonus-Attack), hero._attacksThisTurn == 2', (ps(t, me).attacksPlayedThisTurn || 0) === 2 && (t.hero(me, 0)._attacksThisTurn || 0) === 2, { ap: ps(t, me).attacksPlayedThisTurn, hit: t.hero(me, 0)._attacksThisTurn });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    process.stdout.write(`\n${R.passes} ok, ${R.fails} ✗ (Nieht)\n`);
    const c = require('child_process').spawnSync(process.execPath, [__filename, 'loveshot0'], { stdio: 'inherit' });
    const d = require('child_process').spawnSync(process.execPath, [__filename, 'loveshot1'], { stdio: 'inherit' });
    process.exit(R.fails || c.status || d.status ? 1 : 0);
  })();
} else {
  // Ein Spiel je Prozess: Love Shot – der Spieler `me` wirkt eine Attack über den Gegnerhelden 1 (Mirjam).
  (async () => {
    const R = H.runner();
    const me = MODUS === 'loveshot1' ? 1 : 0, op = 1 - me;
    R.section(`Sitz ${me}: Love Shot – Attack aus der Hand über den Gegnerhelden Mirjam`);
    const hand = [[], []]; hand[me] = ['Love Shot', 'Attack'];
    const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
    for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
    t.setHero(op, 1, MIRJAM, 800);
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: () => ({ selectedCards: [{ handIndex: t.pile(me, 'hand').indexOf('Attack'), cardName: 'Attack' }] }) });
    t.targetFn = (v, cfg) => {
      if (/Love Shot/.test((cfg && cfg.title) || '')) return [`hero-${op}-1`];
      return [(posHero(v, op, 0) || v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx !== 1) || v[0]).id];
    };
    const r = await t.play(me, 'Love Shot', { hero: 0 });
    R.check('Love Shot gespielt, die Attack liegt in der Ablage', r === true && t.pile(me, 'discardPile').includes('Attack'), { r, abl: t.pile(me, 'discardPile') });
    R.check('Zähler des Spielers: attacksPlayedThisTurn == 1 (die Attack), spellsPlayedThisTurn == 1 (Love Shot)', (ps(t, me).attacksPlayedThisTurn || 0) === 1 && (ps(t, me).spellsPlayedThisTurn || 0) === 1, { ap: ps(t, me).attacksPlayedThisTurn, sp: ps(t, me).spellsPlayedThisTurn });
    const mir = t.hero(op, 1);
    R.check('Mirjams Zähler steht auf 1 (sie hat die Attack ausgeführt) und sie ist für weitere Attacks gesperrt', mir._mirjamAttacksUsed === 1 && t.engine.heroKannAngreifen(op, 1, me, { name: 'Attack' }) === false, { n: mir._mirjamAttacksUsed });
    R.check('keine Kontrollmarken zurückgeblieben', mir.charmedBy == null && !mir.statuses?.charmed, [mir.charmedBy, mir.statuses]);
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    R.finish();
  })();
}
