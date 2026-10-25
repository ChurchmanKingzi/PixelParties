'use strict';
// W71a · Punkt 3 · Al: „Der Ascension-Bonus bei Abilities ist OR, nicht AND (also z. B. 'Attach 3 copies of Fighting or 3 copies of Destruction Magic to this Hero.')"
// Bonus-Felder (cards.json `startingAbility1/2`, Ascended Heroes): zwei Ability-Boni stehen bei Arthor (Fighting 3 / Summoning Magic 3), Taio (Fighting 3 / Destruction Magic 3) [beide implementiert],
//   Champion, the Eye of the Storm (Resistance 3 / Toughness 3) und Fern, the Liberated Fairy (Charme 3 / Friendship 3) [noch ohne Skript]. Alle anderen Ability-Boni sind EINE Ability.
// Erwartet (beide Sitze): bei zwei Ability-Boni wählt der Spieler EINE ("Choose one", Prompt `optionPicker` „Ascension Bonus") — nur diese wird angelegt; Abbruch = keine; ist nur eine Alternative machbar
//   (nur dafür Kopien/Platz), entfällt das Menü und es bleibt beim „Add X?"-Ja/Nein; keine Kopien = still nichts; CPU wählt die Alternative mit den meisten anlegbaren Kopien.
//   Einzel-Ability-Helden: unverändert (nur „Add X?"). Open Invitation / Throne Robber (`skipBonus`/`notAnAscension`): kein Bonus wie bisher.
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const cpu = require(ROOT + '/cards/effects/_cpu');
const TAIO = "Taio, Absorber of the Mountain's Heart";
const ARTHOR = 'Arthor, Inheritor of the Barbarian Sword';
const D = 'ZZ Dummy';
const zonen = (t, s, hi) => (t.gs.players[s].abilityZones[hi] || []).flat();
const anz = (arr, n) => arr.filter(x => x === n).length;
const menues = (t) => t.prompts.filter(p => p.d.type === 'optionPicker' && p.d.title === 'Ascension Bonus');
const fragen = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === 'Ascension Bonus');
(async () => {
  const R = H.runner();

  // ── Statischer Audit: Daten ↔ Skripte ──
  R.section('Audit: Ascended Heroes mit Ability-Bonus (Datenfelder) ↔ Skriptaufrufe');
  const karten = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
  const abil = new Set(karten.filter(k => k.cardType === 'Ability').map(k => k.name));
  const nameZuDatei = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const ohneKomm = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');
  const zweiAbilities = [];
  for (const k of karten.filter(x => x.cardType === 'Ascended Hero')) {
    const felder = [k.startingAbility1, k.startingAbility2].map(s => String(s || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const ab = felder.map(f => { const m = /^(.+?) (\d+)$/.exec(f); return m && abil.has(m[1]) ? m[1] : null; }).filter(Boolean);
    const f = path.join(ROOT, 'cards', 'effects', nameZuDatei(k.name) + '.js');
    const code = fs.existsSync(f) ? ohneKomm(fs.readFileSync(f, 'utf8')) : null;
    if (code) {
      const aufrufe = code.match(/performAscensionBonus\s*\(/g) || [];
      R.check(`${k.name}: höchstens EIN performAscensionBonus-Aufruf (keine UND-Folge aus zwei Aufrufen)`, aufrufe.length <= 1, aufrufe.length);
    }
    if (ab.length >= 2) {
      zweiAbilities.push(k.name);
      if (code) {
        const call = /performAscensionBonus\s*\([^)]*\[([^\]]*)\]/.exec(code);
        R.check(`${k.name}: beide Ability-Boni (${ab.join(' / ')}) stehen als ALTERNATIVEN im selben Aufruf`, !!call && ab.every(n => call[1].includes(`'${n}'`)), call && call[1]);
      }
    }
  }
  R.check('genau die vier erwarteten Helden haben zwei Ability-Boni', JSON.stringify(zweiAbilities.sort()) === JSON.stringify([ARTHOR, 'Champion, the Eye of the Storm', 'Fern, the Liberated Fairy', TAIO].sort()), zweiAbilities);

  const helden = [
    { name: TAIO, a: 'Fighting', b: 'Destruction Magic' },
    { name: ARTHOR, a: 'Fighting', b: 'Summoning Magic' },
  ];
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const h of helden) {
      R.section(`Sitz ${me} · ${h.name}`);
      const mk = async (deck, hand = []) => {
        const t = await H.fresh({ deck: me === 0 ? [deck, []] : [[], deck], hand: me === 0 ? [hand, []] : [[], hand], ...(me ? { active: 1 } : {}) });
        t.setHero(me, 0, h.name, 300);
        return t;
      };
      const bonus = (t) => t.run(() => H.loadCardEffect(h.name).onAscensionBonus(t.engine, me, 0, me));
      const wahlSkript = (t, id) => t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Ascension Bonus', answer: () => (id == null ? { cancelled: true } : { optionId: String(id) }) });
      const deckVoll = () => [h.a, h.a, h.a, h.b, h.b, h.b, D, D];

      // Wahl A
      { const t = await mk(deckVoll()); wahlSkript(t, 0); await bonus(t);
        const m = menues(t);
        R.check('Menü "Choose one" erscheint genau einmal, mit beiden Alternativen (Reihenfolge der Karte)', m.length === 1 && m[0].d.options.length === 2 && m[0].d.options[0].label === h.a && m[0].d.options[1].label === h.b && /Choose one/.test(m[0].d.description) && m[0].d.cancellable === true, m.map(x => x.d));
        R.check(`Wahl A (${h.a}): 3 Kopien ${h.a}, KEINE ${h.b}`, anz(zonen(t, me, 0), h.a) === 3 && anz(zonen(t, me, 0), h.b) === 0, zonen(t, me, 0));
        R.check('kein zusätzliches "Add X?"-Ja/Nein, die ungewählten Kopien bleiben im Deck', fragen(t).length === 0 && anz(t.pile(me, 'mainDeck'), h.b) === 3 && anz(t.pile(me, 'mainDeck'), h.a) === 0, { fragen: fragen(t).length, deck: t.pile(me, 'mainDeck') });
        R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
      // Wahl B
      { const t = await mk(deckVoll()); wahlSkript(t, 1); await bonus(t);
        R.check(`Wahl B (${h.b}): 3 Kopien ${h.b}, KEINE ${h.a}`, anz(zonen(t, me, 0), h.b) === 3 && anz(zonen(t, me, 0), h.a) === 0, zonen(t, me, 0));
        R.check('die ungewählten Kopien bleiben im Deck', anz(t.pile(me, 'mainDeck'), h.a) === 3 && anz(t.pile(me, 'mainDeck'), h.b) === 0, t.pile(me, 'mainDeck'));
        R.check('Protokoll: ascension_bonus nur für die gewählte Ability', t.lg('ascension_bonus').length === 1 && t.lg('ascension_bonus')[0].ability === h.b && t.lg('ascension_bonus')[0].count === 3, t.lg('ascension_bonus')); }
      // Abbruch
      { const t = await mk(deckVoll()); const deckVor = t.pile(me, 'mainDeck').slice(); wahlSkript(t, null); await bonus(t);
        R.check('Abbruch des Menüs: nichts angelegt, Deck unverändert (nicht gemischt)', zonen(t, me, 0).length === 0 && JSON.stringify(t.pile(me, 'mainDeck')) === JSON.stringify(deckVor) && t.lg('ascension_bonus_declined').length === 1, { z: zonen(t, me, 0), declined: t.lg('ascension_bonus_declined') }); }
      // Hand-Kopien zählen mit
      { const t = await mk([D, D], [h.b, h.b]); wahlSkript(t, 0);
        await bonus(t);
        R.check('nur die zweite Alternative machbar (Kopien in der Hand): kein Menü, "Add X?" (Ja) → angelegt', menues(t).length === 0 && fragen(t).length === 1 && /Add /.test(fragen(t)[0].d.message) && anz(zonen(t, me, 0), h.b) === 2, { m: menues(t).length, f: fragen(t).map(x => x.d.message), z: zonen(t, me, 0) }); }
      // nur eine Alternative im Deck, Spieler lehnt ab
      { const t = await mk([h.a, h.a, D]); t.policy.confirm = false;
        await bonus(t);
        R.check('nur eine Alternative machbar, "Add X?" abgelehnt → nichts angelegt', menues(t).length === 0 && fragen(t).length === 1 && zonen(t, me, 0).length === 0, { z: zonen(t, me, 0) }); }
      // keine Kopien
      { const t = await mk([D, D, D]);
        await bonus(t);
        R.check('keine Kopien verfügbar: kein Menü, keine Frage, nichts angelegt, kein Fehler', t.prompts.length === 0 && zonen(t, me, 0).length === 0 && t.errors.length === 0, { p: t.prompts.map(x => x.d.type) }); }
      // Platz: Zonen voll mit drei anderen Abilities -> beide Alternativen nicht machbar
      { const t = await mk(deckVoll()); t.setAbilities(me, 0, [['Wisdom'], ['Leadership'], ['Toughness']]); wahlSkript(t, 0);
        await bonus(t);
        R.check('kein freier Platz (3 fremde Abilities): nichts, kein Menü', menues(t).length === 0 && anz(zonen(t, me, 0), h.a) === 0 && anz(zonen(t, me, 0), h.b) === 0, zonen(t, me, 0)); }
      // Stapel der ersten Alternative schon auf Stufe 3 -> nur die zweite machbar
      { const t = await mk(deckVoll()); t.setAbilities(me, 0, [[h.a, h.a, h.a], [], []]);
        await bonus(t);
        R.check('Alternative A ist schon Lv3: kein Menü, nur B über "Add X?"', menues(t).length === 0 && fragen(t).length === 1 && anz(zonen(t, me, 0), h.b) === 3 && anz(zonen(t, me, 0), h.a) === 3, { z: zonen(t, me, 0) }); }
      // Auffüllen eines vorhandenen Stapels zählt (Stufe 1 -> 3) und die Auswahl lässt A zu
      { const t = await mk(deckVoll()); t.setAbilities(me, 0, [[h.a], [], []]); wahlSkript(t, 0);
        await bonus(t);
        R.check('vorhandener Stapel wird aufgefüllt: Lv1 → Lv3 (2 Kopien aus dem Deck)', anz(zonen(t, me, 0), h.a) === 3 && anz(t.pile(me, 'mainDeck'), h.a) === 1, { z: zonen(t, me, 0), deck: t.pile(me, 'mainDeck') }); }
      // CPU-Wahl (kein Skript): die Alternative mit den meisten anlegbaren Kopien
      { const t = await mk([h.a, h.b, h.b, h.b, D]); t.engine._cpuPlayerIdx = me; cpu.installCpuBrain(t.engine);
        await bonus(t);
        R.check('CPU: 1 Kopie A, 3 Kopien B → wählt B (3 angelegt)', anz(zonen(t, me, 0), h.b) === 3 && anz(zonen(t, me, 0), h.a) === 0, { z: zonen(t, me, 0), m: menues(t).length }); }
      { const t = await mk([h.a, h.a, h.a, h.b, D]); t.engine._cpuPlayerIdx = me; cpu.installCpuBrain(t.engine);
        await bonus(t);
        R.check('CPU: 3 Kopien A, 1 Kopie B → wählt A', anz(zonen(t, me, 0), h.a) === 3 && anz(zonen(t, me, 0), h.b) === 0, { z: zonen(t, me, 0) }); }
      { const t = await mk([h.a, h.a, h.b, h.b, D]); t.setAbilities(me, 0, [[h.b], [], []]); t.engine._cpuPlayerIdx = me; cpu.installCpuBrain(t.engine);
        await bonus(t);
        R.check('CPU Gleichstand (je 2 anlegbar): bevorzugt die Ability, die der Held schon hat', anz(zonen(t, me, 0), h.b) === 3 && anz(zonen(t, me, 0), h.a) === 0, { z: zonen(t, me, 0) }); }
    }

    // ── Echter Aufstieg (performAscension) + Gegenprobe Open Invitation/Throne Robber-Weg ──
    R.section(`Sitz ${me} · echter Aufstieg Taio`);
    {
      const aufstieg = async (opts) => {
        const t = await H.fresh({ deck: me === 0 ? [['Fighting', 'Fighting', 'Fighting', 'Destruction Magic', 'Destruction Magic', 'Destruction Magic', D], []] : [[], ['Fighting', 'Fighting', 'Fighting', 'Destruction Magic', 'Destruction Magic', 'Destruction Magic', D]], hand: me === 0 ? [[TAIO], []] : [[], [TAIO]], ...(me ? { active: 1 } : {}) });
        t.setHero(me, 0, 'Taio, the Sun Fencer', 300);
        t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Ascension Bonus', answer: () => ({ optionId: '1' }) });
        const r = await t.run(() => t.engine.performAscension(me, 0, TAIO, t.pile(me, 'hand').indexOf(TAIO), opts));
        return { t, r };
      };
      { const { t, r } = await aufstieg({ skipCondition: true });
        R.check('Aufstieg mit Bonus: Held ist Taio Absorber, Menü erschien, nur Destruction Magic angelegt (Wahl B)', r && r.success !== false && t.hero(me, 0).name === TAIO && menues(t).length === 1 && anz(zonen(t, me, 0), 'Destruction Magic') === 3 && anz(zonen(t, me, 0), 'Fighting') === 0, { r, name: t.hero(me, 0).name, z: zonen(t, me, 0), m: menues(t).length, e: t.errors }); }
      { const { t, r } = await aufstieg({ skipCondition: true, skipBonus: true });
        R.check('Throne-Robber-/Open-Invitation-Weg (skipBonus): KEIN Bonus, kein Menü, keine Ability angelegt', t.hero(me, 0).name === TAIO && menues(t).length === 0 && fragen(t).length === 0 && zonen(t, me, 0).length === 0, { name: t.hero(me, 0).name, z: zonen(t, me, 0), r }); }
      { const { t, r } = await aufstieg({ skipCondition: true, notAnAscension: true });
        R.check('notAnAscension (Open Invitation): kein Bonus', menues(t).length === 0 && zonen(t, me, 0).length === 0, { z: zonen(t, me, 0), r }); }
    }

    // ── Gegenprobe: Helden mit EINER Ability im Bonus (kein Menü, nur "Add X?") ──
    R.section(`Sitz ${me} · Gegenprobe Einzel-Ability-Helden`);
    for (const [name, a] of [["Kohta, Master of Super-Killing", 'Fighting'], ['Fiona, the Empty Vessel of a Forgotten Sorceress', 'Magic Arts'], ['Rescued Damsel Cecilia', 'Charme'], ['True Fairy Crestina, the Primordial Goddess', 'Wisdom'], ['Monia Bot, the Foretold Rescuer of Coolness', 'Resistance'], ['Molinda, the Cutest Being in the Sky', 'Charme'], ["Layn, Master of Deri's Relic", 'Fighting'], ['Lolek, Mender of the Shattered Trident', 'Fighting'], ['Riffel, Master of the Ultimate Gun', 'Fighting']]) {
      const t = await H.fresh({ deck: me === 0 ? [[a, a, a, D], []] : [[], [a, a, a, D]], ...(me ? { active: 1 } : {}) });
      t.setHero(me, 0, name, 300);
      await t.run(() => H.loadCardEffect(name).onAscensionBonus(t.engine, me, 0, me));
      R.check(`${name}: ${a} ×3 angelegt, nur "Add X?" (kein Menü)`, anz(zonen(t, me, 0), a) === 3 && menues(t).length === 0 && fragen(t).length === 1, { z: zonen(t, me, 0), m: menues(t).length, f: fragen(t).length });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
