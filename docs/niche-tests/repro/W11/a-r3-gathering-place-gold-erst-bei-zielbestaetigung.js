'use strict';
// W11a · R3 (War Council Gathering Place) · Al, 15.10.2026: „Statt dass das Gold abgezogen und dann zurückgegeben wird, soll es ERST abgezogen werden,
//   wenn der Effekt sein Ziel bestätigt (aber BEVOR z.B. Harpthenean resolved, der ja mit Gold skaliert)."
//   Text: „Whenever a player summons a "War Counselor" Creature, they may spend 8 Gold to immediately have it use its active effect."
// Erwartet:
//   * Die 8 Gold sind beim Annehmen des Angebots und WÄHREND der Zielwahl noch da; sie werden erst nach der Zielbestätigung abgezogen.
//   * Bricht der Spieler die Zielwahl ab (oder die Optionswahl), wird nie Gold abgezogen.
//   * Harpthenean (Schaden-Modus): Schaden = 5 × Gold NACH der Zahlung (Anzeige und Auflösung); Gold-Modus: erst zahlen, dann gewinnen.
//   * Ratgeber ohne Zielwahl (Thebinxan): Gold wird direkt vor der Auflösung abgezogen (vor der Ansage des Gegners).
const H = require('../../lib/h.js');
const CENS = 'Censpartan War Counselor', CYK = 'Cykyran War Counselor', GOR = 'Gorinthian War Counselor', HARP = 'Harpthenean War Counselor',
  MINO = 'Minocrete War Counselor', THEB = 'Thebinxan War Counselor', AREA = 'War Council Gathering Place';
(async () => {
  const R = H.runner();
  const g = (t) => t.gs.players[0].gold;
  const mk = async (karte, gold, aufbau) => {
    const t = await H.fresh({ hand: [[karte], []], gold: [gold, 100] });
    t.putArea(0, AREA);
    t.policy.confirm = true;
    if (aufbau) await aufbau(t);
    return t;
  };
  const gefragt = (t) => t.prompts.some(p => /War Council Gathering Place/.test(JSON.stringify(p.d)));
  const AUFBAU = {
    [CENS]: (t) => { t.put(1, 0, 0, H.INERT.creature); t.put(1, 0, 1, H.INERT.creature); },
    [CYK]: (t) => {
      t.gs.players[0].heroes[0].atk = 100;
      t.script.push({ match: d => d.type === 'optionPicker' && d.title === CYK, answer: (d) => ({ optionId: d.options[0].id }) });
    },
    [GOR]: (t) => { t.put(0, 1, 0, CYK); },
    [MINO]: async (t) => {
      const a = t.put(1, 0, 0, H.INERT.big);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Quelle', owner: 0, heroIdx: 0 }, a, 50, 'creature', { sourceOwner: 0 }));
    },
  };
  // (1) Zielwahl-Ratgeber: Gold während der Zielwahl noch da, danach −8; Abbruch → nie Gold weg
  for (const karte of [CENS, CYK, GOR, MINO]) {
    let t = await mk(karte, 100, AUFBAU[karte]);
    let goldInWahl = null;
    t.targetFn = (valid, cfg) => { if (cfg && cfg.title === karte) goldInWahl = g(t); return [valid[0].id]; };
    let r = await t.play(0, karte, { hero: 0, slot: 0 });
    R.check(karte + ': beschworen, Angebot erschien', r === true && gefragt(t), { r, p: t.prompts.map(p => p.d.title) });
    R.check(karte + ': während der Zielwahl sind die 8 Gold noch da', goldInWahl === 100, goldInWahl);
    R.check(karte + ': nach der Zielbestätigung sind 8 Gold bezahlt', g(t) === 92, g(t));
    R.check(karte + ': keine Engine-Fehler', t.errors.length === 0, t.errors);

    t = await mk(karte, 100, AUFBAU[karte]);
    t.targetFn = (valid, cfg) => (cfg && cfg.title === karte) ? null : [valid[0].id];
    r = await t.play(0, karte, { hero: 0, slot: 0 });
    R.check(karte + ': Zielwahl abgebrochen → Angebot war da, aber kein Gold abgezogen', gefragt(t) && g(t) === 100, { gefragt: gefragt(t), gold: g(t) });
    R.check(karte + ': Abbruch → keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // (2) Harpthenean, Schaden-Modus: Gold in der Zielwahl unverändert, Schaden = 5 × (Gold − 8)
  {
    const t = await mk(HARP, 40);
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === HARP, answer: () => ({ optionId: 'damage' }) });
    let goldInWahl = null, basis = null;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === HARP) { goldInWahl = g(t); basis = cfg.baseDamage; }
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    const hp0 = t.hp(1, 0);
    await t.play(0, HARP, { hero: 0, slot: 0 });
    R.check('Harpthenean: Gold in der Zielwahl noch 40', goldInWahl === 40, goldInWahl);
    R.check('Harpthenean: angezeigter Schaden = 5 × (40 − 8) = 160', basis === 160, basis);
    R.check('Harpthenean: Gold danach 32', g(t) === 32, g(t));
    R.check('Harpthenean: Schaden 5 × 32 = 160', hp0 - t.hp(1, 0) === 160, hp0 - t.hp(1, 0));
    R.check('Harpthenean Schaden: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (2b) Harpthenean abgebrochen (Zielwahl und Optionswahl): kein Gold weg
  {
    let t = await mk(HARP, 40);
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === HARP, answer: () => ({ optionId: 'damage' }) });
    t.targetFn = (valid, cfg) => (cfg && cfg.title === HARP) ? null : [valid[0].id];
    await t.play(0, HARP, { hero: 0, slot: 0 });
    R.check('Harpthenean: Zielwahl abgebrochen → Gold bleibt 40', g(t) === 40, g(t));
    t = await mk(HARP, 40);
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === HARP, answer: () => null });
    await t.play(0, HARP, { hero: 0, slot: 0 });
    R.check('Harpthenean: Optionswahl abgebrochen → Gold bleibt 40', g(t) === 40, g(t));
  }
  // (3) Harpthenean, Gold-Modus: erst −8, dann + 10 × Ratgeber (1)
  {
    const t = await mk(HARP, 100);
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === HARP, answer: () => ({ optionId: 'gold' }) });
    await t.play(0, HARP, { hero: 0, slot: 0 });
    R.check('Harpthenean Gold-Modus: 100 − 8 + 10 = 102', g(t) === 102, g(t));
    R.check('Harpthenean Gold-Modus: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (4) Thebinxan (keine Zielwahl): Gold ist beim Ansage-Prompt des Gegners schon abgezogen, danach weiter 92
  {
    const t = await mk(THEB, 100);
    let goldBeiAnsage = null;
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === THEB, answer: (d) => { goldBeiAnsage = g(t); return { optionId: d.options[0].id }; }, once: true });
    await t.play(0, THEB, { hero: 0, slot: 0 });
    R.check('Thebinxan: Angebot erschien', gefragt(t), t.prompts.map(p => p.d.title));
    R.check('Thebinxan: Gold bei der Ansage bereits abgezogen (92)', goldBeiAnsage === 92, goldBeiAnsage);
    R.check('Thebinxan: Gold am Ende 92', g(t) === 92, g(t));
    R.check('Thebinxan: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (5) Angebot abgelehnt: kein Gold weg
  {
    const t = await mk(CENS, 100, AUFBAU[CENS]);
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'confirm' && /War Council/.test(d.title || ''), answer: () => null });
    await t.play(0, CENS, { hero: 0, slot: 0 });
    R.check('Angebot abgelehnt: Gold bleibt 100', g(t) === 100, g(t));
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
