'use strict';
// W20c · Frage 1 · Al, 20.10.2026: „Sollen alle Hand-Reaktionszauber (Cure, Anti Magic Shield und andere) über jeden vom Kontrolleur übernommenen Helden gewirkt werden dürfen?“
// — „Ja, das gilt generell für alle Reactions. Aber natürlich müssen ihre Bedingungen wie Level erfüllt sein.“
//
// Regel: JEDER Held, den der Spieler gerade kontrolliert (dauerhaft = Paraseed-Art `actionTakeHeroPermanently`, temporär = Charme-Art `actionStealHero`; auch in der Gegnerspalte), ist für ALLE
// Reaktionen ein gültiger Wirker — mit SEINEN Schulen/Stufen aus SEINEN Ability Zones, Kosten/Wisdom-Abwurf aus Hand und Gold des Kontrolleurs, ohne Cast-Sperre (Frozen/Stunned/Silenced).
// Der BESITZER eines abgegebenen Helden wirkt Reaktionen nicht mit ihm (W20a), die Besitzer-Helden bleiben unverändert (Normalspiel = Gegenprobe in jedem Teil).
// Vorher: nur Furious Anger (jede Übernahme) und Jump in the River / Stealthy Pursuit (nur dauerhaft) per Karten-Schalter `fremdeWirker`; Cure, Anti Magic Shield & Co. nie.
//
// Aufbau je Teil: Reagierender R (Schule NUR am Wirker), Gegner O löst das Fenster aus. Varianten: `eigen` (Normalspiel, Wirker in der eigenen Spalte), `dauerhaft`, `temporaer`.
//   Teil 1 Kettenfenster (The Core's Awakening) · Teil 2 Wirker-Wahl + Wisdom aus der Hand des Kontrolleurs · Teil 3 Phasenfenster (Cure)
//   Teil 4 Vor-/Nach-Schaden mit Wirker = Zielheld (Escape, Emergency Spell Armor, Weapon Absorption, Paraseed Zombie, Fireshield)
//   Teil 5 Post-Target (Anti Magic Shield, Test Flight, Barrier of Faith, Divine Gift of Rain) · Teil 6 Umleitung (Challenge, Martyry)
//   Teil 7 Nach Beschwörung (Bomblebee Cluster, Old Couple), gegnerische Action Phase (Burning Fuse) · Teil 8 Zugbeginn-Hooks (Jump in the River, Dive Down)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);
const GUN = 'Future Tech Gun', CA = "The Core's Awakening";
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

/** `ctrl` übernimmt den Held `besitzer:hi`: dauerhaft (Paraseed Control) oder temporär (Charme, bis Zugende). */
async function uebernehmen(t, v, ctrl, besitzer, hi) {
  if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(ctrl, besitzer, hi);
  else if (v === 'temporaer') t.engine.actionStealHero(ctrl, besitzer, hi);
  await sleep(150);   // Harness-Falle: onTakeControl läuft asynchron nach
}
/** Rolle des Wirkers: `eigen` → Schule am eigenen Helden `r:0`; sonst am Helden `o:wh` der Gegenspalte, den `r` übernimmt. */
async function wirkerEinrichten(t, v, r, o, schulen, wh = 0) {
  if (v === 'eigen') t.setAbilities(r, 0, [schulen, [], []]);
  else { t.setAbilities(o, wh, [schulen, [], []]); await uebernehmen(t, v, r, o, wh); }
}
/** Seite/Index des Wirkers für Treffer-Auswahl und Prüfungen. */
const wirkerAdresse = (v, r, o, wh = 0) => (v === 'eigen' ? { seite: r, hi: 0 } : { seite: o, hi: wh });

(async () => {
  const R = H.runner();

  // ═══ Teil 1 · Kettenfenster: The Core's Awakening („when you play an Artifact“, Support Magic 1) ═══
  for (const v of ['eigen', 'dauerhaft', 'temporaer']) {
    R.section(`Teil 1 (${v}): Core's Awakening reagiert aufs Ausrüsten einer Gun — Wirker nur ${v === 'eigen' ? 'der eigene Held' : 'der übernommene Held der Gegenspalte'}`);
    const t = await H.fresh({ hand: [[GUN, CA], []], deck: [[GUN, GUN, GUN, GUN, H.INERT.creature], []], gold: [100, 100] });
    await wirkerEinrichten(t, v, 0, 1, ['Support Magic', 'Support Magic']);   // Support Magic 2 → bis zu 2 Kopien
    let angebot = null;
    t.script.push({ match: d => d._anzahlWahl, answer: (d) => { angebot = d.options.length; return { optionId: d.options[d.options.length - 1].id }; } });
    await t.play(0, GUN, { hero: 0, noGrant: true });
    const abl = t.pile(0, 'discardPile');
    R.check(`${v}: Core's Awakening wurde gewirkt (Ablage des Reagierenden)`, abl.includes(CA), abl);
    R.check(`${v}: Staffel folgt dem Wirker (Support Magic 2 → Angebot 1..2, 2 Guns aus dem Deck in die Ablage)`, angebot === 2 && abl.filter(x => x === GUN).length === 2, { angebot, abl });
    R.check(`${v}: nur der Reagierende wurde gefragt`, t.prompts.every(p => p.pi === 0), t.prompts.map(p => p.pi));
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.section('Teil 1 Gegenproben: ohne Schule, Frozen, abgegebener eigener Held');
  {
    const run = async (label, aufbau, erwartet, ausruester = 0) => {
      const t = await H.fresh({ hand: [[GUN, CA], []], deck: [[GUN, GUN, GUN, H.INERT.creature], []], gold: [100, 100] });
      await aufbau(t);
      t.script.push({ match: d => d._anzahlWahl, answer: (d) => ({ optionId: d.options[d.options.length - 1].id }) });
      await t.play(0, GUN, { hero: ausruester, noGrant: true });
      R.check(`${label}: Core's Awakening ${erwartet ? 'wird' : 'wird NICHT'} gewirkt`, t.pile(0, 'discardPile').includes(CA) === erwartet, { abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
      R.check(`${label}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    };
    await run('übernommener Held OHNE passende Schule', async (t) => { t.setAbilities(1, 0, [['Fighting', 'Fighting'], [], []]); await uebernehmen(t, 'dauerhaft', 0, 1, 0); }, false);
    await run('übernommener Held mit Schule, aber Frozen', async (t) => { await wirkerEinrichten(t, 'dauerhaft', 0, 1, ['Support Magic']); t.heroStatus(1, 0, 'frozen'); }, false);
    await run('übernommener Held mit Schule, aber Stunned', async (t) => { await wirkerEinrichten(t, 'temporaer', 0, 1, ['Support Magic']); t.heroStatus(1, 0, 'stunned'); }, false);
    await run('übernommener Held mit Schule, nicht gesperrt (Gegenprobe)', async (t) => { await wirkerEinrichten(t, 'dauerhaft', 0, 1, ['Support Magic']); }, true);
    await run('eigener Held mit Schule, aber an den Gegner abgegeben (Besitzer wirkt nicht)', async (t) => { t.setAbilities(0, 0, [['Support Magic', 'Support Magic'], [], []]); await uebernehmen(t, 'dauerhaft', 1, 0, 0); }, false);
    await run('eigener Held mit Schule, ZWEITER eigener Held abgegeben: der nicht abgegebene wirkt weiter', async (t) => { t.setAbilities(0, 1, [['Support Magic'], [], []]); t.setAbilities(0, 0, [['Support Magic'], [], []]); await uebernehmen(t, 'dauerhaft', 1, 0, 0); }, true, 1);
  }

  // ═══ Teil 2 · Wirker-Wahl und Wisdom: Hand des KONTROLLEURS ═══
  R.section('Teil 2: eigener UND übernommener Held können wirken → Wirker-Auswahl; der übernommene Held wirkt mit SEINER Stufe');
  {
    // Eigener Held 0:0 Support Magic 1, übernommener Held 1:0 Support Magic 3: Core's Awakening → Auswahl, Staffel folgt dem gewählten Wirker
    for (const [wahl, erwartet] of [['hero-0', 1], ['hero-1-0', 3]]) {
      const t = await H.fresh({ hand: [[GUN, CA], []], deck: [[GUN, GUN, GUN, GUN, H.INERT.creature], []], gold: [100, 100] });
      t.setAbilities(0, 0, [['Support Magic'], [], []]);
      t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], [], []]);
      await uebernehmen(t, 'dauerhaft', 0, 1, 0);
      let optionen = null;
      t.script.push({ match: d => d.type === 'optionPicker' && !d._anzahlWahl, answer: (d) => { optionen = d.options.map(o => o.id); return { optionId: wahl }; } });
      t.script.push({ match: d => d._anzahlWahl, answer: (d) => ({ optionId: d.options[d.options.length - 1].id }) });
      await t.play(0, GUN, { hero: 0, noGrant: true });
      R.check(`Wirker-Auswahl bietet beide Helden an (${J(optionen)})`, J(optionen) === J(['hero-0', 'hero-1-0']), optionen);
      R.check(`gewählter Wirker ${wahl}: ${erwartet} Kopie(n) gesendet (Stufe des gewählten Helden)`, t.pile(0, 'discardPile').filter(x => x === GUN).length === erwartet, t.pile(0, 'discardPile'));
      R.check(`gewählter Wirker ${wahl}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.section('Teil 2: Wisdom — Level-Lücke des übernommenen Helden wird aus der HAND DES KONTROLLEURS bezahlt (Divine Gift of Rain: Magic Arts 2, Held hat Magic Arts 1 + Wisdom 1)');
  for (const v of ['eigen', 'dauerhaft', 'temporaer']) {
    for (const [label, handR, erwartet] of [['Hand mit Füllkarten', ['Divine Gift of Rain', 'ZZ Filler', 'ZZ Filler'], true], ['Hand OHNE Wisdom-Material', ['Divine Gift of Rain'], false]]) {
      const t = await H.fresh({ hand: [['Burning Finger', 'ZZ Filler', 'ZZ Filler'], handR], deckSize: 30, active: 0 });
      t.grantFor(0, 0, 'Burning Finger');
      const w = wirkerAdresse(v, 1, 0, 2);
      if (v === 'eigen') t.setAbilities(1, 0, [['Magic Arts'], ['Wisdom'], []]);
      else { t.setAbilities(0, 2, [['Magic Arts'], ['Wisdom'], []]); await uebernehmen(t, v, 1, 0, 2); }
      // Die Spezial-Gegnerhand (Sitz 0) hat Material, die von Sitz 1 nicht (zweite Zeile) — nur die Hand des Kontrolleurs zählt.
      t.targetFn = (valid) => { const h = valid.find(x => x.id === `hero-${w.seite}-${w.hi}`); return [(h || valid[0]).id]; };
      t.script.push({ match: d => d.type === 'confirm' && d.title === 'Divine Gift of Rain', answer: () => ({ confirmed: true }) });
      const hp = t.hp(w.seite, w.hi);
      const hand0 = t.pile(0, 'hand').length;
      await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
      const rain = t.pile(1, 'discardPile').includes('Divine Gift of Rain');
      R.check(`${v}, ${label}: Rain ${erwartet ? 'wird gewirkt' : 'wird nicht angeboten'}`, rain === erwartet, { abl1: t.pile(1, 'discardPile'), hand1: t.pile(1, 'hand') });
      if (erwartet) {
        R.check(`${v}, ${label}: Wisdom-Abwurf kam aus der Hand des Kontrolleurs (Sitz 1: Rain + 1 abgeworfen, 0 Karten übrig außer 1 Füllkarte), Hand des Helden-Besitzers (Sitz 0) nur um die gespielte Karte kleiner`,
          t.pile(1, 'hand').length === 1 && t.pile(0, 'hand').length === hand0 - 1, { h1: t.pile(1, 'hand'), h0: t.pile(0, 'hand'), hand0 });
        R.check(`${v}, ${label}: Treffer abgewehrt (HP unverändert)`, t.hp(w.seite, w.hi) === hp, [hp, t.hp(w.seite, w.hi)]);
      }
      R.check(`${v}, ${label}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  // ═══ Teil 3 · Phasenfenster: Cure („between phases of your opponent's turn“) ═══
  for (const v of ['eigen', 'dauerhaft']) {
    R.section(`Teil 3 (${v}): Cure im Phasenfenster des Gegnerzugs`);
    const t = await H.fresh({ hand: [['Cure'], []], deckSize: 30, active: 0 });
    await wirkerEinrichten(t, v, 0, 1, ['Support Magic']);
    t.heroStatus(0, 1, 'burned');
    t.reset();
    t.script.push({ match: d => d.type === 'confirm' && /Cure/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    await t.endTurn();
    R.check(`${v}: Sitz 0 wird nach Cure gefragt`, t.prompts.some(p => p.pi === 0 && /Cure/.test(p.d.title || '')), t.prompts.map(p => [p.pi, p.d.title]));
    R.check(`${v}: Burn von 0:1 geheilt, Cure in der Ablage von Sitz 0`, !t.gs.players[0].heroes[1].statuses?.burned && t.pile(0, 'discardPile').includes('Cure'), [t.gs.players[0].heroes[1].statuses, t.pile(0, 'discardPile')]);
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.section('Teil 3 Gegenproben (Cure): ohne Schule, Frozen, magic_silenced, abgegebener Held; temporär: Prädikat (die Übernahme endet vor dem Gegnerzug)');
  {
    const cure = H.loadCardEffect('Cure');
    const probe = async (label, aufbau, erwartet) => {
      const t = await H.fresh({ hand: [['Cure'], []], deckSize: 30 });
      await aufbau(t);
      const w = t.engine.reaktionsWirkerFuer(0, 'Cure', cure, { spellInHand: true }).map(x => `${x.seite}:${x.heroIdx}`);
      R.check(`${label}: Wirker für Cure ${erwartet.length ? 'enthalten ' + erwartet : 'keine'}`, J(w) === J(erwartet), w);
    };
    await probe('dauerhaft übernommen, Schule da', async (t) => { await wirkerEinrichten(t, 'dauerhaft', 0, 1, ['Support Magic']); }, ['1:0']);
    await probe('temporär übernommen, Schule da', async (t) => { await wirkerEinrichten(t, 'temporaer', 0, 1, ['Support Magic']); }, ['1:0']);
    await probe('übernommen, falsche Schule', async (t) => { await wirkerEinrichten(t, 'dauerhaft', 0, 1, ['Fighting', 'Fighting']); }, []);
    await probe('übernommen, Frozen', async (t) => { await wirkerEinrichten(t, 'dauerhaft', 0, 1, ['Support Magic']); t.heroStatus(1, 0, 'frozen'); }, []);
    await probe('übernommen, magic_silenced (Spell-Sperre)', async (t) => { await wirkerEinrichten(t, 'dauerhaft', 0, 1, ['Support Magic']); t.heroStatus(1, 0, 'magic_silenced'); }, []);
    await probe('eigener + übernommener Held, beide passend (eigene zuerst)', async (t) => { t.setAbilities(0, 1, [['Support Magic'], [], []]); await wirkerEinrichten(t, 'dauerhaft', 0, 1, ['Support Magic']); }, ['0:1', '1:0']);
    await probe('eigener Held mit Schule, an den Gegner abgegeben', async (t) => { t.setAbilities(0, 0, [['Support Magic'], [], []]); await uebernehmen(t, 'dauerhaft', 1, 0, 0); }, []);
    await probe('Normalspiel: eigener Held mit Schule', async (t) => { t.setAbilities(0, 0, [['Support Magic'], [], []]); }, ['0:0']);
  }

  // ═══ Teil 4 · Vor-/Nach-Schaden: der Wirker IST der getroffene Held (casterIsTarget) ═══
  // O (Sitz 0) trifft mit Burning Finger (Lv1, „choose a target“) den Wirker-Held von R (Sitz 1): eigen = 1:1, übernommen = 0:2 (steht in O's Spalte, R kontrolliert ihn).
  // Temporär: der Charme schützt den Held vor dem Schaden seines Besitzers — dafür Prädikat-Gegenprobe unten.
  const SCH = { 'Escape': ['Fighting', 'Fighting'], 'Emergency Spell Armor': ['Support Magic'], 'Weapon Absorption': ['Magic Arts', 'Magic Arts'], 'Paraseed Zombie': ['Decay Magic'], 'Fireshield': ['Destruction Magic'] };
  for (const karte of Object.keys(SCH)) {
    for (const v of ['eigen', 'dauerhaft']) {
      R.section(`Teil 4 (${v}): ${karte} wirkt über den getroffenen Helden`);
      const letal = karte !== 'Fireshield';
      const hand1 = karte === 'Paraseed Zombie' ? [karte, 'Paraseed', 'ZZ Filler'] : [karte, 'ZZ Filler', 'ZZ Filler'];
      const t = await H.fresh({ hand: [['Burning Finger'], hand1], deckSize: 30, active: 0 });
      t.grantFor(0, 0, 'Burning Finger');
      const zl = v === 'eigen' ? { seite: 1, hi: 1 } : { seite: 0, hi: 2 };
      t.setAbilities(zl.seite, zl.hi, [SCH[karte], karte === 'Weapon Absorption' ? ['Fighting'] : [], []]);
      if (v === 'dauerhaft') await uebernehmen(t, v, 1, 0, 2);
      if (letal) t.gs.players[zl.seite].heroes[zl.hi].hp = 100;
      t.targetFn = (valid) => { const h = valid.find(x => x.id === `hero-${zl.seite}-${zl.hi}`); return h ? [h.id] : (valid.length ? [valid[0].id] : []); };
      t.script.push({ match: d => d.type === 'confirm' && d.title === karte, answer: () => ({ confirmed: true }) });
      const hp = t.hp(zl.seite, zl.hi);
      await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
      R.check(`${v}: ${karte} wurde gewirkt (Ablage bzw. Gelöscht-Stapel von Sitz 1)`, t.pile(1, 'discardPile').includes(karte) || t.pile(1, 'deletedPile').includes(karte), { abl: t.pile(1, 'discardPile'), del: t.pile(1, 'deletedPile') });
      if (karte === 'Escape') R.check(`${v}: Escape — der Treffer wurde abgewehrt (HP bleibt ${hp})`, t.hp(zl.seite, zl.hi) === hp, [hp, t.hp(zl.seite, zl.hi)]);
      if (karte === 'Emergency Spell Armor') R.check(`${v}: Emergency Spell Armor — HP und Max-HP des Wirkers sind 1`, t.hp(zl.seite, zl.hi) === 1 && t.gs.players[zl.seite].heroes[zl.hi].maxHp === 1, t.hp(zl.seite, zl.hi));
      if (karte === 'Weapon Absorption') R.check(`${v}: Weapon Absorption — Abilities geschickt und geheilt (HP über Ausgangswert)`, t.hp(zl.seite, zl.hi) > hp - 100 + 80, [hp, t.hp(zl.seite, zl.hi)]);
      if (karte === 'Paraseed Zombie') {
        const sup = (t.gs.players[zl.seite].supportZones[zl.hi] || []).flat();
        R.check(`${v}: Paraseed Zombie — HP 1 und die Paraseed liegt in der Zone des Wirkers (Spalte ${zl.seite})`, t.hp(zl.seite, zl.hi) === 1 && sup.some(n => /Paraseed/.test(n)), { hp: t.hp(zl.seite, zl.hi), sup });
      }
      if (karte === 'Fireshield') R.check(`${v}: Fireshield — Rückstoß traf den Angreifer 0:0 (HP unter 800)`, t.hp(0, 0) < 800, t.hp(0, 0));
      R.check(`${v}: ${karte} — keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.section('Teil 4 Gegenproben: Zielheld ohne Schule / Frozen / abgegeben; temporär (Prädikat)');
  {
    const esc = H.loadCardEffect('Escape');
    const t = await H.fresh({ hand: [[], ['Escape', 'ZZ Filler']], deckSize: 30, active: 0 });
    t.setAbilities(0, 2, [['Fighting', 'Fighting'], [], []]);
    await uebernehmen(t, 'temporaer', 1, 0, 2);
    const k = t.engine._rxCastKandidaten(t.gs.players[1], 'Escape', esc, { targetHeroIdx: 2, targetSeite: 0 }).map(c => `${c.casterSeite}:${c.casterIdx}`);
    R.check('temporär: der getroffene übernommene Held 0:2 ist Wirker für Escape', J(k) === J(['0:2']), k);
    const k2 = t.engine._rxCastKandidaten(t.gs.players[0], 'Escape', esc, { targetHeroIdx: 2, targetSeite: 0 }).map(c => `${c.casterSeite}:${c.casterIdx}`);
    R.check('der BESITZER (Sitz 0) wirkt Escape nicht über den abgegebenen Helden 0:2', J(k2) === J([]), k2);
    t.heroStatus(0, 2, 'frozen');
    const k3 = t.engine._rxCastKandidaten(t.gs.players[1], 'Escape', esc, { targetHeroIdx: 2, targetSeite: 0 }).map(c => `${c.casterSeite}:${c.casterIdx}`);
    R.check('Frozen: der übernommene Zielheld wirkt nicht', J(k3) === J([]), k3);
    delete t.gs.players[0].heroes[2].statuses.frozen;
    t.setAbilities(0, 2, [['Support Magic'], [], []]);
    const k4 = t.engine._rxCastKandidaten(t.gs.players[1], 'Escape', esc, { targetHeroIdx: 2, targetSeite: 0 }).map(c => `${c.casterSeite}:${c.casterIdx}`);
    R.check('falsche Schule: nicht', J(k4) === J([]), k4);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ═══ Teil 5 · Post-Target: Anti Magic Shield, Test Flight, Barrier of Faith, Divine Gift of Rain ═══
  const POST = { 'Anti Magic Shield': ['Magic Arts'], 'Test Flight': ['Magic Arts', 'Magic Arts'], 'Barrier of Faith': ['Support Magic', 'Fighting', 'Toughness'], 'Divine Gift of Rain': ['Magic Arts', 'Magic Arts'] };
  for (const karte of Object.keys(POST)) {
    for (const v of ['eigen', 'dauerhaft']) {
      R.section(`Teil 5 (${v}): ${karte} — der getroffene Held ist${karte === 'Divine Gift of Rain' ? ' (Ziel, das R kontrolliert; Wirker ebenfalls)' : ' der Wirker'}`);
      const t = await H.fresh({ hand: [['Burning Finger'], [karte, 'ZZ Filler', 'ZZ Filler']], deckSize: 30, active: 0 });
      t.grantFor(0, 0, 'Burning Finger');
      const z = v === 'eigen' ? { seite: 1, hi: 1 } : { seite: 0, hi: 2 };
      t.setAbilities(z.seite, z.hi, [POST[karte], karte === 'Barrier of Faith' ? ['Wisdom'] : [], []]);
      if (v === 'dauerhaft') await uebernehmen(t, v, 1, 0, 2);
      t.targetFn = (valid) => { const h = valid.find(x => x.id === `hero-${z.seite}-${z.hi}`); return h ? [h.id] : (valid.length ? [valid[0].id] : []); };
      t.script.push({ match: d => d.type === 'confirm' && d.title === karte, answer: () => ({ confirmed: true }) });
      const hp = t.hp(z.seite, z.hi);
      await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
      R.check(`${v}: ${karte} wurde gewirkt (Ablage von Sitz 1)`, t.pile(1, 'discardPile').includes(karte), t.pile(1, 'discardPile'));
      R.check(`${v}: der Treffer (100) wurde abgewehrt — HP von ${z.seite}:${z.hi} bleibt ${hp}`, t.hp(z.seite, z.hi) === hp, [hp, t.hp(z.seite, z.hi)]);
      if (karte === 'Barrier of Faith' && v === 'dauerhaft') R.check('dauerhaft: die 3 Abilities des übernommenen Helden gingen in die Ablage ihres BESITZERS (Sitz 0)', ['Support Magic', 'Fighting', 'Toughness'].every(n => t.pile(0, 'discardPile').includes(n)), t.pile(0, 'discardPile'));
      R.check(`${v}: ${karte} — keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.section('Teil 5 Gegenproben: Anti Magic Shield — Spell-Stufe höher als Magic Arts des Helden, falscher Zielheld, Besitzer');
  {
    // Fireball (Lv2) > Magic Arts 1 → AMS wirkt nicht
    const t = await H.fresh({ hand: [['Fireball'], ['Anti Magic Shield', 'ZZ Filler']], deckSize: 30, active: 0 });
    t.grantFor(0, 0, 'Fireball');
    t.setAbilities(0, 2, [['Magic Arts'], [], []]);
    await uebernehmen(t, 'dauerhaft', 1, 0, 2);
    t.targetFn = (valid) => [valid.find(x => x.id === 'hero-1-0').id];
    await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('Fireball (Lv2) gegen Magic Arts 1: Anti Magic Shield bleibt auf der Hand, Held 1:0 nimmt Schaden', t.pile(1, 'hand').includes('Anti Magic Shield') && t.hp(1, 0) < 800, [t.pile(1, 'hand'), t.hp(1, 0)]);
    // Zielheld ist ein EIGENER Held ohne Schule, der Wirker (übernommen) wird nicht getroffen → AMS: „a Hero that can use this Spell is hit“ → nicht
    const t2 = await H.fresh({ hand: [['Burning Finger'], ['Anti Magic Shield', 'ZZ Filler']], deckSize: 30, active: 0 });
    t2.grantFor(0, 0, 'Burning Finger');
    t2.setAbilities(0, 2, [['Magic Arts'], [], []]);
    await uebernehmen(t2, 'dauerhaft', 1, 0, 2);
    t2.targetFn = (valid) => [valid.find(x => x.id === 'hero-1-0').id];
    await t2.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Treffer auf einen Helden OHNE Schule (Wirker unversehrt): Anti Magic Shield wird nicht angeboten', t2.pile(1, 'hand').includes('Anti Magic Shield') && t2.hp(1, 0) === 700, [t2.pile(1, 'hand'), t2.hp(1, 0)]);
    // abgegebener eigener Held wird getroffen: der BESITZER (Sitz 0) hat AMS, Schule am abgegebenen Helden → nicht angeboten
    const t3 = await H.fresh({ hand: [['ZZ Filler', 'Anti Magic Shield'], ['Burning Finger']], deckSize: 30, active: 1 });
    t3.grantFor(1, 0, 'Burning Finger');
    t3.setAbilities(0, 2, [['Magic Arts'], [], []]);
    await uebernehmen(t3, 'dauerhaft', 1, 0, 2);
    t3.targetFn = (valid) => [valid.find(x => x.id === 'hero-0-2').id];
    await t3.play(1, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Besitzer (Sitz 0) hält AMS und Schule am abgegebenen Helden 0:2: wird nicht angeboten', t3.pile(0, 'hand').includes('Anti Magic Shield') && !t3.prompts.some(p => p.pi === 0 && /Anti Magic/.test(p.d.title || '')), [t3.pile(0, 'hand'), t3.prompts.map(p => [p.pi, p.d.title])]);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t) && sauber(t2) && sauber(t3), { e: [t.errors, t2.errors, t3.errors], a: [t.audit(), t2.audit(), t3.audit()] });
  }

  // ═══ Teil 6 · Umleitung: Challenge, Martyry („redirected to the user“) ═══
  for (const karte of ['Challenge', 'Martyry']) {
    for (const v of ['eigen', 'dauerhaft']) {
      R.section(`Teil 6 (${v}): ${karte} — der Wirker wird das neue Ziel`);
      const t = await H.fresh({ hand: [['Burning Finger'], [karte]], deckSize: 30, active: 0 });
      t.grantFor(0, 0, 'Burning Finger');
      const u = v === 'eigen' ? { seite: 1, hi: 0 } : { seite: 0, hi: 2 };
      t.grantFor(u.seite, u.hi, karte);
      if (v === 'dauerhaft') await uebernehmen(t, v, 1, 0, 2);
      t.targetFn = (valid) => [(valid.find(x => x.id === 'hero-1-1') || valid[0]).id];
      t.script.push({ match: d => d.type === 'confirm' && d.title === karte, answer: () => ({ confirmed: true }) });
      const hpU = t.hp(u.seite, u.hi);
      await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
      R.check(`${v}: ${karte} gespielt, ursprüngliches Ziel 1:1 unversehrt, der Wirker ${u.seite}:${u.hi} nimmt den Treffer`, t.pile(1, 'discardPile').includes(karte) && t.hp(1, 1) === 800 && t.hp(u.seite, u.hi) === hpU - 100, { abl: t.pile(1, 'discardPile'), h11: t.hp(1, 1), hU: [hpU, t.hp(u.seite, u.hi)] });
      R.check(`${v}: ${karte} — keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  // ═══ Teil 7 · Nach Beschwörung (Bomblebee Cluster), gegnerische Action Phase (Burning Fuse) ═══
  for (const v of ['eigen', 'dauerhaft', 'temporaer', 'keine']) {
    R.section(`Teil 7 (${v}): Bomblebee Cluster nach der Beschwörung einer Bomblebee`);
    const BB = 'Bomblebee';
    const t = await H.fresh({ hand: [[BB, 'Bomblebee Cluster', BB], []], deckSize: 30, active: 0 });
    if (v === 'eigen') t.grantFor(0, 1, 'Bomblebee Cluster');
    else if (v !== 'keine') { t.grantFor(1, 0, 'Bomblebee Cluster'); await uebernehmen(t, v, 0, 1, 0); }
    t.grantFor(0, 0, BB);   // Beschwörer: Summoning Magic 1 reicht NICHT für den Cluster (Lv2)
    t.script.push({ match: d => d.type === 'confirm' && /Cluster/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    await t.play(0, BB, { hero: 0, slot: 0, noGrant: true });
    const gespielt = t.pile(0, 'discardPile').includes('Bomblebee Cluster');
    R.check(`${v}: Cluster ${v === 'keine' ? 'wird NICHT angeboten' : 'wird gewirkt'}`, gespielt === (v !== 'keine'), { abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  for (const v of ['eigen', 'dauerhaft', 'temporaer', 'keine']) {
    R.section(`Teil 7 (${v}): Burning Fuse, wenn der Gegner seine Action Phase betritt`);
    const t = await H.fresh({ hand: [['Burning Fuse'], []], deckSize: 30, active: 1, turn: 6 });
    t.put(0, 0, 0, 'Bomblebee').turnPlayed = 2;
    if (v === 'eigen') t.grantFor(0, 1, 'Burning Fuse');
    else if (v !== 'keine') { t.grantFor(1, 0, 'Burning Fuse'); await uebernehmen(t, v, 0, 1, 0); }
    t.script.push({ match: d => d.type === 'confirm' && /Fuse/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    await t.run(() => t.engine._checkOppActionPhaseHandReactions(1));
    R.check(`${v}: Burning Fuse ${v === 'keine' ? 'wird NICHT angeboten' : 'wird gewirkt'}`, t.pile(0, 'discardPile').includes('Burning Fuse') === (v !== 'keine'), { abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  for (const v of ['eigen', 'dauerhaft', 'temporaer', 'keine']) {
    R.section(`Teil 7 (${v}): Old Couple („when you summon a Creature with level 1/2/3 or lower“) — Stufe des WIRKERS, Beschwörer ist ein anderer Held`);
    const t = await H.fresh({ hand: [[H.INERT.creature, 'Old Couple'], []], deck: [[H.INERT.big, H.INERT.frail, H.INERT.big], []], deckSize: 30, active: 0 });
    if (v === 'eigen') t.setAbilities(0, 1, [['Support Magic'], [], []]);
    else if (v !== 'keine') { t.setAbilities(1, 0, [['Support Magic'], [], []]); await uebernehmen(t, v, 0, 1, 0); }
    t.script.push({ match: d => d.type === 'confirm' && /Old Couple/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: (d.cards[0].name || d.cards[0]) }) });
    await t.play(0, H.INERT.creature, { hero: 0, slot: 0, noGrant: true });
    const zone = (t.gs.players[0].supportZones[0] || []).flat();
    R.check(`${v}: Old Couple ${v === 'keine' ? 'wird NICHT angeboten' : 'wird gewirkt: der Partner steht mit demselben Helden in der Zone'}`, v === 'keine' ? (!t.pile(0, 'discardPile').includes('Old Couple') && zone.length === 1) : (t.pile(0, 'discardPile').includes('Old Couple') && zone.length === 2), { abl: t.pile(0, 'discardPile'), zone });
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ═══ Teil 8 · Zugbeginn-Hooks im Gegnerzug: Jump in the River, Dive Down (vorher nur dauerhaft) ═══
  {
    const jump = H.loadCardEffect('Jump in the River');
    for (const v of ['eigen', 'dauerhaft', 'temporaer']) {
      R.section(`Teil 8 (${v}): Jump in the River („at the beginning of your opponent's turn“)`);
      const t = await H.fresh({ hand: [['Jump in the River'], []], deckSize: 30, active: 1 });
      await wirkerEinrichten(t, v, 0, 1, ['Fighting', 'Fighting']);
      const w = wirkerAdresse(v, 0, 1);
      const wSeite = v === 'eigen' ? 0 : 1;
      t.script.push({ match: d => d.type === 'confirm' && d.title === 'Jump in the River', answer: () => ({ confirmed: true }) });
      await t.run(() => jump.hooks.onTurnStart({ isMyTurn: false, _engine: t.engine, cardOwner: 0, gameState: t.gs }));
      const hero = t.gs.players[wSeite].heroes[v === 'eigen' ? 0 : 0];
      const getaucht = JSON.stringify(hero.buffs || hero._buffs || hero.statuses || {}).includes('submerged') || JSON.stringify(hero).includes('submerged');
      R.check(`${v}: Jump in the River wird gewirkt (Karte in der Ablage von Sitz 0), Held ${wSeite}:0 ist getaucht`, t.pile(0, 'discardPile').includes('Jump in the River') && getaucht, { abl: t.pile(0, 'discardPile'), getaucht });
      R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
    {
      const t = await H.fresh({ hand: [['Jump in the River'], []], deckSize: 30, active: 1 });
      t.setAbilities(1, 0, [['Fighting', 'Fighting'], [], []]);   // Held nur beim Gegner, nicht übernommen
      t.script.push({ match: d => d.type === 'confirm' && d.title === 'Jump in the River', answer: () => ({ confirmed: true }) });
      await t.run(() => jump.hooks.onTurnStart({ isMyTurn: false, _engine: t.engine, cardOwner: 0, gameState: t.gs }));
      R.check('Gegenprobe: Held mit Fighting 2 gehört dem Gegner, nicht übernommen → keine Reaktion', t.pile(0, 'hand').includes('Jump in the River'), t.pile(0, 'discardPile'));
    }
    const dive = H.loadCardEffect('Dive Down');
    for (const v of ['eigen', 'dauerhaft', 'temporaer']) {
      R.section(`Teil 8 (${v}): Dive Down („at the beginning of your opponent's turn while there's at least 1 Area in play“)`);
      const t = await H.fresh({ hand: [['Dive Down'], []], deckSize: 30, active: 1 });
      t.putArea(1, 'Spatial Crevice');
      await wirkerEinrichten(t, v, 0, 1, ['Magic Arts']);
      const wSeite = v === 'eigen' ? 0 : 1;
      t.script.push({ match: d => d.type === 'confirm' && /Dive/.test(d.title || ''), answer: () => ({ confirmed: true }) });
      await t.run(() => dive.hooks.onTurnStart({ isMyTurn: false, _engine: t.engine, cardOwner: 0, gameState: t.gs }));
      const ok = t.pile(0, 'deletedPile').includes('Dive Down') && (t.gs.players[wSeite].heroes[0]._targetBlockers || []).some(b => b.card === 'Dive Down');
      R.check(`${v}: Dive Down wird gewirkt (gelöscht), Held ${wSeite}:0 trägt den Zielschutz`, ok, { del: t.pile(0, 'deletedPile'), bl: t.gs.players[wSeite].heroes[0]._targetBlockers });
      R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
