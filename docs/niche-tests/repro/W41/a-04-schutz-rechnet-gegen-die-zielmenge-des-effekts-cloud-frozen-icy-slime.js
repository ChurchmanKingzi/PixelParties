'use strict';
// W41a · Punkt 4 · Al, 22.10.2026 (Erklärung zur W40a-Rückfrage 4): „Butterfly Cloud und ähnliche Schutz-Effekte sollten keinen Overlap mit Frozen/Stunned haben? Der Clouded-Hero ist solange geschützt,
//  wie sein Beherrscher andere Heroes als mögliche Ziele kontrolliert. Nur, weil ein anderer Hero Frozen ist, ist er trotzdem ein legales Ziel für fast alle Karten. Falls deine Frage sich auf Effekte wie
//  Icy Slime bezieht, die explizit Frozen targets nicht wählen können, DANN hast du recht; es geht nur darum, dass ein gegebener Effekt noch andere Heroes des Cloud-Spielers wählen kann – DANN gilt Cloud, sonst nicht."
// Regel: der Schutz eines Helden (Butterfly Cloud/`untargetable`, Invisibility/`invisible`) gilt nur, solange der konkrete Effekt noch einen ANDEREN Helden desselben Spielers wählen KANN. Frozen/Stunned macht einen Helden
//  nicht zum unmöglichen Ziel (gewöhnliche Spells/Attacks: Cloud schützt weiter); ein Held zählt nur dann NICHT als mögliches Ziel, wenn der Effekt ihn ausdrücklich ausschließt (Icy Slime: keine Frozen-Ziele;
//  Alluring Light: der gezwungene Angreifer muss angreifen können).
// (a) Alluring Light · (b) gewöhnlicher Attack/Spell · (c) Icy Slime · (d) ausgegraute Ziele (`dimUnmetCondition`) · (e) Sword in a Bottle (Listenfilter) · Gegenproben ohne Cloud.
// Exit 1 auf der Basis (a, c-Randfall via dim, e), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W41/a-04-schutz-rechnet-gegen-die-zielmenge-des-effekts-cloud-frozen-icy-slime.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ids = (v) => v.map(x => x.id).sort().join(',');

/** Spielt `karte` von `me`; erfasst die angebotene Liste der ersten Wahl, die Gegnerhelden enthält (`waehlbar` = nicht ausgegraut). */
async function spiele(me, op, karte, aufbau, o = {}) {
  const t = await H.fresh({ hand: me === 0 ? [[karte], []] : [[], [karte]], hp: 800, deckSize: 20, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
  if (aufbau) await aufbau(t);
  const angebot = [];
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v, cfg) => {
    const gegnerHelden = v.filter(x => x.type === 'hero' && x.owner === op);
    if (!gegnerHelden.length) return o.eigene ? o.eigene(v, cfg) : undefined;
    const el = v.filter(x => !x.ineligible);
    angebot.push({ alle: ids(v), waehlbar: ids(el), titel: cfg && cfg.title });
    const w = el.find(x => x.owner === op && x.type === 'hero' && x.heroIdx === (o.waehle ?? 0)) || el.find(x => x.owner === op) || el[0];
    return w ? [w.id] : null;
  };
  const r = await t.play(me, karte, { hero: o.hero ?? 0 });
  return { t, r, angebot, erste: angebot[0] || null };
}
const heroIds = (op, l) => l.map(i => `hero-${op}-${i}`).sort().join(',');

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const hero = (i) => `hero-${op}-${i}`;

    // ── (a) Alluring Light: der Angreifer muss angreifen können ──
    const licht = async (aufbau, o = {}) => {
      const x = await spiele(me, op, 'Alluring Light', async (t) => { t.grantFor(me, 1, 'Alluring Light'); if (aufbau) await aufbau(t); }, { hero: 1, ...o });
      return x;
    };
    for (const schutz of ['untargetable', 'invisible']) {
      for (const status of ['frozen', 'stunned']) {
        // Cloud-Held 0, alle anderen Gegnerhelden nicht angriffsfähig -> der Cloud-Held ist wählbar
        const a = await licht(async (t) => { t.heroStatus(op, 0, schutz); t.heroStatus(op, 1, status); t.heroStatus(op, 2, status); });
        R.check(`(a) ${schutz} auf Held 0, Helden 1+2 ${status}: Held 0 ist der einzige mögliche Angreifer → wählbar, Karte spielbar`, a.r === true && a.erste && a.erste.waehlbar === hero(0), { r: a.r, erste: a.erste });
        // ein weiterer Held (2) kann angreifen -> Cloud schützt Held 0
        const b = await licht(async (t) => { t.heroStatus(op, 0, schutz); t.heroStatus(op, 1, status); });
        R.check(`(a) ${schutz} auf Held 0, Held 1 ${status}, Held 2 frei: Held 0 bleibt unwählbar (es gibt noch einen anderen möglichen Angreifer)`, b.r === true && b.erste && b.erste.waehlbar === hero(2), { r: b.r, erste: b.erste });
        ok(R, `(a) ${schutz}/${status}`, a.t, b.t);
      }
    }
    {   // Gegenprobe ohne Schutz: nur Held 0 angriffsfähig -> Held 0 wählbar (wie vorher)
      const x = await licht(async (t) => { t.heroStatus(op, 1, 'frozen'); t.heroStatus(op, 2, 'stunned'); });
      R.check('(a) Gegenprobe ohne Cloud: nur Held 0 kann angreifen → er ist wählbar', x.r === true && x.erste && x.erste.waehlbar === hero(0), x.erste);
    }
    {   // Cloud-Held kann selbst nicht angreifen (frozen) und ein anderer kann -> der andere ist wählbar, nicht der Cloud-Held
      const x = await licht(async (t) => { t.heroStatus(op, 0, 'untargetable'); t.heroStatus(op, 0, 'frozen'); t.heroStatus(op, 1, 'frozen'); });
      R.check('(a) Cloud-Held selbst eingefroren, Held 2 frei: nur Held 2 wählbar', x.r === true && x.erste && x.erste.waehlbar === hero(2), x.erste);
    }
    {   // alle drei nicht angriffsfähig -> unspielbar
      const x = await licht(async (t) => { t.heroStatus(op, 0, 'untargetable'); for (let i = 0; i < 3; i++) t.heroStatus(op, i, 'frozen'); });
      R.check('(a) kein Gegnerheld kann angreifen: unspielbar, Karte bleibt auf der Hand', x.r === false && x.t.gs.players[me].hand.includes('Alluring Light'), { r: x.r });
    }

    // ── (b) gewöhnlicher Attack / Spell: ein Frozen/Stunned-Held bleibt ein mögliches Ziel → Cloud schützt weiter ──
    for (const [karte, titelTeil] of [['Attack', null], ['Fireball', null]]) {
      for (const status of ['frozen', 'stunned']) {
        const x = await spiele(me, op, karte, async (t) => { t.heroStatus(op, 0, 'untargetable'); t.heroStatus(op, 1, status); t.heroStatus(op, 2, status); }, { waehle: 1 });
        const w = x.erste ? x.erste.waehlbar.split(',').filter(i => i.startsWith('hero-' + op + '-')).sort().join(',') : null;
        R.check(`(b) ${karte}: Held 0 untargetable, Helden 1+2 ${status} → Held 0 bleibt geschützt, die ${status}en Helden sind legale Ziele`, x.erste && w === heroIds(op, [1, 2]), { erste: x.erste });
        ok(R, `(b) ${karte}/${status}`, x.t);
      }
      {   // alle drei untargetable → Schutz bricht zusammen (unverändert)
        const x = await spiele(me, op, karte, async (t) => { for (let i = 0; i < 3; i++) t.heroStatus(op, i, 'untargetable'); });
        const w = x.erste ? x.erste.waehlbar.split(',').filter(i => i.startsWith('hero-' + op + '-')).sort().join(',') : null;
        R.check(`(b) ${karte}: alle drei untargetable → Schutz bricht zusammen, alle wählbar`, x.erste && w === heroIds(op, [0, 1, 2]), { erste: x.erste });
      }
      {   // Gegenprobe ohne Cloud: alles wählbar
        const x = await spiele(me, op, karte, async (t) => { t.heroStatus(op, 1, 'frozen'); });
        const w = x.erste ? x.erste.waehlbar.split(',').filter(i => i.startsWith('hero-' + op + '-')).sort().join(',') : null;
        R.check(`(b) Gegenprobe ${karte} ohne Cloud: alle drei Helden wählbar (auch der gefrorene)`, x.erste && w === heroIds(op, [0, 1, 2]), { erste: x.erste });
      }
    }

    // ── (c) Icy Slime: wählt keine Frozen-Ziele (und keine Immune) → der Held zählt nicht als mögliches Ziel ──
    {
      const slime = async (aufbau) => spiele(me, op, 'Icy Slime', async (t) => { t.grantFor(me, 0, 'Icy Slime'); if (aufbau) await aufbau(t); }, { waehle: 0 });
      const gegner = (x) => x.erste ? x.erste.waehlbar.split(',').filter(i => i.startsWith('hero-' + op)).sort().join(',') : null;
      const a = await slime(async (t) => { t.heroStatus(op, 0, 'untargetable'); t.heroStatus(op, 1, 'frozen'); t.heroStatus(op, 2, 'frozen'); });
      R.check('(c) Icy Slime: Held 0 untargetable, Helden 1+2 schon Frozen → Icy Slime kann sie nicht wählen → Held 0 ist der einzige mögliche Held → wählbar', a.erste && gegner(a) === hero(0), a.erste);
      const b = await slime(async (t) => { t.heroStatus(op, 0, 'untargetable'); t.heroStatus(op, 1, 'frozen'); });
      R.check('(c) Icy Slime: Held 0 untargetable, Held 1 Frozen, Held 2 frei → Held 2 ist ein mögliches Ziel → Held 0 bleibt unwählbar', b.erste && gegner(b) === hero(2), b.erste);
      const c = await slime(async (t) => { t.heroStatus(op, 0, 'untargetable'); });
      R.check('(c) Gegenprobe Icy Slime ohne Frozen: Held 0 geschützt, 1+2 wählbar', c.erste && gegner(c) === heroIds(op, [1, 2]), c.erste);
      const d = await slime(async (t) => { t.heroStatus(op, 1, 'frozen'); });
      R.check('(c) Gegenprobe Icy Slime ohne Cloud: der gefrorene Held 1 ist nicht wählbar, 0 und 2 schon', d.erste && gegner(d) === heroIds(op, [0, 2]), d.erste);
      ok(R, '(c) Icy Slime', a.t, b.t, c.t, d.t);
    }

    // ── (c2) The Warlord's Bite („a target that is not Poisoned yet") und Frost Breaker („a Frozen target"): eigene Zielausschlüsse über `condition` ──
    {
      const gegner = (x) => x.erste ? x.erste.waehlbar.split(',').filter(i => i.startsWith('hero-' + op + '-')).sort().join(',') : null;
      const bite = async (aufbau) => spiele(me, op, "The Warlord's Bite", async (t) => { t.grantFor(me, 0, "The Warlord's Bite"); if (aufbau) await aufbau(t); }, { waehle: 0 });
      const vergifte = (t, i) => t.engine.addHeroStatus(op, i, 'poisoned', { stacks: 1, appliedBy: me });
      const a = await bite(async (t) => { t.heroStatus(op, 0, 'untargetable'); await t.run(() => vergifte(t, 1)); await t.run(() => vergifte(t, 2)); });
      R.check("(c2) Warlord's Bite: Held 0 untargetable, Helden 1+2 schon Poisoned (vom Effekt ausgeschlossen) → Held 0 wählbar", a.erste && gegner(a) === hero(0), a.erste);
      const b = await bite(async (t) => { t.heroStatus(op, 0, 'untargetable'); await t.run(() => vergifte(t, 1)); });
      R.check("(c2) Warlord's Bite: Held 2 noch unvergiftet → Held 0 bleibt geschützt", b.erste && gegner(b) === hero(2), b.erste);
      const fb = async (aufbau) => spiele(me, op, 'Frost Breaker', async (t) => { t.grantFor(me, 0, 'Frost Breaker'); if (aufbau) await aufbau(t); }, { waehle: 0 });
      const c = await fb(async (t) => { t.heroStatus(op, 0, 'untargetable'); t.heroStatus(op, 0, 'frozen'); });
      R.check('(c2) Frost Breaker: nur Held 0 (untargetable) ist Frozen → er ist das einzige mögliche Ziel → wählbar', c.erste && gegner(c) === hero(0), c.erste);
      const d = await fb(async (t) => { t.heroStatus(op, 0, 'untargetable'); t.heroStatus(op, 0, 'frozen'); t.heroStatus(op, 2, 'frozen'); });
      R.check('(c2) Frost Breaker: Held 2 ist auch Frozen (mögliches Ziel) → Held 0 bleibt geschützt', d.erste && gegner(d) === hero(2), d.erste);
      ok(R, '(c2)', a.t, b.t, c.t, d.t);
    }

    // ── (d) ausgegraute Ziele (`dimUnmetCondition`): vom Effekt ausgeschlossene Helden halten den Schutz nicht aufrecht ──
    for (const einzeln of [true, false]) {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me });
      t.heroStatus(op, 0, 'untargetable'); t.heroStatus(op, 1, 'frozen'); if (!einzeln) { /* Held 2 bleibt frei */ } else t.heroStatus(op, 2, 'frozen');
      const quelle = t.put(me, 0, 0, H.INERT.creature);
      const ctx = t.engine._createContext(quelle, {});
      let liste = null;
      t.targetFn = (v) => { liste = v; const el = v.filter(x => !x.ineligible); return el.length ? [el[0].id] : null; };
      await t.run(() => ctx.promptDamageTarget({
        side: 'enemy', types: ['hero'], damageType: 'attack', baseDamage: 10, title: 'ZZ Test', cancellable: true, noSpellCancel: true,
        dimUnmetCondition: true, condition: (tt, eng) => !eng.gs.players[tt.owner].heroes[tt.heroIdx].statuses?.frozen,
      }));
      const waehlbar = liste ? liste.filter(x => !x.ineligible).map(x => x.id).sort().join(',') : null;
      R.check(einzeln ? '(d) dimUnmetCondition: Held 0 untargetable, die beiden anderen vom Effekt ausgegraut (Frozen) → Held 0 wählbar (Schutz fällt)' : '(d) dimUnmetCondition: Held 0 untargetable, Held 1 ausgegraut, Held 2 frei → nur Held 2 wählbar',
        liste && waehlbar === (einzeln ? hero(0) : hero(2)), { waehlbar });
      ok(R, '(d)', t);
    }

    // ── (e) Sword in a Bottle (Listenfilter `heroStatusSchutzFilter`): bereits ausgeschlossene Helden zählen nicht als Ausweichziel ──
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me });
      t.heroStatus(op, 0, 'untargetable');
      const liste = [0, 1, 2].map(i => ({ id: `hero-${op}-${i}`, type: 'hero', owner: op, heroIdx: i, cardName: t.hero(op, i).name }));
      liste[1].ineligible = true; liste[2].ineligible = true;   // vom Effekt ausgeschlossen
      t.engine.heroStatusSchutzFilter(liste, me, [{ type: 'hero', owner: me, heroIdx: 0 }], 'Sword in a Bottle');
      R.check('(e) heroStatusSchutzFilter: Held 0 untargetable, 1 und 2 vom Effekt ausgeschlossen → Held 0 bleibt wählbar', !liste[0].ineligible, liste.map(x => !!x.ineligible));
      const liste2 = [0, 1, 2].map(i => ({ id: `hero-${op}-${i}`, type: 'hero', owner: op, heroIdx: i, cardName: t.hero(op, i).name }));
      liste2[1].ineligible = true;
      t.engine.heroStatusSchutzFilter(liste2, me, [{ type: 'hero', owner: me, heroIdx: 0 }], 'Sword in a Bottle');
      R.check('(e) heroStatusSchutzFilter: Held 2 ist noch wählbar → Held 0 geschützt (ineligible), Held 2 nicht', liste2[0].ineligible === true && !liste2[2].ineligible, liste2.map(x => !!x.ineligible));
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });

function ok(R, id, ...ts) { for (const t of ts) R.check(id + ': keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() }); }
