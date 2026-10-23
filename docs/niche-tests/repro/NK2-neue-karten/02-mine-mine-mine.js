'use strict';
// NK2-02 · Mine! Mine! Mine! (23.10.2026)
// Kartentext: „Choose an Artifact equipped to a Hero your opponent controls and add it to your hand. If the user has at least Charme 1, this counts as an additional Action and
//   you may immediately equip the Artifact to the user without paying its Cost." — Attack (Normal), Fighting Lv0. Das Anlegen ist optional (Al).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const MMM = 'Mine! Mine! Mine!';
  const BLADE = 'Blade of the Frostbringer', HEART = 'Heart of Ice', VAMP = 'Vampiric Sword';
  const acted = (t) => (t.gs.players[0].heroesActedThisTurn || []).length;
  const equipsOn = (t, seat, hi) => t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === hi && ['Artifact'].includes((H.DB[c.name] || {}).cardType)).map(c => c.name);

  /** Gegner (Sitz 1) trägt ausgerüstet `ausruestung` am Helden 0 (echt gespielt, damit Boni gelten); Sitz 0 spielt gleich Mine!. */
  const frisch = async (ausruestung = [BLADE], o = {}) => {
    const t = await H.fresh({ hand: [[MMM], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100, ...o });
    for (const [i, name] of ausruestung.entries()) {
      t.gs.players[1].hand.push(name); t.engine._trackCard(name, 1, 'hand');
      const r = await t.play(1, name, { noGrant: true, hero: o.traeger ?? 0, slot: i });
      if (r !== true) throw new Error('Aufbau: ' + name + ' nicht ausrüstbar: ' + JSON.stringify(r));
    }
    t.gs.activePlayer = 0;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.cardName === (o.ziel || ausruestung[0])); return v ? [v.id] : null; };
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === MMM, answer: () => ({ optionId: o.antwort || 'equip' }) });
    return t;
  };
  const charme = (t, lvl = 1) => { t.setAbilities(0, 0, [Array(lvl).fill('Charme'), [], []]); };
  const spiele = (t, o = {}) => t.play(0, MMM, { hero: 0, ...o });

  R.section('A · Ohne Charme: das Artefakt wandert auf die Hand, die Karte kostet eine Aktion');
  {
    const t = await frisch();
    const atk0 = t.hero(1, 0).atk;
    R.check('Aufbau: Blade liegt am Gegnerhelden (ATK +10)', equipsOn(t, 1, 0).includes(BLADE) && atk0 >= (H.DB[t.hero(1, 0).name].atk || 0) + 10, { eq: equipsOn(t, 1, 0), atk0 });
    const r = await spiele(t);
    R.check('gespielt', r === true, r);
    R.check('Blade liegt auf MEINER Hand, nicht mehr am Gegnerhelden', t.pile(0, 'hand').includes(BLADE) && !equipsOn(t, 1, 0).includes(BLADE) && !t.pile(1, 'hand').includes(BLADE), { hand: t.pile(0, 'hand'), eq: equipsOn(t, 1, 0) });
    R.check('der Held des Gegners verliert den ATK-Bonus (−10)', t.hero(1, 0).atk === atk0 - 10, { vorher: atk0, nachher: t.hero(1, 0).atk });
    R.check('kostet eine normale Aktion (keine Zusatzaktion ohne Charme)', acted(t) === 1, t.gs.players[0].heroesActedThisTurn);
    R.check('Mine! Mine! Mine! liegt in der Ablage', t.pile(0, 'discardPile').includes(MMM) && !t.pile(0, 'hand').includes(MMM));
    const inst = t.inst(c => c.zone === 'hand' && c.owner === 0 && c.name === BLADE)[0];
    R.check('Eigentum bleibt beim Gegner (originalOwner = Sitz 1)', !!inst && inst.originalOwner === 1, inst && { owner: inst.owner, oo: inst.originalOwner });
    await t.run(() => t.engine.actionDiscardHandCard(0, BLADE, t.pile(0, 'hand').indexOf(BLADE), {}));
    R.check('abgeworfen geht es in die Ablage des Gegners', t.pile(1, 'discardPile').includes(BLADE) && !t.pile(0, 'discardPile').includes(BLADE), { me: t.pile(0, 'discardPile'), opp: t.pile(1, 'discardPile') });
    R.check('keine Engine-Fehler, Audit sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('A2 · Flug Zone → Hand: Haltezeit über das Ende der fliegenden Kopie hinaus (Al: Kopie und echte Karte waren kurz beide sichtbar)');
  {
    const t = await frisch();
    const delays = [];
    const orig = t.engine._delay;
    t.engine._delay = async (ms) => { delays.push(ms); return orig(ms); };
    await spiele(t);
    R.check('nach dem Wegnehmen wartet die Karte mindestens 900 ms (Flug 700 + Entfernen der Kopie 100 + Puffer), BEVOR sie die Hand verlässt', delays.some(ms => ms >= 900), delays);
  }

  R.section('B · Charme 1+: Zusatzaktion, optionales Anlegen ohne Kosten');
  for (const lvl of [1, 2, 3]) {
    const t = await frisch(); charme(t, lvl);
    const gold0 = t.gs.players[0].gold, atkEigen0 = t.hero(0, 0).atk;
    R.check(`Charme ${lvl}: die Engine meldet eine inhärente Aktion`, t.engine.cardHasInherentAction(0, 0, H.DB[MMM]) === true);
    const r = await spiele(t);
    R.check(`Charme ${lvl}: gespielt, KEINE Aktion verbraucht`, r === true && acted(t) === 0, { r, acted: t.gs.players[0].heroesActedThisTurn });
    R.check(`Charme ${lvl}: Blade liegt am Nutzer (Support Zone), nicht auf der Hand`, equipsOn(t, 0, 0).includes(BLADE) && !t.pile(0, 'hand').includes(BLADE), { eq: equipsOn(t, 0, 0), hand: t.pile(0, 'hand') });
    R.check(`Charme ${lvl}: ohne Kosten (Gold unverändert) und ATK +10 beim Nutzer`, t.gs.players[0].gold === gold0 && t.hero(0, 0).atk === atkEigen0 + 10, { gold: t.gs.players[0].gold, atk: t.hero(0, 0).atk, atk0: atkEigen0 });
    const inst = t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === BLADE)[0];
    R.check(`Charme ${lvl}: Eigentum bleibt beim Gegner`, !!inst && inst.originalOwner === 1, inst && { oo: inst.originalOwner });
    R.check(`Charme ${lvl}: keine Engine-Fehler, Audit sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await frisch([BLADE], { antwort: 'keep' }); charme(t);
    const atkEigen0 = t.hero(0, 0).atk;
    await spiele(t);
    R.check('„Keep it in my hand": Blade bleibt auf der Hand, nicht angelegt, ATK unverändert, trotzdem Zusatzaktion', t.pile(0, 'hand').includes(BLADE) && equipsOn(t, 0, 0).length === 0 && t.hero(0, 0).atk === atkEigen0 && acted(t) === 0, { hand: t.pile(0, 'hand'), eq: equipsOn(t, 0, 0), acted: acted(t) });
  }
  {
    // Charme ohne Ability-Zone, aber die Karte ist negiert/blanked: unter harter Negierung zählt Charme nicht
    const t = await frisch(); charme(t); t.heroStatus(0, 0, 'negated', { appliedTurn: 0 });
    const hat = t.engine.cardHasInherentAction(0, 0, H.DB[MMM]);
    R.note('Charme unter Negierung des Nutzers: inhärente Aktion?', hat);
  }

  R.section('C · Anlegen unmöglich: keine Rückfrage, das Artefakt bleibt auf der Hand');
  {
    const t = await frisch(); charme(t);
    for (let z = 0; z < 3; z++) t.put(0, 0, z, 'Cute Bird');          // keine freie Support Zone beim Nutzer
    const r = await spiele(t);
    const fragen = t.prompts.filter(p => p.d.type === 'optionPicker' && p.d.title === MMM).length;
    R.check('keine freie Zone: keine Rückfrage, Blade auf der Hand, Aktion trotzdem nicht verbraucht (Charme)', r === true && fragen === 0 && t.pile(0, 'hand').includes(BLADE) && acted(t) === 0, { r, fragen, hand: t.pile(0, 'hand') });
  }
  {
    const t = await frisch(); charme(t);
    t.heroStatus(0, 0, 'frozen');
    const r = await spiele(t, { noGrant: false });
    R.note('eingefrorener Nutzer: Karte spielbar?', { r, hand: t.pile(0, 'hand'), eq: equipsOn(t, 0, 0) });
  }
  {
    // Der Nutzer kann das Artefakt wegen einer Anlege-Grenze nicht tragen („You can only have 1 Vampiric Sword …")
    const t = await frisch([VAMP], { ziel: VAMP }); charme(t);
    t.gs.players[0].hand.push(VAMP); t.engine._trackCard(VAMP, 0, 'hand');
    t.gs.players[0].gold = 100;
    const r1 = await t.play(0, VAMP, { noGrant: true, hero: 0, slot: 0 });
    const r = await spiele(t);
    R.note('eigene Kopie schon ausgerüstet (Grenze „1 pro Held" je nach Karte)', { r1, r, hand: t.pile(0, 'hand'), eq: equipsOn(t, 0, 0) });
  }

  R.section('D · Mehrere freie Zonen: Zonenwahl');
  {
    const t = await frisch(); charme(t);
    const zielZone = 2;
    t.targetFn = (valid, cfg) => {
      const e = valid.find(x => x.type === 'equip' && x.owner === 1 && x.cardName === BLADE);       // Zielwahl der Karte
      if (e) return [e.id];
      const z = valid.find(x => x.type === 'equip' && x.owner === 0 && x.heroIdx === 0 && x.slotIdx === zielZone);   // Zonenwahl
      return z ? [z.id] : undefined;
    };
    await spiele(t);
    const inst = t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === BLADE)[0];
    R.check('gewählte Zone 2 trägt das Artefakt', !!inst && inst.zoneSlot === zielZone, inst && inst.zoneSlot);
  }

  R.section('E · Zielfilter: nur Ausrüstung an Helden, die der Gegner kontrolliert');
  {
    const t = await frisch([BLADE, HEART]);
    t.gs.players[0].hand.push(HEART); t.engine._trackCard(HEART, 0, 'hand');
    await t.play(0, HEART, { noGrant: true, hero: 1, slot: 0 });          // eigene Ausrüstung an meinem Helden 1
    t.put(1, 1, 0, 'Cute Bird');                                           // Gegnerkreatur
    t.gs.players[1].hand.push(HEART); t.engine._trackCard(HEART, 1, 'hand');
    t.gs.activePlayer = 0;
    let angeboten = null;
    t.targetFn = (valid) => { angeboten = valid.map(v => `${v.type}:${v.owner}:${v.heroIdx}:${v.cardName}`); return null; };
    t.policy.cancelTargets = true;
    await spiele(t);
    R.check('angeboten: nur die zwei Artefakte des Gegners (Blade, Heart of Ice)', angeboten && angeboten.includes('equip:1:0:' + BLADE) && angeboten.includes('equip:1:0:' + HEART) && !angeboten.some(a => a.includes('equip:0:')) && !angeboten.includes('equip:1:1:Cute Bird'), angeboten);
    R.check('Abbruch der Zielwahl: nichts geändert, Karte bleibt auf der Hand, keine Aktion', t.pile(0, 'hand').includes(MMM) && acted(t) === 0 && equipsOn(t, 1, 0).length === 2, { hand: t.pile(0, 'hand') });
  }
  {
    // Kontrolle statt Brettseite: der Gegner übernimmt MEINEN Helden dauerhaft → seine Ausrüstung (meine Spalte) ist wählbar; ein von mir übernommener Gegnerheld nicht.
    const t = await frisch([BLADE]);
    t.gs.players[0].hand.push(HEART); t.engine._trackCard(HEART, 0, 'hand');
    await t.play(0, HEART, { noGrant: true, hero: 1, slot: 0 });          // Heart of Ice am eigenen Helden 1
    await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 1));        // Sitz 1 übernimmt MEINEN Helden 1 dauerhaft
    t.gs.activePlayer = 0;
    let angeboten = null;
    t.targetFn = (valid) => { angeboten = valid.map(v => `${v.type}:${v.owner}:${v.heroIdx}:${v.cardName}`); return null; };
    t.policy.cancelTargets = true;
    await spiele(t);
    R.check('Heart of Ice an meinem vom Gegner kontrollierten Helden ist wählbar (Kontrolle, nicht Spalte)', angeboten && angeboten.includes('equip:0:1:' + HEART), angeboten);
  }
  {
    const t = await frisch([BLADE]);
    await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0));        // ICH übernehme den Gegnerhelden 0 (er trägt das Blade) dauerhaft
    t.gs.activePlayer = 0;
    const r = await spiele(t);
    R.check('Gegnerheld gehört mir: sein Blade ist kein Ziel → Karte nicht spielbar', r !== true && t.pile(0, 'hand').includes(MMM), { r });
  }
  {
    // Nicht wählbar: unbewegliche Ausrüstung, Token
    const t = await frisch([BLADE]);
    t.find(BLADE, 'support').counters.immovable = true;
    const r = await spiele(t);
    R.check('unbewegliche (immovable) Ausrüstung ist kein Ziel → nicht spielbar', r !== true && equipsOn(t, 1, 0).includes(BLADE), { r });
  }

  R.section('F · Spielbarkeit');
  {
    const t = await frisch([]);
    const r = await spiele(t);
    R.check('ohne Gegner-Ausrüstung: nicht spielbar', r !== true && t.pile(0, 'hand').includes(MMM), { r });
  }
  {
    const t = await frisch(); t.gs.players[0].handLocked = true;
    const r = await spiele(t);
    R.check('Hand-Sperre des Wirkers: nicht spielbar', r !== true && equipsOn(t, 1, 0).includes(BLADE), { r });
  }
  {
    const t = await frisch(); t.gs.firstTurnProtectedPlayer = 1;
    const r = await spiele(t);
    R.check('Erstrunden-Schutz des Gegners: nicht spielbar', r !== true && equipsOn(t, 1, 0).includes(BLADE), { r });
  }
  {
    const t = await frisch(); t.setHero(1, 2, 'Boris, the Guardian of Blackport', 800);
    const r = await spiele(t);
    R.check('Boris des Gegners: die Karte holt Gegnerkarten und ist gesperrt', r !== true && equipsOn(t, 1, 0).includes(BLADE), { r });
  }
  {
    const t = await frisch(); t.setAbilities(1, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]);
    const r = await spiele(t);
    R.check('Resistance Lv3 am Trägerhelden: das Abnehmen wird abgefangen — Blade bleibt liegen, die Karte ist gewirkt (Ablage)', r === true && equipsOn(t, 1, 0).includes(BLADE) && !t.pile(0, 'hand').includes(BLADE) && t.pile(0, 'discardPile').includes(MMM), { r, eq: equipsOn(t, 1, 0), disc: t.pile(0, 'discardPile') });
  }

  R.section('G · Schutz-Fenster beim Wegnehmen');
  {
    const t = await frisch(); t.grantFor(1, 0, 'Defending the Gate'); t.putSurprise(1, 0, 'Defending the Gate');
    const r = await spiele(t);
    R.check('Defending the Gate (Surprise des Gegners): das Wegnehmen aus der Support Zone wird verhindert — Blade bleibt liegen, die Karte ist gewirkt',
      r === true && equipsOn(t, 1, 0).includes(BLADE) && !t.pile(0, 'hand').includes(BLADE) && t.pile(0, 'discardPile').includes(MMM), { r, eq: equipsOn(t, 1, 0), hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile') });
  }
  {
    // Wie Kidnapping: ein Ziel, das zwischen Wahl und Auflösung verschwindet, lässt die Karte verpuffen (kein Absturz, kein Geister-Zustand)
    const t = await frisch();
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.cardName === BLADE); if (v) { const i = t.find(BLADE, 'support'); t.engine._untrackCard(i.id); t.gs.players[1].supportZones[0][0] = []; return [v.id]; } return null; };
    const r = await spiele(t);
    R.check('Ziel in der Wahl verschwunden: kein Absturz, nichts auf der Hand, keine Fehler', t.errors.length === 0 && !t.pile(0, 'hand').includes(BLADE), { r, e: t.errors, hand: t.pile(0, 'hand') });
  }

  R.section('H · CPU');
  {
    const cpu = require('../../../../cards/effects/_cpu.js');
    const t = await frisch([BLADE, HEART, VAMP], { ziel: VAMP });
    cpu.installCpuBrain(t.engine);
    t.targetFn = null; charme(t);
    const r = await spiele(t);
    R.check('CPU-Sitz nimmt das teuerste Artefakt (Vampiric Sword, 50) und legt es an (Charme)', r === true && equipsOn(t, 0, 0).includes(VAMP), { r, eq: equipsOn(t, 0, 0), hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
