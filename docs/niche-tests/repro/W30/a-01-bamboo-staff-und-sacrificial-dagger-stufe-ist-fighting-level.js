'use strict';
// W30a · Entscheidung Al (21.10.2026, Punkt 1): Bamboo Staff und Sacrificial Dagger haben denselben Text wie Infected Greatmaw („That is treated as that Hero hitting the target with an Attack" /
// „This counts as the equipped Hero hitting that target with an Attack"). Al: „Ja, die kriegen auch das Fighting-Level" → ihre Quellstufe ist das FIGHTING-LEVEL des ausgerüsteten Helden
// (dessen Attack-Stat / Treffer sie nutzen), nicht mehr fix 0 (W27a). Ohne Fighting = 0, bei harter Negierung der Abilities = 0, Fighting-Stapel in Support Zones (Xalibur) zählen.
// Gleicher Mechanismus wie beim Greatmaw (W29a): Stempel `treatedAsAttack: { get level() }` am Treffer-Quellobjekt; in den Zielwahl-/Reaktionsfenstern, in denen die Quelle die Karteninstanz ist,
// liest `_heldenEffektStufe` die Deklaration `treatedAsAttack: { fightingOfHost: true }` (Träger-Fighting-Level).
// Je Gegenstand, Fighting-Level F = 0..3 und Sitz: jeder Leser schützt genau dann, wenn F die Bedingung erfüllt (Stealth Lv1/Lv2, Jetpack 0/1 Kopien, Glass Wall „level 1 or lower", Test Flight
// „lower than the Magic Arts level" [2], Escape Device „equal to or lower than the number of … in your discard pile" [0]). Dazu: der TRÄGER zählt (nicht ein anderer Held), Xalibur-Fighting,
// harte Negierung, Helfer direkt.
// ★ W32a (Al, 22.10.2026): die Gegenprobe „Javelin Throw / Sword in a Bottle / Crusader's bleiben Level 0" ist überholt – ALLGEMEINE REGEL „Zählt als Attack eines Helden = Ability-Level dieses Helden":
// auch diese gelten mit dem Fighting-Level ihres Helden (Al: „Sie nehmen trotzdem das Fighting-Level"); der Helfer-Block unten prüft jetzt das (volle Staffel: `W32/a-01`). Die „harte Negierung der
// Abilities" ist hier die Stowaway-Form (Abilities weg, Held bleibt handlungsfähig): ein hart negierter Held (Standardform) kann nach W32a gar nicht mehr angreifen (Bamboo Staff/Dagger ruhen).
// Aufruf: node docs/niche-tests/repro/W30/a-01-bamboo-staff-und-sacrificial-dagger-stufe-ist-fighting-level.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const JET = 'Future Tech Jetpack', GW = 'Glass Wall', TF = 'Test Flight', ED = 'Future Tech Escape Device';
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const fight = (n) => [Array(n).fill('Fighting'), [], []];

/** Szene: Seat `me` hat den Gegenstand an Held 0 (Fighting F); Gegner-Held 0 trägt den Leser. */
async function szene(item, me, op, leser, o = {}) {
  const F = o.F ?? 0;
  const opHand = leser === TF ? [TF] : leser === ED ? [ED] : [];
  const meDiscard = item === 'Bamboo Staff' ? ['ZZ Filler'] : [];
  const t = await H.fresh({ hand: me === 0 ? [[], opHand] : [opHand, []], discard: me === 0 ? [meDiscard, []] : [[], meDiscard], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
  t.setAbilities(me, 0, fight(F));
  if (o.vorbereiten) o.vorbereiten(t);
  const inst = t.put(me, 0, 0, item);
  let opfer = null;
  if (item === 'Sacrificial Dagger') opfer = t.put(me, 1, 0, H.INERT.creature);
  if (leser === 'Stealth1') t.setAbilities(op, 0, [['Stealth'], [], []]);
  if (leser === 'Stealth2') t.setAbilities(op, 0, [['Stealth', 'Stealth'], [], []]);
  if (leser === 'Jetpack0') t.put(op, 0, 0, JET);
  if (leser === 'Jetpack1') { t.put(op, 0, 0, JET); t.setDiscard(op, [JET]); }
  if (leser === GW) { t.putSurprise(op, 0, GW); t.grantFor(op, 0, GW); }
  if (leser === TF) { t.grantFor(op, 0, TF); t.setAbilities(op, 0, [['Magic Arts', 'Magic Arts'], [], []]); }
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const rec = { quellen: [] };
  const orig = t.engine.actionDealDamage.bind(t.engine);
  t.engine.actionDealDamage = (source, target, amount, type, oo) => { rec.quellen.push({ q: source, type }); return orig(source, target, amount, type, oo); };
  t.targetFn = (v) => {
    const h0 = posHero(v, op, 0), h1 = posHero(v, op, 1);
    rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible;
    return [(rec.angeboten ? h0 : h1).id];
  };
  const hp0 = t.hp(op, 0);
  if (item === 'Bamboo Staff') await t.run(() => t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W30a' }));
  else await t.run(() => t.engine.opfereKreatur(opfer, { name: 'Test', owner: me }));
  return { t, rec, inst, schaden: hp0 - t.hp(op, 0) };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  const LESER = {
    Stealth1: (F) => F <= 1, Stealth2: (F) => F <= 2, Jetpack0: (F) => F <= 0, Jetpack1: (F) => F <= 1,
    [GW]: (F) => F <= 1, [TF]: (F) => F < 2, [ED]: (F) => F <= 0,
  };
  for (const item of ['Bamboo Staff', 'Sacrificial Dagger']) {
    for (const [me, op] of [[0, 1], [1, 0]]) {
      for (const F of [0, 1, 2, 3]) {
        R.section(`${item}, Sitz ${me}: Träger mit Fighting ${F}`);
        const k = await szene(item, me, op, 'keiner', { F });
        R.check('Kontrolle (kein Leser): Gegner-Held 0 wird angeboten und getroffen', k.rec.gefragt && k.rec.angeboten && k.schaden > 0, { rec: k.rec.angeboten, s: k.schaden });
        R.check(`Kontrolle: der Treffer ist ein Attack-Treffer des Helden mit Stufe ${F} (Stempel am Quellobjekt)`,
          k.rec.quellen.length >= 1 && k.rec.quellen.every(({ q, type }) => type === 'attack' && k.t.engine._heldenEffektStufe(q.name, type, q) === F), k.rec.quellen.map(x => [x.q.name, x.type, x.q.treatedAsAttack && x.q.treatedAsAttack.level]));
        R.check(`Kontrolle: Karteninstanz als Quelle (Zielwahl-/Reaktionsfenster) liefert ebenfalls ${F}`, k.t.engine._heldenEffektStufe(item, 'attack', k.inst) === F, k.t.engine._heldenEffektStufe(item, 'attack', k.inst));
        sauber(R, k, 'Kontrolle');
        for (const leser of Object.keys(LESER)) {
          const soll = LESER[leser](F);
          const r = await szene(item, me, op, leser, { F });
          if (leser.startsWith('Stealth')) {
            R.check(`${leser}: ${soll ? 'schützt (Gegner-Held 0 nicht wählbar, kein Schaden)' : 'schützt nicht (Gegner-Held 0 wird getroffen)'}`, soll ? (!r.rec.angeboten && r.schaden === 0) : (r.rec.angeboten && r.schaden > 0), { rec: r.rec.angeboten, s: r.schaden });
          } else if (leser.startsWith('Jetpack')) {
            R.check(`${leser}: ${soll ? 'schützt (nicht wählbar / Treffer prallt ab)' : 'schützt nicht (Treffer landet)'}`, soll ? r.schaden === 0 : r.schaden > 0, { s: r.schaden, rec: r.rec.angeboten });
          } else {
            R.check(`${leser}: ${soll ? 'wird angeboten und wehrt ab' : 'wird nicht angeboten, Treffer landet'}`, soll ? (gefragt(r.t, leser) >= 1 && r.schaden === 0) : (gefragt(r.t, leser) === 0 && r.schaden > 0), { gefragt: gefragt(r.t, leser), s: r.schaden });
          }
          sauber(R, r, leser);
        }
      }
      // Der TRÄGER zählt: Held 0 (Träger) ohne Fighting, Held 1 mit Fighting 3 → Level 0 → Glass Wall wehrt ab
      R.section(`${item}, Sitz ${me}: nur das Fighting-Level des Trägers zählt`);
      {
        const r = await szene(item, me, op, GW, { F: 0, vorbereiten: (t) => t.setAbilities(me, 1, fight(3)) });
        R.check('Träger Fighting 0, anderer Held Fighting 3 → Level 0 → Glass Wall wehrt ab', gefragt(r.t, GW) >= 1 && r.schaden === 0, { g: gefragt(r.t, GW), s: r.schaden });
        const r2 = await szene(item, me, op, GW, { F: 3, vorbereiten: (t) => t.setAbilities(me, 1, fight(0)) });
        R.check('Träger Fighting 3, anderer Held Fighting 0 → Level 3 → Glass Wall bleibt verdeckt, Treffer landet', gefragt(r2.t, GW) === 0 && r2.schaden > 0, { g: gefragt(r2.t, GW), s: r2.schaden });
      }
      // Fighting in Support Zones (Xalibur) zählt; harte Negierung = Level 0
      R.section(`${item}, Sitz ${me}: Fighting-Stapel in der Support Zone / Negierung`);
      for (const [n, soll] of [[1, true], [2, false]]) {
        const r = await szene(item, me, op, GW, { F: 0, vorbereiten: (t) => { t.put(me, 0, 2, 'Xalibur'); t.gs.players[me].supportZones[0][3] = Array(n).fill('Fighting'); } });
        R.check(`Fighting ${n} in der Support Zone: Level ${n} → Glass Wall ${soll ? 'wehrt ab' : 'bleibt verdeckt'}`, soll ? (gefragt(r.t, GW) >= 1 && r.schaden === 0) : (gefragt(r.t, GW) === 0 && r.schaden > 0), { g: gefragt(r.t, GW), s: r.schaden });
        R.check('Support Zone: keine Engine-Fehler', r.t.errors.length === 0, r.t.errors);
      }
      {
        const r = await szene(item, me, op, GW, { F: 3, vorbereiten: (t) => { t.hero(me, 0).statuses.negated = { appliedTurn: 0, _fromAttachment: 'Stowaway', abilitiesNegated: true }; } });
        R.check('Abilities negiert (Stowaway-Form; Fighting 3 zählt nicht) → Level 0 → Glass Wall wehrt ab', gefragt(r.t, GW) >= 1 && r.schaden === 0, { g: gefragt(r.t, GW), s: r.schaden });
        sauber(R, r, 'Negierung');
      }
    }
  }

  // Helfer direkt + Gegenprobe: Gegenstände, deren Text KEINEN Angreifer-Helden nennt, bleiben Level 0
  {
    R.section('Helfer direkt / Gegenprobe');
    const t = await H.fresh({});
    const e = t.engine;
    t.setAbilities(0, 0, fight(3));
    for (const n of ['Bamboo Staff', 'Sacrificial Dagger']) {
      R.check(`${n}: nur der Name (ohne Instanz) → Level 0 (bekannte Untergrenze)`, e._heldenEffektStufe(n, 'attack') === 0, e._heldenEffektStufe(n, 'attack'));
      const inst = t.put(0, 0, 0, n);
      R.check(`${n}: Instanz an Held 0 mit Fighting 3 → 3`, e._heldenEffektStufe(n, 'attack', inst) === 3, e._heldenEffektStufe(n, 'attack', inst));
      R.check(`${n}: Instanz, aber Schadenstyp spell → keine Stufe`, e._heldenEffektStufe(n, 'destruction_spell', inst) === null, e._heldenEffektStufe(n, 'destruction_spell', inst));
    }
    for (const n of ['Javelin Throw', 'Sword in a Bottle', "Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"]) {
      // W32a (Al, 22.10.2026): ebenfalls das Fighting-Level des Helden (hier 3), ohne Held-Bezug (nur der Name) die Untergrenze 0
      R.check(`${n} (W32a: zählt als Attack des Helden): Fighting-Level 3 des Helden 0`, e._heldenEffektStufe(n, 'attack', { name: n, owner: 0, heroIdx: 0, zone: 'support' }) === 3, e._heldenEffektStufe(n, 'attack', { name: n, owner: 0, heroIdx: 0, zone: 'support' }));
      R.check(`${n}: nur der Name (ohne Held) → Untergrenze 0`, e._heldenEffektStufe(n, 'attack') === 0, e._heldenEffektStufe(n, 'attack'));
    }
    const st = e.heldenAngriffStempel(0, 0);
    R.check('heldenAngriffStempel: dynamisch (Fighting 3 → 3, danach negiert → 0)', st.level === 3 && (t.heroStatus(0, 0, 'negated'), st.level === 0), st.level);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
