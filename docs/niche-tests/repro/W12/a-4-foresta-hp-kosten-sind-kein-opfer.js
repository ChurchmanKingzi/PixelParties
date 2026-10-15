'use strict';
// W12a · Rückfrage 4 (Foresta-HP-Kosten und Thuly) · Al, 15.10.2026: „Nicht gewollt. Der Hero stirbt ja nicht, weil er durch einen Effekt 'sacrificed' wird,
//   sondern durch HP-Verlust!"
//   Foresta: „You can only summon this Creature by sacrificing 2 Creatures you control … and halving the current HP of the corresponding Hero (rounded down)."
// Erwartet: Stirbt der beschwörende Held an den HP-Kosten (genau 1 HP: floor(1/2) = 0), ist das KEIN Opfer: der Hook `onHeroSacrificed` feuert nicht, Thuly
//   („when you sacrifice a target") schlägt dafür nicht zu und Temple of Sacrifice („sacrifices … Heroes → draw 3") bietet nichts an. Die zwei geopferten KREATUREN
//   sind echte Opfer (Thuly/Temple wie bisher je einmal). Gegenprobe: ein echtes Helden-Opfer (Teocuilatl) feuert den Hook, Thuly schlägt zu, Temple bietet 3 Karten an.
const H = require('../../lib/h.js');
const D = H.INERT.creature;
const THULY = 'Bonded Companion Thuly', TEO = 'Teocuilatl, the Embodiment of Gods', TEMPLE = 'Temple of Sacrifice';
const zaehleHook = (t, name) => { const c = { n: 0 }; const alt = t.engine.runHooks.bind(t.engine); t.engine.runHooks = async (n, ctx) => { if (n === name) c.n++; return alt(n, ctx); }; return c; };
const temple3 = (t) => t.prompts.filter(p => p.d && p.d.title === TEMPLE && /draw 3/.test(p.d.message || '')).length;
const temple1 = (t) => t.prompts.filter(p => p.d && p.d.title === TEMPLE && /draw 1 card\b/.test(p.d.message || '')).length;
(async () => {
  const R = H.runner();

  R.section('(1) Foresta bei 1 HP: der Held stirbt am HP-Verlust, kein Opfer');
  {
    const t = await H.fresh({ hand: [['Foresta, the Guard'], []], gold: [50, 50] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.put(0, 1, 0, THULY).turnPlayed = 1;
    t.putArea(0, TEMPLE);
    t.put(0, 0, 0, D).turnPlayed = 0; t.put(0, 0, 1, D).turnPlayed = 0;
    t.put(1, 0, 0, H.INERT.big);
    t.hero(0, 0).hp = 1;
    t.policy.confirm = true;
    let thuly = 0;
    t.targetFn = (valid, cfg) => {
      if (/Thuly/.test((cfg && cfg.title) || '')) { thuly++; return [valid.find(v => v.owner === 1).id]; }
      return valid.filter(x => !x.ineligible && x.cardName === D).slice(0, 2).map(x => x.id);   // Opferwahl: die zwei Dummy-Kreaturen (nicht Thuly)
    };
    const hook = zaehleHook(t, 'onHeroSacrificed');
    const r = await t.play(0, 'Foresta, the Guard', { hero: 0 });
    R.check('Foresta wurde beschworen, der Beschwörer-Held starb an den HP-Kosten', r === true && t.hp(0, 0) === 0 && !!t.find('Foresta, the Guard', 'support'), { r, hp: t.hp(0, 0), da: !!t.find('Foresta, the Guard', 'support') });
    R.check('Hook onHeroSacrificed feuert NICHT (HP-Verlust ist kein Opfer)', hook.n === 0, hook.n);
    R.check('Temple of Sacrifice bietet für den Helden keine 3 Karten an', temple3(t) === 0, temple3(t));
    R.check('die zwei geopferten Kreaturen zählen weiter (Thuly einmal pro Zug gefragt, Temple 1 Karte angeboten)', thuly === 1 && temple1(t) >= 1, { thuly, temple1: temple1(t) });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(2) Gegenprobe: ein echtes Helden-Opfer (Teocuilatl) bleibt ein Opfer');
  {
    const t = await H.fresh({ hand: [[], []], gold: [50, 50], phase: 2, heroes: [[TEO, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    t.put(0, 1, 0, THULY).turnPlayed = 1;
    t.putArea(0, TEMPLE);
    t.put(0, 0, 0, D).turnPlayed = 1;
    let thuly = 0;
    t.targetFn = (valid, cfg) => {
      if (/Thuly/.test((cfg && cfg.title) || '')) { thuly++; return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; }
      const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2); return [h ? h.id : valid[0].id];
    };
    t.policy.confirm = true;
    const hook = zaehleHook(t, 'onHeroSacrificed');
    await t.activateHero(0, 0, {});
    R.check('Teocuilatl: Held 2 geopfert', t.hp(0, 2) === 0, t.hp(0, 2));
    R.check('Hook onHeroSacrificed feuert genau einmal', hook.n === 1, hook.n);
    R.check('Temple bietet 3 Karten für das Helden-Opfer an', temple3(t) === 1, temple3(t));
    R.check('Thuly schlägt zu', thuly === 1, thuly);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(3) Foresta bei vollen HP (Regression): HP halbiert, kein Heldentod, kein Hook');
  {
    const t = await H.fresh({ hand: [['Foresta, the Guard'], []], gold: [50, 50] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.put(0, 0, 0, D).turnPlayed = 0; t.put(0, 0, 1, D).turnPlayed = 0;
    t.policy.confirm = true;
    t.targetFn = (valid) => valid.filter(x => !x.ineligible).slice(0, 2).map(x => x.id);
    const hook = zaehleHook(t, 'onHeroSacrificed');
    const r = await t.play(0, 'Foresta, the Guard', { hero: 0 });
    R.check('beschworen, HP 800 -> 400, kein Hook', r === true && t.hp(0, 0) === 400 && hook.n === 0, { r, hp: t.hp(0, 0), hook: hook.n });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
