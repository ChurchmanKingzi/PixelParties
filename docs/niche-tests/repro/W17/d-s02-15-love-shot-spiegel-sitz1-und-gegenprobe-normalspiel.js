'use strict';
// W17d · S02-15 (Teil 2): Spiegel und Gegenprobe.
// (1) Gegenprobe Normalspiel (kein Kontrollwechsel): angeboten werden genau die drei Gegnerhelden in Spaltenreihenfolge, der Nachguss über einen Gegnerhelden (Zweig `charmed`) läuft wie bisher
//     (Fireball über Gegnerheld 1:1 mit Destruction Magic x2, trifft −150), Ablage/Hand stimmen.
// (2) Spiegel: Sitz 1 spielt Love Shot. Sitz 0 kontrolliert dauerhaft den Helden 1:1 (Spalte von Sitz 1), Sitz 1 kontrolliert dauerhaft den Helden 0:0 (Spalte von Sitz 0).
//     „Held, den der Gegner (Sitz 0) kontrolliert“ = 0:1, 0:2 und 1:1 — NICHT 0:0 (den kontrolliere ich selbst) und nicht 1:0 (mein eigener, nicht kontrolliert).
// Ein Spiel je Prozess: der Spiegelfall läuft als Kindprozess (Argument `spiegel`); der Exitcode fasst beide zusammen.
const H = require('../../lib/h.js');
const MODUS = process.argv[2] || 'normal';
if (MODUS === 'normal') {
  (async () => {
    const R = H.runner();
    const t = await H.fresh({ hand: [['Love Shot', 'Fireball'], []], deckSize: 30, abilities: { 1: { 1: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    let offered = null;
    t.targetFn = (valid, cfg) => {
      const title = (cfg && cfg.title) || '';
      if (/Love Shot/.test(title)) { offered = valid.map(v => `${v.owner}:${v.heroIdx}`); return ['hero-1-1']; }
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: () => ({ selectedCards: [{ handIndex: t.pile(0, 'hand').indexOf('Fireball'), cardName: 'Fireball' }] }) });
    const r = await t.play(0, 'Love Shot', { hero: 0 });
    t.say('Love Shot ->', r, JSON.stringify(offered));
    R.check('Normalspiel: Love Shot gespielt', r === true, r);
    R.check('Normalspiel: angeboten genau 1:0, 1:1, 1:2 (unverändert)', JSON.stringify(offered) === JSON.stringify(['1:0', '1:1', '1:2']), offered);
    R.check('Normalspiel: Fireball über Gegnerheld 1:1 trifft 1:0 (−150)', t.hp(1, 0) === 650, t.hp(1, 0));
    R.check('Normalspiel: Fireball in meiner Ablage', t.pile(0, 'discardPile').includes('Fireball') && !t.pile(0, 'hand').includes('Fireball'), t.pile(0, 'discardPile'));
    const h11 = t.gs.players[1].heroes[1];
    R.check('Normalspiel: keine Kontrollmarken am Gegnerhelden zurückgeblieben', h11.charmedBy == null && h11.permaControlBy == null && !h11.statuses?.charmed, [h11.charmedBy, h11.statuses]);
    R.check('Normalspiel: keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Normalspiel: Zustand sauber', t.audit().length === 0, t.audit());
    // Spiegelfall im Kindprozess (ein Spiel je Prozess); Gesamt-Exitcode = beide
    process.stdout.write(`\n${R.passes} ok, ${R.fails} ✗ (Normalspiel)\n`);
    const c = require('child_process').spawnSync(process.execPath, [__filename, 'spiegel'], { stdio: 'inherit' });
    process.exit(R.fails || c.status ? 1 : 0);
  })();
} else {
  (async () => {
    const R = H.runner();
    const t = await H.fresh({ hand: [[], ['Love Shot', 'Fireball', 'Cure']], deckSize: 30, active: 1, abilities: { 1: { 1: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    await t.engine.actionTakeHeroPermanently(0, 1, 1);
    await t.engine.actionTakeHeroPermanently(1, 0, 0);
    let offered = null, ziele = null;
    t.targetFn = (valid, cfg) => {
      const title = (cfg && cfg.title) || '';
      if (/Love Shot/.test(title)) { offered = valid.map(v => `${v.owner}:${v.heroIdx}`); return ['hero-1-1']; }
      ziele = valid.map(v => `${v.owner}:${v.heroIdx}`);
      return [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
    };
    t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: () => ({ selectedCards: [{ handIndex: t.pile(1, 'hand').indexOf('Fireball'), cardName: 'Fireball' }] }) });
    const r = await t.play(1, 'Love Shot', { hero: 0 });
    t.say('Love Shot (Sitz 1) ->', r, '| angeboten', JSON.stringify(offered), '| Fireball-Ziele', JSON.stringify(ziele));
    R.check('Spiegel: Love Shot gespielt', r === true, r);
    R.check('Spiegel: angeboten genau die vom Gegner (Sitz 0) kontrollierten Helden 0:1, 0:2, 1:1', !!offered && JSON.stringify([...offered].sort()) === JSON.stringify(['0:1', '0:2', '1:1']), offered);
    R.check('Spiegel: von mir kontrollierter Held 0:0 und mein eigener Held 1:0 nicht angeboten', !!offered && !offered.includes('0:0') && !offered.includes('1:0'), offered);
    R.check('Spiegel: Fireball über 1:1 (vom Gegner kontrolliert) trifft 0:1 (−150)', t.hp(0, 1) === 650, t.hp(0, 1));
    R.check('Spiegel: Fireball-Ziele ohne den von mir kontrollierten Held 0:0', !!ziele && !ziele.includes('0:0'), ziele);
    const h11 = t.gs.players[1].heroes[1];
    R.check('Spiegel: 1:1 danach wieder vom Gegner (Sitz 0) kontrolliert', t.engine.heroSideOf(1, h11) === 0 && h11.permaControlBy === 0 && !h11.statuses?.charmed, [h11.charmedBy, h11.permaControlBy, h11.statuses]);
    R.check('Spiegel: Fireball in der Ablage von Sitz 1', t.pile(1, 'discardPile').includes('Fireball') && !t.pile(1, 'hand').includes('Fireball'), t.pile(1, 'discardPile'));
    R.check('Spiegel: keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Spiegel: Zustand sauber', t.audit().length === 0, t.audit());
    R.finish();
  })();
}
