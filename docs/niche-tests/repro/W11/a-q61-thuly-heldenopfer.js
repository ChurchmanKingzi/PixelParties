'use strict';
// W11a · Q61 (A09-18, Bonded Companion Thuly) · Al, 15.10.2026: „Auch Heroes."
//   Thuly: „Once per turn, when you sacrifice a target, you may choose a target and deal 150 damage to it."
// Erwartet:
//   * Das Opfer eines HELDEN (Teocuilatl, Divine Gift of Sacrifice) löst Thulys 150-Schlag aus (wie das Opfer einer Kreatur).
//   * Eine gewöhnliche Niederlage (Schaden) ist KEIN Opfer: kein Schlag.
//   * „Once per turn": Kreatur-Opfer und Helden-Opfer im selben Zug → zusammen nur ein Schlag.
//   * Ist der Companion-Held selbst das Opfer, geht Thuly mit; kein Schlag, keine Engine-Fehler.
const H = require('../../lib/h.js');
const THULY = 'Bonded Companion Thuly', TEO = 'Teocuilatl, the Embodiment of Gods';
(async () => {
  const R = H.runner();
  const gegnerZiel = (valid) => valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id;
  // (1) Teocuilatl opfert Held 2
  {
    const t = await H.fresh({ hand: [[], []], gold: [50, 50], phase: 2, heroes: [[TEO, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    t.put(0, 1, 0, THULY).turnPlayed = 1;
    t.put(0, 0, 0, H.INERT.creature).turnPlayed = 1;
    let thulyGefragt = 0;
    t.targetFn = (valid, cfg) => {
      if (/Thuly/.test((cfg && cfg.title) || '')) { thulyGefragt++; return [gegnerZiel(valid)]; }
      const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2); return [h ? h.id : valid[0].id];
    };
    const hp0 = t.hp(1, 0);
    await t.activateHero(0, 0, {});
    R.check('Teocuilatl: Held 2 geopfert', t.hp(0, 2) === 0, t.hp(0, 2));
    R.check('Teocuilatl: Thuly fragt einmal und schlägt mit 150 zu', thulyGefragt === 1 && hp0 - t.hp(1, 0) === 150, { thulyGefragt, dmg: hp0 - t.hp(1, 0) });
    R.check('Teocuilatl: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // (2) Divine Gift of Sacrifice opfert Held 2 (Thuly an Held 1)
  {
    const t = await H.fresh({ hand: [['Divine Gift of Sacrifice'], []], gold: [50, 50] });
    t.put(0, 1, 0, THULY).turnPlayed = 1;
    let thulyGefragt = 0;
    t.targetFn = (valid, cfg) => {
      if (/Thuly/.test((cfg && cfg.title) || '')) { thulyGefragt++; return [gegnerZiel(valid)]; }
      const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2) || valid[0]; return [h.id];
    };
    t.script.push({ match: d => d.type === 'optionPicker' || d.type === 'heroPick' || d.type === 'zonePick', answer: (d) => ({ optionId: d.options && d.options[0] && d.options[0].id }), once: false });
    const hp0 = t.hp(1, 0);
    const r = await t.play(0, 'Divine Gift of Sacrifice', { hero: 0 });
    const geopfert = [0, 1, 2].filter(h => t.hp(0, h) === 0).length;
    R.check('Divine Gift of Sacrifice: gespielt, ein Held geopfert', r === true && geopfert === 1, { r, geopfert });
    R.check('Divine Gift of Sacrifice: Thuly schlägt zu (150)', thulyGefragt === 1 && hp0 - t.hp(1, 0) === 150, { thulyGefragt, dmg: hp0 - t.hp(1, 0) });
    R.check('Divine Gift of Sacrifice: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (3) gewöhnliche Niederlage durch Schaden: kein Schlag
  {
    const t = await H.fresh({ hand: [[], []], gold: [50, 50], phase: 2 });
    t.put(0, 1, 0, THULY).turnPlayed = 1;
    let gefragt = 0;
    t.targetFn = (valid, cfg) => { if (/Thuly/.test((cfg && cfg.title) || '')) gefragt++; return [valid[0].id]; };
    await t.run(() => t.engine.actionDealDamage({ name: 'Quelle', owner: 1 }, t.gs.players[0].heroes[2], 9999, 'spell'));
    R.check('Niederlage durch Schaden ist kein Opfer: Thuly bleibt stumm', gefragt === 0, gefragt);
  }
  // (4) Companion-Held selbst geopfert: Thuly geht mit, kein Schlag, keine Fehler
  {
    const t = await H.fresh({ hand: [[], []], gold: [50, 50], phase: 2, heroes: [[TEO, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    t.put(0, 1, 0, THULY).turnPlayed = 1;
    let gefragt = 0;
    t.targetFn = (valid, cfg) => {
      if (/Thuly/.test((cfg && cfg.title) || '')) { gefragt++; return [gegnerZiel(valid)]; }
      const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1); return [h ? h.id : valid[0].id];
    };
    await t.activateHero(0, 0, {});
    R.check('Companion-Held selbst geopfert: Thuly ist weg', !t.find(THULY, 'support'), t.find(THULY, 'support') && 'noch da');
    R.check('Companion-Held selbst geopfert: kein Schlag', gefragt === 0, gefragt);
    R.check('Companion-Held selbst geopfert: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
