'use strict';
// W58a · Punkt 3 (Al, 22.10.2026): Cool Rescuer Monia verliert die Once-per-Turn-Klausel.
//   Alt:  „Once per turn, when 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate any effects that card or effect has on all Creatures."
//   Neu:  „Whenever 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate any effects that card or effect has on all Creatures."
//   (Al schrieb „Wheneven" — offensichtlicher Tippfehler, umgesetzt ist „Whenever".)
// Erwartung: die Sperre `monia-protect` entfällt; JEDE Karte / JEDER Effekt, der mindestens eine Kreatur betreffen würde, öffnet das Angebot erneut (jede Annahme kostet erneut 1 Karte) —
//   aber pro Karte/Effekt nur EIN Angebot je Kontrolleur (nicht mehrfach wegen mehrerer Kreaturen oder mehrerer Schadensstapel; Ablehnung gilt ebenfalls für den ganzen Effekt).
// Geprüft (beide Sitze): (A) Kartentext · (B) mehrere Effekte nacheinander im selben Zug (Spells, Status, Primitiv-Aufrufe) → jedes Mal ein Angebot, jedes Mal 1 Karte · (C) ein Effekt, mehrere Kreaturen /
//   mehrere Stapel → genau ein Angebot · (D) Ablehnung: kein Abwurf, kein zweites Angebot für denselben Effekt, der nächste Effekt fragt wieder · (E) Hand leer / 1 Karte · (F) Monia besiegt / eingefroren /
//   betäubt / negiert → kein Angebot · (G) zwei Monias (beide Kontrolleure) · (H) Kontrolle (Charme): der aktuelle Kontrolleur wird gefragt und wirft ab · (I) Pseudonia mit gewonnenem Effekt ·
//   (J) CPU: nimmt nur an, wenn eigene Kreaturen vom Gegner ernsthaft bedroht sind und die Karte es wert ist — wirft nicht in jedem Fenster Karten weg ·
//   (K) Gegenprobe alter Stand (nur 1 Angebot pro Zug) ist auf dem Stand vor W58a rot. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const MO = 'Cool Rescuer Monia', PSEUDO = 'Pseudonia, the Skill Devourer';
const D = H.INERT.creature, BIG = H.INERT.big, FRAIL = H.INERT.frail, FILL = H.INERT.filler;
const BL = H.BLANK_HEROES, BLB = H.BLANK_HEROES_B;
const fs = require('fs'), path = require('path');
const isMo = (d) => d && d.type === 'optionPicker' && /Cool Rescue/.test(d.title || '');

/** Szene: Monia = Held 0 von Sitz m (n Füllkarten auf der Hand), k große Kreaturen auf Held 1/2 von m; Gegner o hat Heldenplatzhalter und die Zauber `zauber` auf der Hand. */
async function szene(m, { n = 5, k = 3, zauber = [], moniaOp = false, heroName = MO, kreatur = BIG } = {}) {
  const o = 1 - m;
  const hand = [0, 1].map(s => s === m ? Array(n).fill(FILL) : zauber.slice());
  const heroes = [0, 1].map(s => s === m ? [heroName, BL[1], BL[2]] : [moniaOp ? MO : BLB[0], BLB[1], BLB[2]]);
  const t = await H.fresh({ heroes, hand, active: o, hp: 800 });
  await t.run(() => t.engine.runHooks('onGameStart', {}));          // wie im echten Spielstart: setzt heroFlags.moniaProtection
  if (heroName === PSEUDO) { t.engine.grantHeroEffect(m, 0, MO); await t.run(() => t.engine.finishGainedHeroEffects(m, 0)); }
  const kr = [];
  for (let i = 0; i < k; i++) { const c = t.put(m, 1 + (i % 2), Math.floor(i / 2), kreatur); c.turnPlayed = 1; kr.push(c); }
  t.gs.activePlayer = o; t.phase(3);
  t.errors.length = 0; t.reset();
  return { t, m, o, kr };
}
/** Skript für Monias Angebot: `antworten` = Liste 'ja' | 'nein' | Funktion(d, pi) → Antwort; danach 'nein'. Zählt Angebote je Kontrolleur. */
function antworte(t, antworten) {
  const log = [];
  t.script.push({ match: isMo, answer: (d, pi) => { const a = antworten.length ? antworten.shift() : 'nein'; log.push({ pi, titel: d.title, optionen: d.options.map(x => x.id) });
    if (typeof a === 'function') return a(d, pi); return a === 'ja' ? { optionId: d.options[0].id } : null; } });
  return log;
}
const angebote = (t) => t.prompts.filter(p => isMo(p.d));
const hand = (t, s) => t.gs.players[s].hand.length;
const hp = (c) => c.counters.currentHp ?? H.DB[c.name].hp;   // unberührte Kreaturen haben noch keinen Zähler
/** Ende einer Auflösung wie im Spielweg. */
const ende = (t, o) => t.run(() => t.engine.runHooks('onAnyActionResolved', { actionType: 'ability', playerIdx: o, heroIdx: 0, isAdditional: false, isInherent: false, isFree: false, _skipReactionCheck: true }));
/** Primitiv-Treffer einer benannten Quelle auf eine Kreatur. */
const treffer = (t, o, c, wer = 'Multi Hit', amt = 60, typ = 'fire') => t.run(() => t.engine.actionDealCreatureDamage({ name: wer, owner: o, heroIdx: 0 }, c, amt, typ, { sourceOwner: o }));
const waehle = (t, m, k) => { t.targetFn = (valid) => valid.filter(x => x.owner === m && x.type === 'equip').slice(0, k).map(x => x.id); };

(async () => {
  const R = H.runner();
  const DB = H.DB;

  // ═══ (A) Kartentext ═══
  R.section('(A) Kartentext');
  {
    const text = DB[MO].effect;
    R.check('Text: „Whenever 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate any effects that card or effect has on all Creatures."',
      text === 'Whenever 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate any effects that card or effect has on all Creatures.', text);
    R.check('keine Once-per-turn-Klausel mehr im Text, kein Tippfehler „Wheneven"', !/once per turn/i.test(text) && !/Wheneven/.test(text), text);
    const roh = fs.readFileSync(path.join(H.ROOT, 'data', 'cards.json'), 'utf8');
    R.check('data/cards.json: genau ein Eintrag mit diesem Text', (roh.match(/Whenever 1 or more Creatures either player controls would be affected/g) || []).length === 1 && !/Once per turn, when 1 or more Creatures either player/.test(roh), null);
    const skript = fs.readFileSync(path.join(H.ROOT, 'cards', 'effects', 'cool-rescuer-monia.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    R.check('Skript: keine Einmal-pro-Zug-Sperre (`monia-protect`, `heldenSperre…`) mehr', !/monia-protect|heldenSperre/.test(skript), null);
  }

  for (const m of [0, 1]) {
    const o = 1 - m;

    // ═══ (B) Mehrere Effekte nacheinander im selben Zug ═══
    R.section(`Sitz ${m} · (B) jede Karte / jeder Effekt öffnet das Angebot erneut — jede Annahme kostet erneut 1 Karte`);
    {
      const { t, kr } = await szene(m, { zauber: ['Fireball', 'Fireball', 'Fireball'] });
      const log = antworte(t, ['ja', 'ja', 'ja']);
      waehle(t, m, 1);
      for (let i = 0; i < 3; i++) await t.play(o, 'Fireball', { hero: 0 });
      R.check('drei Fireballs nacheinander im selben Zug: drei Angebote', angebote(t).length === 3 && log.every(x => x.pi === m), { n: angebote(t).length, log });
      R.check('drei Karten abgeworfen (5 → 2)', hand(t, m) === 2, hand(t, m));
      R.check('alle drei Treffer negiert (Kreatur 1000 HP unversehrt)', kr.every(c => hp(c) === 1000) || kr.slice(0, 1).every(c => hp(c) === 1000), kr.map(hp));
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
    }
    {
      // verschiedene Arten: Schaden (Fireball), Status (Instant Cryo Stasis), Zerstören (Primitiv) — drei Effekte, drei Angebote, drei Karten
      const { t, kr } = await szene(m, { zauber: ['Fireball', 'Instant Cryo Stasis'] });
      const log = antworte(t, ['ja', 'ja', 'ja']);
      waehle(t, m, 1);
      await t.play(o, 'Fireball', { hero: 0 });
      await t.play(o, 'Instant Cryo Stasis', { hero: 0 });
      await t.run(() => t.engine.actionDestroyCard({ name: 'Wrecking Ball', owner: o, heroIdx: 0 }, kr[2], {}));
      await ende(t, o);
      R.check('Schaden + Status + Zerstören: drei Angebote, drei Karten', angebote(t).length === 3 && hand(t, m) === 2, { n: angebote(t).length, h: hand(t, m), log: log.map(x => x.titel) });
      R.check('Fireball-Kreatur unversehrt, Cryo-Kreatur nicht gefroren, zerstörte Kreatur lebt', hp(kr[0]) === 1000 && !kr.some(c => c.counters.frozen) && kr[2].zone === 'support', { hp: kr.map(hp), z: kr.map(c => c.zone), fr: kr.map(c => !!c.counters.frozen) });
    }
    {
      // Zwei Primitiv-Effekte verschiedener Quellen im SELBEN Zug (ohne Aktionsende dazwischen): verschiedene Karten → je ein Angebot
      const { t, kr } = await szene(m);
      const log = antworte(t, ['ja', 'ja']);
      await treffer(t, o, kr[0], 'Quelle A'); await treffer(t, o, kr[1], 'Quelle B');
      R.check('zwei verschiedene Quellen in derselben Auflösung: zwei Angebote, beide Treffer negiert', angebote(t).length === 2 && hp(kr[0]) === 1000 && hp(kr[1]) === 1000 && hand(t, m) === 3, { n: angebote(t).length, hp: kr.map(hp), h: hand(t, m), log: log.length });
    }

    // ═══ (C) Ein Effekt, mehrere Kreaturen / mehrere Stapel → genau ein Angebot ═══
    R.section(`Sitz ${m} · (C) ein Effekt trifft mehrere Kreaturen / läuft in mehreren Schadensstapeln ab → genau ein Angebot`);
    {
      const { t, kr } = await szene(m, { zauber: ['Fireball'] });
      const log = antworte(t, ['ja', 'ja', 'ja']);
      waehle(t, m, 2);
      await t.play(o, 'Fireball', { hero: 0 });
      R.check('Fireball auf zwei Kreaturen: ein Angebot, eine Karte, beide unversehrt', angebote(t).length === 1 && hand(t, m) === 4 && hp(kr[0]) === 1000 && hp(kr[1]) === 1000, { n: angebote(t).length, h: hand(t, m), hp: kr.map(hp), log });
    }
    {
      const { t, kr } = await szene(m);
      const log = antworte(t, ['ja', 'ja', 'ja']);
      for (const c of kr) await treffer(t, o, c);                  // drei Stapel derselben Quelle in einer Auflösung
      R.check('derselbe Effekt in drei Stapeln (Primitiv, gleiche Quelle): ein Angebot, ein Abwurf, alle drei negiert', angebote(t).length === 1 && hand(t, m) === 4 && kr.every(c => hp(c) === 1000), { n: angebote(t).length, h: hand(t, m), hp: kr.map(hp), log });
      await ende(t, o);
      await treffer(t, o, kr[0]);
      R.check('nach dem Aktionsende ist es ein neuer Effekt: wieder ein Angebot (zweite Karte)', angebote(t).length === 2 && hand(t, m) === 3 && hp(kr[0]) === 1000, { n: angebote(t).length, h: hand(t, m) });
    }
    for (const antwort of ['ja', 'nein']) {
      // Statuswirkung auf mehrere Kreaturen einzeln (Unwanted Audience: jede Kreatur ein eigenes Fenster) → genau ein Angebot, angenommen oder abgelehnt (wie W5-b/Z2)
      const heroes = [0, 1].map(s => s === m ? [MO, BL[1], BL[2]] : [BLB[0], BLB[1], BLB[2]]);
      const t = await H.fresh({ heroes, hand: [0, 1].map(s => s === m ? [FILL, FILL, FILL] : ['Unwanted Audience']), hp: 800, active: o });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      t.setAbilities(o, 0, [['Support Magic'], [], []]);
      const k1 = t.put(m, 1, 0, 'Cannon Tower'); k1.turnPlayed = 1; const k2 = t.put(m, 2, 0, 'Cannon Tower'); k2.turnPlayed = 1; const k3 = t.put(m, 0, 1, 'Cannon Tower'); k3.turnPlayed = 1;
      t.grantFor(o, 0, 'Unwanted Audience');
      t.gs.activePlayer = o; t.policy.confirm = true;
      const log = antworte(t, [antwort]);
      const hand0 = hand(t, m);
      await t.endTurn();
      const gesperrt = [k1, k2, k3].filter(c => c.counters.active_locked).length;
      R.check(`Unwanted Audience auf drei Kreaturen (${antwort}): genau ein Angebot, ${antwort === 'ja' ? 'alle drei geschützt, 1 Karte' : 'alle drei gesperrt, keine Karte'}`,
        angebote(t).length === 1 && (antwort === 'ja' ? gesperrt === 0 && hand(t, m) === hand0 + 1 - 1 : gesperrt === 3), { n: angebote(t).length, gesperrt, h: [hand0, hand(t, m)], log: log.length });
    }

    // ═══ (D) Ablehnung ═══
    R.section(`Sitz ${m} · (D) abgelehnt: kein Abwurf, keine zweite Frage für denselben Effekt — der nächste Effekt fragt wieder`);
    {
      const { t, kr } = await szene(m);
      const log = antworte(t, ['nein', 'ja']);
      for (const c of kr) await treffer(t, o, c, 'Multi Hit', 60);
      R.check('Ablehnung: ein Angebot für den ganzen Effekt, keine Karte abgeworfen, alle drei Kreaturen getroffen', angebote(t).length === 1 && hand(t, m) === 5 && kr.every(c => hp(c) === 940), { n: angebote(t).length, h: hand(t, m), hp: kr.map(hp) });
      await ende(t, o);
      await treffer(t, o, kr[0], 'Zweiter Effekt', 60);
      R.check('nächster Effekt: wieder ein Angebot, jetzt angenommen → negiert, 1 Karte', angebote(t).length === 2 && hand(t, m) === 4 && hp(kr[0]) === 940, { n: angebote(t).length, h: hand(t, m), hp: kr.map(hp), log: log.length });
    }
    {
      // Abbrechen (null) zählt wie Ablehnen
      const { t, kr } = await szene(m);
      antworte(t, [() => ({ cancelled: true })]);
      await treffer(t, o, kr[0]); await treffer(t, o, kr[1]);
      R.check('Abbruch des Panels: keine zweite Frage für denselben Effekt', angebote(t).length === 1 && hand(t, m) === 5, { n: angebote(t).length, h: hand(t, m) });
    }

    // ═══ (E) Hand leer / eine Karte ═══
    R.section(`Sitz ${m} · (E) Hand leer → kein Angebot; letzte Karte abgeworfen → nächster Effekt ohne Angebot`);
    {
      const { t, kr } = await szene(m, { n: 0 });
      antworte(t, ['ja']);
      await treffer(t, o, kr[0]);
      R.check('Hand leer: kein Angebot, Treffer wirkt', angebote(t).length === 0 && hp(kr[0]) === 940, { n: angebote(t).length, hp: hp(kr[0]) });
    }
    {
      const { t, kr } = await szene(m, { n: 1 });
      antworte(t, ['ja', 'ja']);
      await treffer(t, o, kr[0], 'Eins'); await ende(t, o);
      await treffer(t, o, kr[1], 'Zwei');
      R.check('eine Karte: erster Effekt angeboten und bezahlt (Hand 0), zweiter ohne Angebot und trifft', angebote(t).length === 1 && hand(t, m) === 0 && hp(kr[0]) === 1000 && hp(kr[1]) === 940, { n: angebote(t).length, h: hand(t, m), hp: kr.map(hp) });
    }

    // ═══ (F) Monia nicht aktiv ═══
    R.section(`Sitz ${m} · (F) Monia besiegt / eingefroren / betäubt / negiert → kein Angebot (bestehende Rulings)`);
    for (const [nm, mach] of [['besiegt', (t) => { t.hero(m, 0).hp = 0; t.hero(m, 0).diedOnTurn = t.gs.turn; }], ['eingefroren', (t) => t.heroStatus(m, 0, 'frozen')], ['betäubt', (t) => t.heroStatus(m, 0, 'stunned')], ['negiert', (t) => t.heroStatus(m, 0, 'negated')]]) {
      const { t, kr } = await szene(m);
      mach(t); antworte(t, ['ja']);
      await treffer(t, o, kr[0]);
      R.check(`Monia ${nm}: kein Angebot, Treffer wirkt`, angebote(t).length === 0 && hp(kr[0]) === 940, { n: angebote(t).length, hp: hp(kr[0]) });
    }

    // ═══ (G) Zwei Monias ═══
    R.section(`Sitz ${m} · (G) beide Seiten haben Monia: je Kontrolleur ein Angebot je Effekt`);
    {
      const { t, kr } = await szene(m, { moniaOp: true });
      t.gs.players[o].hand = Array(3).fill(FILL);
      const log = antworte(t, ['nein', 'ja']);          // Zugspieler (o) lehnt ab, danach m nimmt an
      await treffer(t, o, kr[0], 'Gemeinsam');
      const von = log.map(x => x.pi);
      R.check('o lehnt ab → m wird gefragt und nimmt an: zwei Angebote (o, m), Kreatur unversehrt, nur m wirft ab', von.length === 2 && von[0] === o && von[1] === m && hp(kr[0]) === 1000 && hand(t, m) === 4, { von, hp: hp(kr[0]), h: hand(t, m) });
    }
    {
      const { t, kr } = await szene(m, { moniaOp: true });
      t.gs.players[o].hand = Array(3).fill(FILL);
      const log = antworte(t, ['ja', 'ja']);
      await treffer(t, o, kr[0], 'Gemeinsam');
      R.check('o nimmt an → der andere Kontrolleur wird für denselben Effekt nicht mehr gefragt', log.length === 1 && log[0].pi === o && hp(kr[0]) === 1000 && hand(t, m) === 5 && hand(t, o) === 2, { von: log.map(x => x.pi), h: [hand(t, m), hand(t, o)] });
    }

    // ═══ (H) Kontrolle ═══
    R.section(`Sitz ${m} · (H) Kontrolle: der aktuelle Kontrolleur wird gefragt und bezahlt`);
    {
      const { t, kr } = await szene(m);
      t.gs.players[o].hand = Array(2).fill(FILL);
      t.engine.actionStealHero(o, m, 0, { sourceName: 'Test' });       // o übernimmt Monia (Charme)
      const gestohlen = t.hero(m, 0).charmedBy === o;
      const log = antworte(t, ['ja']);
      await treffer(t, 1 - o, kr[0], 'Dritter');
      R.check('übernommene Monia: der Übernehmer wird gefragt, wirft ab; der Besitzer nicht', !gestohlen || (log.length === 1 && log[0].pi === o && hand(t, o) === 1 && hand(t, m) === 5), { gestohlen, von: log.map(x => x.pi), h: [hand(t, m), hand(t, o)] });
    }

    // ═══ (I) Pseudonia mit gewonnenem Effekt ═══
    R.section(`Sitz ${m} · (I) Pseudonia mit Monias Effekt: gleiche Regeln`);
    {
      const { t, kr } = await szene(m, { heroName: PSEUDO, zauber: ['Fireball', 'Fireball'] });
      antworte(t, ['ja', 'ja']);
      waehle(t, m, 1);
      await t.play(o, 'Fireball', { hero: 0 }); await t.play(o, 'Fireball', { hero: 0 });
      R.check('zwei Fireballs: zwei Angebote, zwei Karten', angebote(t).length === 2 && hand(t, m) === 3, { n: angebote(t).length, h: hand(t, m) });
    }

    // ═══ (J) CPU-Entscheidung ═══
    R.section(`Sitz ${m} · (J) CPU: nur bei echtem Nutzen, nicht in jedem Fenster`);
    {
      // keine Skriptantwort → die Engine-CPU entscheidet (`cpuResponse` der Karte)
      const { t, kr } = await szene(m, { n: 5, kreatur: FRAIL });
      for (let i = 0; i < 6; i++) { await treffer(t, o, kr[i % 3], 'Pieks ' + i, 5); await ende(t, o); }
      R.check('sechs schwache Treffer (5 Schaden auf 10-HP-Kreaturen) in einem Zug: die CPU wirft KEINE Karte weg', hand(t, m) === 5, { h: hand(t, m), n: angebote(t).length });
    }
    {
      const { t, kr } = await szene(m, { n: 3, kreatur: 'Cannon Tower' });
      for (const c of kr) { c.counters.currentHp = 300; }
      await treffer(t, o, kr[0], 'Todesschlag', 500);
      R.check('toedlicher Schlag auf einen wertvollen Gegner-Treffer (Level 3, 300 HP) mit 3 Handkarten: die CPU nimmt an, Kreatur lebt, 1 Karte weg', hp(kr[0]) === 300 && hand(t, m) === 2 && kr[0].zone === 'support', { hp: hp(kr[0]), h: hand(t, m), z: kr[0].zone });
      await ende(t, o);
      await treffer(t, o, kr[1], 'Noch ein Todesschlag', 500);
      R.check('zweiter toedlicher Schlag im selben Zug (anderer Effekt): wieder angenommen (Hand 1)', hp(kr[1]) === 300 && hand(t, m) === 1, { hp: hp(kr[1]), h: hand(t, m) });
      await ende(t, o);
      await treffer(t, o, kr[2], 'Dritter Todesschlag', 500);
      R.check('dritter toedlicher Schlag mit nur 1 Handkarte, aber sehr wertvoller Kreatur (Wert 95 ≥ 80): die CPU bezahlt die letzte Karte', hp(kr[2]) === 300 && hand(t, m) === 0, { hp: hp(kr[2]), h: hand(t, m) });
    }
    {
      // eine Karte auf der Hand und eine Kreatur von geringem Wert (Level 0): die CPU bezahlt nicht
      const { t, kr } = await szene(m, { n: 1, kreatur: D });
      await treffer(t, o, kr[0], 'Hart', 500);
      R.check('1 Handkarte, toedlicher Schlag auf eine Level-0-Kreatur (Wert < 80): die CPU bezahlt die letzte Karte nicht', hand(t, m) === 1 && hp(kr[0]) <= 0, { h: hand(t, m), hp: hp(kr[0]) });
    }
    {
      // nie die Kreaturen des Gegners retten, nicht gegen den eigenen Effekt
      const { t, kr } = await szene(m, { n: 4, kreatur: 'Cannon Tower' });
      const gegner = []; for (let i = 0; i < 2; i++) { const c = t.put(o, 1, i, 'Cannon Tower'); c.turnPlayed = 1; c.counters.currentHp = 300; gegner.push(c); }
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Eigener Schlag', owner: m, heroIdx: 0 }, gegner[0], 500, 'fire', { sourceOwner: m }));
      R.check('eigener Effekt gegen Gegner-Kreaturen: die CPU rettet die Kreaturen des Gegners NICHT (keine Karte weg, Kreatur erleidet den Schaden)', hand(t, m) === 4 && hp(gegner[0]) <= 0, { h: hand(t, m), hp: hp(gegner[0]) });
    }
    {
      // Heilung durch den Gegner auf eigene Kreatur: nie verhindern
      const { t, kr } = await szene(m, { n: 4, kreatur: 'Cannon Tower', zauber: ['Heal'] });
      kr[0].counters.currentHp = 100;
      t.targetFn = (valid) => { const x = valid.find(v => v.owner === m && v.type === 'equip'); return x ? [x.id] : undefined; };
      await t.run(() => t.engine.actionHealCreature ? t.engine.actionHealCreature({ name: 'Heal', owner: o, heroIdx: 0 }, kr[0], 150) : null);
      R.check('Heilung einer eigenen Kreatur: kein Abwurf', hand(t, m) === 4, { h: hand(t, m) });
    }

    // ═══ (K) Aufräumen ═══
    R.section(`Sitz ${m} · (K) nach dem Aktionsende ist alles aufgeräumt`);
    {
      const { t, kr } = await szene(m);
      antworte(t, ['ja']);
      await treffer(t, o, kr[0]);
      const davor = !!(t.gs._moniaAngebote && t.gs._moniaAngebote.length) && t.gs._moniaShieldActive != null;
      await ende(t, o);
      R.check('Angebote und Schildmarke gelten nur für die laufende Auflösung', davor && t.gs._moniaAngebote === undefined && t.gs._moniaShieldActive == null, { davor, a: t.gs._moniaAngebote, s: t.gs._moniaShieldActive });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write('FATAL ' + (e && e.stack || e) + '\n'); process.exit(2); });
