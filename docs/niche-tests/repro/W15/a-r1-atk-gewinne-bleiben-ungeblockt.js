'use strict';
// W15a · R1 (Rückfrage 1 aus W14a) · Al, 16.10.2026: „Sollen auch ATK-Gewinne von Heldenpassiven und Effekten (Nero, Toras, Taio …) an Resistance abprallen?" — „Nein, sollen sie nicht."
// Erwartet: ATK-Gewinne bleiben von Resistance UNgeblockt — einheitlich: Nero Zira (+30 je platzierter Kreatur), Toras (+40 je Artefakt), Taio (+20 je Ausrüstung) und
//   Chaorc Pyre Grill Master im ATK-Zweig (+40 ATK je Held, auch auf Resistance-Helden). Nur Max-HP-/Aufbau-Effekte (Chaorcs +80-HP-Zweig, Styx …) bleiben geblockt (a-q7). Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const RES = (lv) => Array(lv).fill('Resistance');
  const ohneFehler = (t) => t.errors.length === 0 && t.audit().length === 0;

  R.section('Chaorc Pyre Grill Master: ATK-Zweig (+40 ATK je Held) trifft auch Resistance-Helden; HP-Zweig bleibt geblockt');
  for (const [modus, atkSoll, hpSoll] of [['atk', 40, 0], ['hp', 0, 80]]) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    const chaorc = t.put(0, 0, 0, 'Chaorc Pyre Grill Master'); chaorc.turnPlayed = 1;
    const opfer = t.put(0, 0, 1, H.INERT.creature); opfer.turnPlayed = 1;
    t.setAbilities(0, 0, [RES(3), [], []]);   // eigener Held 0: Resistance Lv3
    t.setAbilities(1, 1, [RES(3), [], []]);   // gegnerischer Held 1: Resistance Lv3
    const atk0 = [0, 1].map(s => [0, 1, 2].map(h => t.hero(s, h).atk));
    const hp0 = [0, 1].map(s => [0, 1, 2].map(h => t.hero(s, h).maxHp));
    t.gs.currentPhase = 2; t.gs.activePlayer = 0;
    t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Chaorc Pyre Grill Master', answer: () => ({ optionId: modus }) });
    t.policy.confirm = true;
    await t.activateCreature(0, 0, 0);
    const dAtk = [0, 1].map(s => [0, 1, 2].map(h => t.hero(s, h).atk - atk0[s][h]));
    const dHp = [0, 1].map(s => [0, 1, 2].map(h => t.hero(s, h).maxHp - hp0[s][h]));
    const res = (a) => [a[0][0], a[1][1]];                  // die zwei Resistance-Helden
    const frei = (a) => [a[0][1], a[0][2], a[1][0], a[1][2]];   // die übrigen vier
    if (modus === 'atk') {
      R.check('ATK-Zweig: ALLE sechs Helden +40 ATK, auch die Resistance-Helden (0/0 und 1/1)', dAtk.flat().every(x => x === 40), dAtk);
      R.check('ATK-Zweig: keine Max-HP-Änderung', dHp.flat().every(x => x === 0), dHp);
    } else {
      R.check('HP-Zweig: Resistance-Helden bleiben bei +0 Max-HP, die übrigen vier +80 (Max-HP-Gewinn bleibt geblockt)', res(dHp).every(x => x === 0) && frei(dHp).every(x => x === 80), dHp);
      R.check('HP-Zweig: keine ATK-Änderung', dAtk.flat().every(x => x === 0), dAtk);
    }
    R.check(`Chaorc ${modus}: keine Engine-Fehler / Zustand sauber`, ohneFehler(t), { e: t.errors, a: t.audit() });
  }

  R.section('Nero Zira: +30 ATK je platzierter Kreatur — auch mit Resistance Lv3 am Träger');
  for (const [label, res] of [['Resistance Lv3', true], ['ohne Resistance (Kontrolle)', false]]) {
    const t = await H.fresh({ heroes: [['Nero Zira, the Mastermind', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[H.INERT.creature], []], hp: 800 });
    if (res) t.setAbilities(0, 0, [RES(3), [], []]);
    const vorher = t.hero(0, 0).atk;
    await t.play(0, H.INERT.creature, { hero: 0, slot: 0 });
    R.check(`${label}: Nero +30 ATK`, t.hero(0, 0).atk - vorher === 30, { vorher, nachher: t.hero(0, 0).atk });
    R.check(`${label}: keine Engine-Fehler`, ohneFehler(t), { e: t.errors, a: t.audit() });
  }

  R.section('Toras: +40 ATK je Artefakt mit anderem Namen — auch mit Resistance Lv3');
  for (const [label, res] of [['Resistance Lv3', true], ['ohne Resistance (Kontrolle)', false]]) {
    const t = await H.fresh({ heroes: [['Toras, Master of all Weapons', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Club of Gobbo'], []], hp: 800 });
    if (res) t.setAbilities(0, 0, [RES(3), [], []]);
    const vorher = t.hero(0, 0).atk;
    const r = await t.play(0, 'Club of Gobbo', { hero: 0, zoneSlot: 0 });
    R.check(`${label}: Ausrüstung liegt, ATK +30 (Club) +40 (Toras) = +70`, r === true && t.hero(0, 0).atk - vorher === 70, { r, vorher, nachher: t.hero(0, 0).atk });
    R.check(`${label}: keine Engine-Fehler`, ohneFehler(t), { e: t.errors, a: t.audit() });
  }

  R.section('Taio, the Sun Fencer: +20 ATK je Ausrüstung — auch mit Resistance Lv3');
  for (const [label, res] of [['Resistance Lv3', true], ['ohne Resistance (Kontrolle)', false]]) {
    const t = await H.fresh({ heroes: [['Taio, the Sun Fencer', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Club of Gobbo'], []], hp: 800 });
    if (res) t.setAbilities(0, 0, [RES(3), [], []]);
    const vorher = t.hero(0, 0).atk;
    const r = await t.play(0, 'Club of Gobbo', { hero: 0, zoneSlot: 0 });
    R.check(`${label}: Ausrüstung liegt, ATK +30 (Club) +20 (Taio) = +50`, r === true && t.hero(0, 0).atk - vorher === 50, { r, vorher, nachher: t.hero(0, 0).atk });
    R.check(`${label}: keine Engine-Fehler`, ohneFehler(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
