'use strict';
// W29a · Entscheidung Al (21.10.2026, Punkt 1): Infected Greatmaw („… deal damage equal to the Attack stat of one of your Heroes to it. That is treated as that Hero hitting the target with
// an Attack.") – „Lv gleich dem Fighting-Level des Heroes". Der Treffer zählt als Attack des gewählten Helden (Schadenstyp bleibt `attack`), seine STUFE ist das Fighting-Level dieses Helden
// (Anzahl seiner Fighting-Abilities, auch Fighting-Stapel in Support Zones laut `effectiveSchoolLevelForCaster`; ohne Fighting oder bei harter Negierung der Abilities = Level 0). Der Stempel
// `treatedAsAttack` am Quellobjekt trägt die Stufe dynamisch; jeder Leser einer Quellstufe sieht sie: Stealth („level N or lower"), Future Tech Jetpack („levels lower than or equal to the number
// of Jetpacks in your discard pile"), Glass Wall („level 1 or lower"), Test Flight („level lower than the Hero's Magic Arts level"), Future Tech Escape Device („level equal to or lower than the
// number of … in your discard pile").
// Je Fighting-Level F = 0..3 und Sitz: jeder Leser schützt genau dann, wenn F die Bedingung erfüllt. Dazu: Heldenwahl (der GEWÄHLTE Held zählt), Fighting in der Support Zone (Xalibur),
// harte Negierung = Level 0, Alliance (Angreifer-Held ist der Wähler, nicht der Wirt der Kreatur), Dive Down.
// Aufruf: node docs/niche-tests/repro/W29/a-01-infected-greatmaw-stufe-ist-fighting-level.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const JET = 'Future Tech Jetpack', GW = 'Glass Wall', TF = 'Test Flight', ED = 'Future Tech Escape Device';
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const fight = (n) => [Array(n).fill('Fighting'), [], []];

/** Szene: Seat `me` hat Infected Greatmaw (Held 0) + Opferkreatur; Angreifer-Held `angreifer` mit Fighting F; Gegner-Held 0 trägt den Leser. */
async function szene(me, op, leser, o = {}) {
  const F = o.F ?? 0, angreifer = o.angreifer ?? 0;
  const opHand = leser === TF ? [TF] : leser === ED ? [ED] : [];
  const t = await H.fresh({ hand: me === 0 ? [[], opHand] : [opHand, []], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
  t.setAbilities(me, angreifer, fight(F));
  if (o.vorbereiten) o.vorbereiten(t);
  const hostHero = o.host ?? 0;
  const g = t.put(me, hostHero, 0, 'Infected Greatmaw'); g.turnPlayed = 1;
  const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1;
  if (leser === 'Stealth1') t.setAbilities(op, 0, [['Stealth'], [], []]);
  if (leser === 'Stealth2') t.setAbilities(op, 0, [['Stealth', 'Stealth'], [], []]);
  if (leser === 'Jetpack0') t.put(op, 0, 0, JET);
  if (leser === 'Jetpack1') { t.put(op, 0, 0, JET); t.setDiscard(op, [JET]); }
  if (leser === GW) { t.putSurprise(op, 0, GW); t.grantFor(op, 0, GW); }
  if (leser === TF) { t.grantFor(op, 0, TF); t.setAbilities(op, 0, [['Magic Arts', 'Magic Arts'], [], []]); }
  if (leser === 'Dive Down') t.engine.addHeroTargetBlocker(op, 0, 'Dive Down', { untilTurn: t.gs.turn });
  if (o.alliance) t.put(o.alliance.seite === 'me' ? me : op, o.alliance.hero ?? 0, 2, 'Alliance', { counters: { allyOwner: o.alliance.seite === 'me' ? op : me, allyHeroIdx: o.alliance.seite === 'me' ? 0 : angreifer } });
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const rec = { quellen: [] };
  const orig = t.engine.actionDealDamage.bind(t.engine);
  t.engine.actionDealDamage = (source, target, amount, type, oo) => { rec.quellen.push({ q: source, type }); return orig(source, target, amount, type, oo); };
  t.targetFn = (v, cfg) => {
    if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
    if (v.every(z => z.owner === me)) return [(posHero(v, me, angreifer) || v[0]).id];   // Angreifer-Held wählen
    const h0 = posHero(v, op, 0), h1 = posHero(v, op, 1);
    rec.gefragt = true; rec.angeboten = !!h0 && !h0.ineligible;
    return [(rec.angeboten ? h0 : h1).id];
  };
  const hp0 = t.hp(op, 0);
  t.phase(2);
  await t.activateCreature(me, hostHero, 0);
  return { t, rec, schaden: hp0 - t.hp(op, 0) };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  // Soll-Tabelle: schützt der Leser bei Fighting-Level F?
  const LESER = {
    Stealth1: (F) => F <= 1, Stealth2: (F) => F <= 2, Jetpack0: (F) => F <= 0, Jetpack1: (F) => F <= 1,
    [GW]: (F) => F <= 1, [TF]: (F) => F < 2, [ED]: (F) => F <= 0,
  };
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const F of [0, 1, 2, 3]) {
      R.section(`Sitz ${me}: Angreifer-Held mit Fighting ${F}`);
      const k = await szene(me, op, 'keiner', { F });
      R.check('Kontrolle (kein Leser): Gegner-Held 0 wird angeboten und getroffen', k.rec.gefragt && k.rec.angeboten && k.schaden > 0, { rec: k.rec.angeboten, s: k.schaden });
      R.check(`Kontrolle: der Treffer ist ein Attack-Treffer des Helden mit Stufe ${F} (Stempel am Quellobjekt)`,
        k.rec.quellen.length >= 1 && k.rec.quellen.every(({ q, type }) => type === 'attack' && k.t.engine._heldenEffektStufe(q.name, type, q) === F), k.rec.quellen.map(x => [x.q.name, x.type, x.q.treatedAsAttack && x.q.treatedAsAttack.level]));
      sauber(R, k, 'Kontrolle');
      for (const leser of Object.keys(LESER)) {
        const soll = LESER[leser](F);
        const r = await szene(me, op, leser, { F });
        if (leser.startsWith('Stealth')) {
          R.check(`${leser}: ${soll ? 'schützt (Gegner-Held 0 nicht wählbar, kein Schaden)' : 'schützt nicht (Gegner-Held 0 wird getroffen)'}`, soll ? (!r.rec.angeboten && r.schaden === 0) : (r.rec.angeboten && r.schaden > 0), { rec: r.rec.angeboten, s: r.schaden });
        } else if (leser.startsWith('Jetpack')) {
          R.check(`${leser}: ${soll ? 'schützt (Treffer prallt ab)' : 'schützt nicht (Treffer landet)'}`, soll ? r.schaden === 0 : r.schaden > 0, { s: r.schaden });
        } else {
          const n = leser === ED ? ED : leser;
          R.check(`${leser}: ${soll ? 'wird angeboten und wehrt ab' : 'wird nicht angeboten, Treffer landet'}`, soll ? (gefragt(r.t, n) >= 1 && r.schaden === 0) : (gefragt(r.t, n) === 0 && r.schaden > 0), { gefragt: gefragt(r.t, n), s: r.schaden });
        }
        sauber(R, r, leser);
      }
    }
  }

  // Heldenwahl: der GEWÄHLTE Held zählt (Held 0: Fighting 0, Held 1: Fighting 2)
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Heldenwahl – der gewählte Held bestimmt die Stufe`);
    for (const [angreifer, glasWallFeuert] of [[0, true], [1, false]]) {
      const r = await szene(me, op, GW, { F: angreifer === 0 ? 0 : 2, angreifer });
      R.check(`Angreifer-Held ${angreifer} (Fighting ${angreifer === 0 ? 0 : 2}): Glass Wall ${glasWallFeuert ? 'wehrt ab' : 'bleibt verdeckt, Treffer landet'}`,
        glasWallFeuert ? (gefragt(r.t, GW) >= 1 && r.schaden === 0) : (gefragt(r.t, GW) === 0 && r.schaden > 0), { g: gefragt(r.t, GW), s: r.schaden });
      sauber(R, r, 'Heldenwahl');
    }
  }

  // Fighting in Support Zones (Xalibur) zählt; harte Negierung der Abilities = Level 0
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Fighting-Stapel in der Support Zone / Negierung`);
    for (const [n, soll] of [[1, true], [2, false]]) {
      const r = await szene(me, op, GW, { F: 0, vorbereiten: (t) => { t.put(me, 0, 1, 'Xalibur'); t.gs.players[me].supportZones[0][2] = Array(n).fill('Fighting'); } });
      R.check(`Fighting ${n} in der Support Zone: Level ${n} → Glass Wall ${soll ? 'wehrt ab' : 'bleibt verdeckt'}`, soll ? (gefragt(r.t, GW) >= 1 && r.schaden === 0) : (gefragt(r.t, GW) === 0 && r.schaden > 0), { g: gefragt(r.t, GW), s: r.schaden });
      R.check('Support Zone: keine Engine-Fehler (der Audit entfällt: der Fighting-Stapel wurde von Hand in die Zone gelegt)', r.t.errors.length === 0, r.t.errors);
    }
    const r = await szene(me, op, GW, { F: 3, vorbereiten: (t) => t.heroStatus(me, 0, 'negated') });
    R.check('Abilities hart negiert (Fighting 3 zählt nicht) → Level 0 → Glass Wall wehrt ab', gefragt(r.t, GW) >= 1 && r.schaden === 0, { g: gefragt(r.t, GW), s: r.schaden });
    sauber(R, r, 'Negierung');
  }

  // Alliance / Dive Down: der Greatmaw-Treffer zählt als Attack; Wähler ist der Angreifer-Held, nicht der Wirt der Kreatur
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Alliance / Dive Down gegen den Greatmaw-Treffer`);
    // Greatmaw liegt bei Held 1, Angreifer ist Held 0; Alliance verbindet Held 0 ↔ Gegner-Held 0
    for (const seite of ['me', 'op']) {
      const r = await szene(me, op, 'keiner', { F: 1, angreifer: 0, host: 1, alliance: { seite, hero: 0 } });
      R.check(`Alliance (Träger ${seite === 'me' ? 'Angreifer-Held 0' : 'Gegner-Held 0'}): Gegner-Held 0 nicht wählbar für den Angreifer-Held 0, auch wenn die Kreatur bei Held 1 liegt`, r.rec.gefragt && !r.rec.angeboten && r.schaden === 0, { rec: r.rec.angeboten, s: r.schaden });
      sauber(R, r, 'Alliance');
    }
    // Alliance verbindet Held 1 (Wirt der Kreatur, nicht der Angreifer) ↔ Gegner-Held 0 → der Angreifer-Held 0 ist nicht betroffen
    {
      const r = await szene(me, op, 'keiner', { F: 1, angreifer: 0, host: 1, vorbereiten: (t) => t.put(me, 1, 2, 'Alliance', { counters: { allyOwner: op, allyHeroIdx: 0 } }) });
      R.check('Alliance an Held 1 (nur Wirt der Kreatur): Angreifer-Held 0 darf Gegner-Held 0 wählen', r.rec.angeboten && r.schaden > 0, { rec: r.rec.angeboten, s: r.schaden });
    }
    {
      const r = await szene(me, op, 'Dive Down', { F: 1 });
      R.check('Dive Down: Gegner-Held 0 nicht wählbar, kein Schaden', r.rec.gefragt && !r.rec.angeboten && r.schaden === 0, { rec: r.rec.angeboten, s: r.schaden });
      sauber(R, r, 'Dive Down');
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
