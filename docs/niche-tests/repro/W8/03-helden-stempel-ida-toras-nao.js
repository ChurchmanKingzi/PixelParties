'use strict';
// W8/03 · Welle 8 (Al, 14.10.2026): Heldenbeschränkungen, die das Skript als Stempel in `gs.heroFlags` ablegt, ruhen bei Frost,
// Betäubung und Negation (Leser: `engine.heroFlagsLive`): Ida „can never hit more than 1 target with a Destruction Spell",
// Toras „can never hit more than 1 target with an Attack", Naos Überheilung. Kontrollen: ohne Status gelten sie.
// (Leichte Negation `effectOnly`, damit der Held die Karten noch wirken kann - hart negierte Abilities senken die Stufen auf 0.)
// Aufruf: node docs/niche-tests/repro/W8/03-helden-stempel-ida-toras-nao.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
const NEG_LEICHT = (t) => t.heroStatus(0, 0, 'negated', { appliedTurn: 0, effectOnly: true });
const ZUSTAENDE = [[null, null], ['negiert (Effekt)', NEG_LEICHT], ['negiert (hart)', (t) => t.heroStatus(0, 0, 'negated')],
  ['gefroren', (t) => t.heroStatus(0, 0, 'frozen')], ['betäubt', (t) => t.heroStatus(0, 0, 'stunned')]];

(async () => {
  const R = H.runner();

  // ── Prüfer: heroFlagsLive streicht die passiven Stempel nur bei ruhendem Helden ────────────────
  for (const held of ['Ida, the Adept of Destruction', 'Toras, Master of all Weapons', 'Nao, the Barrier Priestess']) {
    for (const [name, set] of ZUSTAENDE) {
      const t = await H.fresh({ heroes: [[held, ...fill], null] });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      if (set) set(t);
      const f = t.engine.heroFlagsLive(0, 0) || {};
      const an = !!(f.forcesSingleTarget || f.singleTargetAttack || f.overhealPassive);
      R.check(`${held.split(',')[0]} ${name || 'ohne Status'}: Stempel ${name ? 'ruht' : 'gilt'}`, an === !name, f);
      R.check(`${held.split(',')[0]} ${name || 'ohne Status'}: Stempel am Spielstand bleibt liegen`, !!(t.gs.heroFlags?.['0-0']), t.gs.heroFlags);
      R.check(`${held.split(',')[0]} ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }

  // ── Ida: Flame Avalanche trifft alle Ziele, wenn Ida negiert ist; sonst nur EIN gewähltes ───────
  for (const [name, set] of [[null, null], ['negiert (Effekt)', NEG_LEICHT]]) {
    const t = await H.fresh({ heroes: [['Ida, the Adept of Destruction', ...fill], null], hand: [['Flame Avalanche'], []], hp: 800 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.grantFor(0, 0, 'Flame Avalanche');
    t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 0); return v ? [v.id] : null; };
    if (set) set(t);
    const r = await t.play(0, 'Flame Avalanche', { hero: 0, noGrant: true });
    await wait(300);
    const getroffen = [0, 1, 2].filter(i => t.hp(1, i) < 800).length;
    R.check(`Ida ${name || 'ohne Status'}: gespielt`, r === true, r);
    R.check(`Ida ${name || 'ohne Status'}: ${name ? 'alle 3 Helden getroffen (Beschränkung ruht)' : 'nur 1 Held getroffen'}`, getroffen === (name ? 3 : 1), { getroffen });
    R.check(`Ida ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Toras: Whirlwind Strike - bis zu 2 Helden, wenn Toras negiert ist; sonst 1 ───────────────
  for (const [name, set] of [[null, null], ['negiert (Effekt)', NEG_LEICHT]]) {
    const t = await H.fresh({ heroes: [['Toras, Master of all Weapons', ...fill], null], hand: [['Whirlwind Strike'], []], hp: 800 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.grantFor(0, 0, 'Whirlwind Strike');
    t.targetFn = (valid) => valid.filter(q => q.type === 'hero' && q.owner === 1).slice(0, 2).map(q => q.id);
    if (set) set(t);
    const r = await t.play(0, 'Whirlwind Strike', { hero: 0, noGrant: true });
    await wait(400);
    const getroffen = [0, 1, 2].filter(i => t.hp(1, i) < 800).length;
    R.check(`Toras ${name || 'ohne Status'}: gespielt`, r === true, r);
    R.check(`Toras ${name || 'ohne Status'}: ${name ? '2 Helden getroffen (Beschränkung ruht)' : 'nur 1 Held getroffen'}`, getroffen === (name ? 2 : 1), { getroffen });
    R.check(`Toras ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Nao: Überheilung über das Maximum ruht ─────────────────────────────────────────────────────
  for (const [name, set] of ZUSTAENDE) {
    const t = await H.fresh({ heroes: [['Nao, the Barrier Priestess', ...fill], null], hp: 400 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    if (set) set(t);
    const ziel = t.hero(0, 1); const max = ziel.maxHp || 400;
    ziel.hp = max;
    await t.run(() => t.engine.actionHealHero({ name: 'Heal', owner: 0, heroIdx: 0 }, ziel, 100));
    R.check(`Nao ${name || 'ohne Status'}: Heilung ${name ? 'deckelt am Maximum (ruht)' : 'geht über das Maximum'}`, name ? ziel.hp === max : ziel.hp > max, { hp: ziel.hp, max });
    R.check(`Nao ${name || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
